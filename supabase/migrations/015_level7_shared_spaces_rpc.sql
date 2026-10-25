-- Neatly Database - Level 7 Shared Spaces RPCs
-- Adds RPCs for team management, assignments, swaps, away periods, and invitations

-- ============================================
-- TEAM MANAGEMENT
-- ============================================
CREATE OR REPLACE FUNCTION create_team(
  p_space_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL
)
RETURNS teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_team teams;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT has_role(p_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can create teams';
  END IF;

  IF btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Team name is required';
  END IF;

  INSERT INTO teams (space_id, name, description, color, created_by)
  VALUES (p_space_id, btrim(p_name), p_description, p_color, v_user)
  RETURNING * INTO v_team;

  RETURN v_team;
END;
$$;

CREATE OR REPLACE FUNCTION update_team(
  p_team_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL
)
RETURNS teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_team teams;
  v_space_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT space_id INTO v_space_id
  FROM teams
  WHERE id = p_team_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  IF NOT has_role(v_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can update teams';
  END IF;

  UPDATE teams
  SET name = COALESCE(btrim(p_name), name),
      description = p_description,
      color = p_color,
      updated_at = NOW()
  WHERE id = p_team_id
  RETURNING * INTO v_team;

  RETURN v_team;
END;
$$;

-- ============================================
-- TEAM MEMBER MANAGEMENT
-- ============================================
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
  v_user UUID := auth.uid();
  v_member team_members;
  v_space_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT space_id INTO v_space_id
  FROM teams
  WHERE id = p_team_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  IF NOT has_role(v_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can add team members';
  END IF;

  IF p_role NOT IN ('lead', 'member') THEN
    RAISE EXCEPTION 'Role must be lead or member';
  END IF;

  INSERT INTO team_members (team_id, user_id, role, joined_at)
  VALUES (p_team_id, p_user_id, p_role, NOW())
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

-- ============================================
-- INVITATION MANAGEMENT
-- ============================================
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
  v_token TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT has_role(p_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can create invitations';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := COALESCE(p_expires_at, NOW() + INTERVAL '7 days');

  INSERT INTO invitations (space_id, email, role, token, invited_by, expires_at)
  VALUES (p_space_id, p_email, p_role, v_token, v_user, v_expires)
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
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

  -- Check if already a member
  SELECT * INTO v_membership
  FROM memberships
  WHERE user_id = v_user
    AND space_id = v_invitation.space_id
    AND deleted_at IS NULL;

  IF FOUND THEN
    RAISE EXCEPTION 'Already a member of this space';
  END IF;

  -- Create membership
  INSERT INTO memberships (user_id, space_id, role, joined_at)
  VALUES (v_user, v_invitation.space_id, v_invitation.role, NOW())
  RETURNING * INTO v_membership;

  -- Update invitation
  UPDATE invitations
  SET status = 'accepted',
      accepted_by = v_user,
      accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN v_membership;
END;
$$;

-- ============================================
-- AWAY PERIOD MANAGEMENT
-- ============================================
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
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF p_starts_at > COALESCE(p_ends_at, NOW() + INTERVAL '365 days') THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  INSERT INTO member_away (space_id, user_id, type, starts_at, ends_at, reason, created_by)
  VALUES (p_space_id, v_user, p_type, p_starts_at, p_ends_at, p_reason, v_user)
  RETURNING * INTO v_away;

  RETURN v_away;
END;
$$;

-- ============================================
-- TASK SWAP MANAGEMENT
-- ============================================
CREATE OR REPLACE FUNCTION request_swap(
  p_task_instance_id UUID,
  p_requested_to UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS task_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_instance task_instances;
  v_swap task_swaps;
  v_space_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_task_instance_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_space_id := v_instance.space_id;

  IF NOT is_space_member(v_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF v_instance.assignee_id <> v_user AND v_instance.assignee_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only the assignee can request a swap';
  END IF;

  IF p_requested_to IS NOT NULL THEN
    IF NOT is_space_member(v_space_id, p_requested_to) THEN
      RAISE EXCEPTION 'Requested person is not a member of this space';
    END IF;
  END IF;

  INSERT INTO task_swaps (task_instance_id, requested_by, requested_to, reason)
  VALUES (p_task_instance_id, v_user, p_requested_to, p_reason)
  RETURNING * INTO v_swap;

  RETURN v_swap;
END;
$$;

CREATE OR REPLACE FUNCTION respond_swap(
  p_swap_id UUID,
  p_response TEXT
)
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
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_swap
  FROM task_swaps
  WHERE id = p_swap_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap request not found';
  END IF;

  IF v_swap.status <> 'pending' THEN
    RAISE EXCEPTION 'This swap has already been responded to';
  END IF;

  IF v_swap.requested_to IS NOT NULL AND v_swap.requested_to <> v_user THEN
    RAISE EXCEPTION 'Only the requested person can respond';
  END IF;

  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Response must be accepted or declined';
  END IF;

  UPDATE task_swaps
  SET status = p_response,
      responded_by = v_user,
      responded_at = NOW()
  WHERE id = p_swap_id
  RETURNING * INTO v_swap;

  -- If accepted, reassign the task
  IF p_response = 'accepted' THEN
    SELECT * INTO v_instance
    FROM task_instances
    WHERE id = v_swap.task_instance_id AND deleted_at IS NULL;

    IF FOUND THEN
      UPDATE task_instances
      SET assignee_id = v_user,
          updated_at = NOW()
      WHERE id = v_instance.id;
    END IF;
  END IF;

  RETURN v_swap;
END;
$$;

-- ============================================
-- FUNCTION GRANTS
-- ============================================
REVOKE ALL ON FUNCTION create_team(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_team(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION add_team_member(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_invitation(UUID, TEXT, membership_role, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION accept_invitation(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_away(UUID, away_type, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_swap(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION respond_swap(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_team(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_team(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_team_member(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_invitation(UUID, TEXT, membership_role, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_away(UUID, away_type, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION request_swap(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_swap(UUID, TEXT) TO authenticated;
