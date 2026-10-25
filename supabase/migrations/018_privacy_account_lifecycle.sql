-- Preserve operational history while removing a user by anonymizing authorship
-- references instead of deleting records created by that user.
DO $$
DECLARE
  v_table TEXT;
  v_column TEXT;
  v_constraint TEXT;
  v_pair RECORD;
BEGIN
  FOR v_pair IN
    SELECT * FROM (VALUES
      ('organizations', 'created_by'),
      ('spaces', 'created_by'),
      ('task_templates', 'created_by'),
      ('tasks', 'created_by'),
      ('task_completions', 'user_id'),
      ('issues', 'reported_by'),
      ('issue_events', 'user_id'),
      ('supply_requests', 'requested_by'),
      ('teams', 'created_by'),
      ('task_assignments', 'assigned_by'),
      ('task_comments', 'user_id'),
      ('task_swaps', 'requested_by'),
      ('invitations', 'invited_by'),
      ('task_dependencies', 'created_by'),
      ('task_checklist_items', 'created_by'),
      ('task_checklist_results', 'actor_user_id')
    ) AS refs(table_name, column_name)
  LOOP
    v_table := v_pair.table_name;
    v_column := v_pair.column_name;

    SELECT c.conname INTO v_constraint
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = format('public.%I', v_table)::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND a.attname = v_column
    LIMIT 1;

    IF v_constraint IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', v_table, v_column);
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_table, v_constraint);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL',
        v_table,
        v_constraint,
        v_column
      );
    END IF;
    v_constraint := NULL;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION log_self_service_audit(p_action TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_action NOT IN ('data_export', 'account_deletion_requested') THEN
    RAISE EXCEPTION 'Unsupported self-service audit action';
  END IF;

  INSERT INTO audit_events (user_id, action, resource_type, resource_id)
  VALUES (v_user, p_action, 'account', v_user);
END;
$$;

REVOKE ALL ON FUNCTION log_self_service_audit(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_self_service_audit(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_my_privacy_export()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM log_self_service_audit('data_export');

  RETURN jsonb_build_object(
    'exported_at', NOW(),
    'profile', (SELECT to_jsonb(p) FROM profiles p WHERE p.id = v_user),
    'memberships', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM memberships m WHERE m.user_id = v_user), '[]'::jsonb),
    'task_templates', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM task_templates t WHERE t.created_by = v_user), '[]'::jsonb),
    'tasks', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM tasks t WHERE t.created_by = v_user), '[]'::jsonb),
    'task_completions', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM task_completions c WHERE c.user_id = v_user), '[]'::jsonb),
    'task_comments', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM task_comments c WHERE c.user_id = v_user), '[]'::jsonb),
    'task_assignments', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM task_assignments a WHERE a.user_id = v_user OR a.assigned_by = v_user), '[]'::jsonb),
    'task_swaps', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM task_swaps s WHERE s.requested_by = v_user OR s.requested_to = v_user OR s.responded_by = v_user), '[]'::jsonb),
    'away_periods', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM member_away a WHERE a.user_id = v_user), '[]'::jsonb),
    'invitations', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM invitations i WHERE i.invited_by = v_user OR i.accepted_by = v_user), '[]'::jsonb),
    'issues_reported', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM issues i WHERE i.reported_by = v_user), '[]'::jsonb),
    'issue_events', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM issue_events e WHERE e.user_id = v_user), '[]'::jsonb),
    'supply_requests', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM supply_requests r WHERE r.requested_by = v_user), '[]'::jsonb),
    'notification_preferences', COALESCE((SELECT jsonb_agg(to_jsonb(n)) FROM notification_preferences n WHERE n.user_id = v_user), '[]'::jsonb),
    'recommendations', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM recommendations r WHERE r.created_by = v_user OR r.dismissed_by = v_user), '[]'::jsonb),
    'checklist_items', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM task_checklist_items i WHERE i.created_by = v_user), '[]'::jsonb),
    'checklist_results', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM task_checklist_results r WHERE r.actor_user_id = v_user), '[]'::jsonb),
    'audit_events', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM audit_events a WHERE a.user_id = v_user), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_my_privacy_export() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_my_privacy_export() TO authenticated;

