-- Neatly Database - Level 7 Shared Spaces RLS
-- Policies for tables created in 007_shared_spaces.sql.
-- Kept separate from 002 so the base policies can run before these tables exist.

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_away ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TEAMS
-- ============================================
CREATE POLICY "team_select_member" ON teams
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "team_insert_supervisor_up" ON teams
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND created_by = auth.uid()
  );

CREATE POLICY "team_update_supervisor_up" ON teams
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "team_delete_supervisor_up" ON teams
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- ============================================
-- TEAM MEMBERS
-- ============================================
CREATE POLICY "team_member_select_member" ON team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND is_space_member(t.space_id)
    )
  );

CREATE POLICY "team_member_insert_owner_admin" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND has_role(t.space_id, ARRAY['owner', 'admin'])
    )
  );

CREATE POLICY "team_member_update_owner_admin" ON team_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND has_role(t.space_id, ARRAY['owner', 'admin'])
    )
  );

CREATE POLICY "team_member_delete_owner_admin" ON team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_members.team_id
        AND has_role(t.space_id, ARRAY['owner', 'admin'])
    )
  );

-- ============================================
-- TASK ASSIGNMENTS
-- ============================================
CREATE POLICY "assignment_select_member" ON task_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignments.task_id
        AND is_space_member(t.space_id)
    )
  );

CREATE POLICY "assignment_insert_supervisor_up" ON task_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignments.task_id
        AND has_role(t.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
    AND assigned_by = auth.uid()
  );

CREATE POLICY "assignment_update_supervisor_up" ON task_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignments.task_id
        AND has_role(t.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  );

CREATE POLICY "assignment_delete_supervisor_up" ON task_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_assignments.task_id
        AND has_role(t.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  );

-- ============================================
-- TASK COMMENTS
-- ============================================
CREATE POLICY "comment_select_member" ON task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_comments.task_instance_id
        AND is_space_member(ti.space_id)
    )
  );

CREATE POLICY "comment_insert_member" ON task_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_comments.task_instance_id
        AND is_space_member(ti.space_id)
    )
  );

CREATE POLICY "comment_update_own" ON task_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "comment_delete_own_supervisor" ON task_comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_comments.task_instance_id
        AND has_role(ti.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  );

-- ============================================
-- TASK SWAPS
-- ============================================
CREATE POLICY "swap_select_involved" ON task_swaps
  FOR SELECT USING (
    requested_by = auth.uid()
    OR requested_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_swaps.task_instance_id
        AND has_role(ti.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  );

CREATE POLICY "swap_insert_member" ON task_swaps
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_swaps.task_instance_id
        AND is_space_member(ti.space_id)
    )
  );

CREATE POLICY "swap_update_involved" ON task_swaps
  FOR UPDATE USING (
    requested_by = auth.uid()
    OR requested_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_swaps.task_instance_id
        AND has_role(ti.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  );

CREATE POLICY "swap_delete_requester" ON task_swaps
  FOR DELETE USING (requested_by = auth.uid());

-- ============================================
-- MEMBER AWAY
-- ============================================
CREATE POLICY "away_select_member" ON member_away
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "away_insert_own" ON member_away
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND created_by = auth.uid()
    AND is_space_member(space_id)
  );

CREATE POLICY "away_insert_supervisor_up" ON member_away
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND created_by = auth.uid()
  );

CREATE POLICY "away_update_own_supervisor" ON member_away
  FOR UPDATE USING (
    user_id = auth.uid()
    OR has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "away_delete_own_supervisor" ON member_away
  FOR DELETE USING (
    user_id = auth.uid()
    OR has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- ============================================
-- INVITATIONS
-- ============================================
CREATE POLICY "invitation_select_involved" ON invitations
  FOR SELECT USING (
    invited_by = auth.uid()
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR has_role(space_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "invitation_insert_owner_admin" ON invitations
  FOR INSERT WITH CHECK (
    invited_by = auth.uid()
    AND has_role(space_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "invitation_update_involved" ON invitations
  FOR UPDATE USING (
    invited_by = auth.uid()
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR has_role(space_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "invitation_delete_owner_admin" ON invitations
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin'])
  );
