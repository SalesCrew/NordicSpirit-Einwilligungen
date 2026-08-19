import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Supabase schema keeps consent metadata private and idempotent", async () => {
  const schema = await readFile(new URL("supabase/schema.sql", root), "utf8");
  assert.match(schema, /create table if not exists public\.consent_records/);
  assert.match(schema, /id uuid primary key/);
  assert.match(schema, /alter table public\.consent_records enable row level security/);
  assert.match(schema, /privacy_notice_version text not null/);
  assert.match(schema, /privacy_acknowledged_at_client timestamptz not null/);
  assert.match(schema, /photo_choice_haftung in \('yes', 'no'\)/);
  assert.match(schema, /retention_until date not null default date '2029-08-22'/);
  assert.match(schema, /legal_hold boolean not null default false/);
  assert.match(schema, /revoke all on table public\.consent_records from public, anon, authenticated, service_role/);
  assert.match(schema, /grant select, insert on table public\.consent_records to service_role/);
  assert.match(schema, /false,\s*12582912/);
  assert.doesNotMatch(schema, /full_name|birth_date|signature_png/i);
});

test("integrated submission endpoints and offline worker are present", async () => {
  const paths = [
    "app/api/device/session/route.ts",
    "app/api/health/route.ts",
    "app/api/submissions/prepare/route.ts",
    "app/api/submissions/complete/route.ts",
    "app/api/submissions/[id]/route.ts",
    "app/api/submissions/[id]/documents/[kind]/route.ts",
    "public/sw.js",
  ];
  await Promise.all(paths.map((path) => readFile(new URL(path, root), "utf8")));
});

test("the offline worker cannot activate with a partial or stale build shell", async () => {
  const worker = await readFile(new URL("public/sw.js", root), "utf8");
  const client = await readFile(new URL("lib/client/pwa.ts", root), "utf8");

  assert.match(worker, /frequency-consent-shell-v13/);
  assert.match(client, /frequency-consent-shell-v13/);
  assert.match(worker, /\/assets\/frequency-finish-background\.png/);
  assert.match(client, /\/assets\/frequency-finish-background\.png/);
  assert.match(worker, /BUILD_ASSET_PREFIX = "\/_next\/static\/"/);
  assert.match(worker, /url\.pathname\.startsWith\(BUILD_ASSET_PREFIX\)/);
  assert.match(worker, /Promise\.all\(urls\.map\(\(url\) => cache\.add\(url\)\)\)/);
  const installHandler = worker.slice(
    worker.indexOf('self.addEventListener("install"'),
    worker.indexOf('self.addEventListener("activate"'),
  );
  assert.doesNotMatch(installHandler, /cache\.add\(url\)\.catch\(\(\) => undefined\)/);
  assert.match(client, /updateViaCache: "none"/);
  assert.match(client, /registration\.update\(\)\.catch/);
});

test("the landing action activates directly from an iPad touch", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const styles = await readFile(new URL("app/globals.css", root), "utf8");

  assert.match(page, /onTouchEnd=\{\(event\) => \{/);
  assert.match(page, /event\.preventDefault\(\);\s*goTo\("liability"\);/);
  assert.match(styles, /@media \(any-pointer: coarse\)/);
  assert.match(styles, /\.start-button:hover span \{ transform: none; \}/);
});

test("the kiosk setup is visible, required online, and reports synchronization failures", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const setup = await readFile(new URL("app/setup/page.tsx", root), "utf8");
  const sync = await readFile(new URL("lib/client/sync.ts", root), "utf8");

  assert.match(setup, /type=\{showSetupCode \? "text" : "password"\}/);
  assert.match(setup, /Setup-Code anzeigen/);
  assert.match(setup, /Synchronisierung beendet:/);
  assert.match(setup, /Synchronisierung läuft:/);
  assert.match(setup, /iPad freigeschaltet ✓/);
  assert.match(setup, /disabled=\{working \|\| !configured\}/);
  assert.match(setup, /Freischaltung konnte auf diesem iPad nicht gespeichert werden/);
  assert.match(page, /window\.location\.replace\("\/setup"\)/);
  assert.match(page, /className="setup-hotspot"/);
  assert.match(setup, /className="setup-app-link"/);
  assert.match(setup, /window\.location\.replace\("\/"\)/);
  assert.match(sync, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(sync, /findCommittedSubmission/);
  assert.match(sync, /committed\.haftungSha256 === latest\.haftungSha256/);
});

test("iPad uploads use the same-origin server proxy instead of direct Storage requests", async () => {
  const sync = await readFile(new URL("lib/client/sync.ts", root), "utf8");
  const server = await readFile(new URL("lib/server/supabase.ts", root), "utf8");
  const offlineDatabase = await readFile(new URL("lib/client/offline-db.ts", root), "utf8");
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(sync, /uploadToAppServer/);
  assert.match(sync, /credentials: "same-origin"/);
  assert.match(sync, /body: document/);
  assert.doesNotMatch(sync, /body: await blob\.arrayBuffer\(\)/);
  assert.match(sync, /REQUEST_TIMEOUT_MS/);
  assert.match(sync, /regenerateQueuedDocuments/);
  assert.match(sync, /containsLegacyBlob/);
  assert.match(offlineDatabase, /INDEXED_DB_TIMEOUT_MS/);
  assert.match(page, /documents\.haftungDocx\.arrayBuffer\(\)/);
  assert.match(page, /haftungDocx,\s*einwilligungDocx,/);
  assert.doesNotMatch(sync, /uploadApiKey|uploadToSignedUrl/);
  assert.match(server, /uploadSubmissionDocument/);
  assert.match(server, /method: "POST"/);
  assert.match(server, /"x-upsert": "true"/);
  assert.doesNotMatch(server, /createSignedUploadUrl/);
});

test("Supabase failures remain in the background after a durable local save", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /await saveLocalRecord\(record\)/);
  assert.match(page, /void syncRecord\(id\)\.catch\(\(\) => undefined\)/);
  assert.doesNotMatch(page, /Lokal speichern &amp; fortfahren/);
  assert.doesNotMatch(page, /Synchronisierung fehlgeschlagen/);
});

test("the application rejects submissions without mandatory photo consent", async () => {
  const validation = await readFile(new URL("lib/server/validation.ts", root), "utf8");
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(validation, /parsed\.photoChoiceHaftung !== "yes"/);
  assert.match(page, /photoChoice === "yes"/);
  assert.match(page, /Teilnahmevoraussetzung Foto/);
  assert.doesNotMatch(page, /Du kannst trotzdem an/);
});
