# Neatly

A universal space-care web app (PWA) that works equally for one person in an apartment and for a multi-site organization, using ONE configurable data model.

## Product Principles

1. **Action-first**: The Today screen answers "What should I do next?" with at most 3 prominent tasks.
2. **Encouraging, never shaming**: No guilt copy, no public leaderboards, no punitive streaks, no manipulative engagement loops.
3. **Status is derived only from task and issue records**: Never claim objective cleanliness. Photos are context, not certification.
4. **Privacy-first**: A personal user needs no photos or personal data. Photos are optional and off by default.
5. **Authorization is enforced in the database (RLS)**: Never only in the UI.
6. **Optional modules** (plants, inventory, maintenance, decluttering) are feature-flagged and must not alter core task logic.
7. **Recommendations are transparent rules**: Always show the reason, and allow accept, edit, dismiss or disable. No AI is required.
8. **Do not claim real-time or offline support** that is not implemented and tested. Do not claim hygiene or clinical certification.
9. **No localStorage-only data** for anything meaningful; the database is the source of truth.

## Tech Stack

- **Frontend**: React 19 + TypeScript (strict) + Vite + Tailwind CSS v4
- **Routing**: React Router v7
- **State/Data**: React state and feature hooks; TanStack Query is installed but not yet used by the task and issue screens
- **Forms**: react-hook-form + Zod
- **Dates**: date-fns + date-fns-tz
- **Backend**: Supabase (Postgres, Auth, Row Level Security, private Storage for issue photos)
- **PWA**: vite-plugin-pwa
- **QR Codes**: qrcode.react (placeholder UI only)
- **Testing**: Vitest + Playwright
- **UI**: Custom component library with Radix-style patterns

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 8)
- npm or pnpm
- Supabase account (for backend)

### Installation

```bash
# Clone and install dependencies
npm install --legacy-peer-deps

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

The app refuses to boot without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. There is no demo database, so onboarding activation, task generation, issue reporting, photo upload, and RLS behavior require a configured Supabase project with the migrations applied.

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
src/
├── components/
│   ├── ui/           # Base UI components (Button, Card, Input, etc.)
│   ├── layout/       # Layout components (AppShell, etc.)
│   └── auth/         # Auth-related components
├── features/         # Feature folders (domain-driven)
│   ├── auth/
│   ├── spaces/
│   ├── tasks/        # Recurrence, task CRUD, Today, History
│   ├── areas/
│   ├── supplies/
│   ├── issues/
│   ├── reports/
│   ├── settings/
│   └── shared/
├── contexts/         # React contexts (Auth, etc.)
├── hooks/            # Shared hooks
├── lib/              # Utilities, Supabase client
├── styles/           # Global styles, Tailwind config
├── types/            # TypeScript types
├── api/              # API functions
└── test/             # Test setup

e2e/                  # Playwright end-to-end tests
supabase/migrations/  # Database schema and RLS migrations
```

## Database

Migrations are in `supabase/migrations/`:

1. `001_initial_schema.sql` - Core tables (organizations, spaces, areas, memberships, tasks, issues, supplies, etc.)
2. `002_rls_policies.sql` - Row Level Security policies for all tables
3. `007_shared_spaces.sql` - Teams, assignments, comments, swaps, away mode, invitations
4. `008_level7_policies.sql` - RLS for the Level 7 tables
5. `009_level2_space_setup.sql` - Atomic space bootstrap and task-instance indexes
6. `010_level3_task_engine.sql` - Due times, schedule anchors, dependencies, unassigned-work policies, and task RPCs
7. `011_level4_issue_status.sql` - Adds the `reopened` issue status in its own transaction
8. `012_level4_issues.sql` - Issue categories, assignment, lifecycle RPCs, patterns, and private issue-photo storage

Apply them in filename order. The Level 4 RPCs and Storage policies assume the helper functions and tables from the earlier migrations exist.

### Key Tables

