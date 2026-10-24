-- Neatly Database - Row Level Security Policies
-- Rule: Users can only read/write rows of spaces where they have a membership
-- Actions allowed by role (role matrix):
-- owner/admin: full access
-- supervisor: manages tasks, issues, requests, verification
-- member/cleaner: completes assigned tasks, reports issues, requests supplies
-- auditor: read-only

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user has a role in a space
CREATE OR REPLACE FUNCTION has_role(space_id UUID, roles membership_role[])
RETURNS BOOLEAN AS $$
DECLARE
  user_role membership_role;
BEGIN
  SELECT role INTO user_role
  FROM memberships
  WHERE user_id = auth.uid()
    AND space_id = has_role.space_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN user_role = ANY(roles);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Helper function: Get user's role in a space
CREATE OR REPLACE FUNCTION get_user_role(space_id UUID)
RETURNS membership_role AS $$
DECLARE
  user_role membership_role;
BEGIN
  SELECT role INTO user_role
  FROM memberships
  WHERE user_id = auth.uid()
    AND space_id = get_user_role.space_id
    AND deleted_at IS NULL
  LIMIT 1;

  RETURN user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Helper function: Check if user is member of space
CREATE OR REPLACE FUNCTION is_space_member(space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND space_id = is_space_member.space_id
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================
-- ORGANIZATIONS
-- ============================================
-- Users can see organizations they belong to (via spaces)
CREATE POLICY "org_select_member" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces s
      JOIN memberships m ON m.space_id = s.id
      WHERE s.organization_id = organizations.id
        AND m.user_id = auth.uid()
        AND m.deleted_at IS NULL
        AND s.deleted_at IS NULL
    )
  );

-- Only owners can insert/update/delete organizations
CREATE POLICY "org_insert_owner" ON organizations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "org_update_owner" ON organizations
  FOR UPDATE USING (
    created_by = auth.uid()
  );

CREATE POLICY "org_delete_owner" ON organizations
  FOR DELETE USING (created_by = auth.uid());

-- ============================================
-- SPACES
-- ============================================
-- Members can view spaces they belong to
CREATE POLICY "space_select_member" ON spaces
  FOR SELECT USING (is_space_member(id));

-- Owners/admins can create spaces in their organization
CREATE POLICY "space_insert_owner_admin" ON spaces
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND (
      -- The creator of an organization may create its first space.
      organization_id IN (
        SELECT id FROM organizations
        WHERE created_by = auth.uid()
      )
      -- Existing space owners/admins may add more spaces to the organization.
      OR organization_id IN (
        SELECT s.organization_id FROM spaces s
        JOIN memberships m ON m.space_id = s.id
        WHERE m.user_id = auth.uid()
          AND m.deleted_at IS NULL
          AND s.deleted_at IS NULL
          AND has_role(s.id, ARRAY['owner', 'admin'])
      )
    )
  );

-- Owners/admins can update spaces
CREATE POLICY "space_update_owner_admin" ON spaces
  FOR UPDATE USING (
    has_role(id, ARRAY['owner', 'admin'])
  );

-- Owners can delete spaces
CREATE POLICY "space_delete_owner" ON spaces
  FOR DELETE USING (has_role(id, ARRAY['owner']));

-- ============================================
-- AREAS
-- ============================================
CREATE POLICY "area_select_member" ON areas
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "area_insert_supervisor_up" ON areas
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "area_update_supervisor_up" ON areas
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "area_delete_supervisor_up" ON areas
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- ============================================
-- MEMBERSHIPS
-- ============================================
-- Users can see their own memberships
CREATE POLICY "membership_select_own" ON memberships
  FOR SELECT USING (user_id = auth.uid());

-- Space owners/admins can see all memberships in their spaces
CREATE POLICY "membership_select_owner_admin" ON memberships
  FOR SELECT USING (
    has_role(space_id, ARRAY['owner', 'admin'])
  );

-- Owners/admins can insert memberships (invite users)
CREATE POLICY "membership_insert_owner_admin" ON memberships
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin'])
  );

-- Owners/admins can update roles
CREATE POLICY "membership_update_owner_admin" ON memberships
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin'])
  );

-- Owners can delete memberships (remove members)
CREATE POLICY "membership_delete_owner" ON memberships
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner'])
    AND user_id != auth.uid() -- Can't remove yourself
  );

-- ============================================
-- TASK TEMPLATES
-- ============================================
CREATE POLICY "template_select_member" ON task_templates
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "template_insert_supervisor_up" ON task_templates
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND created_by = auth.uid()
  );

CREATE POLICY "template_update_supervisor_up" ON task_templates
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "template_delete_supervisor_up" ON task_templates
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- ============================================
-- TASKS
-- ============================================
CREATE POLICY "task_select_member" ON tasks
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "task_insert_supervisor_up" ON tasks
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND created_by = auth.uid()
  );

CREATE POLICY "task_update_supervisor_up" ON tasks
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- Assignees can update their own task status
CREATE POLICY "task_update_assignee" ON tasks
  FOR UPDATE USING (
    assignee_id = auth.uid()
  );

