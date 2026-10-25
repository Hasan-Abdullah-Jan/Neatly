# What works and what is not built yet

## Locally implemented

- Authenticated core app, onboarding, personal/organization spaces, areas, task routines, history, issues, and undo flows.
- Supplies UI and request flow; Level 7 teams, invitations, assignments, rotation, swaps, away mode, comments, workload, and rebalancing suggestions.
- Level 5 QR/evidence/checklist/verification schemas and components. Some task-page integration and live database flows remain incomplete.
- Standalone guided demo at `/demo`; tab-local data; simulated actions; reset; demo QR links. It never writes to Supabase.
- In-app notification inbox UI, unread count, read state, and recipient-scoped persistence are implemented locally. Notification event generation and delivery integrations are not wired.
- Privacy JSON/CSV export through a caller-scoped RPC, self-service audit entries, local account deletion UI, Edge Function source, and local error boundary.
- Ordered database migrations, a cross-space RLS smoke-test script, Netlify security headers, and deploy/QA documentation.

## Not built, incomplete, or not verified

- Levels 8, 9, and 10A–10E are not complete. Level 8 has an in-app inbox and preference scaffolding, but no event delivery, email/push, or habit system; Level 9 does not have the full insights/export/recommendation engine; Level 10 domain modules are absent.
- Full Level 5 end-to-end integration and all Level 6 history/reminder behaviors are incomplete.
- Demo workflows are sample client state, not production data or authorization tests. QR scanning in the demo is a link/simulation, not camera access.
- No live Supabase project is connected here. Migrations, RLS, cross-space isolation, account deletion, private Storage, and Edge Functions have not been executed against Postgres.
- Account deletion requires deploying the Edge Function and migrations. The function preserves shared operational records, removes isolated personal spaces, transfers organization ownership when possible, and may report a conflict if no replacement owner/member can be found. Shared issue photos cannot be reliably attributed to an uploader in the present schema and are not deleted by the function.
- Evidence retention cleanup is available as a database function but must be scheduled in the deployed project; settings alone do not run a job.
- Error diagnostics stay on the device for the tab session. There is no central error monitoring service.
- Hosted production/staging environments, backups, and managed secrets have not been provisioned from this workspace.
