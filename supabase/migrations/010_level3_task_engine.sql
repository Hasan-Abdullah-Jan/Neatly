-- Neatly Database - Level 3 Task & Routine Engine
-- Adds scheduling anchors, due times, task dependencies, and atomic
-- instance actions. Completion history is never deleted by these helpers.

-- ============================================
-- SCHEDULING FIELDS
-- ============================================
ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS due_time TIME NOT NULL DEFAULT '09:00';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS due_time TIME NOT NULL DEFAULT '09:00';

-- Recurrence starts from this instant. Fresh Start moves it to "now" so a
-- space can restart without losing completed or skipped history.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS schedule_anchor_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tasks_space_active
  ON tasks (space_id, is_active)
  WHERE deleted_at IS NULL;

-- ============================================
-- TASK DEPENDENCIES
-- ============================================
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT task_dependency_not_self CHECK (task_id <> depends_on_task_id),
  CONSTRAINT task_dependency_unique UNIQUE (task_id, depends_on_task_id)
);

CREATE TRIGGER update_task_dependencies_updated_at
  BEFORE UPDATE ON task_dependencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task
  ON task_dependencies (task_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on
  ON task_dependencies (depends_on_task_id)
  WHERE deleted_at IS NULL;

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dependency_select_member" ON task_dependencies
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "dependency_insert_supervisor_up" ON task_dependencies
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND created_by = auth.uid()
  );

CREATE POLICY "dependency_update_supervisor_up" ON task_dependencies
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "dependency_delete_supervisor_up" ON task_dependencies
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- ============================================
-- UNASSIGNED WORK
-- Any member can pick up an unassigned instance. The original policies only
-- allowed the assignee or a supervisor, which made "anyone" tasks impossible.
-- ============================================
CREATE POLICY "instance_update_unassigned_member" ON task_instances
  FOR UPDATE USING (
    assignee_id IS NULL
    AND is_space_member(space_id)
  );

CREATE POLICY "completion_insert_unassigned_member" ON task_completions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_completions.task_instance_id
        AND ti.assignee_id IS NULL
        AND is_space_member(ti.space_id)
    )
  );

-- ============================================
-- ATOMIC INSTANCE ACTIONS
-- These run as SECURITY DEFINER so the completion row and instance status
-- change together. Every function performs its own membership and role checks.
-- ============================================

CREATE OR REPLACE FUNCTION complete_task_instance(
  p_instance_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL
)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_instance task_instances;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  IF NOT is_space_member(v_instance.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF v_instance.status = 'completed' THEN
    RAISE EXCEPTION 'This task is already completed';
  END IF;

  IF NOT (
    v_instance.assignee_id = v_user
    OR v_instance.assignee_id IS NULL
    OR has_role(v_instance.space_id, ARRAY['owner', 'admin', 'supervisor'])
  ) THEN
    RAISE EXCEPTION 'Only the assignee or a supervisor can complete this task';
  END IF;

  -- A dependency blocks completion only while its latest occurrence due on or
  -- before this instance is still open. Earlier missed occurrences do not stack up.
  IF EXISTS (
    SELECT 1
    FROM task_dependencies d
    JOIN LATERAL (
      SELECT dep.status
      FROM task_instances dep
      WHERE dep.task_id = d.depends_on_task_id
        AND dep.deleted_at IS NULL
        AND dep.due_at <= v_instance.due_at
      ORDER BY dep.due_at DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE d.task_id = v_instance.task_id
      AND d.deleted_at IS NULL
      AND latest.status NOT IN ('completed', 'skipped')
  ) THEN
    RAISE EXCEPTION 'This task is waiting on a prerequisite task';
  END IF;

  INSERT INTO task_completions (
    task_instance_id,
    user_id,
    completed_at,
    notes,
    duration_minutes
  ) VALUES (
    p_instance_id,
    v_user,
    NOW(),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_duration_minutes
  );

  UPDATE task_instances
  SET status = 'completed',
      completed_at = NOW(),
      skipped_at = NULL,
      skip_reason = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

CREATE OR REPLACE FUNCTION undo_task_completion(p_instance_id UUID)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_instance task_instances;
  v_can_undo BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  IF NOT is_space_member(v_instance.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM task_completions c
    WHERE c.task_instance_id = p_instance_id
      AND c.deleted_at IS NULL
      AND c.user_id = v_user
  ) OR has_role(v_instance.space_id, ARRAY['owner', 'admin', 'supervisor'])
  INTO v_can_undo;

  IF NOT v_can_undo THEN
    RAISE EXCEPTION 'Only the person who completed this task or a supervisor can undo it';
  END IF;

  UPDATE task_completions
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE task_instance_id = p_instance_id
    AND deleted_at IS NULL;

  UPDATE task_instances
  SET status = 'pending',
      completed_at = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

CREATE OR REPLACE FUNCTION skip_task_instance(
  p_instance_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_instance task_instances;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  IF NOT is_space_member(v_instance.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF NOT (
    v_instance.assignee_id = v_user
    OR v_instance.assignee_id IS NULL
    OR has_role(v_instance.space_id, ARRAY['owner', 'admin', 'supervisor'])
  ) THEN
    RAISE EXCEPTION 'Only the assignee or a supervisor can skip this task';
  END IF;

  IF v_instance.status = 'completed' THEN
    RAISE EXCEPTION 'Undo the completion before skipping this task';
  END IF;

  UPDATE task_instances
  SET status = 'skipped',
      skipped_at = NOW(),
      skip_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
      completed_at = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

CREATE OR REPLACE FUNCTION reopen_task_instance(p_instance_id UUID)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_instance task_instances;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  IF NOT is_space_member(v_instance.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF NOT (
    v_instance.assignee_id = v_user
    OR v_instance.assignee_id IS NULL
    OR has_role(v_instance.space_id, ARRAY['owner', 'admin', 'supervisor'])
  ) THEN
    RAISE EXCEPTION 'Only the assignee or a supervisor can reopen this task';
  END IF;

  IF v_instance.status = 'completed' THEN
    RAISE EXCEPTION 'Use undo completion to reopen a completed task';
  END IF;

  UPDATE task_instances
  SET status = 'pending',
      skipped_at = NULL,
      skip_reason = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

-- Fresh Start removes only open scheduled work. Completed and skipped
-- instances stay as history, and task definitions keep their settings.
CREATE OR REPLACE FUNCTION fresh_start_space(p_space_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_removed INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT has_role(p_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only owners, admins, and supervisors can start fresh';
  END IF;

  UPDATE task_instances
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE space_id = p_space_id
    AND deleted_at IS NULL
    AND status IN ('pending', 'in_progress', 'overdue');

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE tasks
  SET schedule_anchor_at = NOW(), updated_at = NOW()
  WHERE space_id = p_space_id
    AND deleted_at IS NULL
    AND is_active = TRUE;

  RETURN v_removed;
END;
$$;

REVOKE ALL ON FUNCTION complete_task_instance(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION undo_task_completion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION skip_task_instance(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reopen_task_instance(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fresh_start_space(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION complete_task_instance(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION undo_task_completion(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION skip_task_instance(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reopen_task_instance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fresh_start_space(UUID) TO authenticated;
