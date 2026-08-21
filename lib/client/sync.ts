import type {
  LocalConsentRecord,
  PreparedSubmission,
  StoredDocument,
  SubmissionMetadata,
  SubmissionResult,
} from "@/lib/contracts";
import { toSubmissionMetadata } from "@/lib/contracts";
import {
  getLocalRecord,
  getSyncCandidates,
  markSynced,
  markSyncError,
  markUploading,
  saveLocalRecord,
} from "@/lib/client/offline-db";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const REQUEST_TIMEOUT_MS = 45_000;
const DOCUMENT_REBUILD_TIMEOUT_MS = 60_000;

let queueSyncRunning = false;

export type SyncFailureKind = "network" | "setup-required" | "remote" | "local-document";

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly kind: SyncFailureKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export interface QueueSyncResult {
  attempted: number;
  synced: number;
  failed: number;
  lastError: string | null;
}

export interface QueueSyncProgress extends QueueSyncResult {
  total: number;
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Upload fehlgeschlagen";
}

async function requestWithTimeout(
  path: string,
  init: RequestInit,
  unavailableMessage: string,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new SyncError("Zeitüberschreitung beim Serverzugriff", "network"));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      fetch(path, { ...init, signal: controller.signal }),
      deadline,
    ]);
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError(unavailableMessage, "network");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function withDeadline<T>(promise: Promise<T>, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new SyncError(message, "local-document")),
      DOCUMENT_REBUILD_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function postJson<T>(path: string, body: SubmissionMetadata) {
  const response = await requestWithTimeout(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  }, "Der Server ist derzeit nicht erreichbar");
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: "Upload fehlgeschlagen" })) as { error?: string };
    if (response.status === 401 || response.status === 403) {
      throw new SyncError(
        "Dieses iPad ist nicht freigeschaltet oder die Gerätesitzung ist abgelaufen",
        "setup-required",
        response.status,
      );
    }
    throw new SyncError(result.error || `Upload fehlgeschlagen (${response.status})`, "remote", response.status);
  }
  return response.json() as Promise<T>;
}

async function uploadToAppServer(url: string, document: StoredDocument) {
  const response = await requestWithTimeout(url, {
    method: "PUT",
    headers: {
      "content-type": DOCX_MIME,
    },
    body: document,
    cache: "no-store",
    credentials: "same-origin",
  }, "Der Upload-Server ist derzeit nicht erreichbar");
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: "Datei-Upload fehlgeschlagen" })) as {
      error?: string;
      message?: string;
    };
    throw new SyncError(
      result.message || result.error || `Datei-Upload fehlgeschlagen (${response.status})`,
      "remote",
      response.status,
    );
  }
}

function localDocuments(record: LocalConsentRecord) {
  if (!record.haftungDocx || !record.einwilligungDocx) {
    throw new SyncError("Lokale Dokumente fehlen", "local-document");
  }
  return {
    haftung: record.haftungDocx,
    einwilligung: record.einwilligungDocx,
  };
}

function containsLegacyBlob(documents: ReturnType<typeof localDocuments>) {
  return documents.haftung instanceof Blob || documents.einwilligung instanceof Blob;
}

async function regenerateQueuedDocuments(record: LocalConsentRecord) {
  if (!record.source) {
    throw new SyncError(
      "Die lokale Dokumentdatei ist beschädigt und kann nicht wiederhergestellt werden",
      "local-document",
    );
  }
  try {
    const documents = await withDeadline(
      import("@/lib/client/document-generator").then(({ generateConsentDocuments }) => (
        generateConsentDocuments(record.source!)
      )),
      "Zeitüberschreitung beim Wiederherstellen der lokalen Dokumente",
    );
    const [haftungBytes, einwilligungBytes] = await withDeadline(
      Promise.all([
        documents.haftungDocx.arrayBuffer(),
        documents.einwilligungDocx.arrayBuffer(),
      ]),
      "Die lokalen Dokumente konnten nicht gelesen werden",
    );
    record.haftungDocx = haftungBytes;
    record.einwilligungDocx = einwilligungBytes;
    record.haftungSha256 = documents.haftungSha256;
    record.einwilligungSha256 = documents.einwilligungSha256;
    record.lastError = null;
    record.nextRetryAt = null;
    record.updatedAt = new Date().toISOString();
    await saveLocalRecord(record);
    return record;
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError(
      `Lokale Dokumente konnten nicht wiederhergestellt werden: ${safeErrorMessage(error)}`,
      "local-document",
    );
  }
}

