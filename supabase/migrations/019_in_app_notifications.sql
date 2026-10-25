CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'task_reminder',
    'task_overdue',
    'task_completed',
    'issue_reported',
    'issue_assigned',
    'issue_resolved',
    'supply_low',
    'supply_requested',
    'supply_fulfilled',
    'recommendation_new',
    'mention',
    'daily_summary',
    'weekly_summary'
  )),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 1000),
  metadata JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_recipient_recent_idx
  ON notifications(user_id, space_id, created_at DESC);
CREATE INDEX notifications_unread_idx
  ON notifications(user_id, space_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_select_recipient"
  ON notifications FOR SELECT
  USING (user_id = auth.uid() AND is_space_member(space_id));

CREATE POLICY "notification_insert_recipient"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_space_member(space_id));

CREATE POLICY "notification_update_read_recipient"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid() AND is_space_member(space_id))
  WITH CHECK (user_id = auth.uid() AND is_space_member(space_id));

REVOKE UPDATE ON notifications FROM authenticated;
GRANT UPDATE (read_at) ON notifications TO authenticated;
