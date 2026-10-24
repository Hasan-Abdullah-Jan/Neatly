-- Neatly Database - Level 4 Issue lifecycle
-- PostgreSQL cannot use a newly added enum value in the same transaction that
-- adds it, so the value lives in its own migration. The rest of Level 4 runs
-- after this file commits.

ALTER TYPE issue_status ADD VALUE IF NOT EXISTS 'reopened';
