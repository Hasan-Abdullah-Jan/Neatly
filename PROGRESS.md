# Neatly — Development Progress

Last updated: 2026-10-25

## Status at a glance

| Level | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: scaffold, design system, auth, app shell, schema, RLS, PWA | Built — with the caveats below |
| 2 | Space & Area Setup: onboarding, template packs, space settings, area shell | Built and locally verified |
| 3 | Task & Routine Engine: recurrence, instances, Today/Tasks, completion, undo | Built and locally verified; database flows unverified |
| 4 | Issues: reporting, lifecycle, assignment, timeline, photos, patterns | Built and locally verified; database flows unverified |

**Verification run at the end of Level 4**

- `npm run build` — passed (`tsc -b && vite build`).
- `npm test` — passed: 11 test files, 109 tests.
- `npm run lint` — 0 errors, warnings only (see Known issues).
- `npm run test:e2e` — both Playwright specs were discovered and skipped themselves (2 skipped) because Supabase environment variables and `E2E_EMAIL`/`E2E_PASSWORD` were absent. This is **not** a passing end-to-end run, and neither spec has been executed against a live database.
- No live Supabase project or `.env.local` was available, so migrations 011/012, RLS policies, SECURITY DEFINER RPCs, Storage policies, and database-backed flows were not executed against Postgres.

---

## Level 1 — Foundation

### Built

- Vite + React 19 + TypeScript (strict) + Tailwind CSS v4.
- Design tokens for light/dark themes, reduced motion, focus rings, and semantic status colors.
- Base UI components: Button, Card, Input, Textarea, Select, Checkbox/CheckboxGroup, Badge/StatusPill, Modal/ConfirmModal, Sheet, Toast (including undo), Skeleton, EmptyState, ErrorState, Tabs, Switch, Progress.
- PWA configuration with `vite-plugin-pwa` and generated manifest/service worker.
- Email/password auth, magic-link auth, password reset request, protected routes, profile theme/language fields, and demo-mode placeholder.
- App shell with desktop side rail, mobile navigation, space switcher, user menu, and theme controls.
- Core schema in `supabase/migrations/001_initial_schema.sql`:
  - organizations, spaces, areas, memberships, task_templates, tasks, task_instances, task_completions
  - issues, issue_events, supply_items, supply_requests
  - notification_preferences, recommendations, audit_events, profiles
  - soft deletes, timestamps, indexes, and space timezone/settings/modules fields.
- RLS policies in `supabase/migrations/002_rls_policies.sql` for all core tables.
- Level 7 tables pre-created in `007_shared_spaces.sql`; their policies are isolated in `008_level7_policies.sql` so `002` can run before those tables exist.
- Level 2 bootstrap RPC and indexes in `009_level2_space_setup.sql`.

### Corrections to earlier progress notes

- There is **no automated permission/RLS test suite**. Policies are defined, but no test executes them against a database.
- Several pages listed as “implemented” in an earlier version of this file did not exist at that time. The current app ships the pages listed under Levels 2 and 3, plus auth and account settings.
- The original mock-data Today page was replaced with real task records. No fabricated tasks are shown.

---

## Level 2 — Space & Area Setup

### Onboarding wizard (resumable, 7 steps)

Implemented in `src/features/onboarding`:

1. **Profile** — personal, shared home, workplace, institution, healthcare, or custom. Choosing a profile loads its starter pack.
2. **Details** — space name, IANA timezone with detection, and optional building/floor/zone hierarchy.
3. **Areas** — suggested area chips plus custom areas; rename, reorder, nest/unnest, archive/restore, and remove. Archived areas are skipped on activation.
4. **Plan** — turn suggested tasks on/off, edit frequency (including custom intervals) and estimated minutes; weekly effort estimate uses a documented calculation.
5. **Review** — typed summary of details, areas/tasks, invitations, and modules before activation, with edit links and calm warnings (e.g. no tasks selected, unusually large weekly plan).
6. **Invite** — pending invitations with role selection and personal note; personal spaces explicitly skip invitations.
7. **Modules** — core modules locked on; optional modules suggested by profile and fully skippable.

