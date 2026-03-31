-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Score cards
CREATE TABLE IF NOT EXISTS score_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  hole_scores JSONB NOT NULL DEFAULT '[]',
  total_strokes INTEGER,
  notes TEXT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe payout events
CREATE TABLE IF NOT EXISTS stripe_payout_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  amount_cents INTEGER,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for waitlist
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
-- Index for score_cards
CREATE INDEX IF NOT EXISTS idx_score_cards_user ON score_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_score_cards_course ON score_cards(course_id);
