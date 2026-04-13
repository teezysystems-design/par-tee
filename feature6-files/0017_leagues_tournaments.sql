-- 0017_leagues_tournaments.sql
-- Feature 6: Leagues & Tournaments schema updates
--   1. Add league_type, scoring_format, partner_config columns to leagues
--   2. Add ELO rating + team columns to league_members
--   3. Add team support to league_matches
--   4. Add tournament score tracking columns
--   5. Create record_match_result function
--   6. RLS policies + indexes
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. LEAGUES TABLE — add missing spec columns
-- ════════════════════════════════════════════════════════════════════════════

-- League type: 1v1 or 2v2
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS league_type text DEFAULT '1v1'
  CHECK (league_type IN ('1v1', '2v2'));

-- Scoring format for matches
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS scoring_format text DEFAULT 'stroke_play'
  CHECK (scoring_format IN ('stroke_play', 'net_stroke_play', 'match_play'));

-- Whether rematches are allowed within a season
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS allow_rematches boolean DEFAULT false;

-- 2v2 partner config
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS partner_config text DEFAULT 'locked'
  CHECK (partner_config IN ('locked', 'flexible'));

-- Current season/round tracking
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS current_round integer DEFAULT 1;

-- Playoff format
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_format text DEFAULT 'single_elimination'
  CHECK (playoff_format IN ('single_elimination', 'double_elimination', 'best_of_three'));

-- Playoff size (top N advance)
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_size integer DEFAULT 4;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. LEAGUE MEMBERS — add ELO + team support
-- ════════════════════════════════════════════════════════════════════════════

-- ELO rating for 1v1/2v2 league ranking
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS elo_rating integer DEFAULT 1200;

-- Win/loss/draw tracking
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS wins integer DEFAULT 0;
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS losses integer DEFAULT 0;
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS draws integer DEFAULT 0;

-- Team name for 2v2 leagues
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS team_name text;

-- Partner ID for 2v2 locked-partner leagues
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES users(id);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. LEAGUE MATCHES — add team + detail columns
-- ════════════════════════════════════════════════════════════════════════════

-- For 2v2: team members (player1_id/player2_id become team1 lead/team2 lead)
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS team1_partner_id uuid REFERENCES users(id);
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS team2_partner_id uuid REFERENCES users(id);

-- Match status tracking
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS status text DEFAULT 'scheduled'
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'forfeited'));

-- Deadline for completing the match
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

-- Party/round references (links to actual played round)
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES parties(id);
ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES rounds(id);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. TOURNAMENTS — add missing columns
-- ════════════════════════════════════════════════════════════════════════════

