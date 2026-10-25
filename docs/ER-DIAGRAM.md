# Core entity relationship diagram

```mermaid
erDiagram
  AUTH_USERS ||--o{ MEMBERSHIPS : joins
  ORGANIZATIONS ||--o{ SPACES : contains
  SPACES ||--o{ MEMBERSHIPS : grants
  SPACES ||--o{ AREAS : contains
  AREAS ||--o{ TASK_TEMPLATES : scopes
  SPACES ||--o{ TASK_TEMPLATES : configures
  TASK_TEMPLATES ||--o{ TASKS : creates
  SPACES ||--o{ TASKS : scopes
  AREAS ||--o{ TASKS : locates
  TASKS ||--o{ TASK_INSTANCES : schedules
  TASK_INSTANCES ||--o{ TASK_COMPLETIONS : records
  TASK_INSTANCES ||--o{ TASK_CHECKLIST_RESULTS : answers
  TASKS ||--o{ TASK_CHECKLIST_ITEMS : defines
  SPACES ||--o{ ISSUES : tracks
  AREAS ||--o{ ISSUES : locates
  ISSUES ||--o{ ISSUE_EVENTS : records
  SPACES ||--o{ SUPPLY_ITEMS : stocks
  SUPPLY_ITEMS ||--o{ SUPPLY_REQUESTS : requests
  SPACES ||--o{ TEAMS : groups
  TEAMS ||--o{ TEAM_MEMBERS : includes
  SPACES ||--o{ INVITATIONS : invites
  SPACES ||--o{ AUDIT_EVENTS : audits
  SPACES ||--o{ RECOMMENDATIONS : suggests
  SPACES ||--o{ NOTIFICATIONS : contains
  AUTH_USERS ||--o{ NOTIFICATIONS : receives
```

This is a conceptual diagram of the current core schema; Level 10 entities are not present yet. Exact columns, nullability, delete actions, and RLS policies are defined in ordered migrations under `supabase/migrations/`.
