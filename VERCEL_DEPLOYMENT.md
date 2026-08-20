# Vercel deployment handoff

## Project settings

Import the GitHub repository into Vercel. `vercel.json` already selects Nitro, runs `npm ci` / `npm run build`, uses Node.js 22 through the generated function artifact and places the function in Frankfurt (`fra1`).

- If the repository begins with this application's `package.json`, leave **Root Directory** empty.
- If the repository contains this application inside an `app` subfolder, set **Root Directory** to `app`.
- Do not set an Output Directory override. Nitro generates `.vercel/output` in Vercel's Build Output API format.

## Environment variables

Add these variables in **Project → Settings → Environment Variables**.

| Variable | Value | Exposure |
|---|---|---|
| `NEXT_PUBLIC_EVENT_ID` | `frequency-2026` | Public/build-time |
| `NEXT_PUBLIC_APP_VERSION` | `2026.1.1` | Public/build-time |
| `NEXT_PUBLIC_TEMPLATE_HAFTUNG_VERSION` | `2026-08-18` | Public/build-time |
| `NEXT_PUBLIC_TEMPLATE_EINWILLIGUNG_VERSION` | `2026-08-18` | Public/build-time |
| `NEXT_PUBLIC_PRIVACY_NOTICE_VERSION` | `2026-08-20.1` | Public/build-time |
| `EVENT_ID` | `frequency-2026` | Server-only configuration |
| `SUPABASE_URL` | `https://muqirsxlsfwslovdeawa.supabase.co` | Server-only configuration |
| `SUPABASE_SECRET_KEY` | Copy the active `sb_secret_...` value from Supabase **Project Settings → API Keys → Secret keys** | **Sensitive/server-only** |
| `SUPABASE_BUCKET` | `frequency-2026-consents` | Server-only configuration |
| `KIOSK_SETUP_CODE` | A new long random code used once at `/setup` on each authorized iPad | **Sensitive/server-only** |
| `KIOSK_SESSION_SECRET` | A new random value containing at least 32 random bytes | **Sensitive/server-only** |

Set the five `NEXT_PUBLIC_*` variables for both Preview and Production so previews render the correct document versions. Keep the three sensitive values scoped to Production. If a preview needs a real upload test, scope those secrets only to the specific protected acceptance branch rather than every preview branch. `SUPABASE_PUBLISHABLE_KEY` is no longer required because document uploads are proxied through the authenticated server route.

Generate suitable secrets locally in PowerShell without committing them:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(16)).ToLowerInvariant()
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Use the first output for `KIOSK_SETUP_CODE` and the second for `KIOSK_SESSION_SECRET`.

## Manual acceptance after deployment

1. Open `/api/health`; expect `{"ready":true}`.
2. Open `/setup`, enter `KIOSK_SETUP_CODE`, and confirm the device reports as configured.
3. Select “Nein” for photo/video. Confirm the participation-requirement dialog appears, continuation is blocked, and no local or Supabase record is created.
4. Select “Auswahl ändern”, choose “Ja”, and complete one test consent online.
5. In Supabase, verify one `consent_records` row and exactly two DOCX objects under the same submission UUID.
6. Enable airplane mode and complete another consent; confirm it remains pending under `/setup`.
7. Close and reopen the installed Home Screen app while still offline.
8. Restore connectivity, run synchronization, and verify the pending record reaches Supabase exactly once.
9. Open both generated DOCX files and visually verify the name, dates, consent choice and signature placement.

Do not enter real participant data until the organizational/legal approvals in `BACKEND_SETUP.md` are complete.

## Contractual privacy requirement

The Vercel DPA current on 19 August 2026 applies to Pro and Enterprise plans. The responsible organization must ensure that the selected Vercel plan is covered by that DPA, document Vercel's subprocessors and transfer safeguards, and complete the Art. 28 review before real participant data is processed. Selecting Frankfurt for the Function reduces latency but does not by itself guarantee that every Vercel processing activity remains inside the EEA.
