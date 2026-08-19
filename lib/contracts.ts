export const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID ?? "frequency-2026";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "2026.1.1";
export const LIABILITY_TEMPLATE_VERSION =
  process.env.NEXT_PUBLIC_TEMPLATE_HAFTUNG_VERSION ?? "2026-08-18";
export const CONSENT_TEMPLATE_VERSION =
  process.env.NEXT_PUBLIC_TEMPLATE_EINWILLIGUNG_VERSION ?? "2026-08-18";
export const PRIVACY_NOTICE_VERSION =
  process.env.NEXT_PUBLIC_PRIVACY_NOTICE_VERSION ?? "2026-08-19.2";

export type LocalSyncState = "pending" | "uploading" | "synced" | "error";

export interface ConsentSourceData {
  fullName: string;
  birthDate: string;
  signedDate: string;
  readConfirmed: true;
  privacyAcknowledged: true;
  privacyNoticeVersion: string;
  privacyAcknowledgedAtClient: string;
  photoChoice: "yes";
  signatureDataUrl: string;
}

export interface SubmissionMetadata {
  id: string;
  eventId: string;
  deviceId: string;
  createdAtClient: string;
  signedOn: string;
  templateHaftungVersion: string;
  templateEinwilligungVersion: string;
  privacyNoticeVersion: string;
  privacyAcknowledgedAtClient: string;
  photoChoiceHaftung: "yes";
  haftungSha256: string;
  einwilligungSha256: string;
  appVersion: string;
}

export interface LocalConsentRecord extends SubmissionMetadata {
  source: ConsentSourceData | null;
  signaturePng: Blob | null;
  haftungDocx: Blob | null;
  einwilligungDocx: Blob | null;
  syncState: LocalSyncState;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  syncedAt: string | null;
  haftungPath: string | null;
  einwilligungPath: string | null;
  updatedAt: string;
}

export interface SubmissionResult {
  id: string;
  status: "synced";
  syncedAt: string;
  haftungPath: string;
  einwilligungPath: string;
  haftungSha256: string;
  einwilligungSha256: string;
}

export interface PreparedSubmission {
  status: "upload";
  id: string;
  haftungPath: string;
  einwilligungPath: string;
  haftungUploadUrl: string;
  einwilligungUploadUrl: string;
}

export function toSubmissionMetadata(record: LocalConsentRecord): SubmissionMetadata {
  return {
    id: record.id,
    eventId: record.eventId,
    deviceId: record.deviceId,
    createdAtClient: record.createdAtClient,
    signedOn: record.signedOn,
    templateHaftungVersion: record.templateHaftungVersion,
    templateEinwilligungVersion: record.templateEinwilligungVersion,
    privacyNoticeVersion: record.privacyNoticeVersion,
    privacyAcknowledgedAtClient: record.privacyAcknowledgedAtClient,
    photoChoiceHaftung: record.photoChoiceHaftung,
    haftungSha256: record.haftungSha256,
    einwilligungSha256: record.einwilligungSha256,
    appVersion: record.appVersion,
  };
}