Other onboarding behavior:

- Draft persists in `localStorage` under `neatly-onboarding-v2` and can be reset with confirmation.
- Draft data is a resumable convenience only. Activation writes the meaningful records to Supabase.
- Activation validates the entire plan with Zod (`activationSchema`) before writing.
- Space creation uses the `create_space_with_owner` SECURITY DEFINER RPC to atomically create organization + space + owner membership + notification preference, avoiding an RLS bootstrap deadlock.
- Areas are inserted parent-before-child; task templates are inserted only for selected tasks. If a later write fails, the new space is deleted as a best-effort rollback.
- Level 2 originally stopped after saving templates. Since Level 3, activation also turns those templates into recurring tasks and generates the first 30 days of instances. The confirmation screen says this plainly.

### Template packs

`src/features/onboarding/data/templatePacks.ts` stores packs as data for:

- personal
- shared_home
- workplace
- institution
- healthcare
- custom

Each pack defines suggested areas/tasks, default modules, and reminder defaults. Healthcare copy states that suggested procedures require organizational approval. Packs do not alter core task logic.

### Space Settings

`src/features/spaces/pages/SpaceSettingsPage.tsx` provides four tabs:

- **General** — name, timezone, building/floor/zone.
- **Modules** — core modules locked; optional modules toggled independently of task logic.
- **Rules & reminders** — evidence rule, reminder defaults, and retention period.
- **People** — members with roles, last-owner protection, optimistic role changes, remove-with-confirmation, pending invitations, invite, and revoke.

Honest limitations:

- Invitations are stored as pending rows. **No email is sent and no acceptance flow exists yet.**
- Reminder defaults and retention periods are stored settings. No delivery job or retention cleanup job runs yet.
- Evidence rules are stored defaults. No evidence enforcement exists for task completion, and task photo capture is not implemented. Issue photos are a separate Level 4 feature and remain optional and off by default.

### Areas

- `/rooms` and `/areas` render `AreasPage`: loading, error, empty, and success states; nested active areas; scheduled-task and template counts; archived area disclosure; add-area form; derived area status with a visible reason.
- `/areas/:areaId` renders `AreaPage`: derived status, scheduled tasks with next due time, open counts, recent history with undo/reopen, unscheduled setup templates, QR placeholder, rename form, archive/restore with confirmation, and undo toast.
- Level 2 originally showed setup status only. Level 3 replaced it with `deriveAreaStatus`, which uses task instance records only. Status never claims hygiene or a clinical outcome.

### Routing and shell

- Onboarding is protected and rendered outside the app shell.
- All other authenticated routes require both a user and a current space.
- Routes: `/onboarding`, `/today`, `/tasks`, `/tasks-schedule` (alias of Tasks), `/history`, `/rooms`, `/areas`, `/areas/:areaId`, `/issues`, `/issues/:issueId`, `/space-settings`, `/settings`.
- Unknown paths redirect to Today when a space exists, otherwise to onboarding.
- Personal navigation exposes Today, Rooms & areas, Tasks, Supplies, History, Issues, and Space settings. Organization navigation exposes Overview, Areas, Tasks & Schedules, Supplies & Requests, Issues, Reports, and History.
- Supplies, Overview/Organization, and Reports are still navigation placeholders that fall through to the catch-all redirect. Issues is now a real route in both modes.

### Database changes

- `002_rls_policies.sql` no longer references Level 7 tables.
- Corrected organization update policy and space-creation policy.
- Area insert policy no longer references a nonexistent `created_by` column.
- Helper functions are `STABLE SECURITY DEFINER` with `SET search_path = public`.
- `008_level7_policies.sql` contains policies for teams, assignments, comments, swaps, away mode, and invitations.
- `009_level2_space_setup.sql` adds `create_space_with_owner`, a unique active task-instance due index, and a membership lookup index.
- `010_level3_task_engine.sql` adds due times, schedule anchors, task dependencies, unassigned-work policies, and the Level 3 RPCs.
- `src/types/database.ts` now uses object type aliases (required by the current Supabase client generics) and declares table `Relationships`.

