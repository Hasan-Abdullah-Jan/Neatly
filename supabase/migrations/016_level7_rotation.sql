-- Level 7: scoped assignments and round-robin recurring work.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignee_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rotation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rotation_cursor INTEGER NOT NULL DEFAULT 0
    CHECK (rotation_cursor >= 0);

ALTER TABLE task_assignments
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;

UPDATE task_assignments assignment
SET space_id = task.space_id
FROM tasks task
WHERE assignment.task_id = task.id
  AND assignment.space_id IS NULL;

ALTER TABLE task_assignments
  ALTER COLUMN space_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_assignments_space_task
  ON task_assignments(space_id, task_id, rotation_index)
  WHERE is_active AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION validate_task_assignment_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM teams
    WHERE id = NEW.assignee_team_id
      AND space_id = NEW.space_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Assigned team must belong to the task space';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_task_assignment_team_trigger ON tasks;
CREATE TRIGGER validate_task_assignment_team_trigger
  BEFORE INSERT OR UPDATE OF assignee_team_id, space_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION validate_task_assignment_team();

DROP POLICY IF EXISTS assignment_insert_supervisor_up ON task_assignments;
CREATE POLICY "assignment_insert_supervisor_up" ON task_assignments
  FOR INSERT WITH CHECK (
    assigned_by = auth.uid()
    AND has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND EXISTS (
      SELECT 1 FROM tasks task
      JOIN memberships member
        ON member.space_id = task.space_id
        AND member.user_id = task_assignments.user_id
        AND member.deleted_at IS NULL
      WHERE task.id = task_assignments.task_id
        AND task.space_id = task_assignments.space_id
    )
  );

DROP POLICY IF EXISTS assignment_update_supervisor_up ON task_assignments;
CREATE POLICY "assignment_update_supervisor_up" ON task_assignments
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  )
  WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND EXISTS (
      SELECT 1 FROM tasks task
      JOIN memberships member
        ON member.space_id = task.space_id
        AND member.user_id = task_assignments.user_id
        AND member.deleted_at IS NULL
      WHERE task.id = task_assignments.task_id
        AND task.space_id = task_assignments.space_id
    )
  );

DROP POLICY IF EXISTS team_member_insert_owner_admin ON team_members;
CREATE POLICY "team_member_insert_manager" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams team
      JOIN memberships member
        ON member.space_id = team.space_id
        AND member.user_id = team_members.user_id
        AND member.deleted_at IS NULL
      WHERE team.id = team_members.team_id
        AND has_role(team.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  );