async function findCommittedSubmission(id: string) {
  try {
    const response = await requestWithTimeout(`/api/submissions/${encodeURIComponent(id)}`, {
      cache: "no-store",
      credentials: "same-origin",
    }, "Der Server ist derzeit nicht erreichbar");
    if (!response.ok) return null;
    const result = await response.json() as Partial<SubmissionResult>;
    if (
      result.id !== id ||
      result.status !== "synced" ||
      typeof result.syncedAt !== "string" ||
      typeof result.haftungPath !== "string" ||
      typeof result.einwilligungPath !== "string" ||
      typeof result.haftungSha256 !== "string" ||
      typeof result.einwilligungSha256 !== "string"
    ) {
      return null;
    }
    return result as SubmissionResult;
  } catch {
    return null;
  }
}

export async function syncRecord(id: string) {
  const record = await markUploading(id);
  if (!record) throw new Error("Lokaler Datensatz wurde nicht gefunden");

  try {
    let activeRecord = record;
    let metadata = toSubmissionMetadata(activeRecord);
    let documents = localDocuments(activeRecord);
    let prepared = await postJson<PreparedSubmission | SubmissionResult>(
      "/api/submissions/prepare",
      metadata,
    );

    let result: SubmissionResult;
    if (prepared.status === "synced") {
      result = prepared;
    } else {
      // Older iPad records persisted Blob handles in IndexedDB. WebKit can leave
      // those handles unreadable after an offline restart, so rebuild them from
      // the retained form source before attempting the network request.
      if (containsLegacyBlob(documents) && activeRecord.source) {
        activeRecord = await regenerateQueuedDocuments(activeRecord);
        metadata = toSubmissionMetadata(activeRecord);
        documents = localDocuments(activeRecord);
        prepared = await postJson<PreparedSubmission | SubmissionResult>(
          "/api/submissions/prepare",
          metadata,
        );
      }

      if (prepared.status === "synced") {
        result = prepared;
      } else {
        await uploadToAppServer(prepared.haftungUploadUrl, documents.haftung);
        await uploadToAppServer(prepared.einwilligungUploadUrl, documents.einwilligung);
        result = await postJson<SubmissionResult>("/api/submissions/complete", metadata);
      }
    }

    const latest = await getLocalRecord(id);
    if (
      !latest ||
      result.status !== "synced" ||
      result.haftungSha256 !== latest.haftungSha256 ||
      result.einwilligungSha256 !== latest.einwilligungSha256
    ) {
      throw new Error("Upload konnte nicht verifiziert werden");
    }
    await markSynced(id, result);
    return result;
  } catch (error) {
    const committed = await findCommittedSubmission(id);
    const latest = await getLocalRecord(id);
    if (
      committed &&
      latest &&
      committed.haftungSha256 === latest.haftungSha256 &&
      committed.einwilligungSha256 === latest.einwilligungSha256
    ) {
      await markSynced(id, committed);
      return committed;
    }
    await markSyncError(id, safeErrorMessage(error));
    throw error;
  }
}

export async function syncPendingRecords(
  ignoreBackoff = false,
  onProgress?: (progress: QueueSyncProgress) => void,
) {
  if (queueSyncRunning) return null;
  queueSyncRunning = true;
  const result: QueueSyncResult = { attempted: 0, synced: 0, failed: 0, lastError: null };
  try {
    const records = await getSyncCandidates(ignoreBackoff);
    for (const record of records) {
      result.attempted += 1;
      try {
        await syncRecord(record.id);
        result.synced += 1;
      } catch (error) {
        result.failed += 1;
        result.lastError = safeErrorMessage(error);
      }
      onProgress?.({ ...result, total: records.length });
    }
    return result;
  } finally {
    queueSyncRunning = false;
  }
}
