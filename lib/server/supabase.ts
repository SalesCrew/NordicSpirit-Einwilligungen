import type {
  PreparedSubmission,
  SubmissionMetadata,
  SubmissionResult,
} from "@/lib/contracts";
import { ConfigurationError, getServerEventId, getSupabaseConfig } from "@/lib/server/env";
import { sha256 } from "@/lib/server/validation";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_DOCUMENT_SIZE = 12 * 1024 * 1024;

export type SubmissionDocumentKind = "haftung" | "einwilligung";

export class SupabaseRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SupabaseRequestError";
  }
}

interface ConsentRow {
  id: string;
  device_id: string;
  synced_at: string;
  privacy_notice_version: string;
  privacy_acknowledged_at_client: string;
  photo_choice_haftung: "yes";
  haftung_path: string;
  einwilligung_path: string;
  haftung_sha256: string;
  einwilligung_sha256: string;
}

function encodeObjectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function requestSupabase(path: string, init: RequestInit = {}) {
  const { url, secretKey } = await getSupabaseConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(`${url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: secretKey,
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new SupabaseRequestError(503, "Supabase is not reachable");
  } finally {
    clearTimeout(timeout);
  }
}

async function requireSuccess(response: Response, operation: string) {
  if (response.ok) return response;
  const detail = (await response.text()).slice(0, 300);
  throw new SupabaseRequestError(response.status, `${operation} failed${detail ? `: ${detail}` : ""}`);
}

async function findRecord(id: string): Promise<ConsentRow | null> {
  const select = "id,device_id,synced_at,privacy_notice_version,privacy_acknowledged_at_client,photo_choice_haftung,haftung_path,einwilligung_path,haftung_sha256,einwilligung_sha256";
  const response = await requireSuccess(
    await requestSupabase(`/rest/v1/consent_records?id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`, {
      headers: { Accept: "application/json" },
    }),
    "Metadata lookup",
  );
  const rows = (await response.json()) as ConsentRow[];
  return rows[0] ?? null;
}

function rowToResult(row: ConsentRow): SubmissionResult {
  return {
    id: row.id,
    status: "synced",
    syncedAt: row.synced_at,
    haftungPath: row.haftung_path,
    einwilligungPath: row.einwilligung_path,
    haftungSha256: row.haftung_sha256,
    einwilligungSha256: row.einwilligung_sha256,
  };
}

function pathsFor(metadata: SubmissionMetadata) {
  const base = `${metadata.eventId}/${metadata.deviceId}/${metadata.id}`;
  return {
    haftungPath: `${base}/haftungsausschluss.docx`,
    einwilligungPath: `${base}/foto-video-entscheidung.docx`,
  };
}

async function downloadDocument(path: string) {
  const { bucket } = await getSupabaseConfig();
  const response = await requireSuccess(
    await requestSupabase(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(path)}`),
    "Uploaded document verification",
  );
  const document = await response.blob();
  if (document.size === 0 || document.size > MAX_DOCUMENT_SIZE) {
    throw new SupabaseRequestError(422, "Uploaded document size is invalid");
  }
  return document;
}

function assertExistingMatches(existing: ConsentRow, metadata: SubmissionMetadata) {
  const existingPrivacyTimestamp = Date.parse(existing.privacy_acknowledged_at_client);
  const submittedPrivacyTimestamp = Date.parse(metadata.privacyAcknowledgedAtClient);
  if (
    existing.device_id !== metadata.deviceId ||
    existing.privacy_notice_version !== metadata.privacyNoticeVersion ||
    !Number.isFinite(existingPrivacyTimestamp) ||
    existingPrivacyTimestamp !== submittedPrivacyTimestamp ||
    existing.photo_choice_haftung !== metadata.photoChoiceHaftung ||
    existing.haftung_sha256 !== metadata.haftungSha256 ||
    existing.einwilligung_sha256 !== metadata.einwilligungSha256
  ) {
    throw new SupabaseRequestError(409, "Record ID already exists with different contents");
  }
}

