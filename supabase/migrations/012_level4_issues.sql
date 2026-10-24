-- Neatly Database - Level 4 Issues
-- Adds the issue category model, assignment targets, resolution and
-- verification records, checked lifecycle RPCs, private issue photos, and
-- rolling area+category patterns for later recommendations.
--
-- Lifecycle writes go through SECURITY DEFINER functions. Direct UPDATE and
-- event INSERT policies are intentionally removed so every status change has
-- an actor, timestamp, and note in issue_events.

-- ============================================
-- ISSUE FIELDS
-- ============================================
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS custom_category TEXT;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS external_service TEXT;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS verification_note TEXT;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS follow_up_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- One-off tasks are created by issue conversion. The recurrence engine still
-- understands their single due instant, but never repeats them.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_one_off BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'issue_category_check'
  ) THEN
    ALTER TABLE issues
      ADD CONSTRAINT issue_category_check
      CHECK (category IN (
        'cleanliness',
        'facility',
        'supplies',
        'organization',
        'outdoor',
        'other',
        'custom'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'issue_custom_category_check'
  ) THEN
    ALTER TABLE issues
      ADD CONSTRAINT issue_custom_category_check
      CHECK (
        category <> 'custom'
        OR (custom_category IS NOT NULL AND btrim(custom_category) <> '')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'issue_assignment_single_check'
  ) THEN
    ALTER TABLE issues
      ADD CONSTRAINT issue_assignment_single_check
      CHECK (
        (CASE WHEN assigned_to IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN assigned_team_id IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN external_service IS NOT NULL AND btrim(external_service) <> '' THEN 1 ELSE 0 END)
        <= 1
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'issue_reopen_count_check'
  ) THEN
    ALTER TABLE issues
      ADD CONSTRAINT issue_reopen_count_check CHECK (reopen_count >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_team ON issues(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_issues_due_at ON issues(due_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_issues_open
  ON issues(space_id, created_at DESC)
  WHERE deleted_at IS NULL
    AND status IN ('reported', 'acknowledged', 'in_progress', 'reopened');

CREATE INDEX IF NOT EXISTS idx_issue_events_issue_created
  ON issue_events(issue_id, created_at ASC);

-- ============================================
-- ROLLING ISSUE PATTERNS
-- Counts are stored per area + category over a rolling window. The trigger
-- keeps them current as issues are reported or removed; the public wrapper
-- lets the app refresh the window as time passes.
-- ============================================
CREATE TABLE IF NOT EXISTS issue_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  custom_category TEXT,
  pattern_key TEXT NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30 CHECK (window_days BETWEEN 1 AND 365),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  issue_count INTEGER NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  last_reported_at TIMESTAMPTZ,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT issue_patterns_unique
    UNIQUE (space_id, area_id, pattern_key, window_days)
);

CREATE TRIGGER update_issue_patterns_updated_at
  BEFORE UPDATE ON issue_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_issue_patterns_space_window
  ON issue_patterns(space_id, window_days, is_recurring);

ALTER TABLE issue_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issue_pattern_select_member" ON issue_patterns
  FOR SELECT USING (is_space_member(space_id));

-- Recompute one or more area+category rows. p_area_id, p_category, and
-- p_custom_category are optional filters; NULL means all values. The trigger
-- and the member-facing wrapper are the only callers.
CREATE OR REPLACE FUNCTION refresh_issue_patterns(
  p_space_id UUID,
  p_area_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_custom_category TEXT DEFAULT NULL,
  p_window_days INTEGER DEFAULT 30
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_start TIMESTAMPTZ;
  v_row RECORD;
  v_count INTEGER;
  v_last TIMESTAMPTZ;
  v_key TEXT;
BEGIN
  IF p_window_days IS NULL OR p_window_days < 1 OR p_window_days > 365 THEN
    RAISE EXCEPTION 'The pattern window must be between 1 and 365 days';
  END IF;

  v_start := v_now - make_interval(days => p_window_days);

  FOR v_row IN
    SELECT candidates.area_id, candidates.category, candidates.custom_category
    FROM (
      SELECT i.area_id, i.category, i.custom_category
      FROM issues i
      WHERE i.space_id = p_space_id
        AND i.area_id IS NOT NULL
        AND i.deleted_at IS NULL
        AND (p_area_id IS NULL OR i.area_id = p_area_id)
        AND (p_category IS NULL OR i.category = p_category)
        AND (p_custom_category IS NULL OR i.custom_category IS NOT DISTINCT FROM p_custom_category)
      UNION
      SELECT ip.area_id, ip.category, ip.custom_category
      FROM issue_patterns ip
      WHERE ip.space_id = p_space_id
        AND ip.window_days = p_window_days
        AND (p_area_id IS NULL OR ip.area_id = p_area_id)
        AND (p_category IS NULL OR ip.category = p_category)
        AND (p_custom_category IS NULL OR ip.custom_category IS NOT DISTINCT FROM p_custom_category)
    ) candidates
  LOOP
    v_key := v_row.category || ':' || COALESCE(btrim(v_row.custom_category), '');

    SELECT COUNT(*), MAX(i.created_at)
      INTO v_count, v_last
      FROM issues i
      WHERE i.space_id = p_space_id
        AND i.area_id = v_row.area_id
        AND i.category = v_row.category
        AND i.custom_category IS NOT DISTINCT FROM v_row.custom_category
        AND i.deleted_at IS NULL
        AND i.created_at >= v_start;

    IF v_count = 0 THEN
      DELETE FROM issue_patterns
      WHERE space_id = p_space_id
        AND area_id = v_row.area_id
        AND pattern_key = v_key
        AND window_days = p_window_days;
    ELSE
      INSERT INTO issue_patterns (
        space_id,
        area_id,
        category,
        custom_category,
        pattern_key,
        window_days,
        window_start,
        window_end,
        issue_count,
        is_recurring,
        last_reported_at,
        refreshed_at
      ) VALUES (
        p_space_id,
        v_row.area_id,
        v_row.category,
        v_row.custom_category,
        v_key,
        p_window_days,
        v_start,
        v_now,
        v_count,
        v_count >= 3,
        v_last,
        v_now
      )
      ON CONFLICT (space_id, area_id, pattern_key, window_days)
      DO UPDATE SET
        category = EXCLUDED.category,
        custom_category = EXCLUDED.custom_category,
        window_start = EXCLUDED.window_start,
        window_end = EXCLUDED.window_end,
        issue_count = EXCLUDED.issue_count,
        is_recurring = EXCLUDED.is_recurring,
        last_reported_at = EXCLUDED.last_reported_at,
        refreshed_at = EXCLUDED.refreshed_at,
        updated_at = NOW();
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION issue_patterns_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.area_id IS NOT NULL THEN
      PERFORM refresh_issue_patterns(
        OLD.space_id, OLD.area_id, OLD.category, OLD.custom_category, 30
      );
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.space_id IS DISTINCT FROM NEW.space_id
      OR OLD.area_id IS DISTINCT FROM NEW.area_id
      OR OLD.category IS DISTINCT FROM NEW.category
      OR OLD.custom_category IS DISTINCT FROM NEW.custom_category
      OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
    THEN
      IF OLD.area_id IS NOT NULL THEN
        PERFORM refresh_issue_patterns(
          OLD.space_id, OLD.area_id, OLD.category, OLD.custom_category, 30
        );
      END IF;
    END IF;
  END IF;

  IF NEW.area_id IS NOT NULL THEN
    PERFORM refresh_issue_patterns(
      NEW.space_id, NEW.area_id, NEW.category, NEW.custom_category, 30
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS issue_patterns_after_change ON issues;
CREATE TRIGGER issue_patterns_after_change
  AFTER INSERT OR UPDATE OR DELETE ON issues
  FOR EACH ROW EXECUTE FUNCTION issue_patterns_after_change();

-- Public wrapper used when a client opens the issues list. It refreshes the
-- rolling window so old reports fall out even when no issue row changed.
CREATE OR REPLACE FUNCTION refresh_space_issue_patterns(
  p_space_id UUID,
  p_window_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF p_window_days IS NULL OR p_window_days < 1 OR p_window_days > 365 THEN
    RAISE EXCEPTION 'The pattern window must be between 1 and 365 days';
  END IF;

  PERFORM refresh_issue_patterns(p_space_id, NULL, NULL, NULL, p_window_days);

  SELECT COUNT(*) INTO v_count
  FROM issue_patterns
  WHERE space_id = p_space_id AND window_days = p_window_days;

  RETURN v_count;
END;
$$;

-- ============================================
-- PERMISSION HELPERS
-- ============================================
CREATE OR REPLACE FUNCTION is_issue_assignee(p_issue_id UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM issues i
    WHERE i.id = p_issue_id
      AND i.deleted_at IS NULL
      AND (
        i.assigned_to = p_user
        OR (
          i.assigned_team_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM team_members tm
            WHERE tm.team_id = i.assigned_team_id
              AND tm.user_id = p_user
              AND tm.deleted_at IS NULL
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION can_manage_issue(p_space_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(p_space_id, ARRAY['owner', 'admin', 'supervisor']::membership_role[]);
$$;

-- ============================================
-- LIFECYCLE RPCS
-- ============================================
CREATE OR REPLACE FUNCTION create_issue(
  p_space_id UUID,
  p_area_id UUID,
  p_category TEXT,
  p_custom_category TEXT,
  p_title TEXT,
  p_description TEXT,
  p_priority issue_priority DEFAULT 'medium',
  p_photos TEXT[] DEFAULT '{}',
  p_due_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_photos TEXT[] := COALESCE(p_photos, '{}');
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF p_area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM areas
    WHERE id = p_area_id
      AND space_id = p_space_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Area not found in this space';
  END IF;

  IF p_category IS NULL OR p_category NOT IN (
    'cleanliness', 'facility', 'supplies', 'organization', 'outdoor', 'other', 'custom'
  ) THEN
    RAISE EXCEPTION 'Choose a valid issue category';
  END IF;

  IF p_category = 'custom' AND (p_custom_category IS NULL OR btrim(p_custom_category) = '') THEN
    RAISE EXCEPTION 'Name the custom category';
  END IF;

  IF btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Describe the issue';
  END IF;

  IF array_length(v_photos, 1) > 5 THEN
    RAISE EXCEPTION 'Attach no more than 5 photos';
  END IF;

  INSERT INTO issues (
    space_id,
    area_id,
    reported_by,
    title,
    description,
    category,
    custom_category,
    priority,
    status,
    photos,
    due_at
  ) VALUES (
    p_space_id,
    p_area_id,
    v_user,
    left(btrim(p_title), 160),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    p_category,
    CASE WHEN p_category = 'custom' THEN btrim(p_custom_category) ELSE NULL END,
    p_priority,
    'reported',
    v_photos,
    p_due_at
  )
  RETURNING * INTO v_issue;

  INSERT INTO issue_events (issue_id, user_id, action, new_value)
  VALUES (
    v_issue.id,
    v_user,
    'reported',
    jsonb_build_object(
      'status', v_issue.status,
      'priority', v_issue.priority,
      'category', v_issue.category,
      'custom_category', v_issue.custom_category
    )
  );

  RETURN v_issue;
END;
$$;

CREATE OR REPLACE FUNCTION assign_issue(
  p_issue_id UUID,
  p_assignee_id UUID DEFAULT NULL,
  p_team_id UUID DEFAULT NULL,
  p_external_service TEXT DEFAULT NULL,
  p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_clear_due_date BOOLEAN DEFAULT FALSE
)
RETURNS issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_external TEXT := NULLIF(btrim(COALESCE(p_external_service, '')), '');
  v_has_target BOOLEAN;
  v_new_status issue_status;
  v_old JSONB;
  v_new JSONB;
  v_label TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_issue
  FROM issues
  WHERE id = p_issue_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF NOT has_role(v_issue.space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only owners, admins, and supervisors can assign issues';
  END IF;

  IF v_issue.status IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'Reopen the issue before assigning it';
  END IF;

  IF p_assignee_id IS NOT NULL AND p_team_id IS NOT NULL THEN
    RAISE EXCEPTION 'Choose a person, a team, or an external service, not more than one';
  END IF;

  IF p_assignee_id IS NOT NULL AND v_external IS NOT NULL THEN
    RAISE EXCEPTION 'Choose a person, a team, or an external service, not more than one';
  END IF;

  IF p_team_id IS NOT NULL AND v_external IS NOT NULL THEN
    RAISE EXCEPTION 'Choose a person, a team, or an external service, not more than one';
  END IF;

  IF p_assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE space_id = v_issue.space_id
      AND user_id = p_assignee_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'That person is not a member of this space';
  END IF;

  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM teams
    WHERE id = p_team_id
      AND space_id = v_issue.space_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'That team does not belong to this space';
  END IF;

  IF p_due_at IS NOT NULL AND p_due_at < NOW() THEN
    RAISE EXCEPTION 'Choose a due date in the future';
  END IF;

  v_has_target := p_assignee_id IS NOT NULL OR p_team_id IS NOT NULL OR v_external IS NOT NULL;

  v_new_status := v_issue.status;
  IF v_has_target AND v_issue.status IN ('reported', 'reopened') THEN
    v_new_status := 'acknowledged';
  ELSIF NOT v_has_target AND v_issue.status IN ('acknowledged', 'reopened') THEN
    v_new_status := 'reported';
  END IF;

  IF p_assignee_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(btrim(full_name), ''), 'Member')
      INTO v_label
      FROM profiles
      WHERE id = p_assignee_id;
    v_label := COALESCE(v_label, 'Member');
  ELSIF p_team_id IS NOT NULL THEN
    SELECT name INTO v_label FROM teams WHERE id = p_team_id;
  ELSE
    v_label := v_external;
  END IF;

  v_old := jsonb_build_object(
    'status', v_issue.status,
    'assigned_to', v_issue.assigned_to,
    'assigned_team_id', v_issue.assigned_team_id,
    'external_service', v_issue.external_service,
    'due_at', v_issue.due_at
  );

  UPDATE issues
  SET assigned_to = p_assignee_id,
      assigned_team_id = p_team_id,
      external_service = v_external,
      assigned_by = CASE WHEN v_has_target THEN v_user ELSE NULL END,
      assigned_at = CASE WHEN v_has_target THEN NOW() ELSE NULL END,
      due_at = CASE
        WHEN p_clear_due_date THEN NULL
        ELSE COALESCE(p_due_at, v_issue.due_at)
      END,
      status = v_new_status,
      updated_at = NOW()
  WHERE id = p_issue_id
  RETURNING * INTO v_issue;

  v_new := jsonb_build_object(
    'status', v_issue.status,
    'assigned_to', v_issue.assigned_to,
    'assigned_team_id', v_issue.assigned_team_id,
    'external_service', v_issue.external_service,
    'due_at', v_issue.due_at,
    'assignee_label', v_label
  );

  INSERT INTO issue_events (issue_id, user_id, action, old_value, new_value, comment)
  VALUES (
    v_issue.id,
    v_user,
    'assigned',
    v_old,
    v_new,
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );

  RETURN v_issue;
END;
$$;

CREATE OR REPLACE FUNCTION start_issue(
  p_issue_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_unassigned BOOLEAN;
  v_old JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_issue
  FROM issues
  WHERE id = p_issue_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF NOT is_space_member(v_issue.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF v_issue.status NOT IN ('reported', 'acknowledged', 'reopened') THEN
    RAISE EXCEPTION 'This issue cannot be started from its current status';
  END IF;

  v_unassigned := v_issue.assigned_to IS NULL
    AND v_issue.assigned_team_id IS NULL
    AND v_issue.external_service IS NULL;

  IF NOT (
    has_role(v_issue.space_id, ARRAY['owner', 'admin', 'supervisor'])
    OR is_issue_assignee(v_issue.id, v_user)
    OR (v_unassigned AND v_issue.reported_by = v_user)
  ) THEN
    RAISE EXCEPTION 'Only the assignee or a supervisor can start this issue';
  END IF;

  v_old := jsonb_build_object('status', v_issue.status);

  UPDATE issues
  SET status = 'in_progress',
      updated_at = NOW()
  WHERE id = p_issue_id
  RETURNING * INTO v_issue;

  INSERT INTO issue_events (issue_id, user_id, action, old_value, new_value, comment)
  VALUES (
    v_issue.id,
    v_user,
    'started',
    v_old,
    jsonb_build_object('status', v_issue.status),
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );

  RETURN v_issue;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_issue(
  p_issue_id UUID,
  p_resolution_note TEXT
)
RETURNS issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_unassigned BOOLEAN;
  v_old JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_issue
  FROM issues
  WHERE id = p_issue_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF NOT is_space_member(v_issue.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF v_issue.status NOT IN ('reported', 'acknowledged', 'in_progress', 'reopened') THEN
    RAISE EXCEPTION 'This issue cannot be resolved from its current status';
  END IF;

  IF btrim(COALESCE(p_resolution_note, '')) = '' THEN
    RAISE EXCEPTION 'Add a short resolution note';
  END IF;

  v_unassigned := v_issue.assigned_to IS NULL
    AND v_issue.assigned_team_id IS NULL
    AND v_issue.external_service IS NULL;

  IF NOT (
    has_role(v_issue.space_id, ARRAY['owner', 'admin', 'supervisor'])
    OR is_issue_assignee(v_issue.id, v_user)
    OR (v_unassigned AND v_issue.reported_by = v_user)
  ) THEN
    RAISE EXCEPTION 'Only the assignee or a supervisor can resolve this issue';
  END IF;

  v_old := jsonb_build_object('status', v_issue.status);

  UPDATE issues
  SET status = 'resolved',
      resolution_note = btrim(p_resolution_note),
      resolved_by = v_user,
      resolved_at = NOW(),
      verified_by = NULL,
      verified_at = NULL,
      verification_note = NULL,
      closed_at = NULL,
      updated_at = NOW()
  WHERE id = p_issue_id
  RETURNING * INTO v_issue;

  INSERT INTO issue_events (issue_id, user_id, action, old_value, new_value, comment)
  VALUES (
    v_issue.id,
    v_user,
    'resolved',
    v_old,
    jsonb_build_object('status', v_issue.status),
    btrim(p_resolution_note)
  );

  RETURN v_issue;
END;
$$;

CREATE OR REPLACE FUNCTION verify_issue(
  p_issue_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_old JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_issue
  FROM issues
  WHERE id = p_issue_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF NOT is_space_member(v_issue.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF v_issue.status <> 'resolved' THEN
    RAISE EXCEPTION 'Only resolved issues can be verified';
  END IF;

  IF NOT (
    has_role(v_issue.space_id, ARRAY['owner', 'admin', 'supervisor'])
    OR v_issue.reported_by = v_user
  ) THEN
    RAISE EXCEPTION 'Only the reporter or a supervisor can verify this issue';
  END IF;

  v_old := jsonb_build_object('status', v_issue.status);

  UPDATE issues
  SET status = 'closed',
      verified_by = v_user,
      verified_at = NOW(),
      verification_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      closed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_issue_id
  RETURNING * INTO v_issue;

  INSERT INTO issue_events (issue_id, user_id, action, old_value, new_value, comment)
  VALUES (
    v_issue.id,
    v_user,
    'verified',
    v_old,
    jsonb_build_object('status', v_issue.status),
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );

  RETURN v_issue;
END;
$$;

CREATE OR REPLACE FUNCTION reopen_issue(
  p_issue_id UUID,
  p_note TEXT
)
RETURNS issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_old JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_issue
  FROM issues
  WHERE id = p_issue_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF NOT is_space_member(v_issue.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF v_issue.status NOT IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'Only resolved or closed issues can be reopened';
  END IF;

  IF NOT (
    has_role(v_issue.space_id, ARRAY['owner', 'admin', 'supervisor'])
    OR v_issue.reported_by = v_user
  ) THEN
    RAISE EXCEPTION 'Only the reporter or a supervisor can reopen this issue';
  END IF;

  IF btrim(COALESCE(p_note, '')) = '' THEN
    RAISE EXCEPTION 'Add a note about what still needs attention';
  END IF;

  v_old := jsonb_build_object(
    'status', v_issue.status,
    'resolution_note', v_issue.resolution_note,
    'verification_note', v_issue.verification_note
  );

  UPDATE issues
  SET status = 'reopened',
      resolved_at = NULL,
      resolved_by = NULL,
      resolution_note = NULL,
      verified_at = NULL,
      verified_by = NULL,
      verification_note = NULL,
      closed_at = NULL,
      reopened_at = NOW(),
      reopen_count = reopen_count + 1,
      updated_at = NOW()
  WHERE id = p_issue_id
  RETURNING * INTO v_issue;

  INSERT INTO issue_events (issue_id, user_id, action, old_value, new_value, comment)
  VALUES (
    v_issue.id,
    v_user,
    'reopened',
    v_old,
    jsonb_build_object('status', v_issue.status, 'reopen_count', v_issue.reopen_count),
    btrim(p_note)
  );

  RETURN v_issue;
END;
$$;

CREATE OR REPLACE FUNCTION add_issue_comment(
  p_issue_id UUID,
  p_comment TEXT
)
RETURNS issue_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_event issue_events;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_issue
  FROM issues
  WHERE id = p_issue_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF NOT is_space_member(v_issue.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF btrim(COALESCE(p_comment, '')) = '' THEN
    RAISE EXCEPTION 'Write a comment first';
  END IF;

  INSERT INTO issue_events (issue_id, user_id, action, comment)
  VALUES (v_issue.id, v_user, 'commented', btrim(p_comment))
  RETURNING * INTO v_event;

  RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION attach_issue_photos(
  p_issue_id UUID,
  p_photos TEXT[]
)
RETURNS issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_photos TEXT[] := COALESCE(p_photos, '{}');
  v_path TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_issue
  FROM issues
  WHERE id = p_issue_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  IF NOT is_space_member(v_issue.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF NOT (
    has_role(v_issue.space_id, ARRAY['owner', 'admin', 'supervisor'])
    OR v_issue.reported_by = v_user
  ) THEN
    RAISE EXCEPTION 'Only the reporter or a supervisor can attach photos';
  END IF;

  IF array_length(v_photos, 1) > 5 THEN
    RAISE EXCEPTION 'Attach no more than 5 photos';
  END IF;

  FOREACH v_path IN ARRAY v_photos LOOP
    IF v_path IS NULL OR v_path NOT LIKE v_issue.space_id::text || '/' || v_issue.id::text || '/%' THEN
      RAISE EXCEPTION 'A photo does not belong to this issue';
    END IF;
  END LOOP;

  UPDATE issues
  SET photos = v_photos,
      updated_at = NOW()
  WHERE id = p_issue_id
  RETURNING * INTO v_issue;

  INSERT INTO issue_events (issue_id, user_id, action, new_value)
  VALUES (
    v_issue.id,
    v_user,
    'photos_attached',
    jsonb_build_object('photo_count', COALESCE(array_length(v_photos, 1), 0))
  );

  RETURN v_issue;
END;
$$;

-- Personal spaces convert in one tap and close the issue with a clear note.
-- Organization spaces link a one-off follow-up task and leave the issue open
-- for the normal resolve/verify flow.
CREATE OR REPLACE FUNCTION convert_issue_to_task(
  p_issue_id UUID,
  p_due_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_issue issues;
  v_space spaces;
  v_task tasks;
  v_due TIMESTAMPTZ;
  v_close BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_issue
  FROM issues
  WHERE id = p_issue_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Issue not found';
  END IF;

  SELECT * INTO v_space FROM spaces WHERE id = v_issue.space_id;

  IF NOT is_space_member(v_issue.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF v_space.type <> 'personal' AND NOT has_role(
    v_issue.space_id, ARRAY['owner', 'admin', 'supervisor']
  ) THEN
    RAISE EXCEPTION 'Only owners, admins, and supervisors can create follow-up tasks';
  END IF;

  IF v_issue.follow_up_task_id IS NOT NULL THEN
    SELECT * INTO v_task FROM tasks WHERE id = v_issue.follow_up_task_id;
    IF FOUND THEN
      RETURN v_task;
    END IF;
  END IF;

  v_due := COALESCE(p_due_at, v_issue.due_at, NOW() + INTERVAL '1 day');
  v_close := v_space.type = 'personal';

  INSERT INTO tasks (
    space_id,
    template_id,
    area_id,
    name,
    description,
    estimated_minutes,
    frequency,
    custom_frequency_days,
    due_time,
    schedule_anchor_at,
    assignee_id,
    assignee_role,
    required_skills,
    supplies_needed,
    instructions,
    is_active,
    is_one_off,
    created_by
  ) VALUES (
    v_issue.space_id,
    NULL,
    v_issue.area_id,
    left('Follow up: ' || v_issue.title, 120),
    COALESCE(v_issue.description, v_issue.title),
    NULL,
    'custom',
    1,
    (v_due AT TIME ZONE v_space.timezone)::time,
    v_due,
    v_issue.assigned_to,
    NULL,
    '{}',
    '{}',
    'Created from an issue. Complete it when the follow-up is done.',
    TRUE,
    TRUE,
    v_user
  )
  RETURNING * INTO v_task;

  INSERT INTO task_instances (
    task_id,
    space_id,
    assignee_id,
    due_at,
    timezone,
    status
  ) VALUES (
    v_task.id,
    v_issue.space_id,
    v_issue.assigned_to,
    v_due,
    v_space.timezone,
    'pending'
  );

  IF v_close THEN
    UPDATE issues
    SET follow_up_task_id = v_task.id,
        status = 'closed',
        resolution_note = COALESCE(v_issue.resolution_note, 'Converted to a follow-up task.'),
        resolved_by = COALESCE(v_issue.resolved_by, v_user),
        resolved_at = COALESCE(v_issue.resolved_at, NOW()),
        verified_by = COALESCE(v_issue.verified_by, v_user),
        verified_at = COALESCE(v_issue.verified_at, NOW()),
        verification_note = COALESCE(
          v_issue.verification_note,
          'Converted to a follow-up task.'
        ),
        closed_at = COALESCE(v_issue.closed_at, NOW()),
        updated_at = NOW()
    WHERE id = p_issue_id
    RETURNING * INTO v_issue;
  ELSE
    UPDATE issues
    SET follow_up_task_id = v_task.id,
        updated_at = NOW()
    WHERE id = p_issue_id
    RETURNING * INTO v_issue;
  END IF;

  INSERT INTO issue_events (issue_id, user_id, action, new_value, comment)
  VALUES (
    v_issue.id,
    v_user,
    'converted_to_task',
    jsonb_build_object(
      'task_id', v_task.id,
      'task_name', v_task.name,
      'closed', v_close
    ),
    CASE
      WHEN v_close THEN 'Converted to a one-off task.'
      ELSE 'Created a follow-up task.'
    END
  );

  RETURN v_task;
END;
$$;

-- ============================================
-- RLS HARDENING
-- Status changes, comments, photo attachment, and task conversion are only
-- possible through the checked functions above. Reads remain member-only.
-- ============================================
DROP POLICY IF EXISTS "issue_insert_member" ON issues;
DROP POLICY IF EXISTS "issue_update_reporter_supervisor" ON issues;
DROP POLICY IF EXISTS "issue_update_assignee" ON issues;
DROP POLICY IF EXISTS "issue_event_insert_member" ON issue_events;

-- ============================================
-- PRIVATE ISSUE PHOTOS
-- Path convention: <space_id>/<issue_id>/<file>
-- ============================================
CREATE OR REPLACE FUNCTION safe_uuid(p_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_value::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'issue-photos',
  'issue-photos',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "issue_photo_select_member" ON storage.objects;
CREATE POLICY "issue_photo_select_member" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'issue-photos'
    AND is_space_member(safe_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS "issue_photo_insert_member" ON storage.objects;
CREATE POLICY "issue_photo_insert_member" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'issue-photos'
    AND auth.uid() IS NOT NULL
    AND is_space_member(safe_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS "issue_photo_update_owner" ON storage.objects;
CREATE POLICY "issue_photo_update_owner" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'issue-photos'
    AND (
      owner = auth.uid()
      OR has_role(
        safe_uuid((storage.foldername(name))[1]),
        ARRAY['owner', 'admin', 'supervisor']
      )
    )
  );

DROP POLICY IF EXISTS "issue_photo_delete_owner" ON storage.objects;
CREATE POLICY "issue_photo_delete_owner" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'issue-photos'
    AND (
      owner = auth.uid()
      OR has_role(
        safe_uuid((storage.foldername(name))[1]),
        ARRAY['owner', 'admin', 'supervisor']
      )
    )
  );

-- ============================================
-- FUNCTION GRANTS
-- ============================================
REVOKE ALL ON FUNCTION refresh_issue_patterns(UUID, UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_issue_assignee(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION can_manage_issue(UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION refresh_space_issue_patterns(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_issue(UUID, UUID, TEXT, TEXT, TEXT, TEXT, issue_priority, TEXT[], TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_issue(UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION start_issue(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_issue(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION verify_issue(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reopen_issue(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION add_issue_comment(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION attach_issue_photos(UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION convert_issue_to_task(UUID, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION safe_uuid(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_space_issue_patterns(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION create_issue(UUID, UUID, TEXT, TEXT, TEXT, TEXT, issue_priority, TEXT[], TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_issue(UUID, UUID, UUID, TEXT, TIMESTAMPTZ, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION start_issue(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_issue(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_issue(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reopen_issue(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_issue_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION attach_issue_photos(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_issue_to_task(UUID, TIMESTAMPTZ) TO authenticated;