CREATE OR REPLACE FUNCTION prepare_my_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_space RECORD;
  v_org RECORD;
  v_replacement UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- A personal space with no other members is wholly owned by the departing
  -- user and can be removed without affecting another account.
  DELETE FROM spaces s
  USING memberships own_membership
  WHERE own_membership.space_id = s.id
    AND own_membership.user_id = v_user
    AND own_membership.deleted_at IS NULL
    AND s.type = 'personal'
    AND NOT EXISTS (
      SELECT 1 FROM memberships other_membership
      WHERE other_membership.space_id = s.id
        AND other_membership.user_id <> v_user
        AND other_membership.deleted_at IS NULL
    );

  DELETE FROM organizations o
  WHERE o.created_by = v_user
    AND NOT EXISTS (SELECT 1 FROM spaces s WHERE s.organization_id = o.id);

  -- Do not strand a shared space without an owner. Promote an existing member
  -- when possible; otherwise abort before deleting any non-personal workspace.
  FOR v_space IN
    SELECT s.id, s.type
    FROM spaces s
    JOIN memberships m ON m.space_id = s.id
    WHERE m.user_id = v_user
      AND m.role = 'owner'
      AND m.deleted_at IS NULL
  LOOP
    SELECT m.user_id INTO v_replacement
    FROM memberships m
    WHERE m.space_id = v_space.id
      AND m.user_id <> v_user
      AND m.deleted_at IS NULL
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.joined_at
    LIMIT 1;

    IF v_replacement IS NULL AND v_space.type <> 'personal' THEN
      RAISE EXCEPTION 'This account is the only member of a shared space. Add another member before deleting the account.';
    ELSIF v_replacement IS NOT NULL THEN
      UPDATE memberships
      SET role = 'owner'
      WHERE space_id = v_space.id
        AND user_id = v_replacement
        AND role <> 'owner';
    END IF;
    v_replacement := NULL;
  END LOOP;

  -- If the account created an organization that still has members, transfer
  -- its ownership to an existing member before deleting the auth identity.
  FOR v_org IN
    SELECT o.id
    FROM organizations o
    WHERE o.created_by = v_user
      AND EXISTS (SELECT 1 FROM spaces s WHERE s.organization_id = o.id)
  LOOP
    SELECT m.user_id INTO v_replacement
    FROM spaces s
    JOIN memberships m ON m.space_id = s.id
    WHERE s.organization_id = v_org.id
      AND m.user_id <> v_user
      AND m.deleted_at IS NULL
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.joined_at
    LIMIT 1;

    IF v_replacement IS NULL THEN
      DELETE FROM organizations WHERE id = v_org.id;
    ELSE
      UPDATE organizations SET created_by = v_replacement WHERE id = v_org.id;
      UPDATE spaces SET created_by = v_replacement
      WHERE organization_id = v_org.id AND created_by = v_user;
      UPDATE memberships SET role = 'owner'
      WHERE space_id = (
        SELECT s.id FROM spaces s
        JOIN memberships m ON m.space_id = s.id
        WHERE s.organization_id = v_org.id AND m.user_id = v_replacement
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
        LIMIT 1
      )
        AND user_id = v_replacement
        AND role <> 'owner';
    END IF;
  END LOOP;

  -- Transfer creator attribution for any remaining space to a current member.
  FOR v_space IN
    SELECT s.id, s.organization_id
    FROM spaces s
    WHERE s.created_by = v_user
  LOOP
    SELECT m.user_id INTO v_replacement
    FROM memberships m
    WHERE m.space_id = v_space.id
      AND m.user_id <> v_user
      AND m.deleted_at IS NULL
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.joined_at
    LIMIT 1;

    IF v_replacement IS NULL AND v_space.organization_id IS NOT NULL THEN
      SELECT m.user_id INTO v_replacement
      FROM spaces s
      JOIN memberships m ON m.space_id = s.id
      WHERE s.organization_id = v_space.organization_id
        AND m.user_id <> v_user
        AND m.deleted_at IS NULL
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.joined_at
      LIMIT 1;
    END IF;

    IF v_replacement IS NOT NULL THEN
      UPDATE spaces SET created_by = v_replacement WHERE id = v_space.id;
    END IF;
    v_replacement := NULL;
  END LOOP;

  INSERT INTO audit_events (user_id, action, resource_type, resource_id)
  VALUES (v_user, 'account_deletion_requested', 'account', v_user);

  RETURN jsonb_build_object('prepared', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION prepare_my_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prepare_my_account_deletion() TO authenticated;

CREATE OR REPLACE FUNCTION audit_sensitive_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id UUID;
  v_action TEXT;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_TABLE_NAME = 'memberships' THEN
    IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
      v_space_id := NEW.space_id;
      v_action := 'membership_role_changed';
      v_old := jsonb_build_object('role', OLD.role);
      v_new := jsonb_build_object('role', NEW.role);
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'task_instances' THEN
    IF TG_OP = 'UPDATE' AND OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
      SELECT t.space_id INTO v_space_id
      FROM tasks t
      WHERE t.id = NEW.task_id;
      v_action := 'task_verification_changed';
      v_old := jsonb_build_object('verification_status', OLD.verification_status);
      v_new := jsonb_build_object(
        'verification_status', NEW.verification_status,
        'verified_by', NEW.verified_by,
        'verified_at', NEW.verified_at
      );
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO audit_events (space_id, user_id, action, resource_type, resource_id, old_value, new_value)
  VALUES (v_space_id, auth.uid(), v_action, TG_TABLE_NAME, NEW.id, v_old, v_new);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_membership_role_change ON memberships;
CREATE TRIGGER audit_membership_role_change
AFTER UPDATE OF role ON memberships
FOR EACH ROW EXECUTE FUNCTION audit_sensitive_row_change();

DROP TRIGGER IF EXISTS audit_task_verification_change ON task_instances;
CREATE TRIGGER audit_task_verification_change
AFTER UPDATE OF verification_status ON task_instances
FOR EACH ROW EXECUTE FUNCTION audit_sensitive_row_change();