### Tests added in Level 2

- `src/features/onboarding/lib/plan.test.ts` — frequency math, selected-task filtering, archived-area exclusion, duration formatting.
- `src/features/onboarding/data/templatePacks.test.ts` — every profile has a usable pack; core modules stay on.
- `src/features/onboarding/api/schema.test.ts` — activation validation accepts a complete plan and rejects invalid names, empty plans, bad emails, bad estimates, and unsupported space types.
- `src/features/onboarding/data/timezones.test.ts` — detection, IANA validation, option de-duplication.
- `src/features/areas/lib/areaDisplay.test.ts` — category labels and frequency labels.
- `test/setup.ts` loads jest-dom matchers; `vitest.config.ts` now resolves its setup file.

Level 2 ended with 5 test files and 30 tests. Level 3 adds 4 test files and 45 tests.

---

## Level 3 — Task & Routine Engine

### Recurrence engine

`src/features/tasks/lib/recurrence.ts` contains the pure scheduling logic:

- `generateInstances(task, windowStart, windowEnd, spaceTimezone)` returns occurrences for a half-open window `[windowStart, windowEnd)`.
- Supported frequencies: `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`, and `custom` with a positive day interval.
- Recurrence starts at `schedule_anchor_at`, falling back to `created_at`, and uses the task's local `due_time` in the space timezone.
- Calendar stepping uses zoned-day arithmetic rather than fixed 24-hour increments, so daylight-saving transitions do not shift the local due time.
- Month-end and leap-year dates clamp safely (for example, a monthly task anchored on January 31 is due February 28 or 29, then March 31).
- Invalid dates, unsupported frequencies, non-positive custom intervals, and reversed windows are rejected.
- `startOfZonedDay`, `addZonedDays`, and `zonedDateKey` are shared by Today, History, and area status.

Tests in `recurrence.test.ts` (18 tests) cover every frequency, month-end and leap-year clamping, DST behavior, timezone boundaries, window filtering, and invalid inputs.

### Schema, RLS, and RPCs

`supabase/migrations/010_level3_task_engine.sql`:

- Adds `due_time` (default `09:00`) to `task_templates` and `tasks`.
- Adds `schedule_anchor_at` to `tasks`. Recurrence never starts before this instant.
- Adds `task_dependencies` with soft delete, a self-dependency check, and a unique `(task_id, depends_on_task_id)` pair.
- Adds an index for active tasks by space.
- RLS: members can read dependencies; only owners, admins, and supervisors can insert, update, or delete them. Unassigned task instances can be updated and completed by any space member.
- Adds atomic SECURITY DEFINER RPCs: `complete_task_instance`, `undo_task_completion`, `skip_task_instance`, `reopen_task_instance`, and `fresh_start_space`. Each function performs its own authentication, membership, and role checks.
- `src/types/database.ts` was updated with the new columns, dependency table, and RPC signatures.

### Schedule generation and anchors

- `materializeTasksFromTemplates` creates one recurring task per setup template that does not already have one, preserving the template's due time and frequency.
- `ensureInstancesForSpace` loads active, non-deleted tasks, generates occurrences for the requested window, skips duplicates, and inserts `pending` instances.
- Generation skips any occurrence due before the task's anchor instant. This prevents an instant overdue backlog after creating, editing, resuming, or resetting a task late in the day.
- A unique index on non-deleted task-instance due dates acts as a database backstop against duplicates.
- Activation materializes tasks from templates and generates the next 30 days.
- Today generates from local midnight today through 14 days ahead. Tasks & schedules loads 7 days back and generates from today through 30 days ahead. Area status loads open work up to 90 days ahead plus the last 7 days of records.
- Generation runs only for owners, admins, and supervisors because RLS restricts inserts. There is no background job or edge function, so a member-only visit cannot fill missing instances and a long-idle space needs a manager visit or Refresh schedule.

