# Deployment and operations

## Static frontend (Netlify)

1. Connect this repository to a Netlify site and set the build command to `npm run build` and publish directory to `dist` (also specified in `netlify.toml`).
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build environment variables. These are public browser settings; never put a service-role key in a `VITE_` variable.
3. Deploy a separate staging site and point it at a separate Supabase staging project.
4. The Netlify configuration supplies an SPA fallback and CSP/security headers. If using a custom Supabase domain, update `connect-src` and `img-src`, then test the deployed app and signed photo previews.
5. Confirm HTTPS and verify the served headers with the browser network panel or `curl -I`.

## Supabase

1. Create separate staging and production projects. Keep service-role keys in Supabase Edge Function secrets only.
2. Apply migrations in order, including `017_shared_device_pin_lockout.sql`, `018_privacy_account_lifecycle.sql`, `019_in_app_notifications.sql`, and `020_harden_supply_mutations.sql`.
3. Review migration SQL in staging before production. The local workspace has no database credentials, so these migrations have not been executed here.
4. Deploy `delete-account` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and an exact `ALLOWED_ORIGIN` matching the frontend origin. Never add the service-role secret to the static host.
5. Run `supabase/tests/rls_cross_space.sql` with two staging accounts/spaces and test denied reads/writes and each sensitive RPC with both authorized and unauthorized roles. Run `supabase/tests/supply_mutation_authorization.sql` with a non-manager member, a manager, one supply item, and pending/approved requests. Add staging fixtures for every table and Storage object class before calling the RLS check complete.
6. Configure a scheduled job for `purge_expired_task_evidence`; verify retention and storage deletion using test data before enabling photos.

## Environment and seed data

`.env.example` lists browser and optional end-to-end test variables. Keep local `.env.local` and CI secrets out of version control. `supabase/seed.sql` seeds an isolated staging workspace using three existing Auth user IDs; run it only against staging after all migrations. The `/demo` route is a separate, tab-local product demo.

For authenticated end-to-end tests, use a dedicated staging user and a disposable test space. Set `E2E_EMAIL`, `E2E_PASSWORD`, and `E2E_BASE_URL`; never use a real staff account or production records.

## Backups and recovery

Enable Supabase's managed database backups/PITR according to the selected plan. Before migrations, record the current migration version and take a backup/snapshot where the plan permits. Test restoration in staging; a backup is not verified until restored. Storage objects need a separate backup/retention plan.

## Release gate

Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`. E2E auth flows skip without test credentials; a skipped test is not a pass. Complete the manual RLS, storage, account deletion, headers, backup restore, and mobile QA steps in `QA-CHECKLIST.md`.
