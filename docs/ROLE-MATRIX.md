# Role matrix

This matrix summarizes intended application permissions. Postgres RLS and checked RPCs are the authority; this document is not a substitute for testing the deployed policies.

| Action | Owner | Admin | Supervisor | Member | Cleaner | Auditor |
|---|---:|---:|---:|---:|---:|---:|
| Read records in a joined space | Yes | Yes | Yes | Yes | Yes | Yes |
| Manage organization settings and membership | Yes | Yes | Limited | No | No | No |
| Manage tasks, areas, and assignments | Yes | Yes | Yes | No | No | No |
| Complete assigned work / submit checklist | Yes | Yes | Yes | Yes | Yes | No |
| Verify submitted task / request rework | Yes | Yes | Yes | No | No | No |
| Report and comment on an issue | Yes | Yes | Yes | Yes | Yes | No |
| Assign/resolve/verify issues | Yes | Yes | Yes | Own/assigned flow | Own/assigned flow | No |
| Manage supply catalog and requests | Yes | Yes | Yes | Request | Request | No |
| Manage teams, invitations, swaps, away periods | Yes | Yes | Yes | Own requests | Own requests | No |
| View workload/recommendation management | Yes | Yes | Yes | No | No | No |
| Read audit events | Yes | Yes | No | No | No | Yes |

Personal-space behavior may grant the member the supervisor-like actions described in the UI. Verify each row against the migrations and a staging database before production.
