-- Neatly Database - Level 2 Space Setup
-- Atomic bootstrap for a space + organization + owner membership.
-- This avoids a chicken-and-egg problem with the membership RLS policies:
-- a brand new space has no members yet, so a normal insert cannot see itself.

CREATE OR REPLACE FUNCTION create_space_with_owner(
  p_name TEXT,
  p_type space_type,
  p_timezone TEXT,
  p_modules JSONB DEFAULT '{}'::jsonb,
  p_settings JSONB DEFAULT '{}'::jsonb,
  p_organization_name TEXT DEFAULT NULL
)
RETURNS spaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_organization_id UUID;
  v_space spaces;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Space name is required';
  END IF;

  IF p_timezone IS NULL OR btrim(p_timezone) = '' THEN
    RAISE EXCEPTION 'Timezone is required';
  END IF;

  INSERT INTO organizations (name, created_by, settings)
  VALUES (
    COALESCE(NULLIF(btrim(p_organization_name), ''), btrim(p_name) || ' Organization'),
    v_user,
    jsonb_build_object('default_space_id', NULL)
  )
  RETURNING id INTO v_organization_id;

  INSERT INTO spaces (organization_id, name, type, timezone, settings, modules, created_by)
  VALUES (
    v_organization_id,
    btrim(p_name),
    p_type,
    p_timezone,
    COALESCE(p_settings, '{}'::jsonb),
    COALESCE(p_modules, '{}'::jsonb),
    v_user
  )
  RETURNING * INTO v_space;

  INSERT INTO memberships (user_id, space_id, role)
  VALUES (v_user, v_space.id, 'owner');

  INSERT INTO notification_preferences (user_id, space_id, timezone)
  VALUES (v_user, v_space.id, p_timezone)
  ON CONFLICT DO NOTHING;

  RETURN v_space;
END;
$$;

REVOKE ALL ON FUNCTION create_space_with_owner(TEXT, space_type, TEXT, JSONB, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_space_with_owner(TEXT, space_type, TEXT, JSONB, JSONB, TEXT) TO authenticated;

-- A task instance may only exist once per task and due timestamp.
-- Nullable/deleted rows are excluded so historical soft-deleted instances do not block regeneration.
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_instances_unique_due
  ON task_instances (task_id, due_at)
  WHERE deleted_at IS NULL;

-- Useful lookup for member management screens.
CREATE INDEX IF NOT EXISTS idx_memberships_space_role
  ON memberships (space_id, role)
  WHERE deleted_at IS NULL;