### Task management UI

`/tasks` (also `/tasks-schedule`) renders `TasksPage`:

- Grouped by area, with active/paused state, frequency, due time, assignee, estimate, next due date, open-instance count, and prerequisite names.
- Create and edit via `TaskForm`: name, area, description, estimate, frequency/custom interval, local due time, assignee, and dependencies.
- Dependency choices exclude the task itself and anything that would create a cycle. Cycle detection is client-side; the database prevents self-dependencies and duplicate pairs but does not itself detect longer cycles.
- Pause/resume, remove with confirmation and undo, Refresh schedule, and Start fresh.
- Loading, empty, error, and success states. Non-managers can view schedules and complete work, with a visible explanation that editing is restricted. The database enforces the same restriction.
- Editing resets the schedule anchor and clears open instances so the new pattern takes effect immediately. Completed and skipped history is never touched.
- Pausing clears open instances; resuming resets the anchor. Removing soft-deletes the task and clears open instances; restoring resets the anchor. History remains available.
- Creating a task is undoable with an Undo toast. Editing updates optimistically and rolls back on failure. Generation failures are reported without hiding the task that was created.

### Today

`TodayPage` uses real task instances and dependencies:

- At most 3 prominent “Up first” cards, ordered overdue first and then due today. Future work is never promoted into this list.
- Remaining work due today or earlier appears in a compact list.
- Open work for the next 7 days appears under Upcoming.
- Completed-today count and encouraging, non-punitive copy.
- Complete, skip, and undo completion actions. A task blocked by a prerequisite shows which task it is waiting on and cannot be completed until the latest prerequisite occurrence due on or before it is completed or skipped.
- Loading, empty, error, and success states. Empty copy distinguishes “no tasks scheduled” from “nothing due today.”

### History

`HistoryPage`:

- Shows completed and skipped instances grouped by local day, with completion/skip time, due time, area, note when present, and who completed it.
- Undo a completion (the completer or a manager) and reopen a skipped task (the assignee, unassigned work, or a manager).
- Includes records from inactive and soft-deleted tasks, so removing a task does not erase its history.
- Shows the latest 100 records. Older records remain stored.
- Loading, empty, error, and success states. No streaks, scores, or penalties.

### Derived area status

`src/features/areas/lib/areaStatus.ts` implements `deriveAreaStatus(area, now)` using task instance records plus optional open-issue counts (added in Level 4):

- **Archived** — the area is inactive.
- **Issue open** — one or more open issues are linked to the area. This takes priority over the task-derived labels; overdue and due-today task counts stay in the visible reason.
- **No schedule** — no instances were loaded for the period.
- **Needs attention** — one or more open instances were due on an earlier local day (amber, with non-shaming copy).
- **Due today** — open work is due today in the space timezone.
- **Recent progress** — completions were recorded in the last 7 days.
- **Upcoming** — open future work exists.
- **No open work** — nothing open in the loaded period.

Each result includes a visible reason, counts, and a tone. Area status never uses photos, hygiene claims, or clinical claims. `AreasPage` and `AreaPage` both render the derived status; the area detail also lists scheduled tasks, next due times, open counts, open issues, unscheduled setup templates, and recent history with undo/reopen.

### Dependencies and Fresh Start

- A task is blocked only while the latest occurrence of a prerequisite due on or before the dependent instance is still open. Older missed occurrences do not stack. This rule is implemented in both `taskViews.ts` and the completion RPC.
- Fresh Start is owner/admin/supervisor only. It soft-deletes open instances, moves task anchors to now, and preserves all completed and skipped history. The confirmation copy states this.

### Onboarding integration

- Activation now materializes recurring tasks from the saved templates and generates the first 30 days.
- Step review and completion copy describe the scheduling behavior instead of claiming that nothing is scheduled.
- The generated work starts at activation time, so onboarding does not create a backlog of past-due instances.

