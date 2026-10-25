-- Repeatable staging/demo seed. Run only against a non-production project:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -v DEMO_OWNER_ID=<auth user UUID> \
--     -v DEMO_CLEANER_ID=<auth user UUID> \
--     -v DEMO_SUPERVISOR_ID=<auth user UUID> -f supabase/seed.sql
-- Existing Auth users are required. This seed is intentionally idempotent by
-- workspace and record names and does not create or expose credentials.
\set ON_ERROR_STOP on
SELECT set_config('neatly.seed_owner', :'DEMO_OWNER_ID', false);
SELECT set_config('neatly.seed_cleaner', :'DEMO_CLEANER_ID', false);
SELECT set_config('neatly.seed_supervisor', :'DEMO_SUPERVISOR_ID', false);

BEGIN;

DO $$
DECLARE
  v_owner UUID := current_setting('neatly.seed_owner')::UUID;
  v_cleaner UUID := current_setting('neatly.seed_cleaner')::UUID;
  v_supervisor UUID := current_setting('neatly.seed_supervisor')::UUID;
  v_org UUID;
  v_space UUID;
  v_area UUID;
  v_template UUID;
  v_task UUID;
  v_item UUID;
  v_due TIMESTAMPTZ;
  v_record RECORD;
BEGIN
  IF v_owner = v_cleaner OR v_owner = v_supervisor OR v_cleaner = v_supervisor THEN
    RAISE EXCEPTION 'Use three distinct existing staging users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner)
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_cleaner)
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_supervisor) THEN
    RAISE EXCEPTION 'All three demo user IDs must exist in auth.users';
  END IF;

  SELECT id INTO v_org
  FROM organizations
  WHERE name = 'Neatly Staging Demo' AND created_by = v_owner AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1;
  IF v_org IS NULL THEN
    INSERT INTO organizations (name, created_by)
    VALUES ('Neatly Staging Demo', v_owner)
    RETURNING id INTO v_org;
  END IF;

  SELECT id INTO v_space
  FROM spaces
  WHERE organization_id = v_org AND name = 'Community Center'
    AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1;
  IF v_space IS NULL THEN
    INSERT INTO spaces (organization_id, name, type, timezone, created_by)
    VALUES (v_org, 'Community Center', 'workplace', 'UTC', v_owner)
    RETURNING id INTO v_space;
  END IF;

  INSERT INTO memberships (user_id, space_id, role)
  VALUES
    (v_owner, v_space, 'owner'),
    (v_supervisor, v_space, 'supervisor'),
    (v_cleaner, v_space, 'cleaner')
  ON CONFLICT (user_id, space_id) DO UPDATE
  SET role = EXCLUDED.role, deleted_at = NULL, updated_at = NOW();

  FOR v_record IN
    SELECT * FROM (VALUES
      ('Kitchen', 'kitchen'),
      ('Restrooms', 'bathroom'),
      ('Lobby', 'shared'),
      ('Office', 'office'),
      ('Storage', 'storage')
    ) AS area_seed(name, category)
  LOOP
    SELECT id INTO v_area
    FROM areas
    WHERE space_id = v_space AND name = v_record.name AND deleted_at IS NULL
    LIMIT 1;
    IF v_area IS NULL THEN
      INSERT INTO areas (space_id, name, category)
      VALUES (v_space, v_record.name, v_record.category)
      RETURNING id INTO v_area;
    END IF;
  END LOOP;

  FOR v_record IN
    SELECT * FROM (VALUES
      ('Kitchen reset', 'Kitchen', 'daily'::task_frequency, 15),
      ('Restroom reset', 'Restrooms', 'weekly'::task_frequency, 25),
      ('Storage zone check', 'Storage', 'monthly'::task_frequency, 20)
    ) AS task_seed(name, area_name, frequency, estimated_minutes)
  LOOP
    SELECT id INTO v_area FROM areas
    WHERE space_id = v_space AND name = v_record.area_name AND deleted_at IS NULL
    LIMIT 1;

    SELECT id INTO v_template FROM task_templates
    WHERE space_id = v_space AND name = v_record.name AND deleted_at IS NULL
    LIMIT 1;
    IF v_template IS NULL THEN
      INSERT INTO task_templates (space_id, area_id, name, frequency, estimated_minutes, created_by)
      VALUES (v_space, v_area, v_record.name, v_record.frequency, v_record.estimated_minutes, v_owner)
      RETURNING id INTO v_template;
    END IF;

    SELECT id INTO v_task FROM tasks
    WHERE space_id = v_space AND name = v_record.name AND deleted_at IS NULL
    LIMIT 1;
    IF v_task IS NULL THEN
      INSERT INTO tasks (
        space_id, template_id, area_id, name, frequency, estimated_minutes,
        assignee_id, created_by
      ) VALUES (
        v_space, v_template, v_area, v_record.name, v_record.frequency,
        v_record.estimated_minutes, v_cleaner, v_owner
      )
      RETURNING id INTO v_task;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM task_instances
      WHERE task_id = v_task AND deleted_at IS NULL
    ) THEN
      v_due := CASE
        WHEN v_record.name = 'Storage zone check' THEN NOW() - INTERVAL '3 days'
        ELSE NOW() + INTERVAL '1 day'
      END;
      INSERT INTO task_instances (task_id, space_id, assignee_id, due_at, timezone, status)
      VALUES (
        v_task,
        v_space,
        v_cleaner,
        v_due,
        'UTC',
        CASE WHEN v_due < NOW() THEN 'overdue'::task_status ELSE 'pending'::task_status END
      );
    END IF;
  END LOOP;

  SELECT id INTO v_area FROM areas
  WHERE space_id = v_space AND name = 'Kitchen' AND deleted_at IS NULL
  LIMIT 1;

  SELECT id INTO v_item FROM supply_items
  WHERE space_id = v_space AND name = 'Soap' AND deleted_at IS NULL
  LIMIT 1;
  IF v_item IS NULL THEN
    INSERT INTO supply_items (space_id, area_id, name, category, unit, quantity, min_quantity, status, created_by)
    VALUES (v_space, v_area, 'Soap', 'cleaning', 'bottle', 1, 2, 'low', v_owner)
    RETURNING id INTO v_item;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM supply_requests
    WHERE space_id = v_space AND item_name = 'Cleaning solution'
      AND requested_by = v_cleaner AND status = 'pending' AND deleted_at IS NULL
  ) THEN
    INSERT INTO supply_requests (space_id, supply_item_id, requested_by, item_name, quantity, unit, notes)
    VALUES (v_space, v_item, v_cleaner, 'Cleaning solution', 2, 'bottle', 'Staging demo request');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM issues
    WHERE space_id = v_space AND title = 'Dispenser needs attention' AND deleted_at IS NULL
  ) THEN
    SELECT id INTO v_area FROM areas
    WHERE space_id = v_space AND name = 'Restrooms' AND deleted_at IS NULL
    LIMIT 1;
    INSERT INTO issues (space_id, area_id, reported_by, title, description, category, priority, status)
    VALUES (v_space, v_area, v_cleaner, 'Dispenser needs attention', 'Please check the restroom dispenser.', 'supplies', 'medium', 'reported');
  END IF;
END;
$$;

COMMIT;
