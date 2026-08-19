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
    "public/sw.js",
  ];
  await Promise.all(paths.map((path) => readFile(new URL(path, root), "utf8")));
});

test("the application rejects submissions without mandatory photo consent", async () => {
  const validation = await readFile(new URL("lib/server/validation.ts", root), "utf8");
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(validation, /parsed\.photoChoiceHaftung !== "yes"/);
  assert.match(page, /photoChoice === "yes"/);
  assert.match(page, /Teilnahmevoraussetzung Foto/);
  assert.doesNotMatch(page, /Du kannst trotzdem an/);
});