### Tests added in Level 3

- `src/features/tasks/lib/recurrence.test.ts` — 18 tests.
- `src/features/tasks/lib/taskViews.test.ts` — 12 tests: focus cap and order, remaining/upcoming selection, due descriptions, dependency blockers, completion permissions.
- `src/features/tasks/lib/dependencies.test.ts` — 6 tests: cycle detection.
- `src/features/areas/lib/areaStatus.test.ts` — 9 tests: archived, no schedule, overdue, due today, recent progress, upcoming, quiet, and area grouping.

### End-to-end test

- `playwright.config.ts` starts the dev server only when Supabase environment variables are present.
- `e2e/task-flow.spec.ts` covers create task → complete from Today → see it in History → undo → confirm it is open again → clean up.
- The spec skips when `E2E_EMAIL` or `E2E_PASSWORD` is missing, when the account has no active space, or when the account cannot manage tasks.
- It has **not been run against a real database**. A credential-free `npm run test:e2e` discovers the test and skips it; a skipped run is not a passing verification.

---

## Level 4 — Issues

### Scope and routes

- `/issues` renders `IssuesPage`: report modal, filters, All/Queue tabs, supervisor queue, summary counts, recurring-pattern callout, and personal one-tap conversion.
- `/issues/:issueId` renders `IssueDetailPage`: issue metadata, role-aware lifecycle actions, assignment, timeline and comments, photo gallery/upload, resolution and verification records, and a record summary.
- Both routes are protected and space-scoped. Issues appears in personal navigation; the existing organization navigation entry now resolves to the real route.
- `?areaId=<uuid>` pre-filters the list, and `?report=1` opens the report modal. `AreaPage` links to both the filtered list and the pre-opened report form.

### Reporting flow

- A single modal collects area (optional), category, description, priority, and an optional photo. Categories are Cleanliness, Facility / Maintenance, Supplies, Organization, Outdoor / Plant, Other, and custom (with a required custom name).
- The default category is Cleanliness and the default priority is Medium. A report can be submitted after typing only the description; area and priority remain optional defaults. The issue title is derived from the first line of the description, and the full description is stored separately.
- Reports without an area are valid and appear as “No specific area.”
- Photos are offered only when `space.settings.photosEnabled === true`; the default is off. When enabled, the UI shows “Avoid including people or identifying details.” and previews the selected file before upload. When disabled, it explains that photos are off for the space.
- Photo limits: JPEG, PNG, or WebP; 5 MB each; up to 5 photos per issue. The report modal attaches at most one photo; more can be added from the detail page.
- Issue text and status never depend on a photo.

### Lifecycle and permissions

Statuses are `reported` (Open), `acknowledged` (Assigned), `in_progress`, `resolved`, `closed` (Verified / Closed), and `reopened`.

- `create_issue` writes the issue plus a `reported` event.
- `assign_issue` sets exactly one of a person, team, or external service, with an optional due date and note. Assigning moves `reported`/`reopened` to `acknowledged`; unassigning moves `acknowledged`/`reopened` back to `reported`.
- `start_issue` moves to `in_progress`; `resolve_issue` moves to `resolved` and requires a resolution note; `verify_issue` moves to `closed` with an optional verification note; `reopen_issue` moves to `reopened`, requires a note, and increments `reopen_count`.
- Every lifecycle change inserts an immutable `issue_events` row with actor, timestamp, old/new values, and note. Comments are also `issue_events` rows (`action = 'commented'`), so status changes and comments share one timeline.
- Owners, admins, and supervisors can assign, start, resolve, verify, and reopen. A person or team assignee can start and resolve. The reporter can start and resolve an unassigned issue, and can verify or reopen their own issue. Any member can comment. The reporter or a manager can attach photos.
- The UI mirrors these rules, but the database enforces them. Direct issue UPDATE and direct `issue_events` INSERT policies were removed; lifecycle, comments, photo attachment, and conversion go through checked `SECURITY DEFINER` RPCs.

