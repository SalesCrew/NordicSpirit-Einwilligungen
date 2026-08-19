import type { LocalConsentRecord, SubmissionResult } from "@/lib/contracts";

const DB_NAME = "frequency-consent-queue";
const DB_VERSION = 1;
const SUBMISSIONS = "submissions";
const SETTINGS = "settings";

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SUBMISSIONS)) {
        const store = database.createObjectStore(SUBMISSIONS, { keyPath: "id" });
        store.createIndex("syncState", "syncState", { unique: false });
        store.createIndex("createdAtClient", "createdAtClient", { unique: false });
      }
      if (!database.objectStoreNames.contains(SETTINGS)) {
        database.createObjectStore(SETTINGS, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened"));
  });
}

export async function getOrCreateDeviceId() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SETTINGS, "readwrite");
    const store = transaction.objectStore(SETTINGS);
    const existing = await requestResult<{ key: string; value: string } | undefined>(store.get("deviceId"));
    if (existing?.value) {
      transaction.commit?.();
      await transactionDone(transaction);
      return existing.value;
    }
    const deviceId = crypto.randomUUID();
    store.put({ key: "deviceId", value: deviceId });
    await transactionDone(transaction);
    return deviceId;
  } finally {
    database.close();
  }
}

export async function saveLocalRecord(record: LocalConsentRecord) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SUBMISSIONS, "readwrite");
    transaction.objectStore(SUBMISSIONS).put(record);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getLocalRecord(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SUBMISSIONS, "readonly");
    const result = await requestResult<LocalConsentRecord | undefined>(
      transaction.objectStore(SUBMISSIONS).get(id),
    );
    await transactionDone(transaction);
    return result ?? null;
  } finally {
    database.close();
  }
}

export async function getSyncCandidates(ignoreBackoff = false) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SUBMISSIONS, "readonly");
    const records = await requestResult<LocalConsentRecord[]>(transaction.objectStore(SUBMISSIONS).getAll());
    await transactionDone(transaction);
    const now = Date.now();
    return records
      .filter((record) => record.syncState !== "synced")
      .filter((record) => ignoreBackoff || !record.nextRetryAt || Date.parse(record.nextRetryAt) <= now)
      .sort((left, right) => left.createdAtClient.localeCompare(right.createdAtClient));
  } finally {
    database.close();
  }
}

export async function markUploading(id: string) {
  const record = await getLocalRecord(id);
  if (!record) return null;
  record.syncState = "uploading";
  record.updatedAt = new Date().toISOString();
  await saveLocalRecord(record);
  return record;
}

export async function markSynced(id: string, result: SubmissionResult) {
  const record = await getLocalRecord(id);
  if (!record) return;
  record.syncState = "synced";
  record.syncedAt = result.syncedAt;
  record.haftungPath = result.haftungPath;
  record.einwilligungPath = result.einwilligungPath;
  record.nextRetryAt = null;
  record.lastError = null;
  // The verified cloud documents are the evidence copy. Remove all directly
  // identifying source material from the shared festival iPad immediately.
  record.source = null;
  record.signaturePng = null;
  record.haftungDocx = null;
  record.einwilligungDocx = null;
  record.updatedAt = new Date().toISOString();
  await saveLocalRecord(record);
}

export async function markSyncError(id: string, message: string) {
  const record = await getLocalRecord(id);
  if (!record) return;
  const retryCount = record.retryCount + 1;
  const delay = Math.min(5 * 60_000, 5_000 * 2 ** Math.min(retryCount - 1, 6));
  record.syncState = "error";
  record.retryCount = retryCount;
  record.lastError = message.slice(0, 240);
  record.nextRetryAt = new Date(Date.now() + delay).toISOString();
  record.updatedAt = new Date().toISOString();
  await saveLocalRecord(record);
}

export async function getQueueCounts() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SUBMISSIONS, "readonly");
    const records = await requestResult<LocalConsentRecord[]>(transaction.objectStore(SUBMISSIONS).getAll());
    await transactionDone(transaction);
    return records.reduce(
      (counts, record) => {
        counts[record.syncState] += 1;
        return counts;
      },
      { pending: 0, uploading: 0, synced: 0, error: 0 },
    );
  } finally {
    database.close();
  }
}

export async function getLastSuccessfulSync() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SUBMISSIONS, "readonly");
    const records = await requestResult<LocalConsentRecord[]>(transaction.objectStore(SUBMISSIONS).getAll());
    await transactionDone(transaction);
    return records
      .map((record) => record.syncedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
  } finally {
    database.close();
  }
}

export function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) throw new Error("Invalid signature image");
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}
