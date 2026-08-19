-- Initial backend for the isolated project muqirsxlsfwslovdeawa.
-- Browser roles intentionally receive no table or bucket policy access.

create table if not exists public.consent_records (
  id uuid primary key,
  event_id text not null,
  device_id uuid not null,
  created_at_client timestamptz not null,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  signed_on date not null,
  retention_until date not null default date '2029-08-22',
  legal_hold boolean not null default false,
  template_haftung_version text not null,
  template_einwilligung_version text not null,
  privacy_notice_version text not null,
  privacy_acknowledged_at_client timestamptz not null,
  photo_choice_haftung text not null,
  haftung_path text not null unique,
  einwilligung_path text not null unique,
  haftung_sha256 text not null,
  einwilligung_sha256 text not null,
  haftung_size_bytes bigint not null,
  einwilligung_size_bytes bigint not null,
  app_version text not null,
  constraint consent_records_event_id_length check (char_length(event_id) between 1 and 80),
  constraint consent_records_retention_after_signature check (retention_until >= signed_on),
  constraint consent_records_privacy_version_length check (char_length(privacy_notice_version) between 1 and 80),
  constraint consent_records_photo_choice check (photo_choice_haftung in ('yes', 'no')),
  constraint consent_records_haftung_hash check (haftung_sha256 ~ '^[0-9a-f]{64}$'),
  constraint consent_records_einwilligung_hash check (einwilligung_sha256 ~ '^[0-9a-f]{64}$'),
  constraint consent_records_haftung_size check (haftung_size_bytes > 0 and haftung_size_bytes <= 12582912),
  constraint consent_records_einwilligung_size check (einwilligung_size_bytes > 0 and einwilligung_size_bytes <= 12582912)
);

create index if not exists consent_records_event_signed_idx
  on public.consent_records (event_id, signed_on desc);

create index if not exists consent_records_device_synced_idx
  on public.consent_records (device_id, synced_at desc);

create index if not exists consent_records_retention_due_idx
  on public.consent_records (retention_until)
  where legal_hold = false;

alter table public.consent_records enable row level security;

revoke all on table public.consent_records from public, anon, authenticated, service_role;
grant select, insert on table public.consent_records to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'frequency-2026-consents',
  'frequency-2026-consents',
  false,
  12582912,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are created for anon/authenticated. Uploads use
-- short-lived, object-specific URLs minted by the trusted application server.