- **organizations** - Top-level accounts
- **spaces** - Configurable spaces (personal, shared_home, workplace, institution, healthcare, custom)
- **areas** - Hierarchical areas within spaces
- **memberships** - User-space-role relationships
- **task_templates** - Reusable setup definitions with frequency and due time
- **tasks** - Recurring task definitions with schedule anchors, assignees, and due times; converted issue follow-ups are marked `is_one_off`
- **task_instances** - Specific occurrences with due dates and status
- **task_dependencies** - Prerequisite links between recurring tasks
- **task_completions** - Completion records (notes and optional photo fields; task photo capture is not implemented)
- **issues** - Reports with area, category, priority, status, assignment target, due date, resolution/verification notes, reopen count, and optional private photos
- **issue_events** - Immutable issue timeline: lifecycle changes and comments with actor, timestamp, and note
- **issue_patterns** - Rolling 30-day area+category counts used for recurring-pattern flags
- **supply_items** - Inventory tracking
- **supply_requests** - Restock requests
- **teams** - Groups within spaces
- **task_assignments** - Explicit/rotation assignments
- **task_comments** - Comments on task instances
- **task_swaps** - Swap requests between members
- **member_away** - Pause mode for illness/travel
- **invitations** - Email/link invitations with roles
- **recommendations** - Transparent rule-based suggestions
- **audit_events** - Immutable audit log

## Development

### Commands

```bash
npm run dev          # Start dev server
npm run build        # Type-check + build
npm run lint         # Run oxlint
npm run test         # Run Vitest tests once
npm run test:watch   # Run Vitest in watch mode
npm run test:e2e     # Run Playwright tests (requires env, see below)
npm run preview      # Preview production build
```

### Code Style

- Strict TypeScript (no `any`)
- Zod validation for all inputs
- Feature-folder structure
- Every screen has loading, empty, error, success states
- Optimistic mutations where safe, undoable where possible
- UTC timestamps, space timezone for due dates
- WCAG AA contrast, visible focus, keyboard operation
- i18n/RTL is a goal, not complete: current strings are English and some layout classes are physical

## Deployment

### Supabase Setup

1. Create a new Supabase project
2. Run migrations in order:
   ```bash
   supabase db push
   ```
3. Configure Auth providers (Email, Magic Link)
4. Migration 012 creates the private `issue-photos` Storage bucket and its member-only policies. Photos remain off unless a space explicitly enables `photosEnabled`. Verify the Storage policies and signed-URL flow in your project before enabling photos. Realtime is **not implemented**; do not configure or advertise it.

### PWA

The app is configured as a PWA with:

- Cached app shell and static assets for faster loads
- NetworkFirst caching of Supabase GET responses for up to 24 hours
- Installability on supported browsers
- Auto-update on new versions

This is **not offline support**. There is no offline mutation queue, no conflict handling, and cached API responses can be stale. The cache is not cleared on sign-out.

## Testing

### Unit Tests (Vitest)

```bash
npm run test
```

The current suite has 11 test files and 109 tests, covering recurrence (including one-off tasks), task views, dependencies, area status with open issues, issue permissions and schema validation, onboarding validation, template packs, timezones, and display helpers.

### E2E Tests (Playwright)

```bash
npm run test:e2e
```

Prerequisites:

- A configured Supabase project with all migrations applied.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `E2E_EMAIL` and `E2E_PASSWORD` for an owner, admin, or supervisor account with an active space.
- Optionally `E2E_BASE_URL` (defaults to `http://127.0.0.1:4173`).

Playwright reads the same `.env.local` as Vite (see `playwright.config.ts`), or you can set the variables in your shell. Each spec skips itself when the account has no active space or lacks the role it needs. A skipped run is not a passing end-to-end verification.

The task flow covers create task → complete from Today → see the record in History → undo → confirm it is open again → clean up. The issue flow covers report → assign → start → resolve → verify, then checks the closed status and timeline entries. The issue spec needs an owner, admin, or supervisor account and intentionally leaves the closed issue in place because issue records are not deletable from the UI.

### Permission Tests

Client-side permission rules for issue assignment, start, resolve, verify, reopen, photo attachment, conversion, and the supervisor queue are unit-tested. Automated SQL/API permission tests against Postgres are **not implemented yet**. RLS policies exist, but no test currently proves that User A cannot read User B's space, that a cleaner cannot edit templates, or that an auditor cannot write. Treat database permission behavior as unverified until those tests exist and run against Postgres.

## Contributing

1. Follow the product principles strictly
2. Small, reviewable commits
3. Run type-check, lint, and tests before PR
4. Update PROGRESS.md with changes

## License

MIT