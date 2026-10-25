-- Neatly Database - Level 5 QR & Evidence
-- Adds rotatable area QR tokens with rate-limited public lookup, PIN-based
-- shared-device sessions, checklist execution, private task evidence, and
-- supervisor verification/rework records.
--
-- Writes that affect status, evidence, checklist answers, or verification go
-- through SECURITY DEFINER functions. Direct completion writes are removed so
-- a client cannot skip checklist or verification rules.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- TASK EVIDENCE & VERIFICATION FIELDS
-- ============================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS evidence_rule TEXT;

ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS evidence_rule TEXT;

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'not_required';

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS verification_note TEXT;

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS rework_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS rework_requested_at TIMESTAMPTZ;

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS rework_note TEXT;

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS rework_of_instance_id UUID REFERENCES task_instances(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_evidence_rule_check'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT task_evidence_rule_check
      CHECK (
        evidence_rule IS NULL
        OR evidence_rule IN ('none', 'checklist', 'photo', 'supervisor_review')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'template_evidence_rule_check'
  ) THEN
    ALTER TABLE task_templates
      ADD CONSTRAINT template_evidence_rule_check
      CHECK (
        evidence_rule IS NULL
        OR evidence_rule IN ('none', 'checklist', 'photo', 'supervisor_review')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_verification_status_check'
  ) THEN
    ALTER TABLE task_instances
      ADD CONSTRAINT task_verification_status_check
      CHECK (verification_status IN ('not_required', 'pending', 'verified', 'rework_requested'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_task_instances_verification_queue
  ON task_instances (space_id, submitted_at)
  WHERE deleted_at IS NULL
    AND status = 'completed'
    AND verification_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_task_instances_rework_of
  ON task_instances (rework_of_instance_id)
  WHERE rework_of_instance_id IS NOT NULL;

-- ============================================
-- CHECKLIST DEFINITIONS AND RESULTS
-- ============================================
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT task_checklist_label_check CHECK (btrim(label) <> '')
);

CREATE TRIGGER update_task_checklist_items_updated_at
  BEFORE UPDATE ON task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task
  ON task_checklist_items (task_id, position)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_checklist_items_task_position
  ON task_checklist_items (task_id, position)
  WHERE deleted_at IS NULL;

ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_checklist_select_member" ON task_checklist_items
  FOR SELECT USING (is_space_member(space_id));

CREATE TABLE IF NOT EXISTS task_checklist_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES task_checklist_items(id) ON DELETE CASCADE,
  label_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done', 'not_applicable', 'problem')),
  note TEXT,
  issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_checklist_result_unique
    UNIQUE (task_instance_id, checklist_item_id)
);

CREATE TRIGGER update_task_checklist_results_updated_at
  BEFORE UPDATE ON task_checklist_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_task_checklist_results_instance
  ON task_checklist_results (task_instance_id);

ALTER TABLE task_checklist_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_checklist_result_select_member" ON task_checklist_results
  FOR SELECT USING (is_space_member(space_id));

-- ============================================
-- ISSUE SOURCE LINKS
-- A problem found during checklist execution keeps a link back to the exact
-- instance and step that raised it.
-- ============================================
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS source_task_instance_id UUID REFERENCES task_instances(id) ON DELETE SET NULL;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS source_checklist_item_id UUID REFERENCES task_checklist_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issues_source_instance
  ON issues (source_task_instance_id)
  WHERE source_task_instance_id IS NOT NULL;

-- ============================================
-- AREA QR TOKENS
-- Tokens are 24 random bytes rendered as 48 lowercase hex characters. They are
-- unguessable and can be rotated without changing the area.
-- ============================================
ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS qr_token_rotated_at TIMESTAMPTZ;

UPDATE areas
SET qr_token = encode(gen_random_bytes(24), 'hex')
WHERE qr_token IS NULL;

ALTER TABLE areas
  ALTER COLUMN qr_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

ALTER TABLE areas
  ALTER COLUMN qr_token SET NOT NULL;

CREATE TABLE IF NOT EXISTS qr_lookup_attempts (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_lookup_attempts_time
  ON qr_lookup_attempts (attempted_at);

CREATE INDEX IF NOT EXISTS idx_qr_lookup_attempts_token_time
  ON qr_lookup_attempts (token_hash, attempted_at);

ALTER TABLE qr_lookup_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION rotate_area_qr_token(p_area_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_space_id UUID;
  v_token TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT space_id INTO v_space_id
  FROM areas
  WHERE id = p_area_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Area not found';
  END IF;

  IF NOT has_role(v_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only owners, admins, and supervisors can rotate QR codes';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');

  UPDATE areas
  SET qr_token = v_token,
      qr_token_rotated_at = NOW(),
      updated_at = NOW()
  WHERE id = p_area_id;

  RETURN v_token;
END;
$$;

-- Public lookup returns only the labels needed to show a safe landing page.
-- It never returns membership, member names, tasks, or issue data. Lookups are
-- limited per token and globally per minute so a script cannot brute-force.
CREATE OR REPLACE FUNCTION lookup_area_by_qr_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT := lower(btrim(COALESCE(p_token, '')));
  v_hash TEXT;
  v_recent INTEGER;
  v_global INTEGER;
  v_area RECORD;
  v_found BOOLEAN;
  v_qr_enabled BOOLEAN;
  v_shared_enabled BOOLEAN;
  v_session_minutes INTEGER;
BEGIN
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  SELECT COUNT(*) INTO v_recent
  FROM qr_lookup_attempts
  WHERE token_hash = v_hash
    AND attempted_at > NOW() - INTERVAL '1 minute';

  IF v_recent >= 20 THEN
    RAISE EXCEPTION 'Too many code lookups. Wait a minute and try again.';
  END IF;

  SELECT COUNT(*) INTO v_global
  FROM qr_lookup_attempts
  WHERE attempted_at > NOW() - INTERVAL '1 minute';

  IF v_global >= 300 THEN
    RAISE EXCEPTION 'Too many code lookups. Wait a minute and try again.';
  END IF;

  DELETE FROM qr_lookup_attempts
  WHERE attempted_at < NOW() - INTERVAL '1 day';

  IF v_token !~ '^[a-f0-9]{48}$' THEN
    INSERT INTO qr_lookup_attempts (token_hash, succeeded)
    VALUES (v_hash, FALSE);
    RETURN NULL;
  END IF;

  SELECT a.id AS area_id,
         a.name AS area_name,
         a.active AS area_active,
         s.id AS space_id,
         s.name AS space_name,
         s.type AS space_type,
         s.timezone,
         s.settings
    INTO v_area
  FROM areas a
  JOIN spaces s ON s.id = a.space_id
  WHERE a.qr_token = v_token
    AND a.deleted_at IS NULL
    AND s.deleted_at IS NULL;

  v_found := FOUND;

  INSERT INTO qr_lookup_attempts (token_hash, succeeded)
  VALUES (v_hash, v_found);

  IF NOT v_found THEN
    RETURN NULL;
  END IF;

  v_qr_enabled := COALESCE((v_area.settings ->> 'qrCodeEnabled')::boolean, TRUE);
  v_shared_enabled := COALESCE((v_area.settings #>> '{sharedDevice,enabled}')::boolean, FALSE);
  v_session_minutes := COALESCE((v_area.settings #>> '{sharedDevice,sessionMinutes}')::integer, 480);
  v_session_minutes := LEAST(GREATEST(v_session_minutes, 15), 1440);

  RETURN jsonb_build_object(
    'area_id', v_area.area_id,
    'area_name', v_area.area_name,
    'area_active', v_area.area_active,
    'space_id', v_area.space_id,
    'space_name', v_area.space_name,
    'space_type', v_area.space_type,
    'timezone', v_area.timezone,
    'qr_enabled', v_qr_enabled,
    'shared_device_enabled', v_shared_enabled,
    'shared_device_session_minutes', v_session_minutes
  );
END;
$$;

-- ============================================
-- SHARED DEVICE PIN MODE
-- The device is signed in once with a normal account. Each member then sets a
-- personal 4-6 digit PIN. Opening a session returns a short random token that
-- is stored only in sessionStorage. Completion, checklist, issue, and
-- verification RPCs accept that token and record the selected member as the
-- actor, while the database still verifies the signed-in device account.
-- ============================================
CREATE TABLE IF NOT EXISTS shared_device_pins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shared_device_pin_unique UNIQUE (space_id, user_id)
);

CREATE TRIGGER update_shared_device_pins_updated_at
  BEFORE UPDATE ON shared_device_pins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE shared_device_pins ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS shared_device_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shared_device_sessions_lookup
  ON shared_device_sessions (space_id, token_hash)
  WHERE revoked_at IS NULL;

ALTER TABLE shared_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION has_role_for_user(
  p_space_id UUID,
  p_user_id UUID,
  p_roles membership_role[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships
    WHERE space_id = p_space_id
      AND user_id = p_user_id
      AND role = ANY(p_roles)
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION shared_device_is_enabled(p_space_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((settings #>> '{sharedDevice,enabled}')::boolean, FALSE)
  FROM spaces
  WHERE id = p_space_id;
$$;

CREATE OR REPLACE FUNCTION shared_device_session_minutes(p_space_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(
    GREATEST(COALESCE((settings #>> '{sharedDevice,sessionMinutes}')::integer, 480), 15),
    1440
  )
  FROM spaces
  WHERE id = p_space_id;
$$;

CREATE OR REPLACE FUNCTION set_shared_device_pin(
  p_space_id UUID,
  p_pin TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'Use a PIN with 4 to 6 digits';
  END IF;

  INSERT INTO shared_device_pins (space_id, user_id, pin_hash)
  VALUES (p_space_id, v_user, crypt(p_pin, gen_salt('bf', 10)))
  ON CONFLICT (space_id, user_id)
  DO UPDATE SET
    pin_hash = EXCLUDED.pin_hash,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION remove_shared_device_pin(p_space_id UUID)
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

  DELETE FROM shared_device_pins
  WHERE space_id = p_space_id AND user_id = v_user;

  UPDATE shared_device_sessions
  SET revoked_at = NOW()
  WHERE space_id = p_space_id AND user_id = v_user AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION shared_device_pin_status(p_space_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_pin shared_device_pins;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  SELECT * INTO v_pin
  FROM shared_device_pins
  WHERE space_id = p_space_id AND user_id = v_user;

  RETURN jsonb_build_object(
    'has_pin', FOUND,
    'locked_until', v_pin.locked_until
  );
END;
$$;

CREATE OR REPLACE FUNCTION list_shared_device_members(p_space_id UUID)
RETURNS TABLE (
  member_id UUID,
  full_name TEXT,
  role membership_role,
  has_pin BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  RETURN QUERY
  SELECT m.user_id AS member_id,
         COALESCE(NULLIF(btrim(p.full_name), ''), 'Member') AS full_name,
         m.role,
         EXISTS (
           SELECT 1 FROM shared_device_pins dp
           WHERE dp.space_id = p_space_id AND dp.user_id = m.user_id
         ) AS has_pin
  FROM memberships m
  LEFT JOIN profiles p ON p.id = m.user_id
  WHERE m.space_id = p_space_id
    AND m.deleted_at IS NULL
  ORDER BY full_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION open_shared_device_session(
  p_space_id UUID,
  p_user_id UUID,
  p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_pin shared_device_pins;
  v_token TEXT;
  v_expires TIMESTAMPTZ;
  v_name TEXT;
  v_role membership_role;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF NOT shared_device_is_enabled(p_space_id) THEN
    RAISE EXCEPTION 'Shared device mode is turned off for this space';
  END IF;

  SELECT m.role, COALESCE(NULLIF(btrim(p.full_name), ''), 'Member')
    INTO v_role, v_name
  FROM memberships m
  LEFT JOIN profiles p ON p.id = m.user_id
  WHERE m.space_id = p_space_id
    AND m.user_id = p_user_id
    AND m.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not a member of this space';
  END IF;

  SELECT * INTO v_pin
  FROM shared_device_pins
  WHERE space_id = p_space_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person has not set a PIN for this space';
  END IF;

  IF v_pin.locked_until IS NOT NULL AND v_pin.locked_until > NOW() THEN
    RAISE EXCEPTION 'Too many PIN attempts. Try again in a few minutes.';
  END IF;

  IF crypt(COALESCE(p_pin, ''), v_pin.pin_hash) <> v_pin.pin_hash THEN
    IF v_pin.failed_attempts + 1 >= 5 THEN
      UPDATE shared_device_pins
      SET failed_attempts = 0,
          locked_until = NOW() + INTERVAL '15 minutes',
          updated_at = NOW()
      WHERE id = v_pin.id;
      RAISE EXCEPTION 'Too many PIN attempts. Try again in a few minutes.';
    END IF;

    UPDATE shared_device_pins
    SET failed_attempts = failed_attempts + 1,
        updated_at = NOW()
    WHERE id = v_pin.id;

    RAISE EXCEPTION 'That PIN did not match';
  END IF;

  UPDATE shared_device_pins
  SET failed_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE id = v_pin.id;

  DELETE FROM shared_device_sessions
  WHERE space_id = p_space_id
    AND (revoked_at IS NOT NULL OR expires_at < NOW() - INTERVAL '1 day');

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := NOW() + make_interval(mins => shared_device_session_minutes(p_space_id));

  INSERT INTO shared_device_sessions (
    space_id, user_id, token_hash, created_by, expires_at, last_used_at
  ) VALUES (
    p_space_id, p_user_id, encode(digest(v_token, 'sha256'), 'hex'), v_user, v_expires, NOW()
  );

  RETURN jsonb_build_object(
    'token', v_token,
    'user_id', p_user_id,
    'full_name', v_name,
    'role', v_role,
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_shared_device_session(
  p_space_id UUID,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session shared_device_sessions;
  v_name TEXT;
  v_role membership_role;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF p_token IS NULL OR btrim(p_token) = '' OR NOT shared_device_is_enabled(p_space_id) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_session
  FROM shared_device_sessions
  WHERE space_id = p_space_id
    AND token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND revoked_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT m.role, COALESCE(NULLIF(btrim(p.full_name), ''), 'Member')
    INTO v_role, v_name
  FROM memberships m
  LEFT JOIN profiles p ON p.id = m.user_id
  WHERE m.space_id = p_space_id
    AND m.user_id = v_session.user_id
    AND m.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_session.user_id,
    'full_name', v_name,
    'role', v_role,
    'expires_at', v_session.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION close_shared_device_session(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE shared_device_sessions s
  SET revoked_at = NOW()
  WHERE s.token_hash = encode(digest(COALESCE(p_token, ''), 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND is_space_member(s.space_id);
END;
$$;

-- Resolve the acting member for a write. With no token this is the signed-in
-- user. With a token it is the member selected by PIN on this device.
CREATE OR REPLACE FUNCTION resolve_task_actor(
  p_space_id UUID,
  p_device_session_token TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session shared_device_sessions;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT is_space_member(p_space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF p_device_session_token IS NULL OR btrim(p_device_session_token) = '' THEN
    RETURN v_user;
  END IF;

  IF NOT shared_device_is_enabled(p_space_id) THEN
    RAISE EXCEPTION 'Shared device mode is turned off for this space';
  END IF;

  SELECT * INTO v_session
  FROM shared_device_sessions
  WHERE space_id = p_space_id
    AND token_hash = encode(digest(p_device_session_token, 'sha256'), 'hex')
    AND revoked_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This shared-device session has expired. Choose your name and PIN again.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE space_id = p_space_id
      AND user_id = v_session.user_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'That person is no longer a member of this space';
  END IF;

  UPDATE shared_device_sessions
  SET last_used_at = NOW()
  WHERE id = v_session.id;

  RETURN v_session.user_id;
END;
$$;

-- ============================================
-- EVIDENCE RULES AND CHECKLIST HELPERS
-- ============================================
CREATE OR REPLACE FUNCTION effective_evidence_rule(p_task_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(t.evidence_rule, ''),
    NULLIF(s.settings ->> 'evidenceRule', ''),
    'none'
  )
  FROM tasks t
  JOIN spaces s ON s.id = t.space_id
  WHERE t.id = p_task_id;
$$;

CREATE OR REPLACE FUNCTION task_has_unanswered_checklist(p_instance_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM task_checklist_items i
    JOIN task_instances ti ON ti.task_id = i.task_id
    WHERE ti.id = p_instance_id
      AND i.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM task_checklist_results r
        WHERE r.task_instance_id = p_instance_id
          AND r.checklist_item_id = i.id
      )
  );
$$;

CREATE OR REPLACE FUNCTION replace_task_checklist(
  p_task_id UUID,
  p_labels TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_space_id UUID;
  v_count INTEGER := COALESCE(array_length(p_labels, 1), 0);
  v_distinct INTEGER;
  v_label TEXT;
  v_index INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT space_id INTO v_space_id
  FROM tasks
  WHERE id = p_task_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF NOT has_role(v_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only owners, admins, and supervisors can edit checklist steps';
  END IF;

  IF v_count > 30 THEN
    RAISE EXCEPTION 'Keep checklists to 30 steps or fewer';
  END IF;

  FOR v_index IN 1..v_count LOOP
    v_label := btrim(COALESCE(p_labels[v_index], ''));
    IF v_label = '' THEN
      RAISE EXCEPTION 'Every checklist step needs a label';
    END IF;
    IF length(v_label) > 160 THEN
      RAISE EXCEPTION 'Keep each checklist step under 160 characters';
    END IF;
  END LOOP;

  SELECT COUNT(DISTINCT lower(btrim(x)))
    INTO v_distinct
  FROM unnest(p_labels) AS x;

  IF v_distinct <> v_count THEN
    RAISE EXCEPTION 'Checklist steps must be different from each other';
  END IF;

  FOR v_index IN 0..v_count - 1 LOOP
    v_label := btrim(p_labels[v_index + 1]);

    UPDATE task_checklist_items
    SET label = v_label,
        position = v_index,
        updated_at = NOW()
    WHERE task_id = p_task_id
      AND position = v_index
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      INSERT INTO task_checklist_items (
        space_id, task_id, label, position, created_by
      ) VALUES (
        v_space_id, p_task_id, v_label, v_index, v_user
      );
    END IF;
  END LOOP;

  UPDATE task_checklist_items
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE task_id = p_task_id
    AND deleted_at IS NULL
    AND position >= v_count;
END;
$$;

CREATE OR REPLACE FUNCTION save_checklist_result(
  p_instance_id UUID,
  p_checklist_item_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL,
  p_issue_id UUID DEFAULT NULL,
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS task_checklist_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_instance task_instances;
  v_item task_checklist_items;
  v_result task_checklist_results;
BEGIN
  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_actor := resolve_task_actor(v_instance.space_id, p_device_session_token);

  IF v_instance.status NOT IN ('pending', 'in_progress', 'overdue') THEN
    RAISE EXCEPTION 'This task is no longer open for checklist answers';
  END IF;

  IF NOT (
    v_instance.assignee_id = v_actor
    OR v_instance.assignee_id IS NULL
    OR has_role_for_user(v_instance.space_id, v_actor, ARRAY['owner', 'admin', 'supervisor'])
  ) THEN
    RAISE EXCEPTION 'Only the assignee or a supervisor can answer this checklist';
  END IF;

  SELECT * INTO v_item
  FROM task_checklist_items
  WHERE id = p_checklist_item_id
    AND task_id = v_instance.task_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist step not found for this task';
  END IF;

  IF p_status NOT IN ('done', 'not_applicable', 'problem') THEN
    RAISE EXCEPTION 'Choose Done, Not applicable, or Problem found';
  END IF;

  IF p_issue_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM issues
      WHERE id = p_issue_id
        AND space_id = v_instance.space_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'That issue does not belong to this space';
    END IF;
  END IF;

  INSERT INTO task_checklist_results (
    space_id,
    task_instance_id,
    checklist_item_id,
    label_snapshot,
    status,
    note,
    issue_id,
    actor_user_id
  ) VALUES (
    v_instance.space_id,
    p_instance_id,
    p_checklist_item_id,
    v_item.label,
    p_status,
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    CASE WHEN p_status = 'problem' THEN p_issue_id ELSE NULL END,
    v_actor
  )
  ON CONFLICT (task_instance_id, checklist_item_id)
  DO UPDATE SET
    label_snapshot = EXCLUDED.label_snapshot,
    status = EXCLUDED.status,
    note = EXCLUDED.note,
    issue_id = EXCLUDED.issue_id,
    actor_user_id = EXCLUDED.actor_user_id,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================
-- ATOMIC TASK ACTIONS WITH ACTOR + EVIDENCE
-- These replace the Level 3 signatures. The old versions are dropped first so
-- PostgREST sees one function, not an ambiguous overload.
-- ============================================
DROP FUNCTION IF EXISTS complete_task_instance(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS undo_task_completion(UUID);
DROP FUNCTION IF EXISTS skip_task_instance(UUID, TEXT);
DROP FUNCTION IF EXISTS reopen_task_instance(UUID);

CREATE OR REPLACE FUNCTION complete_task_instance(
  p_instance_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_photos TEXT[] DEFAULT '{}',
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_instance task_instances;
  v_rule TEXT;
  v_photos TEXT[] := COALESCE(p_photos, '{}');
  v_path TEXT;
  v_photos_enabled BOOLEAN;
BEGIN
  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_actor := resolve_task_actor(v_instance.space_id, p_device_session_token);

  IF v_instance.status = 'completed' THEN
    RAISE EXCEPTION 'This task is already completed';
  END IF;

  IF NOT (
    v_instance.assignee_id = v_actor
    OR v_instance.assignee_id IS NULL
    OR has_role_for_user(v_instance.space_id, v_actor, ARRAY['owner', 'admin', 'supervisor'])
  ) THEN
    RAISE EXCEPTION 'Only the assignee or a supervisor can complete this task';
  END IF;

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

  IF task_has_unanswered_checklist(p_instance_id) THEN
    RAISE EXCEPTION 'Answer every checklist step before submitting this task';
  END IF;

  IF COALESCE(array_length(v_photos, 1), 0) > 5 THEN
    RAISE EXCEPTION 'Attach no more than 5 evidence photos';
  END IF;

  SELECT COALESCE((settings ->> 'photosEnabled')::boolean, FALSE)
    INTO v_photos_enabled
  FROM spaces
  WHERE id = v_instance.space_id;

  IF COALESCE(array_length(v_photos, 1), 0) > 0 AND NOT v_photos_enabled THEN
    RAISE EXCEPTION 'Photo evidence is turned off for this space';
  END IF;

  FOREACH v_path IN ARRAY v_photos LOOP
    IF v_path IS NULL
      OR v_path NOT LIKE v_instance.space_id::text || '/' || v_instance.id::text || '/%' THEN
      RAISE EXCEPTION 'An evidence photo does not belong to this task instance';
    END IF;
  END LOOP;

  v_rule := effective_evidence_rule(v_instance.task_id);

  INSERT INTO task_completions (
    task_instance_id,
    user_id,
    completed_at,
    notes,
    duration_minutes,
    photos
  ) VALUES (
    p_instance_id,
    v_actor,
    NOW(),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_duration_minutes,
    v_photos
  );

  UPDATE task_instances
  SET status = 'completed',
      completed_at = NOW(),
      skipped_at = NULL,
      skip_reason = NULL,
      verification_status = CASE
        WHEN v_rule = 'supervisor_review' THEN 'pending'
        ELSE 'not_required'
      END,
      submitted_at = CASE
        WHEN v_rule = 'supervisor_review' THEN NOW()
        ELSE NULL
      END,
      verified_by = NULL,
      verified_at = NULL,
      verification_note = NULL,
      rework_requested_by = NULL,
      rework_requested_at = NULL,
      rework_note = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

CREATE OR REPLACE FUNCTION undo_task_completion(
  p_instance_id UUID,
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_instance task_instances;
  v_completion task_completions;
  v_can_undo BOOLEAN;
BEGIN
  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_actor := resolve_task_actor(v_instance.space_id, p_device_session_token);

  SELECT * INTO v_completion
  FROM task_completions
  WHERE task_instance_id = p_instance_id AND deleted_at IS NULL
  ORDER BY completed_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This task has no completion to undo';
  END IF;

  IF v_instance.verification_status = 'verified' THEN
    RAISE EXCEPTION 'This submission was verified. Ask a supervisor to request rework instead.';
  END IF;

  IF v_instance.verification_status = 'rework_requested' THEN
    RAISE EXCEPTION 'A rework task is already open. Complete that task instead.';
  END IF;

  v_can_undo := v_completion.user_id = v_actor
    OR has_role_for_user(v_instance.space_id, v_actor, ARRAY['owner', 'admin', 'supervisor']);

  IF NOT v_can_undo THEN
    RAISE EXCEPTION 'Only the person who completed this task or a supervisor can undo it';
  END IF;

  IF COALESCE(array_length(v_completion.photos, 1), 0) > 0 THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'task-evidence'
      AND name = ANY(v_completion.photos);
  END IF;

  UPDATE task_completions
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE task_instance_id = p_instance_id AND deleted_at IS NULL;

  UPDATE task_instances
  SET status = 'pending',
      completed_at = NULL,
      verification_status = 'not_required',
      submitted_at = NULL,
      verified_by = NULL,
      verified_at = NULL,
      verification_note = NULL,
      rework_requested_by = NULL,
      rework_requested_at = NULL,
      rework_note = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

CREATE OR REPLACE FUNCTION skip_task_instance(
  p_instance_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_instance task_instances;
BEGIN
  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_actor := resolve_task_actor(v_instance.space_id, p_device_session_token);

  IF NOT (
    v_instance.assignee_id = v_actor
    OR v_instance.assignee_id IS NULL
    OR has_role_for_user(v_instance.space_id, v_actor, ARRAY['owner', 'admin', 'supervisor'])
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
      verification_status = 'not_required',
      submitted_at = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

CREATE OR REPLACE FUNCTION reopen_task_instance(
  p_instance_id UUID,
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_instance task_instances;
BEGIN
  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_actor := resolve_task_actor(v_instance.space_id, p_device_session_token);

  IF NOT (
    v_instance.assignee_id = v_actor
    OR v_instance.assignee_id IS NULL
    OR has_role_for_user(v_instance.space_id, v_actor, ARRAY['owner', 'admin', 'supervisor'])
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
      verification_status = 'not_required',
      submitted_at = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

CREATE OR REPLACE FUNCTION attach_task_evidence(
  p_instance_id UUID,
  p_photos TEXT[],
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS task_completions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_instance task_instances;
  v_completion task_completions;
  v_photos TEXT[] := COALESCE(p_photos, '{}');
  v_old TEXT[];
  v_path TEXT;
  v_photos_enabled BOOLEAN;
BEGIN
  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_actor := resolve_task_actor(v_instance.space_id, p_device_session_token);

  IF v_instance.status <> 'completed' THEN
    RAISE EXCEPTION 'Evidence can only be attached after the task is submitted';
  END IF;

  IF v_instance.verification_status = 'verified' THEN
    RAISE EXCEPTION 'This submission is already verified';
  END IF;

  SELECT * INTO v_completion
  FROM task_completions
  WHERE task_instance_id = p_instance_id AND deleted_at IS NULL
  ORDER BY completed_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This task has no submission to attach evidence to';
  END IF;

  IF NOT (
    v_completion.user_id = v_actor
    OR has_role_for_user(v_instance.space_id, v_actor, ARRAY['owner', 'admin', 'supervisor'])
  ) THEN
    RAISE EXCEPTION 'Only the person who submitted this task or a supervisor can change evidence';
  END IF;

  IF COALESCE(array_length(v_photos, 1), 0) > 5 THEN
    RAISE EXCEPTION 'Attach no more than 5 evidence photos';
  END IF;

  SELECT COALESCE((settings ->> 'photosEnabled')::boolean, FALSE)
    INTO v_photos_enabled
  FROM spaces
  WHERE id = v_instance.space_id;

  IF COALESCE(array_length(v_photos, 1), 0) > 0 AND NOT v_photos_enabled THEN
    RAISE EXCEPTION 'Photo evidence is turned off for this space';
  END IF;

  FOREACH v_path IN ARRAY v_photos LOOP
    IF v_path IS NULL
      OR v_path NOT LIKE v_instance.space_id::text || '/' || v_instance.id::text || '/%' THEN
      RAISE EXCEPTION 'An evidence photo does not belong to this task instance';
    END IF;
  END LOOP;

  v_old := v_completion.photos;

  IF COALESCE(array_length(v_old, 1), 0) > 0 THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'task-evidence'
      AND name = ANY(v_old)
      AND NOT (name = ANY(v_photos));
  END IF;

  UPDATE task_completions
  SET photos = v_photos,
      updated_at = NOW()
  WHERE id = v_completion.id
  RETURNING * INTO v_completion;

  RETURN v_completion;
END;
$$;

-- ============================================
-- VERIFICATION AND REWORK
-- ============================================
CREATE OR REPLACE FUNCTION verify_task_instance(
  p_instance_id UUID,
  p_note TEXT DEFAULT NULL,
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_instance task_instances;
BEGIN
  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_actor := resolve_task_actor(v_instance.space_id, p_device_session_token);

  IF NOT has_role_for_user(v_instance.space_id, v_actor, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only owners, admins, and supervisors can verify submissions';
  END IF;

  IF v_instance.status <> 'completed' OR v_instance.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'Only a submitted task awaiting review can be verified';
  END IF;

  UPDATE task_instances
  SET verification_status = 'verified',
      verified_by = v_actor,
      verified_at = NOW(),
      verification_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      rework_requested_by = NULL,
      rework_requested_at = NULL,
      rework_note = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  RETURN v_instance;
END;
$$;

CREATE OR REPLACE FUNCTION request_task_rework(
  p_instance_id UUID,
  p_note TEXT,
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS task_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_instance task_instances;
  v_new task_instances;
BEGIN
  SELECT * INTO v_instance
  FROM task_instances
  WHERE id = p_instance_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task instance not found';
  END IF;

  v_actor := resolve_task_actor(v_instance.space_id, p_device_session_token);

  IF NOT has_role_for_user(v_instance.space_id, v_actor, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only owners, admins, and supervisors can request rework';
  END IF;

  IF v_instance.status <> 'completed' OR v_instance.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'Only a submitted task awaiting review can be sent back for rework';
  END IF;

  IF btrim(COALESCE(p_note, '')) = '' THEN
    RAISE EXCEPTION 'Explain what needs another pass';
  END IF;

  IF EXISTS (
    SELECT 1 FROM task_instances
    WHERE rework_of_instance_id = v_instance.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A rework task already exists for this submission';
  END IF;

  UPDATE task_instances
  SET verification_status = 'rework_requested',
      rework_requested_by = v_actor,
      rework_requested_at = NOW(),
      rework_note = btrim(p_note),
      verification_note = NULL,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_instance;

  INSERT INTO task_instances (
    task_id,
    space_id,
    assignee_id,
    due_at,
    timezone,
    status,
    verification_status,
    rework_of_instance_id
  ) VALUES (
    v_instance.task_id,
    v_instance.space_id,
    v_instance.assignee_id,
    clock_timestamp(),
    v_instance.timezone,
    'pending',
    'not_required',
    v_instance.id
  )
  RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

-- ============================================
-- EVIDENCE RETENTION
-- Removes private storage objects and clears their paths once the space's
-- retention window has passed. The app calls this opportunistically for
-- managers; a pg_cron job may call it with no space id.
-- ============================================
CREATE OR REPLACE FUNCTION purge_expired_task_evidence(p_space_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row RECORD;
  v_days INTEGER;
  v_removed INTEGER := 0;
BEGIN
  IF v_user IS NOT NULL THEN
    IF p_space_id IS NULL THEN
      RAISE EXCEPTION 'Choose a space';
    END IF;

    IF NOT has_role(p_space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
      RAISE EXCEPTION 'Only owners, admins, and supervisors can run evidence cleanup';
    END IF;
  END IF;

  FOR v_row IN
    SELECT c.id,
           c.photos,
           s.id AS space_id,
           COALESCE((s.settings ->> 'dataRetentionDays')::integer, 0) AS retention_days
    FROM task_completions c
    JOIN task_instances ti ON ti.id = c.task_instance_id
    JOIN spaces s ON s.id = ti.space_id
    WHERE c.deleted_at IS NULL
      AND COALESCE(array_length(c.photos, 1), 0) > 0
      AND (p_space_id IS NULL OR s.id = p_space_id)
      AND COALESCE((s.settings ->> 'dataRetentionDays')::integer, 0) > 0
      AND c.completed_at < NOW() - make_interval(
        days => COALESCE((s.settings ->> 'dataRetentionDays')::integer, 0)
      )
  LOOP
    DELETE FROM storage.objects
    WHERE bucket_id = 'task-evidence'
      AND name = ANY(v_row.photos);

    UPDATE task_completions
    SET photos = '{}', updated_at = NOW()
    WHERE id = v_row.id;

    v_removed := v_removed + 1;
  END LOOP;

  RETURN v_removed;
END;
$$;

-- ============================================
-- ISSUE CREATION WITH SOURCE + ACTOR
-- ============================================
DROP FUNCTION IF EXISTS create_issue(UUID, UUID, TEXT, TEXT, TEXT, TEXT, issue_priority, TEXT[], TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION create_issue(
  p_space_id UUID,
  p_area_id UUID,
  p_category TEXT,
  p_custom_category TEXT,
  p_title TEXT,
  p_description TEXT,
  p_priority issue_priority DEFAULT 'medium',
  p_photos TEXT[] DEFAULT '{}',
  p_due_at TIMESTAMPTZ DEFAULT NULL,
  p_source_instance_id UUID DEFAULT NULL,
  p_source_checklist_item_id UUID DEFAULT NULL,
  p_device_session_token TEXT DEFAULT NULL
)
RETURNS issues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_issue issues;
  v_photos TEXT[] := COALESCE(p_photos, '{}');
BEGIN
  v_actor := resolve_task_actor(p_space_id, p_device_session_token);

  IF p_area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM areas
    WHERE id = p_area_id
      AND space_id = p_space_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Area not found in this space';
  END IF;

  IF p_source_instance_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM task_instances
    WHERE id = p_source_instance_id
      AND space_id = p_space_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The source task does not belong to this space';
  END IF;

  IF p_source_checklist_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM task_checklist_items i
    JOIN task_instances ti ON ti.task_id = i.task_id
    WHERE i.id = p_source_checklist_item_id
      AND ti.id = p_source_instance_id
      AND i.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The checklist step does not belong to the source task';
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
    due_at,
    source_task_instance_id,
    source_checklist_item_id
  ) VALUES (
    p_space_id,
    p_area_id,
    v_actor,
    left(btrim(p_title), 160),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    p_category,
    CASE WHEN p_category = 'custom' THEN btrim(p_custom_category) ELSE NULL END,
    p_priority,
    'reported',
    v_photos,
    p_due_at,
    p_source_instance_id,
    p_source_checklist_item_id
  )
  RETURNING * INTO v_issue;

  INSERT INTO issue_events (issue_id, user_id, action, new_value)
  VALUES (
    v_issue.id,
    v_actor,
    'reported',
    jsonb_build_object(
      'status', v_issue.status,
      'priority', v_issue.priority,
      'category', v_issue.category,
      'custom_category', v_issue.custom_category,
      'source_task_instance_id', v_issue.source_task_instance_id,
      'source_checklist_item_id', v_issue.source_checklist_item_id
    )
  );

  RETURN v_issue;
END;
$$;

-- ============================================
-- DIRECT-WRITE HARDENING
-- ============================================
DROP POLICY IF EXISTS "completion_insert_assignee" ON task_completions;
DROP POLICY IF EXISTS "completion_insert_supervisor_up" ON task_completions;
DROP POLICY IF EXISTS "completion_insert_unassigned_member" ON task_completions;
DROP POLICY IF EXISTS "completion_update_own" ON task_completions;
DROP POLICY IF EXISTS "completion_delete_owner_admin" ON task_completions;

-- Task status and verification fields are RPC-only. Managers may still
-- soft-delete or reschedule open instances through the normal task UI.
CREATE OR REPLACE FUNCTION guard_task_instance_rpc_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
    OR NEW.skipped_at IS DISTINCT FROM OLD.skipped_at
    OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
    OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
    OR NEW.verification_note IS DISTINCT FROM OLD.verification_note
    OR NEW.rework_requested_by IS DISTINCT FROM OLD.rework_requested_by
    OR NEW.rework_requested_at IS DISTINCT FROM OLD.rework_requested_at
    OR NEW.rework_note IS DISTINCT FROM OLD.rework_note
    OR NEW.rework_of_instance_id IS DISTINCT FROM OLD.rework_of_instance_id
  THEN
    RAISE EXCEPTION 'Task status changes go through the checked task actions';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_task_instance_rpc_fields ON task_instances;
CREATE TRIGGER guard_task_instance_rpc_fields
  BEFORE UPDATE ON task_instances
  FOR EACH ROW EXECUTE FUNCTION guard_task_instance_rpc_fields();

-- ============================================
-- PRIVATE TASK EVIDENCE STORAGE
-- Path convention: <space_id>/<task_instance_id>/<file>
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-evidence',
  'task-evidence',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "task_evidence_select_member" ON storage.objects;
CREATE POLICY "task_evidence_select_member" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'task-evidence'
    AND is_space_member(safe_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS "task_evidence_insert_member" ON storage.objects;
CREATE POLICY "task_evidence_insert_member" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'task-evidence'
    AND auth.uid() IS NOT NULL
    AND is_space_member(safe_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS "task_evidence_update_owner" ON storage.objects;
CREATE POLICY "task_evidence_update_owner" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'task-evidence'
    AND (
      owner = auth.uid()
      OR has_role(
        safe_uuid((storage.foldername(name))[1]),
        ARRAY['owner', 'admin', 'supervisor']
      )
    )
  );

DROP POLICY IF EXISTS "task_evidence_delete_owner" ON storage.objects;
CREATE POLICY "task_evidence_delete_owner" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'task-evidence'
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
REVOKE ALL ON FUNCTION rotate_area_qr_token(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION lookup_area_by_qr_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION has_role_for_user(UUID, UUID, membership_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION shared_device_is_enabled(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION shared_device_session_minutes(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_shared_device_pin(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION remove_shared_device_pin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION shared_device_pin_status(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION list_shared_device_members(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION open_shared_device_session(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_shared_device_session(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION close_shared_device_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_task_actor(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION effective_evidence_rule(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION task_has_unanswered_checklist(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION replace_task_checklist(UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION save_checklist_result(UUID, UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_task_instance(UUID, TEXT, INTEGER, TEXT[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION undo_task_completion(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION skip_task_instance(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reopen_task_instance(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION attach_task_evidence(UUID, TEXT[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION verify_task_instance(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_task_rework(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_expired_task_evidence(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_issue(UUID, UUID, TEXT, TEXT, TEXT, TEXT, issue_priority, TEXT[], TIMESTAMPTZ, UUID, UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION rotate_area_qr_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_area_by_qr_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_shared_device_pin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_shared_device_pin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION shared_device_pin_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_shared_device_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION open_shared_device_session(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_device_session(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION close_shared_device_session(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION replace_task_checklist(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION save_checklist_result(UUID, UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_task_instance(UUID, TEXT, INTEGER, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION undo_task_completion(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION skip_task_instance(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reopen_task_instance(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION attach_task_evidence(UUID, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_task_instance(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION request_task_rework(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION purge_expired_task_evidence(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_issue(UUID, UUID, TEXT, TEXT, TEXT, TEXT, issue_priority, TEXT[], TIMESTAMPTZ, UUID, UUID, TEXT) TO authenticated;

-- Optional scheduled cleanup. Supabase projects without pg_cron simply skip
-- this block; the app also calls purge_expired_task_evidence opportunistically.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'neatly-purge-task-evidence',
      '15 3 * * *',
      'SELECT purge_expired_task_evidence(NULL);'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