### Personal and organization behavior

- **Personal:** any member can convert an open issue to a one-off task. `convert_issue_to_task` creates a one-off task and a pending instance due from the issue due date or one day ahead, links it to the issue, closes the issue with “Converted to a follow-up task.” in the resolution and verification fields, and writes a `converted_to_task` event. The list exposes the same one-tap action for open issues without a follow-up task.
- **Organization:** managers assign a person, team, or external service and set a due date and note. The assignee starts and resolves; the reporter or a supervisor verifies or reopens. Conversion creates a one-off follow-up task but leaves the issue open for the normal resolve/verify flow.
- A converted task is marked `tasks.is_one_off`; the recurrence engine generates exactly one occurrence and never repeats it.

### List, filters, and supervisor queue

- Issues are sorted open-first, then newest.
- Filters cover status (including a combined Open filter), area (including No area), category, priority, and assignee (anyone, unassigned, external service, person, or team).
- The supervisor queue is visible only to owners, admins, and supervisors. It contains open issues that are unassigned, past due, or reopened. It is a working view, not a score.
- Summary cards show open, unassigned, awaiting-verification, and reopened counts.
- The recurring-pattern callout lists stored area+category counts from the last 30 days and explains that a pattern is marked recurring after three reports.
- Loading, empty, filtered-empty, error, and success states are present. The list loads at most 500 issues and has no pagination yet.

### Detail page, timeline, and photos

- The header shows status, priority, reopen count, area, category, assignee, reporter, due date, and a recurring-pattern badge when applicable.
- Actions are role- and status-aware. Assignment and action modals collect the notes required by the RPCs.
- The timeline shows actor, local timestamp, action, and note for every event, including comments.
- The current resolution and verification fields are shown separately. Reopening clears those current fields; the reopen event retains the prior values in its payload and shows the required note in the timeline.
- Photos are loaded through one-hour signed URLs from the private `issue-photos` bucket. Only space members can read them. There is no photo deletion UI yet.
- The page has loading, error, not-found, and success states.

### Area status and recurring patterns

- `deriveAreaStatus` accepts optional open-issue and recurring-issue counts. Open issues take priority over task-derived labels, with “Issue open” or “N issues open”; the reason keeps overdue and due-today task counts.
- `AreasPage` shows open and recurring counts per area. `AreaPage` shows an Open issues card, lists up to five open issues, links to the filtered issue list, and offers report links.
- `issue_patterns` stores counts per space, area, category, and custom category over a rolling 30-day window. A trigger refreshes rows when issues change, and `refresh_space_issue_patterns` refreshes the window when the issues workspace loads.
- A pattern is flagged recurring at three or more reports. The UI presents these as record counts, not a hygiene or clinical judgement.
- There is no scheduled pattern-refresh job. Counts refresh when the issue list loads or issue records change.

### Database changes

- `011_level4_issue_status.sql` adds `reopened` to the `issue_status` enum. It is separate because PostgreSQL cannot use a new enum value in the transaction that adds it.
- `012_level4_issues.sql` adds issue category/custom category, person/team/external assignment and assignment metadata, due date, resolution and verification fields, close/reopen fields, reopen count, and the follow-up task link. It adds `tasks.is_one_off`, creates `issue_patterns`, and adds indexes plus category, custom-category, single-assignment, and reopen-count constraints.
- RPCs added: `create_issue`, `assign_issue`, `start_issue`, `resolve_issue`, `verify_issue`, `reopen_issue`, `add_issue_comment`, `attach_issue_photos`, `convert_issue_to_task`, `refresh_issue_patterns`, and `refresh_space_issue_patterns`.
- RLS: members can read issues, events, and patterns. Broad issue UPDATE and issue-event INSERT policies were removed. Lifecycle writes use the RPCs above.
- Storage: creates the private `issue-photos` bucket with a 5 MB limit and JPEG/PNG/WebP MIME types. Object paths follow `<space_id>/<issue_id>/<file>`. Select/insert require space membership; update/delete require object ownership or a manager role.

