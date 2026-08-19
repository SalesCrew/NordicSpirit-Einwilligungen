import type { PreparedSubmission, SubmissionMetadata, SubmissionResult } from "@/lib/contracts";
import { toSubmissionMetadata } from "@/lib/contracts";
import {
  getLocalRecord,
  getSyncCandidates,
  markSynced,
  markSyncError,
  markUploading,
} from "@/lib/client/offline-db";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let queueSyncRunning = false;

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Upload fehlgeschlagen";
}

async function postJson<T>(path: string, body: SubmissionMetadata) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: "Upload fehlgeschlagen" })) as { error?: string };
    throw new Error(result.error || `Upload fehlgeschlagen (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function uploadToSignedUrl(url: string, blob: Blob, apiKey: string) {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      apikey: apiKey,
      "cache-control": "max-age=0",
      "content-type": DOCX_MIME,
      "x-upsert": "true",
    },
    body: await blob.arrayBuffer(),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: "Datei-Upload fehlgeschlagen" })) as {
      error?: string;
      message?: string;
    };
    throw new Error(result.message || result.error || `Datei-Upload fehlgeschlagen (${response.status})`);
  }
}

export async function syncRecord(id: string) {
  const record = await markUploading(id);
  if (!record) throw new Error("Lokaler Datensatz wurde nicht gefunden");
  const metadata = toSubmissionMetadata(record);
  const haftungDocx = record.haftungDocx;
  const einwilligungDocx = record.einwilligungDocx;

  if (!haftungDocx || !einwilligungDocx) {
    throw new Error("Lokale Dokumente fehlen");
  }

  try {
    const prepared = await postJson<PreparedSubmission | SubmissionResult>(
      "/api/submissions/prepare",
      metadata,
    );

    let result: SubmissionResult;
    if (prepared.status === "synced") {
      result = prepared;
    } else {
      await Promise.all([
        uploadToSignedUrl(prepared.haftungUploadUrl, haftungDocx, prepared.uploadApiKey),
        uploadToSignedUrl(prepared.einwilligungUploadUrl, einwilligungDocx, prepared.uploadApiKey),
      ]);
      result = await postJson<SubmissionResult>("/api/submissions/complete", metadata);
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
    await markSyncError(id, safeErrorMessage(error));
    throw error;
  }
}

export async function syncPendingRecords(ignoreBackoff = false) {
  if (queueSyncRunning) return;
  queueSyncRunning = true;
  try {
    const records = await getSyncCandidates(ignoreBackoff);
    for (const record of records) {
      try {
        await syncRecord(record.id);
      } catch {
        // The record remains local and carries its own backoff timestamp.
      }
    }
  } finally {
    queueSyncRunning = false;
  }
}
