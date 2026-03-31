-- 0005_parties_scores.sql
-- Adds tee-time parties, party members, and hole-by-hole scoring

CREATE TYPE "game_mode" AS ENUM ('chill', 'fun', 'competitive');
CREATE TYPE "challenge_type" AS ENUM ('none', 'head_to_head', 'scramble_2v2');
CREATE TYPE "party_status" AS ENUM ('forming', 'in_progress', 'completed', 'cancelled');
CREATE TYPE "party_member_status" AS ENUM ('invited', 'accepted', 'declined');

CREATE TABLE "parties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "game_mode" "game_mode" NOT NULL DEFAULT 'fun',
  "challenge_type" "challenge_type" NOT NULL DEFAULT 'none',
  "status" "party_status" NOT NULL DEFAULT 'forming',
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "party_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "party_id" uuid NOT NULL REFERENCES "parties"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "party_member_status" NOT NULL DEFAULT 'invited',
  "invited_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone
);

-- At most 4 members per party (creator + 3 invitees enforced at app layer)
CREATE UNIQUE INDEX "party_members_party_user_uidx" ON "party_members"("party_id", "user_id");

CREATE TABLE "hole_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "party_id" uuid NOT NULL REFERENCES "parties"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "hole_number" integer NOT NULL CHECK ("hole_number" BETWEEN 1 AND 18),
  "strokes" integer NOT NULL CHECK ("strokes" BETWEEN 1 AND 20),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Enforce one score per player per hole per party
CREATE UNIQUE INDEX "hole_scores_party_user_hole_uidx" ON "hole_scores"("party_id", "user_id", "hole_number");

-- Index: look up all scores for a party quickly
CREATE INDEX "hole_scores_party_idx" ON "hole_scores"("party_id");
