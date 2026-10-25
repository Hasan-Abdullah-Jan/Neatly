# Final QA checklist

Statuses: **Done** = implemented and verified locally; **Partial** = some pieces exist but requirements remain; **Deferred** = not implemented or requires an external environment.

## Specification sections 5–10

| Section | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 5 | Unique rotatable area QR token and URL | Partial | DB RPC exists; demo has generated local QR links. Print sheet and production end-to-end routes need verification. |
| 5 | Printable QR sheet with names and fallback | Deferred | No production print sheet. |
| 5 | Logged-out/shared-device entry and quick switch | Partial | PIN/session schema and UI exist; PIN lockout is fixed in migration 017 but DB behavior is unverified. |
| 5 | Reach areas without QR; in-app camera scanner/manual entry | Partial | Areas are navigable normally; no full camera/manual scanner flow. |
| 5 | Checklist done / N/A / problem and issue prefill | Partial | Components and schema exist; task screen integration and complete issue prefill require verification. |
| 5 | Optional compressed, EXIF-stripped private evidence | Deferred | Private bucket and metadata flow exist; compression/EXIF stripping and complete upload retry UX are not verified. |
| 5 | Supervisor verify / linked rework / who and when | Partial | RPCs and panel exist; integrated task flow and live DB test are pending. |
| 5 | Wording and healthcare footer | Partial | Some copy complies; perform a full-string review. |
| 5 | Type/size, no public URLs, QR rate limit | Partial | DB/storage policy and QR throttling are in migrations; cross-space/abuse tests need staging. |
| 6 | Catalog, defaults, quantities, thresholds | Partial | Catalog UI/RPCs exist; defaults and all update flows need tests. |
| 6 | Stepper / mark low / no assumed consumption | Partial | UI exists; audit exact quantity semantics in staging. |
| 6 | Replenishment list and purchase records | Partial | UI/RPC exist; database verification pending. |
| 6 | Requests and affected-user notification | Partial | Request lifecycle exists; notifications are not delivered. |
| 6 | History and issue-to-request link | Partial | History is incomplete; issue conversion is not implemented. |
| 6 | User-controlled low-stock reminders | Deferred | No complete notification delivery or disable controls. |
| 7 | Invitations with role, expiry, revoke | Partial | UI/RPC exists; email delivery is deferred and live DB is unverified. |
| 7 | Person/role/area/team assignment; editable teams | Partial | Implemented locally; validate migration and policy behavior. |
| 7 | Away-aware round-robin and contextual workload | Partial | Logic and unit tests exist; database trigger not run in staging. |
| 7 | Swap / inability flow and preserved history | Partial | UI/RPC exists; live behavior unverified. |
| 7 | Task board/comments | Partial | Shared task list and comments exist; no real-time sync. |
| 7 | Manager-only operational view | Partial | Workload role gate exists; audit every field in live organization mode. |
| 7 | Away/pause without penalty | Partial | UI/assignment behavior exists; test against staged membership. |
| 7 | Four-week unequal-load recommendation | Partial | Rule and unit tests exist; not a full recommendation engine. |
| 8 | In-app center, email/push Edge Functions, failures | Partial | Persistent per-user inbox, unread count, read/mark-all-read actions, and recipient RLS are implemented. Domain event generation, email/push delivery, and delivery-failure reporting are not implemented. |
| 8 | Notification types and gentle escalation actions | Deferred | Not implemented end-to-end. |
| 8 | Per-type settings, quiet hours, pause, affected-only | Partial | Preference helpers exist; settings and delivery enforcement incomplete. |
| 8 | Reduce-over-time, flexible consistency, missed-task prompt | Deferred | Not implemented. |
| 8 | Weekly recap, copy review, daily maximum | Deferred | Not implemented. |
| 9 | Task/issue/supply/area history and exports | Partial | Task history exists; privacy export covers caller-associated data; full selected-record CSV/PDF export is absent. |
| 9 | Real-record dashboard and filters | Deferred | No full insights dashboard. |
| 9 | Transparent scheduled/on-demand recommendation rule engine | Partial | Seeded demo recommendation and schema exist; production rules are not implemented. |
| 9 | Accept/edit/dismiss/disable, caps, role visibility | Partial | Demo actions only; production lifecycle remains incomplete. |
| 9 | Before/after trends and causal disclaimer | Deferred | Not implemented. |
| 9 | Unit test every recommendation rule | Deferred | No production rule engine to test. |
| 10A | Plant records, care, cautions, check reminders | Deferred | No plant module. |
| 10A | Conditional suggestions and dismissal controls | Deferred | No plant module. |
| 10B | Simple location inventory, search, photos, warranties | Deferred | No inventory module. |
| 10B | Shared checkout / return | Deferred | No inventory module. |
| 10C | Distinct recurring maintenance calendar and history | Deferred | No maintenance module. |
| 10C | Service assignment for repair issues | Partial | External-service issue assignment exists, but no maintenance calendar. |
| 10D | Small-zone sessions and keep/relocate/donate/recycle/discard | Deferred | No decluttering module. |
| 10D | Completed/repeatedly cluttered zones | Deferred | No decluttering module. |
| 10E | Optional seasonal and sustainable prompts | Deferred | No seasonal prompt system. |

## Level 13 release checklist

| Item | Status | Verification |
|---|---|---|
| RLS on every table; cross-space read/write denial | Partial | Static policies, cross-space smoke-test script, and supply-role RPC regression test exist. Migration 020 blocks member inventory mutations and direct request status updates. No live DB was available; all tables/roles and storage still require staging tests. |
| PIN brute-force lockout persists | Done in code / DB deferred | Migration 017 returns failure results so attempt updates commit; apply and test on staging. |
| Secrets in environment, validation, private storage | Partial | Browser config uses Vite env; Edge service secret is documented. Runtime migration/storage verification remains. |
| Secure headers | Partial | Netlify CSP and standard headers added; verify deployment and custom Supabase host. |
| Dependency audit | Done locally | Run `npm audit` at release time as lockfile can change. |
| Privacy page and JSON/CSV export | Done in code / DB deferred | Caller-scoped export RPC and UI added; migration and access boundaries need live test. |
| Account deletion and audit events | Partial | Edge Function and ownership/anonymization migration added; deploy/configure and test failure/backup/retention cases. Shared issue photos are not uploader-attributed. |
| Photo retention | Partial | Purge RPC exists; scheduled job and storage cleanup require deployment configuration. |
| Unit tests | Partial | Core tests pass; no full permission tests against Postgres. |
| Demo Playwright script / responsive / axe | Done in test code | Run `npm run test:e2e`; axe and 360/390/768 checks are included. |
| Error pages / error monitoring | Partial | Friendly error boundary and device-local, minimal diagnostics. No central monitoring. |
| Static deployment, staging, backups | Partial | Netlify config, Supabase project config, seed, and deployment/backup instructions are present. No hosted projects were provisioned, migration applied, or backup restore verified. |
| Final docs | Done | Architecture, ER overview, role matrix, user guide, cleaner quick-start, deployment, works/deferred, and this QA report. |

## Local checks

- `npm test` — unit suite.
- `npm run build` — strict TypeScript and production bundle.
- `npm run lint` — warnings should be reviewed; do not treat warnings as zero findings.
- `npm run test:e2e` — includes auth-free demo walkthrough and responsive/axe checks; authenticated task/issue tests need dedicated staging credentials.
- `npm audit` — package advisory check.

No live Postgres, hosted headers, staging backup/restore, account deletion, or RLS permission test is claimed as verified from this workspace.
