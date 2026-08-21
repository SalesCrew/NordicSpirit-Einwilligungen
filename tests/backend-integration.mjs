import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

const appUrl = process.env.TEST_APP_URL || "http://127.0.0.1:3012";
const mockUrl = process.env.MOCK_SUPABASE_URL || "http://127.0.0.1:54321";
const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const deviceId = randomUUID();
const id = randomUUID();
const sessionResponse = await fetch(`${appUrl}/api/device/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ deviceId, setupCode: "test-code" }),
});
assert.equal(sessionResponse.status, 200);
let cookie = sessionResponse.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(cookie, "setup response must set a kiosk cookie");

const registeredSession = await fetch(`${appUrl}/api/device/session`, { headers: { cookie } });
assert.equal(registeredSession.status, 200);
assert.equal((await registeredSession.json()).configured, true);

await fetch(`${mockUrl}/__devices/${deviceId}`, { method: "DELETE" });
const staleSession = await fetch(`${appUrl}/api/device/session`, { headers: { cookie } });
assert.equal(staleSession.status, 200);
assert.equal((await staleSession.json()).configured, false);
assert.match(staleSession.headers.get("set-cookie") || "", /Max-Age=0/);

const reactivationResponse = await fetch(`${appUrl}/api/device/session`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ deviceId, setupCode: "test-code" }),
});
assert.equal(reactivationResponse.status, 200);
cookie = reactivationResponse.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(cookie, "reactivation response must set a kiosk cookie");

function metadataFor(haftungBytes, einwilligungBytes, recordId = id, photoChoice = "yes") {
  return {
    id: recordId,
    eventId: "frequency-2026",
    deviceId,
    createdAtClient: new Date().toISOString(),
    signedOn: "2026-08-18",
    templateHaftungVersion: "2026-08-18",
    templateEinwilligungVersion: "2026-08-18",
    privacyNoticeVersion: "2026-08-20.1",
    privacyAcknowledgedAtClient: "2026-08-19T12:00:00.000Z",
    photoChoiceHaftung: photoChoice,
    haftungSha256: hash(haftungBytes),
    einwilligungSha256: hash(einwilligungBytes),
    appVersion: "test",
  };
}

async function post(path, metadata) {
  return fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(metadata),
  });
}

async function submit(haftungBytes, einwilligungBytes, recordId = id, photoChoice = "yes") {
  const metadata = {
    ...metadataFor(haftungBytes, einwilligungBytes, recordId, photoChoice),
  };
  const preparation = await post("/api/submissions/prepare", metadata);
  if (preparation.status !== 200) return preparation;
  const prepared = await preparation.json();
  if (prepared.status === "synced") {
    return new Response(JSON.stringify(prepared), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }
  assert.equal(prepared.haftungUploadUrl.startsWith("/api/submissions/"), true);
  assert.equal(prepared.einwilligungUploadUrl.startsWith("/api/submissions/"), true);
  assert.equal("uploadApiKey" in prepared, false);
  const uploadHeaders = {
    cookie,
    "cache-control": "no-store",
    "content-type": mime,
  };
  const haftungUpload = await fetch(new URL(prepared.haftungUploadUrl, appUrl), {
    method: "PUT",
    headers: uploadHeaders,
    body: haftungBytes,
  });
  const einwilligungUpload = await fetch(new URL(prepared.einwilligungUploadUrl, appUrl), {
    method: "PUT",
    headers: uploadHeaders,
    body: einwilligungBytes,
  });
  assert.equal(haftungUpload.status, 201, await haftungUpload.clone().text());
  assert.equal(einwilligungUpload.status, 201, await einwilligungUpload.clone().text());
  return post("/api/submissions/complete", metadata);
}

const haftungFixture = Buffer.alloc(1_300_000, 31);
const einwilligungFixture = Buffer.alloc(700_000, 47);
const first = await submit(haftungFixture, einwilligungFixture);
assert.equal(first.status, 201, await first.clone().text());
const firstBody = await first.json();
assert.equal(firstBody.status, "synced");
assert.equal(firstBody.id, id);

const lookup = await fetch(`${appUrl}/api/submissions/${id}`, { headers: { cookie } });
assert.equal(lookup.status, 200);
assert.equal((await lookup.json()).id, id);

const duplicate = await submit(haftungFixture, einwilligungFixture);
assert.equal(duplicate.status, 201);

const conflict = await submit(Buffer.from("different-docx-one"), Buffer.from("different-docx-two"));
assert.equal(conflict.status, 409);

const noConsent = await post(
  "/api/submissions/prepare",
  metadataFor(
    Buffer.alloc(1_300_000, 51),
    Buffer.alloc(400_000, 67),
    randomUUID(),
    "no",
  ),
);
assert.equal(noConsent.status, 400, await noConsent.clone().text());

const state = await (await fetch(`${mockUrl}/__state`)).json();
assert.equal(state.devices.length, 1);
assert.equal(state.devices[0].device_id, deviceId);
assert.equal(state.devices[0].active, true);
assert.equal(state.records.length, 1);
assert.ok(state.records.every((record) => record.photo_choice_haftung === "yes"));
assert.ok(state.records.every((record) => record.privacy_notice_version === "2026-08-20.1"));
assert.equal(state.uploads.length, 2);
assert.ok(state.uploads.every((upload) => upload.size > 0));

process.stdout.write("backend integration: ok\n");