### Tests added in Level 4

- `src/features/issues/tests/permissions.test.ts` — 14 tests for assignment, start, resolve, verify, reopen, comment, photo, conversion, and queue rules.
- `src/features/issues/tests/schema.test.ts` — 16 tests for report/assign/comment validation, labels, open statuses, title derivation, and photo limits.
- `src/features/areas/lib/areaStatus.test.ts` — 2 new tests (11 total) for open-issue priority and issue-only areas.
- `src/features/tasks/lib/recurrence.test.ts` — 2 new tests (20 total) for one-off tasks.
- `src/features/tasks/lib/taskViews.test.ts` — fixture updated for `tasks.is_one_off`.
- Full suite: 11 files, 109 tests.

### End-to-end test

- `e2e/issue-flow.spec.ts` covers report → assign → start → resolve → verify, then checks the closed status and timeline entries.
- It skips when credentials are absent, when the account has no active space, or when the account is not an owner, admin, or supervisor.
- A credential-free `npm run test:e2e` discovers both specs and skips them (2 skipped). The flow has **not** been run against a live database.

---

## Level 3 — Deferred

- Background or edge-function schedule generation. Generation currently depends on a manager opening Today or Tasks & schedules.
- Member-triggered generation (blocked by insert RLS) and a durable “refresh schedule” job.
- Editing a single occurrence or “this and future” occurrences. Edits reset open work and future recurrence.
- Recurrence end dates, maximum occurrence counts, seasonal schedules, and holiday exceptions.
- Drag-and-drop calendar, bulk task actions, task duplication, and manual rescheduling/snoozing from Today.
- Rotation rules, workload balancing, and multi-assignee tasks beyond a single assignee.
- Due-task reminders and notifications. Stored reminder defaults still have no delivery job.
- Skip-reason capture in the UI. The RPC accepts a reason, but the current Skip button does not prompt for one.
- Completion notes and duration capture in the UI. The RPC accepts them, but the current completion action sends no notes or duration.
- Task comments, evidence/photos, and completion proof.
- History filtering, search, export, and pagination beyond the latest 100 records.
- Automated RLS/permission tests and a live Supabase verification run.
- Localization and complete RTL conversion.
- TanStack Query caching, pagination, and optimistic cache updates. The current task screens use local state and reload after mutations.
- Offline mutation queue, realtime updates, and conflict handling.
- Demo mode with seeded data.

---

## Level 4 — Deferred

- Applying migrations 011/012 to a live Supabase project and verifying every RLS policy, RPC, and Storage rule.
- Automated SQL/API permission tests that prove cross-space isolation and role restrictions against Postgres.
- Editing or soft-deleting an issue after it is reported. The current UI supports assignment, comments, lifecycle changes, and conversion, but not changing the description, category, or priority.
- Issue pagination, search, export, and date-range filters. The list loads at most 500 records.
- Issue notifications and reminders. No email, push, or in-app notification job exists.
- Scheduled `issue_patterns` refresh. Counts refresh through the change trigger or when the issues workspace loads.
- Photo deletion/replacement and cleanup of orphaned storage objects. The UI can add photos but cannot remove them.
- A due-date picker for conversion. The RPC accepts a due date, but the current UI always sends null and relies on the issue due date or a one-day default.
- Realtime issue updates. The app reloads after its own mutations and does not subscribe to other users’ changes.
- Localization and RTL conversion for the new issue screens.

---

## Known issues