DROP POLICY IF EXISTS team_member_update_owner_admin ON team_members;
CREATE POLICY "team_member_update_manager" ON team_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM teams team
      WHERE team.id = team_members.team_id
        AND has_role(team.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams team
      JOIN memberships member
        ON member.space_id = team.space_id
        AND member.user_id = team_members.user_id
        AND member.deleted_at IS NULL
      WHERE team.id = team_members.team_id
        AND has_role(team.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  );

DROP POLICY IF EXISTS swap_insert_member ON task_swaps;

CREATE OR REPLACE FUNCTION replace_task_rotation_members(
  p_task_id UUID,
  p_user_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id UUID;
  v_user UUID;
  v_index INTEGER := 0;
  v_input_count INTEGER;
  v_distinct_count INTEGER;
BEGIN
  SELECT space_id INTO v_space_id
  FROM tasks
  WHERE id = p_task_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF NOT has_role(v_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can change task rotation';
  END IF;

  IF cardinality(COALESCE(p_user_ids, ARRAY[]::UUID[])) > 100 THEN
    RAISE EXCEPTION 'A rotation can include at most 100 people';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT candidate.user_id)
  INTO v_input_count, v_distinct_count
  FROM unnest(COALESCE(p_user_ids, ARRAY[]::UUID[])) candidate(user_id);
  IF v_input_count <> v_distinct_count THEN
    RAISE EXCEPTION 'A rotation cannot include the same person more than once';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_user_ids, ARRAY[]::UUID[])) candidate(user_id)
    WHERE NOT is_space_member(v_space_id, candidate.user_id)
  ) THEN
    RAISE EXCEPTION 'Every rotation member must belong to this space';
  END IF;

  UPDATE task_assignments
  SET is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
  WHERE task_id = p_task_id AND is_active AND deleted_at IS NULL;

  FOREACH v_user IN ARRAY COALESCE(p_user_ids, ARRAY[]::UUID[]) LOOP
    INSERT INTO task_assignments (
      task_id, space_id, user_id, assigned_by, rotation_index, is_active, deleted_at
    ) VALUES (
      p_task_id, v_space_id, v_user, auth.uid(), v_index, TRUE, NULL
    );
    v_index := v_index + 1;
  END LOOP;

  UPDATE tasks
  SET rotation_enabled = v_index > 0,
      rotation_cursor = 0,
      updated_at = NOW()
  WHERE id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_away(
  p_space_id UUID,
  p_type away_type,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS member_away
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_away member_away;
BEGIN
  IF v_user IS NULL OR NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;
  IF p_ends_at IS NOT NULL AND p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) > 200 THEN
    RAISE EXCEPTION 'Keep the note under 200 characters';
  END IF;

  INSERT INTO member_away (space_id, user_id, type, starts_at, ends_at, reason, created_by)
  VALUES (p_space_id, v_user, p_type, p_starts_at, p_ends_at,
          NULLIF(btrim(p_reason), ''), v_user)
  RETURNING * INTO v_away;

  UPDATE task_instances
  SET assignee_id = NULL, updated_at = NOW()
  WHERE space_id = p_space_id
    AND assignee_id = v_user
    AND status IN ('pending', 'in_progress', 'overdue')
    AND due_at >= p_starts_at
    AND (p_ends_at IS NULL OR due_at <= p_ends_at)
    AND deleted_at IS NULL;

  RETURN v_away;
END;
$$;

CREATE OR REPLACE FUNCTION assign_recurring_instance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task tasks;
  v_user UUID;
  v_count INTEGER;
  v_position INTEGER;
BEGIN
  SELECT * INTO v_task
  FROM tasks
  WHERE id = NEW.task_id
    AND space_id = NEW.space_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task does not belong to this space';
  END IF;

  IF NEW.rework_of_instance_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_task.rotation_enabled THEN
    SELECT COUNT(*) INTO v_count
    FROM task_assignments assignment
    WHERE assignment.task_id = v_task.id
      AND assignment.is_active
      AND assignment.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM member_away away
        WHERE away.space_id = v_task.space_id
          AND away.user_id = assignment.user_id
          AND away.deleted_at IS NULL
          AND away.starts_at <= NEW.due_at
          AND (away.ends_at IS NULL OR away.ends_at >= NEW.due_at)
      );

    IF v_count > 0 THEN
      v_position := v_task.rotation_cursor % v_count;
      SELECT assignment.user_id INTO v_user
      FROM task_assignments assignment
      WHERE assignment.task_id = v_task.id
        AND assignment.is_active
        AND assignment.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM member_away away
          WHERE away.space_id = v_task.space_id
            AND away.user_id = assignment.user_id
            AND away.deleted_at IS NULL
            AND away.starts_at <= NEW.due_at
            AND (away.ends_at IS NULL OR away.ends_at >= NEW.due_at)
        )
      ORDER BY assignment.rotation_index NULLS LAST, assignment.assigned_at, assignment.id
      OFFSET v_position LIMIT 1;

      NEW.assignee_id := v_user;
      UPDATE tasks
      SET rotation_cursor = v_task.rotation_cursor + 1
      WHERE id = v_task.id;
    ELSE
      NEW.assignee_id := NULL;
    END IF;
  ELSIF v_task.assignee_role IS NOT NULL THEN
    SELECT membership.user_id INTO v_user
    FROM memberships membership
    WHERE membership.space_id = v_task.space_id
      AND membership.role = v_task.assignee_role
      AND membership.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM member_away away
        WHERE away.space_id = v_task.space_id
          AND away.user_id = membership.user_id
          AND away.deleted_at IS NULL
          AND away.starts_at <= NEW.due_at
          AND (away.ends_at IS NULL OR away.ends_at >= NEW.due_at)
      )
    ORDER BY membership.joined_at, membership.user_id
    LIMIT 1;
    NEW.assignee_id := v_user;
  ELSIF v_task.assignee_team_id IS NOT NULL THEN
    SELECT team_member.user_id INTO v_user
    FROM team_members team_member
    JOIN memberships membership
      ON membership.user_id = team_member.user_id
      AND membership.space_id = v_task.space_id
      AND membership.deleted_at IS NULL
    WHERE team_member.team_id = v_task.assignee_team_id
      AND team_member.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM member_away away
        WHERE away.space_id = v_task.space_id
          AND away.user_id = team_member.user_id
          AND away.deleted_at IS NULL
          AND away.starts_at <= NEW.due_at
          AND (away.ends_at IS NULL OR away.ends_at >= NEW.due_at)
      )
    ORDER BY team_member.joined_at, team_member.user_id
    LIMIT 1;
    NEW.assignee_id := v_user;
  ELSE
    NEW.assignee_id := v_task.assignee_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_recurring_instance_trigger ON task_instances;
