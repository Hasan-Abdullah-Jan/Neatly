-- Persist failed PIN counters by returning an authentication result rather
-- than raising an exception after updating the row (exceptions roll back the
-- current Postgres transaction).
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
  v_attempts INTEGER;
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
    RETURN jsonb_build_object(
      'error_code', 'locked',
      'message', 'Too many PIN attempts. Try again in a few minutes.',
      'locked_until', v_pin.locked_until
    );
  END IF;

  IF p_pin IS NULL OR crypt(p_pin, v_pin.pin_hash) <> v_pin.pin_hash THEN
    v_attempts := v_pin.failed_attempts + 1;

    IF v_attempts >= 5 THEN
      UPDATE shared_device_pins
      SET failed_attempts = 0,
          locked_until = NOW() + INTERVAL '15 minutes',
          updated_at = NOW()
      WHERE id = v_pin.id;

      RETURN jsonb_build_object(
        'error_code', 'locked',
        'message', 'Too many PIN attempts. Try again in a few minutes.',
        'locked_until', NOW() + INTERVAL '15 minutes'
      );
    END IF;

    UPDATE shared_device_pins
    SET failed_attempts = v_attempts,
        updated_at = NOW()
    WHERE id = v_pin.id;

    RETURN jsonb_build_object(
      'error_code', 'invalid_pin',
      'message', 'That PIN did not match',
      'attempts_remaining', 5 - v_attempts
    );
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

REVOKE ALL ON FUNCTION open_shared_device_session(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION open_shared_device_session(UUID, UUID, TEXT) TO authenticated;
