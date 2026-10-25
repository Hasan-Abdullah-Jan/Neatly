-- Neatly Database - Level 6 Supplies
-- Adds RPCs for supply management, shopping list, and requests

-- ============================================
-- SUPPLY QUANTITY UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION update_supply_quantity(
  p_item_id UUID,
  p_delta NUMERIC
)
RETURNS supply_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_item supply_items;
  v_new_quantity NUMERIC;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item
  FROM supply_items
  WHERE id = p_item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply item not found';
  END IF;

  IF NOT is_space_member(v_item.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  v_new_quantity := v_item.quantity + p_delta;

  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative';
  END IF;

  UPDATE supply_items
  SET quantity = v_new_quantity,
      status = CASE
        WHEN v_new_quantity <= min_quantity THEN 'low'
        WHEN v_new_quantity = 0 THEN 'out_of_stock'
        ELSE 'available'
      END,
      updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- ============================================
-- MARK SUPPLY LOW
-- ============================================
CREATE OR REPLACE FUNCTION mark_supply_low(p_item_id UUID)
RETURNS supply_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_item supply_items;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item
  FROM supply_items
  WHERE id = p_item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply item not found';
  END IF;

  IF NOT is_space_member(v_item.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  UPDATE supply_items
  SET status = 'low',
      updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- ============================================
-- SUPPLY REQUEST ACTIONS
-- ============================================
CREATE OR REPLACE FUNCTION approve_supply_request(
  p_request_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS supply_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_request supply_requests;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request
  FROM supply_requests
  WHERE id = p_request_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply request not found';
  END IF;

  IF NOT has_role(v_request.space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can approve requests';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be approved';
  END IF;

  UPDATE supply_requests
  SET status = 'approved',
      approved_by = v_user,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION reject_supply_request(
  p_request_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS supply_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_request supply_requests;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request
  FROM supply_requests
  WHERE id = p_request_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply request not found';
  END IF;

  IF NOT has_role(v_request.space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can reject requests';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be rejected';
  END IF;

  UPDATE supply_requests
  SET status = 'rejected',
      approved_by = v_user,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION fulfill_supply_request(
  p_request_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS supply_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_request supply_requests;
  v_item supply_items;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request
  FROM supply_requests
  WHERE id = p_request_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply request not found';
  END IF;

  IF NOT is_space_member(v_request.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF v_request.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Only approved or pending requests can be fulfilled';
  END IF;

  -- Update quantity if linked to an item
  IF v_request.supply_item_id IS NOT NULL THEN
    SELECT * INTO v_item
    FROM supply_items
    WHERE id = v_request.supply_item_id AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      UPDATE supply_items
      SET quantity = quantity + v_request.quantity,
          status = CASE
            WHEN (quantity + v_request.quantity) <= min_quantity THEN 'low'
            ELSE 'available'
          END,
          updated_at = NOW()
      WHERE id = v_request.supply_item_id;
    END IF;
  END IF;

  UPDATE supply_requests
  SET status = 'fulfilled',
      fulfilled_by = v_user,
      fulfilled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

-- ============================================
-- RECORD PURCHASE
-- ============================================
CREATE OR REPLACE FUNCTION record_supply_purchase(
  p_item_id UUID,
  p_quantity_purchased NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS supply_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_item supply_items;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item
  FROM supply_items
  WHERE id = p_item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply item not found';
  END IF;

  IF NOT is_space_member(v_item.space_id) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  IF p_quantity_purchased <= 0 THEN
    RAISE EXCEPTION 'Quantity purchased must be positive';
  END IF;

  UPDATE supply_items
  SET quantity = quantity + p_quantity_purchased,
      status = CASE
        WHEN (quantity + p_quantity_purchased) <= min_quantity THEN 'low'
        ELSE 'available'
      END,
      updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- ============================================
-- FUNCTION GRANTS
-- ============================================
REVOKE ALL ON FUNCTION update_supply_quantity(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_supply_low(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_supply_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_supply_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fulfill_supply_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_supply_purchase(UUID, NUMERIC, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION update_supply_quantity(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_supply_low(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_supply_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_supply_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_supply_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_supply_purchase(UUID, NUMERIC, TEXT) TO authenticated;