CREATE TRIGGER assign_recurring_instance_trigger
  BEFORE INSERT ON task_instances
  FOR EACH ROW EXECUTE FUNCTION assign_recurring_instance();

CREATE OR REPLACE FUNCTION add_team_member(
  p_team_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member'
)
RETURNS team_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id UUID;
  v_member team_members;
BEGIN
  SELECT space_id INTO v_space_id
  FROM teams
  WHERE id = p_team_id AND deleted_at IS NULL;

  IF NOT FOUND OR NOT has_role(v_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only a space manager can add team members';
  END IF;

  IF p_role NOT IN ('lead', 'member') THEN
    RAISE EXCEPTION 'Role must be lead or member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE space_id = v_space_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Team members must belong to the same space';
  END IF;

  INSERT INTO team_members (team_id, user_id, role, joined_at, deleted_at)
  VALUES (p_team_id, p_user_id, p_role, NOW(), NULL)
  ON CONFLICT (team_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, joined_at = NOW(), deleted_at = NULL, updated_at = NOW()
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION create_invitation(
  p_space_id UUID,
  p_email TEXT DEFAULT NULL,
  p_role membership_role DEFAULT 'member',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_invitation invitations;
  v_expires TIMESTAMPTZ := COALESCE(p_expires_at, NOW() + INTERVAL '7 days');
BEGIN
  IF v_user IS NULL OR NOT has_role(p_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only space managers can create invitations';
  END IF;

  IF p_role = 'owner'
    OR (p_role = 'admin' AND NOT has_role(p_space_id, ARRAY['owner', 'admin'])) THEN
    RAISE EXCEPTION 'You cannot invite someone with that role';
  END IF;

  IF p_email IS NOT NULL AND p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  IF v_expires <= NOW() OR v_expires > NOW() + INTERVAL '365 days' THEN
    RAISE EXCEPTION 'Invitation expiry must be within the next 365 days';
  END IF;

  INSERT INTO invitations (space_id, email, role, token, invited_by, expires_at)
  VALUES (p_space_id, NULLIF(lower(btrim(p_email)), ''), p_role,
          encode(gen_random_bytes(32), 'hex'), v_user, v_expires)
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id UUID;
BEGIN
  SELECT space_id INTO v_space_id
  FROM invitations
  WHERE id = p_invitation_id AND status = 'pending' AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT has_role(v_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Pending invitation not found or permission denied';
  END IF;

  UPDATE invitations
  SET status = 'revoked', updated_at = NOW()
  WHERE id = p_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_invitation invitations;
  v_membership memberships;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
    AND deleted_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  IF v_invitation.email IS NOT NULL AND lower(v_invitation.email) <> v_email THEN
    RAISE EXCEPTION 'Sign in with the email address this invitation was sent to';
  END IF;

  SELECT * INTO v_membership
  FROM memberships
  WHERE user_id = v_user AND space_id = v_invitation.space_id
  FOR UPDATE;

  IF FOUND AND v_membership.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Already a member of this space';
  END IF;

  IF FOUND THEN
    UPDATE memberships
    SET role = v_invitation.role, deleted_at = NULL, joined_at = NOW(), updated_at = NOW()
    WHERE id = v_membership.id
    RETURNING * INTO v_membership;
  ELSE
    INSERT INTO memberships (user_id, space_id, role, joined_at)
    VALUES (v_user, v_invitation.space_id, v_invitation.role, NOW())
    RETURNING * INTO v_membership;
  END IF;

  UPDATE invitations
  SET status = 'accepted', accepted_by = v_user, accepted_at = NOW(), updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN v_membership;
END;
$$;

CREATE OR REPLACE FUNCTION respond_swap(p_swap_id UUID, p_response TEXT)
RETURNS task_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_swap task_swaps;
  v_instance task_instances;
BEGIN
  SELECT * INTO v_swap
  FROM task_swaps
  WHERE id = p_swap_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_user IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'Swap request not found';
  END IF;
  IF v_swap.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has already been handled';
  END IF;
  IF v_swap.requested_by = v_user THEN
    RAISE EXCEPTION 'The person who made the request cannot respond to it';
  END IF;
  IF v_swap.requested_to IS NOT NULL
    AND v_swap.requested_to <> v_user
    AND NOT EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = v_swap.task_instance_id
        AND has_role(ti.space_id, ARRAY['owner', 'admin', 'supervisor'])
    ) THEN
    RAISE EXCEPTION 'Only the requested member or a supervisor can respond';
  END IF;
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Response must be accepted or declined';
  END IF;

  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = v_swap.task_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR NOT is_space_member(v_instance.space_id) THEN
    RAISE EXCEPTION 'Task instance not found or permission denied';
  END IF;

  UPDATE task_swaps
  SET status = p_response, responded_by = v_user, responded_at = NOW(), updated_at = NOW()
  WHERE id = p_swap_id
  RETURNING * INTO v_swap;

  IF p_response = 'accepted' THEN
    UPDATE task_instances
    SET assignee_id = v_user, updated_at = NOW()
    WHERE id = v_instance.id;
  END IF;
  RETURN v_swap;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_swap(p_swap_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE task_swaps swap
  SET status = 'cancelled', updated_at = NOW()
  WHERE swap.id = p_swap_id
    AND swap.requested_by = auth.uid()
    AND swap.status = 'pending'
    AND swap.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending swap request not found';
  END IF;
END;
$$;

DROP POLICY IF EXISTS swap_update_involved ON task_swaps;
DROP POLICY IF EXISTS swap_delete_requester ON task_swaps;
CREATE POLICY "swap_select_space_members" ON task_swaps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_swaps.task_instance_id
        AND is_space_member(ti.space_id)
    )
  );

DROP POLICY IF EXISTS invitation_update_involved ON invitations;
DROP POLICY IF EXISTS invitation_select_involved ON invitations;
CREATE POLICY "invitation_select_involved" ON invitations
  FOR SELECT USING (
    invited_by = auth.uid()
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

REVOKE ALL ON FUNCTION revoke_invitation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_swap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_swap(UUID) TO authenticated;
REVOKE ALL ON FUNCTION replace_task_rotation_members(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_task_rotation_members(UUID, UUID[]) TO authenticated;
