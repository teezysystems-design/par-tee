-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');

-- Users
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  avatar_url     TEXT,
  handicap       NUMERIC(4, 1),
  mood_preferences  JSONB NOT NULL DEFAULT '[]',
  location_lat   NUMERIC(9, 6),
  location_lng   NUMERIC(9, 6),
  supabase_user_id TEXT NOT NULL UNIQUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_supabase_user_id ON users (supabase_user_id);
CREATE INDEX idx_users_location ON users (location_lat, location_lng)
  WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Courses
CREATE TABLE courses (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  description      TEXT,
  location_lat     NUMERIC(9, 6) NOT NULL,
  location_lng     NUMERIC(9, 6) NOT NULL,
  location         GEOGRAPHY(POINT, 4326),  -- PostGIS geo column
  address          TEXT NOT NULL,
  mood_tags        JSONB NOT NULL DEFAULT '[]',
  amenities        JSONB NOT NULL DEFAULT '[]',
  photo_urls       JSONB NOT NULL DEFAULT '[]',
  hole_count       INTEGER NOT NULL DEFAULT 18,
  par_score        INTEGER NOT NULL DEFAULT 72,
  website_url      TEXT,
  phone_number     TEXT,
  stripe_account_id TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_courses_location ON courses USING GIST (location);
CREATE INDEX idx_courses_active ON courses (is_active);
CREATE INDEX idx_courses_name_trgm ON courses USING GIN (name gin_trgm_ops);

-- Populate geo column from lat/lng on insert/update
CREATE OR REPLACE FUNCTION courses_set_location() RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326)::GEOGRAPHY;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courses_set_location
  BEFORE INSERT OR UPDATE OF location_lat, location_lng ON courses
  FOR EACH ROW EXECUTE FUNCTION courses_set_location();

-- Tee time slots
CREATE TABLE tee_time_slots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id      UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  starts_at      TIMESTAMPTZ NOT NULL,
  capacity       INTEGER NOT NULL DEFAULT 4,
  booked_count   INTEGER NOT NULL DEFAULT 0,
  price_in_cents INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tee_time_slots_course_starts ON tee_time_slots (course_id, starts_at);
CREATE INDEX idx_tee_time_slots_starts_at ON tee_time_slots (starts_at)
  WHERE booked_count < capacity;

-- Bookings
CREATE TABLE bookings (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  slot_id                  UUID NOT NULL REFERENCES tee_time_slots (id) ON DELETE RESTRICT,
  course_id                UUID NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
  status                   booking_status NOT NULL DEFAULT 'pending',
  payment_status           payment_status NOT NULL DEFAULT 'pending',
  party_size               INTEGER NOT NULL DEFAULT 1,
  total_price_in_cents     INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  cancelled_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_user_id ON bookings (user_id);
CREATE INDEX idx_bookings_slot_id ON bookings (slot_id);
CREATE INDEX idx_bookings_course_id ON bookings (course_id);

-- Friendships
CREATE TABLE friendships (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status       friendship_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_friendships_addressee ON friendships (addressee_id, status);
CREATE INDEX idx_friendships_requester ON friendships (requester_id, status);

-- Groups
CREATE TABLE groups (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               TEXT NOT NULL,
  description        TEXT,
  created_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group members
CREATE TABLE group_members (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id  UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members (user_id);

-- Rounds
CREATE TABLE rounds (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id   UUID NOT NULL,
  booking_id  UUID,
  played_at   TIMESTAMPTZ NOT NULL,
  score_card  JSONB NOT NULL DEFAULT '[]',
  total_score INTEGER,
  mood_rating INTEGER CHECK (mood_rating BETWEEN 1 AND 5),
  is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rounds_user_id ON rounds (user_id, played_at DESC);
CREATE INDEX idx_rounds_shared ON rounds (is_shared, played_at DESC) WHERE is_shared = TRUE;

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tee_time_slots_updated_at BEFORE UPDATE ON tee_time_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_friendships_updated_at BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rounds_updated_at BEFORE UPDATE ON rounds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