CREATE POLICY "task_delete_supervisor_up" ON tasks
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- ============================================
-- TASK INSTANCES
-- ============================================
CREATE POLICY "instance_select_member" ON task_instances
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "instance_insert_supervisor_up" ON task_instances
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- Assignees can update their instances (start, complete, skip)
CREATE POLICY "instance_update_assignee" ON task_instances
  FOR UPDATE USING (
    assignee_id = auth.uid()
    OR has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "instance_delete_supervisor_up" ON task_instances
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- ============================================
-- TASK COMPLETIONS
-- ============================================
CREATE POLICY "completion_select_member" ON task_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_completions.task_instance_id
        AND is_space_member(ti.space_id)
    )
  );

-- Assignees can create completions for their instances
CREATE POLICY "completion_insert_assignee" ON task_completions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_completions.task_instance_id
        AND ti.assignee_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Supervisors+ can create completions for any instance
CREATE POLICY "completion_insert_supervisor_up" ON task_completions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_completions.task_instance_id
        AND has_role(ti.space_id, ARRAY['owner', 'admin', 'supervisor'])
    )
  );

CREATE POLICY "completion_update_own" ON task_completions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "completion_delete_owner_admin" ON task_completions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM task_instances ti
      WHERE ti.id = task_completions.task_instance_id
        AND has_role(ti.space_id, ARRAY['owner', 'admin'])
    )
  );

-- ============================================
-- ISSUES
-- ============================================
CREATE POLICY "issue_select_member" ON issues
  FOR SELECT USING (is_space_member(space_id));

-- Any member can report issues
CREATE POLICY "issue_insert_member" ON issues
  FOR INSERT WITH CHECK (
    is_space_member(space_id)
    AND reported_by = auth.uid()
  );

-- Reporters and supervisors+ can update
CREATE POLICY "issue_update_reporter_supervisor" ON issues
  FOR UPDATE USING (
    reported_by = auth.uid()
    OR has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- Assignees can update status
CREATE POLICY "issue_update_assignee" ON issues
  FOR UPDATE USING (
    assigned_to = auth.uid()
  );

CREATE POLICY "issue_delete_owner_admin" ON issues
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- ISSUE EVENTS
-- ============================================
CREATE POLICY "issue_event_select_member" ON issue_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_events.issue_id
        AND is_space_member(i.space_id)
    )
  );

CREATE POLICY "issue_event_insert_member" ON issue_events
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_events.issue_id
        AND is_space_member(i.space_id)
    )
  );

-- ============================================
-- SUPPLY ITEMS
-- ============================================
CREATE POLICY "supply_select_member" ON supply_items
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "supply_insert_supervisor_up" ON supply_items
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND created_by = auth.uid()
  );

CREATE POLICY "supply_update_supervisor_up" ON supply_items
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "supply_delete_supervisor_up" ON supply_items
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

-- ============================================
-- SUPPLY REQUESTS
-- ============================================
CREATE POLICY "request_select_member" ON supply_requests
  FOR SELECT USING (is_space_member(space_id));

-- Any member can request supplies
CREATE POLICY "request_insert_member" ON supply_requests
  FOR INSERT WITH CHECK (
    is_space_member(space_id)
    AND requested_by = auth.uid()
  );

-- Requesters and supervisors+ can update
CREATE POLICY "request_update_requester_supervisor" ON supply_requests
  FOR UPDATE USING (
    requested_by = auth.uid()
    OR has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
  );

CREATE POLICY "request_delete_owner_admin" ON supply_requests
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- NOTIFICATION PREFERENCES
-- ============================================
CREATE POLICY "notif_pref_select_own" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notif_pref_insert_own" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_pref_update_own" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notif_pref_delete_own" ON notification_preferences
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- RECOMMENDATIONS
-- ============================================
CREATE POLICY "recommendation_select_member" ON recommendations
  FOR SELECT USING (is_space_member(space_id));

CREATE POLICY "recommendation_insert_supervisor_up" ON recommendations
  FOR INSERT WITH CHECK (
    has_role(space_id, ARRAY['owner', 'admin', 'supervisor'])
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY "recommendation_update_owner" ON recommendations
  FOR UPDATE USING (
    has_role(space_id, ARRAY['owner', 'admin'])
    OR (created_by = auth.uid() AND action IN ('accept', 'edit', 'dismiss', 'disable'))
  );

CREATE POLICY "recommendation_delete_owner_admin" ON recommendations
  FOR DELETE USING (
    has_role(space_id, ARRAY['owner', 'admin'])
  );

-- ============================================
-- AUDIT EVENTS
-- ============================================
CREATE POLICY "audit_select_owner_admin" ON audit_events
  FOR SELECT USING (
    space_id IS NULL OR has_role(space_id, ARRAY['owner', 'admin', 'auditor'])
  );

-- System inserts only (no direct user inserts)
CREATE POLICY "audit_insert_system" ON audit_events
  FOR INSERT WITH CHECK (false);

-- ============================================
-- PROFILES
-- ============================================
CREATE POLICY "profile_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profile_select_space_members" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m1
      JOIN memberships m2 ON m2.space_id = m1.space_id
      WHERE m1.user_id = auth.uid()
        AND m1.deleted_at IS NULL
        AND m2.user_id = profiles.id
        AND m2.deleted_at IS NULL
    )
  );

CREATE POLICY "profile_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

