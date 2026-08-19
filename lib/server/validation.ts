import type { SubmissionMetadata } from "@/lib/contracts";
import { getServerEventId } from "@/lib/server/env";
import { validDeviceId } from "@/lib/server/kiosk-session";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHA_PATTERN = /^[0-9a-f]{64}$/;

function nonEmpty(value: unknown, maxLength = 120): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export async function parseSubmissionMetadata(value: unknown): Promise<SubmissionMetadata> {
  const parsed = value as Partial<SubmissionMetadata>;
  if (
    !nonEmpty(parsed.id) ||
    !UUID_PATTERN.test(parsed.id) ||
    !nonEmpty(parsed.deviceId) ||
    !validDeviceId(parsed.deviceId) ||
    parsed.eventId !== await getServerEventId() ||
    !nonEmpty(parsed.createdAtClient) ||
    !Number.isFinite(Date.parse(parsed.createdAtClient)) ||
    !nonEmpty(parsed.signedOn) ||
    !DATE_PATTERN.test(parsed.signedOn) ||
    (parsed.photoChoiceHaftung !== "yes" && parsed.photoChoiceHaftung !== "no") ||
    !nonEmpty(parsed.templateHaftungVersion) ||
    !nonEmpty(parsed.templateEinwilligungVersion) ||
    !nonEmpty(parsed.privacyNoticeVersion) ||
    !nonEmpty(parsed.privacyAcknowledgedAtClient) ||
    !Number.isFinite(Date.parse(parsed.privacyAcknowledgedAtClient)) ||
    !nonEmpty(parsed.appVersion) ||
    !nonEmpty(parsed.haftungSha256) ||
    !SHA_PATTERN.test(parsed.haftungSha256) ||
    !nonEmpty(parsed.einwilligungSha256) ||
    !SHA_PATTERN.test(parsed.einwilligungSha256)
  ) {
    throw new Error("Invalid metadata");
  }
  return parsed as SubmissionMetadata;
}

export async function sha256(file: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
