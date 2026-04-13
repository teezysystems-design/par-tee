-- Feature 8: Notifications + Polish
-- Updates notifications table, adds push_tokens + notification_preferences,
-- auto-creates preferences on user insert, enables Realtime on notifications.

BEGIN;

-- ============================================================
-- 1. Update notifications table
-- ============================================================
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS notification_type text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_via_push boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id) WHERE read_at IS NULL;

-- ============================================================
-- 2. Push tokens table
-- ============================================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens(user_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own push tokens" ON push_tokens;
CREATE POLICY "Users can manage their own push tokens"
  ON push_tokens FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_user_id::text = auth.uid()::text))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_user_id::text = auth.uid()::text));

-- ============================================================
-- 3. Notification preferences table
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- category toggles
  social_enabled boolean NOT NULL DEFAULT true,
  parties_enabled boolean NOT NULL DEFAULT true,
  friends_enabled boolean NOT NULL DEFAULT true,
  bookings_enabled boolean NOT NULL DEFAULT true,
  leagues_enabled boolean NOT NULL DEFAULT true,
  tournaments_enabled boolean NOT NULL DEFAULT true,
  rankings_enabled boolean NOT NULL DEFAULT true,
  marketing_enabled boolean NOT NULL DEFAULT false,
  system_enabled boolean NOT NULL DEFAULT true,
  -- quiet hours
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time NOT NULL DEFAULT '22:00',
  quiet_hours_end time NOT NULL DEFAULT '07:00',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own notification preferences"
  ON notification_preferences;
CREATE POLICY "Users can manage their own notification preferences"
  ON notification_preferences FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_user_id::text = auth.uid()::text))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE supabase_user_id::text = auth.uid()::text));

-- ============================================================
-- 4. Auto-create preferences for new users
-- ============================================================
CREATE OR REPLACE FUNCTION create_notification_preferences_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_notification_preferences ON users;
CREATE TRIGGER trg_create_notification_preferences
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences_for_user();

-- Backfill preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 5. Enable Realtime on notifications
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

COMMIT;