export async function prepareSubmission(
  metadata: SubmissionMetadata,
): Promise<PreparedSubmission | SubmissionResult> {
  const existing = await findRecord(metadata.id);
  if (existing) {
    assertExistingMatches(existing, metadata);
    return rowToResult(existing);
  }
  const { haftungPath, einwilligungPath } = pathsFor(metadata);
  return {
    status: "upload",
    id: metadata.id,
    haftungPath,
    einwilligungPath,
    haftungUploadUrl: `/api/submissions/${encodeURIComponent(metadata.id)}/documents/haftung`,
    einwilligungUploadUrl: `/api/submissions/${encodeURIComponent(metadata.id)}/documents/einwilligung`,
  };
}

export async function uploadSubmissionDocument(
  id: string,
  deviceId: string,
  kind: SubmissionDocumentKind,
  document: Blob,
) {
  if (document.size === 0 || document.size > MAX_DOCUMENT_SIZE) {
    throw new SupabaseRequestError(422, "Uploaded document size is invalid");
  }
  const eventId = await getServerEventId();
  const filename = kind === "haftung"
    ? "haftungsausschluss.docx"
    : "foto-video-entscheidung.docx";
  const path = `${eventId}/${deviceId}/${id}/${filename}`;
  const { bucket } = await getSupabaseConfig();
  await requireSuccess(
    await requestSupabase(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(path)}`, {
      method: "POST",
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": DOCX_MIME,
        "x-upsert": "true",
      },
      body: await document.arrayBuffer(),
    }),
    "Document upload",
  );
  return path;
}

export async function completeSubmission(metadata: SubmissionMetadata): Promise<SubmissionResult> {
  const existing = await findRecord(metadata.id);
  if (existing) {
    assertExistingMatches(existing, metadata);
    return rowToResult(existing);
  }

  const { haftungPath, einwilligungPath } = pathsFor(metadata);
  const [haftungDocument, einwilligungDocument] = await Promise.all([
    downloadDocument(haftungPath),
    downloadDocument(einwilligungPath),
  ]);
  const [haftungHash, einwilligungHash] = await Promise.all([
    sha256(haftungDocument),
    sha256(einwilligungDocument),
  ]);
  if (haftungHash !== metadata.haftungSha256 || einwilligungHash !== metadata.einwilligungSha256) {
    throw new SupabaseRequestError(422, "Uploaded document hash mismatch");
  }

  const now = new Date().toISOString();
  const row = {
    id: metadata.id,
    event_id: metadata.eventId,
    device_id: metadata.deviceId,
    created_at_client: metadata.createdAtClient,
    synced_at: now,
    updated_at: now,
    signed_on: metadata.signedOn,
    template_haftung_version: metadata.templateHaftungVersion,
    template_einwilligung_version: metadata.templateEinwilligungVersion,
    privacy_notice_version: metadata.privacyNoticeVersion,
    privacy_acknowledged_at_client: metadata.privacyAcknowledgedAtClient,
    photo_choice_haftung: metadata.photoChoiceHaftung,
    haftung_path: haftungPath,
    einwilligung_path: einwilligungPath,
    haftung_sha256: metadata.haftungSha256,
    einwilligung_sha256: metadata.einwilligungSha256,
    haftung_size_bytes: haftungDocument.size,
    einwilligung_size_bytes: einwilligungDocument.size,
    app_version: metadata.appVersion,
  };

  await requireSuccess(
    await requestSupabase("/rest/v1/consent_records?on_conflict=id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    }),
    "Metadata write",
  );

  const verified = await findRecord(metadata.id);
  if (verified) assertExistingMatches(verified, metadata);
  if (
    !verified ||
    verified.haftung_path !== haftungPath ||
    verified.einwilligung_path !== einwilligungPath ||
    verified.haftung_sha256 !== metadata.haftungSha256 ||
    verified.einwilligung_sha256 !== metadata.einwilligungSha256
  ) {
    throw new SupabaseRequestError(502, "Upload verification failed");
  }
  return rowToResult(verified);
}

export async function getSubmission(id: string, deviceId: string) {
  const record = await findRecord(id);
  if (!record || record.device_id !== deviceId) return null;
  return rowToResult(record);
}

export async function checkSupabaseHealth() {
  await requireSuccess(
    await requestSupabase("/rest/v1/consent_records?select=id&limit=1", {
      headers: { Accept: "application/json" },
    }),
    "Health check",
  );
}
