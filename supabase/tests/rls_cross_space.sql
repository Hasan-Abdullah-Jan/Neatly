-- Cross-space read isolation smoke test for a staging Supabase project.
-- Run with psql as a database owner and supply:
--   -v TEST_USER_A=<auth.users UUID with membership in space A>
--   -v TEST_SPACE_B=<space UUID with no membership for TEST_USER_A>
-- This test rolls back and creates no fixtures. TEST_SPACE_B must contain at
-- least one row in spaces, areas, tasks, task_instances, issues, and supplies.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'TEST_USER_A', true);
SELECT set_config('test.space_b', :'TEST_SPACE_B', true);

DO $$
DECLARE
  v_space UUID := current_setting('test.space_b')::UUID;
BEGIN
  IF is_space_member(v_space) THEN
    RAISE EXCEPTION 'Cross-space membership unexpectedly granted';
  END IF;

  IF EXISTS (SELECT 1 FROM spaces WHERE id = v_space) THEN
    RAISE EXCEPTION 'Cross-space space row visible';
  END IF;
  IF EXISTS (SELECT 1 FROM areas WHERE space_id = v_space) THEN
    RAISE EXCEPTION 'Cross-space area rows visible';
  END IF;
  IF EXISTS (SELECT 1 FROM task_templates WHERE space_id = v_space) THEN
    RAISE EXCEPTION 'Cross-space task template rows visible';
  END IF;
  IF EXISTS (SELECT 1 FROM tasks WHERE space_id = v_space) THEN
    RAISE EXCEPTION 'Cross-space task rows visible';
  END IF;
  IF EXISTS (
    SELECT 1 FROM task_instances ti
    JOIN tasks t ON t.id = ti.task_id
    WHERE t.space_id = v_space
  ) THEN
    RAISE EXCEPTION 'Cross-space task instance rows visible';
  END IF;
  IF EXISTS (SELECT 1 FROM issues WHERE space_id = v_space) THEN
    RAISE EXCEPTION 'Cross-space issue rows visible';
  END IF;
  IF EXISTS (SELECT 1 FROM supply_items WHERE space_id = v_space) THEN
    RAISE EXCEPTION 'Cross-space supply rows visible';
  END IF;
  IF EXISTS (SELECT 1 FROM supply_requests WHERE space_id = v_space) THEN
    RAISE EXCEPTION 'Cross-space supply request rows visible';
  END IF;
  IF EXISTS (SELECT 1 FROM recommendations WHERE space_id = v_space) THEN
    RAISE EXCEPTION 'Cross-space recommendation rows visible';
  END IF;

  BEGIN
    UPDATE areas SET name = name WHERE space_id = v_space;
    IF FOUND THEN
      RAISE EXCEPTION 'Cross-space area update unexpectedly changed a row';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

ROLLBACK;
