-- WordShift Core Database Schema
-- Migration 0001: Tables, Constraints, Indexes, Triggers

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
  total_matches INTEGER NOT NULL DEFAULT 0 CHECK (total_matches >= 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Approved Dictionary Words
CREATE TABLE IF NOT EXISTS public.words (
  word TEXT PRIMARY KEY,
  length SMALLINT NOT NULL CHECK (length BETWEEN 3 AND 8),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_approved BOOLEAN NOT NULL DEFAULT true,
  is_puzzle_candidate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_words_lookup
  ON public.words (length, difficulty, is_approved, is_puzzle_candidate);

-- 3. Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'ready', 'active', 'finished', 'cancelled', 'expired')),
  word_length SMALLINT NOT NULL DEFAULT 4 CHECK (word_length IN (4, 5)),
  difficulty TEXT NOT NULL DEFAULT 'mixed' CHECK (difficulty IN ('easy', 'medium', 'hard', 'mixed')),
  start_word TEXT NOT NULL,
  target_word TEXT NOT NULL,
  current_word TEXT NOT NULL,
  current_turn_seat SMALLINT NOT NULL DEFAULT 1 CHECK (current_turn_seat IN (1, 2)),
  move_number INTEGER NOT NULL DEFAULT 0 CHECK (move_number >= 0),
  consecutive_timeouts SMALLINT NOT NULL DEFAULT 0 CHECK (consecutive_timeouts >= 0),
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  result_reason TEXT CHECK (
    result_reason IS NULL OR result_reason IN (
      'target_reached',
      'forfeit',
      'timeout_draw',
      'match_duration_draw',
      'disconnect_forfeit',
      'cancelled'
    )
  ),
  turn_deadline_at TIMESTAMPTZ,
  match_deadline_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_room_code ON public.matches (room_code);
CREATE INDEX IF NOT EXISTS idx_matches_status_deadlines ON public.matches (status, turn_deadline_at, match_deadline_at);

-- 4. Match Players
CREATE TABLE IF NOT EXISTS public.match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seat SMALLINT NOT NULL CHECK (seat IN (1, 2)),
  is_ready BOOLEAN NOT NULL DEFAULT false,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  timeout_count SMALLINT NOT NULL DEFAULT 0 CHECK (timeout_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, player_id),
  UNIQUE (match_id, seat)
);

CREATE INDEX IF NOT EXISTS idx_match_players_player ON public.match_players (player_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON public.match_players (match_id);

-- 5. Match Moves
CREATE TABLE IF NOT EXISTS public.match_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL CHECK (move_number >= 1),
  player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  seat SMALLINT CHECK (seat IS NULL OR seat IN (1, 2)),
  word TEXT NOT NULL,
  previous_word TEXT NOT NULL,
  changed_position SMALLINT,
  is_timeout_skip BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, move_number)
);

CREATE INDEX IF NOT EXISTS idx_match_moves_match ON public.match_moves (match_id, move_number);

-- 6. Match Invites
CREATE TABLE IF NOT EXISTS public.match_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_invites_code ON public.match_invites (room_code);

-- 7. Rankings
CREATE TABLE IF NOT EXISTS public.rankings (
  player_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 0),
  rank_tier TEXT NOT NULL DEFAULT 'bronze',
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Daily Challenges
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL UNIQUE,
  word_length SMALLINT NOT NULL DEFAULT 4 CHECK (word_length IN (4, 5)),
  difficulty TEXT NOT NULL DEFAULT 'mixed',
  start_word TEXT NOT NULL,
  target_word TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Idempotency Keys
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON public.idempotency_keys (created_at);

-- 10. Rate Limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 1
);

-- 11. Match Audit Logs
CREATE TABLE IF NOT EXISTS public.match_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_audit_match ON public.match_audit_logs (match_id, created_at DESC);

-- Trigger: auto-create profile and ranking row on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'username'), ''),
    'player_' || SUBSTRING(NEW.id::TEXT, 1, 8)
  );

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, v_username)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rankings (player_id)
  VALUES (NEW.id)
  ON CONFLICT (player_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles/rankings for any users created before migration ran
INSERT INTO public.profiles (id, username)
SELECT
  id,
  COALESCE(NULLIF(TRIM(raw_user_meta_data ->> 'username'), ''), 'player_' || SUBSTRING(id::TEXT, 1, 8))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rankings (player_id)
SELECT id FROM auth.users
ON CONFLICT (player_id) DO NOTHING;

-- Enable Realtime on match tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_moves;