1. **No live database run.** Migrations 001–012, SECURITY DEFINER RPCs, Storage policies, and all RLS policies have not been applied to a real Supabase instance in this workspace. Treat database behavior as unverified until tested.
2. **No automated RLS/permission integration tests.** Client-side permission rules now have unit tests, but no test executes policies against Postgres or proves cross-space isolation. The Level 1 requirement for database permission tests is still unmet.
3. **No `.env.local`.** `src/lib/supabase.ts` throws when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, so the app cannot boot without configuration.
4. **Manager-only generation.** Because instance inserts are manager-restricted, members cannot fill missing schedules. There is no cron job, so long-idle spaces need a manager visit or Refresh schedule.
5. **Playwright has never completed a run.** Both specs and the configuration exist, and a credential-free run skips cleanly (2 skipped), but no live Supabase project or test account was available. A skipped run is not a passing end-to-end verification.
6. **History is capped at 100 records.** Older completed and skipped records remain in the database but are not shown.
7. **Undo/reopen after task deletion.** History includes deleted tasks, but undoing a completion or reopening a skipped instance for a deleted task can leave an open instance whose task is soft-deleted. It is not shown in Today and has no cleanup job.
8. **Dependency integrity is partly client-side.** The database prevents self-dependencies and duplicate pairs, but does not enforce same-space task pairs or detect cycles longer than one edge. The UI prevents both when creating dependencies.
9. **Timezone changes do not rewrite existing instances.** New generation uses the new space timezone; already-created instances keep their stored due time and timezone until they are cleared or regenerated.
10. **PWA data caching is not offline support.** The service worker caches static assets and uses NetworkFirst for Supabase GET responses for up to 24 hours. There is no offline mutation queue, no conflict handling, and no guaranteed fresh data. The cache is not cleared on sign-out, which is a privacy concern on shared devices.
11. **Invitation emails are not sent.** The UI says so. There is no acceptance or token-consumption flow.
12. **Stored settings without jobs.** Reminder defaults, retention, evidence rules, and module flags are persisted, but delivery, cleanup, and enforcement are not implemented.
13. **i18n/RTL incomplete.** Strings are English and hardcoded; some layout classes remain physical (`ml`, `left`) rather than logical.
14. **Lint warnings remain.** `npm run lint` reports warnings from React Compiler rules (set-state-in-effect in async-loading hooks, react-hook-form compatibility notes, fast-refresh export shape). There are no lint errors.
15. **Build warnings remain.** Vite warns about `__dirname` in `vite.config.ts`/`vitest.config.ts`, Tailwind sourcemap generation, and the native config loader. They do not fail the build.
16. **Hand-written database types.** They are strict and `any`-free, but must be kept in sync with migrations manually.
17. **Issue photo storage is implemented but unverified.** Migration 012 creates a private bucket and policies, and the UI uploads and reads signed URLs, but none of it has run against Supabase. Photos remain off by default. There is no deletion UI, and orphaned objects are not cleaned up.
18. **Issues are capped at 500.** The list has no pagination, search, export, or date-range filter, so older issues are not shown.
19. **Issues cannot be edited or deleted.** Reports can be assigned, commented on, resolved, verified, reopened, and converted, but the title, description, category, and priority cannot be changed after creation.
20. **No issue notifications.** There is no email, push, or in-app notification when an issue is assigned, resolved, verified, or reopened.
21. **Pattern refresh is not scheduled.** `issue_patterns` updates through the issue-change trigger or when the issues workspace loads. A long-idle space does not refresh the rolling window on its own.
22. **Conversion due dates are not selectable.** The conversion RPC accepts a due date, but the current UI always sends null, so the task uses the issue due date or a one-day default.
23. **No git history.** The repository has no commits yet; all changes are uncommitted.

---

## Next: Level 5

Level 4 is implemented in the working tree and locally verified, but not live-verified. Before starting Level 5:

- Apply migrations 001–012 to a live Supabase project.
- Verify issue RLS, the lifecycle RPCs, Storage upload/signed URLs, and the one-off conversion path against Postgres.
- Run both Playwright flows with a real owner/admin/supervisor account and a test space.
- Add SQL/API permission tests that prove cross-space isolation and role restrictions.
- Commit the Level 1–4 work.

Level 5 scope is not defined in this repository yet. It should build on the Level 3 task engine and Level 4 issue record without changing their core semantics.
