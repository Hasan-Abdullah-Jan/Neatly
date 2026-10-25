-- Verify supply mutation authorization on a staging database.
-- Required psql variables:
--   TEST_MEMBER_USER: member/cleaner with no manager role in TEST_SPACE
--   TEST_MANAGER_USER: owner, admin, or supervisor in TEST_SPACE
-- The member and manager must belong to the same test space containing
-- TEST_SUPPLY_ITEM, TEST_PENDING_REQUEST, and TEST_APPROVED_REQUEST.
-- The transaction rolls back all successful manager operations.
\set ON_ERROR_STOP on

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'TEST_MEMBER_USER', true);
SELECT set_config('test.supply_item', :'TEST_SUPPLY_ITEM', true);
SELECT set_config('test.pending_request', :'TEST_PENDING_REQUEST', true);
SELECT set_config('test.approved_request', :'TEST_APPROVED_REQUEST', true);

DO $$
DECLARE
  v_item UUID := current_setting('test.supply_item')::UUID;
  v_pending UUID := current_setting('test.pending_request')::UUID;
  v_space UUID;
  v_role TEXT;
BEGIN
  SELECT space_id INTO v_space
  FROM supply_items
  WHERE id = v_item AND deleted_at IS NULL;

  IF v_space IS NULL THEN
    RAISE EXCEPTION 'Member cannot see the fixture supply item';
  END IF;

  SELECT role::TEXT INTO v_role
  FROM memberships
  WHERE user_id = auth.uid() AND space_id = v_space AND deleted_at IS NULL;

  IF v_role IS NULL OR v_role NOT IN ('member', 'cleaner', 'auditor') THEN
    RAISE EXCEPTION 'TEST_MEMBER_USER must have a non-manager role in the fixture space';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM supply_requests
    WHERE id = v_pending AND space_id = v_space AND status = 'pending' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Member cannot see a pending request fixture in the same space';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM supply_requests
    WHERE id = current_setting('test.approved_request')::UUID
      AND space_id = v_space AND status = 'approved' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Member cannot see an approved request fixture in the same space';
  END IF;

  BEGIN
    PERFORM update_supply_quantity(v_item, 1);
    RAISE EXCEPTION 'Member unexpectedly changed supply quantity';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM mark_supply_low(v_item);
    RAISE EXCEPTION 'Member unexpectedly marked supply low';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM record_supply_purchase(v_item, 1, NULL);
    RAISE EXCEPTION 'Member unexpectedly recorded a supply purchase';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM fulfill_supply_request(v_pending, NULL);
    RAISE EXCEPTION 'Member unexpectedly fulfilled a supply request';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    UPDATE supply_requests SET status = 'approved' WHERE id = v_pending;
    RAISE EXCEPTION 'Member unexpectedly updated a supply request directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', :'TEST_MANAGER_USER', true);
SELECT update_supply_quantity(current_setting('test.supply_item')::UUID, 1);
SELECT record_supply_purchase(current_setting('test.supply_item')::UUID, 1, NULL);
SELECT fulfill_supply_request(current_setting('test.approved_request')::UUID, NULL);

ROLLBACK;