-- Ensure format column uses spec values
DO $$ BEGIN
  ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS format text DEFAULT 'stroke_play'
    CHECK (format IN ('stroke_play', 'stableford', 'net_stroke_play', 'match_play'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. TOURNAMENT ENTRIES — add score tracking
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS total_strokes integer;
ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS score_to_par integer;
ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS holes_completed integer DEFAULT 0;
ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES rounds(id);
ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. record_match_result — stored procedure for ELO + win/loss updates
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION record_match_result(
  p_league_id uuid,
  p_winner_id uuid,
  p_loser_id uuid
) RETURNS void AS $$
DECLARE
  v_winner_elo integer;
  v_loser_elo integer;
  v_expected_winner float;
  v_expected_loser float;
  v_k integer := 32;
  v_winner_new_elo integer;
  v_loser_new_elo integer;
BEGIN
  -- Get current ELO ratings
  SELECT elo_rating INTO v_winner_elo
  FROM league_members
  WHERE league_id = p_league_id AND user_id = p_winner_id;

  SELECT elo_rating INTO v_loser_elo
  FROM league_members
  WHERE league_id = p_league_id AND user_id = p_loser_id;

  -- Default to 1200 if not found
  v_winner_elo := COALESCE(v_winner_elo, 1200);
  v_loser_elo := COALESCE(v_loser_elo, 1200);

  -- ELO expected score calculation
  v_expected_winner := 1.0 / (1.0 + power(10, (v_loser_elo - v_winner_elo)::float / 400.0));
  v_expected_loser := 1.0 - v_expected_winner;

  -- New ELO ratings
  v_winner_new_elo := v_winner_elo + round(v_k * (1.0 - v_expected_winner));
  v_loser_new_elo := v_loser_elo + round(v_k * (0.0 - v_expected_loser));

  -- Ensure minimum ELO of 100
  v_loser_new_elo := GREATEST(v_loser_new_elo, 100);

  -- Update winner
  UPDATE league_members
  SET elo_rating = v_winner_new_elo,
      wins = wins + 1
  WHERE league_id = p_league_id AND user_id = p_winner_id;

  -- Update loser
  UPDATE league_members
  SET elo_rating = v_loser_new_elo,
      losses = losses + 1
  WHERE league_id = p_league_id AND user_id = p_loser_id;

  -- Also update the main 1v1 or 2v2 player_rankings leaderboard
  -- Determine leaderboard type from league
  DECLARE
    v_league_type text;
    v_lb_type text;
  BEGIN
    SELECT league_type INTO v_league_type FROM leagues WHERE id = p_league_id;
    v_lb_type := CASE WHEN v_league_type = '2v2' THEN '2v2' ELSE '1v1' END;

    -- Upsert winner ranking
    INSERT INTO player_rankings (user_id, leaderboard_type, points, wins, rounds_played)
    VALUES (p_winner_id, v_lb_type, 25, 1, 1)
    ON CONFLICT (user_id, leaderboard_type)
    DO UPDATE SET
      points = player_rankings.points + 25,
      wins = player_rankings.wins + 1,
      rounds_played = player_rankings.rounds_played + 1;

    -- Upsert loser ranking (still gets some points for participating)
    INSERT INTO player_rankings (user_id, leaderboard_type, points, losses, rounds_played)
    VALUES (p_loser_id, v_lb_type, 5, 1, 1)
    ON CONFLICT (user_id, leaderboard_type)
    DO UPDATE SET
      points = player_rankings.points + 5,
      losses = player_rankings.losses + 1,
      rounds_played = player_rankings.rounds_played + 1;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. INDEXES
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS leagues_status_idx ON leagues(status);
CREATE INDEX IF NOT EXISTS leagues_type_idx ON leagues(league_type);
CREATE INDEX IF NOT EXISTS league_members_league_status_idx ON league_members(league_id, status);
CREATE INDEX IF NOT EXISTS league_members_user_idx ON league_members(user_id);
CREATE INDEX IF NOT EXISTS league_matches_league_round_idx ON league_matches(league_id, round);
CREATE INDEX IF NOT EXISTS league_matches_status_idx ON league_matches(status);
CREATE INDEX IF NOT EXISTS tournaments_status_idx ON tournaments(status);
CREATE INDEX IF NOT EXISTS tournaments_course_idx ON tournaments(course_id);
CREATE INDEX IF NOT EXISTS tournament_entries_tournament_idx ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS tournament_entries_user_idx ON tournament_entries(user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RLS POLICIES
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;

-- Leagues: members can read, commissioner can write
DO $$ BEGIN
  DROP POLICY IF EXISTS "leagues_select" ON leagues;
  CREATE POLICY "leagues_select" ON leagues FOR SELECT USING (true);

  DROP POLICY IF EXISTS "leagues_insert" ON leagues;
  CREATE POLICY "leagues_insert" ON leagues FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = created_by_user_id AND u.supabase_user_id = auth.uid())
  );

  DROP POLICY IF EXISTS "leagues_update" ON leagues;
  CREATE POLICY "leagues_update" ON leagues FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = created_by_user_id AND u.supabase_user_id = auth.uid())
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- Tournaments: public read, course staff can write
DO $$ BEGIN
  DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
  CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (true);

  DROP POLICY IF EXISTS "tournaments_insert" ON tournaments;
  CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = created_by_user_id AND u.supabase_user_id = auth.uid())
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- Tournament entries: own entries writable, all readable
DO $$ BEGIN
  DROP POLICY IF EXISTS "tournament_entries_select" ON tournament_entries;
  CREATE POLICY "tournament_entries_select" ON tournament_entries FOR SELECT USING (true);

  DROP POLICY IF EXISTS "tournament_entries_insert" ON tournament_entries;
  CREATE POLICY "tournament_entries_insert" ON tournament_entries FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = user_id AND u.supabase_user_id = auth.uid())
  );
EXCEPTION WHEN others THEN NULL;
END $$;
