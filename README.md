# Digitale Einwilligungen Nordic Spirit

Full-stack iPad web app for the Frequency Festival 2026 “Geh ma steil” consent flow.

The browser generates both completed DOCX files, stores unfinished submissions in IndexedDB and synchronizes them through the integrated API routes. Supabase stores the private documents and the non-identifying verification metadata. The app is prepared for one Vercel deployment; no separate backend service is required.

## Runtime

- React 19 and TypeScript
- Vinext with the Nitro Vercel adapter
- Vercel Functions on Node.js 22 in Frankfurt (`fra1`)
- Supabase project `muqirsxlsfwslovdeawa` in `eu-central-1`
- Private Supabase Storage bucket `frequency-2026-consents`

## Local commands

```bash
npm ci
npm run dev
npm run build
npm test
```

`npm run build` creates the Vercel Build Output API artifact under `.vercel/output`.

## Deployment

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for the exact Vercel settings, environment variables and manual acceptance checklist.

The database migration is in `supabase/migrations/20260818000000_initial_consent_backend.sql` and has already been applied to the dedicated Supabase project.

## Security boundary

`SUPABASE_SECRET_KEY`, `KIOSK_SETUP_CODE` and `KIOSK_SESSION_SECRET` are server-only secrets. Never commit them and never prefix them with `NEXT_PUBLIC_`. The browser receives only an object-specific, short-lived signed upload URL and the publishable Supabase key.

The technical implementation does not replace the organizational/legal approvals listed in [BACKEND_SETUP.md](./BACKEND_SETUP.md).
