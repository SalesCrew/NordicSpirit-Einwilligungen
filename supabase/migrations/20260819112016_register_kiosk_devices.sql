-- Server-managed registry for iPads authorized with the kiosk setup code.
create table if not exists public.kiosk_devices (
  device_id uuid primary key,
  event_id text not null,
  active boolean not null default true,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint kiosk_devices_event_id_length check (char_length(event_id) between 1 and 80)
);

create index if not exists kiosk_devices_event_active_idx
  on public.kiosk_devices (event_id, active);

-- Preserve devices that already completed at least one synchronization before
-- the registry existed. Devices without a completed row must use the setup code.
insert into public.kiosk_devices (device_id, event_id, active, registered_at, last_seen_at)
select distinct on (device_id)
  device_id,
  event_id,
  true,
  min(synced_at) over (partition by device_id),
  max(synced_at) over (partition by device_id)
from public.consent_records
order by device_id, synced_at desc
on conflict (device_id) do nothing;

alter table public.kiosk_devices enable row level security;

-- The browser cannot enumerate or modify registered devices. All access goes
-- through the application server after setup-code or signed-cookie validation.
revoke all on table public.kiosk_devices from public, anon, authenticated, service_role;
grant select, insert, update on table public.kiosk_devices to service_role;
