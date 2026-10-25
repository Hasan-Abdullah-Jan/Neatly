-- Supply inventory mutations must use checked RPCs; members may create and
-- view requests but cannot directly change request approval or fulfillment.
REVOKE UPDATE ON supply_requests FROM PUBLIC, anon, authenticated;

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
  v_item supply_items;
  v_new_quantity NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_delta IS NULL OR p_delta::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Quantity change must be a finite number' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_item
  FROM supply_items
  WHERE id = p_item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply item not found';
  END IF;

  IF NOT has_role(v_item.space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can change supply quantities' USING ERRCODE = '42501';
  END IF;

  v_new_quantity := v_item.quantity + p_delta;
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity cannot be negative' USING ERRCODE = '22023';
  END IF;

  UPDATE supply_items
  SET quantity = v_new_quantity,
      status = CASE
        WHEN v_new_quantity <= 0 THEN 'out_of_stock'
        WHEN v_new_quantity <= min_quantity THEN 'low'
        ELSE 'available'
      END,
      updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION mark_supply_low(p_item_id UUID)
RETURNS supply_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item supply_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_item
  FROM supply_items
  WHERE id = p_item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply item not found';
  END IF;

  IF NOT has_role(v_item.space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can mark supplies low' USING ERRCODE = '42501';
  END IF;

  UPDATE supply_items
  SET status = 'low',
      updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
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
  v_new_quantity NUMERIC;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM supply_requests
  WHERE id = p_request_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply request not found';
  END IF;

  IF NOT has_role(v_request.space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can fulfill supply requests' USING ERRCODE = '42501';
  END IF;

  IF v_request.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved requests can be fulfilled';
  END IF;

  IF v_request.supply_item_id IS NOT NULL THEN
    SELECT * INTO v_item
    FROM supply_items
    WHERE id = v_request.supply_item_id
      AND space_id = v_request.space_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The requested supply item is unavailable';
    END IF;

    v_new_quantity := v_item.quantity + v_request.quantity;
    UPDATE supply_items
    SET quantity = v_new_quantity,
        status = CASE
          WHEN v_new_quantity <= 0 THEN 'out_of_stock'
          WHEN v_new_quantity <= min_quantity THEN 'low'
          ELSE 'available'
        END,
        updated_at = NOW()
    WHERE id = v_item.id;
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
  v_item supply_items;
  v_new_quantity NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_quantity_purchased IS NULL
    OR p_quantity_purchased::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR p_quantity_purchased <= 0
  THEN
    RAISE EXCEPTION 'Quantity purchased must be a positive finite number' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_item
  FROM supply_items
  WHERE id = p_item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supply item not found';
  END IF;

  IF NOT has_role(v_item.space_id, ARRAY['owner', 'admin', 'supervisor']) THEN
    RAISE EXCEPTION 'Only managers can record supply purchases' USING ERRCODE = '42501';
  END IF;

  v_new_quantity := v_item.quantity + p_quantity_purchased;
  UPDATE supply_items
  SET quantity = v_new_quantity,
      status = CASE
        WHEN v_new_quantity <= 0 THEN 'out_of_stock'
        WHEN v_new_quantity <= min_quantity THEN 'low'
        ELSE 'available'
      END,
      updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION update_supply_quantity(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_supply_low(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fulfill_supply_request(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_supply_purchase(UUID, NUMERIC, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION update_supply_quantity(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_supply_low(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_supply_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_supply_purchase(UUID, NUMERIC, TEXT) TO authenticated;
