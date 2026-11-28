-- WordShift Row Level Security Policies
-- Migration 0002: Strict RLS across all tables

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user belongs to a match
CREATE OR REPLACE FUNCTION public.is_match_participant(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id
      AND mp.player_id = auth.uid()
  );
$$;

-- Profiles: authenticated users can read profiles; users can only update their own username/avatar
CREATE POLICY profiles_select_authenticated
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Words: readable by authenticated users, no client writes
CREATE POLICY words_select_authenticated
  ON public.words FOR SELECT
  TO authenticated
  USING (is_approved = true);

-- Matches: participants only can SELECT; no direct client INSERT/UPDATE/DELETE
CREATE POLICY matches_select_participants
  ON public.matches FOR SELECT
  TO authenticated
  USING (public.is_match_participant(id));

-- Match Players: participants only can SELECT; no direct client mutations
CREATE POLICY match_players_select_participants
  ON public.match_players FOR SELECT
  TO authenticated
  USING (public.is_match_participant(match_id));

-- Match Moves: participants only can SELECT; no direct client mutations
CREATE POLICY match_moves_select_participants
  ON public.match_moves FOR SELECT
  TO authenticated
  USING (public.is_match_participant(match_id));

-- Match Invites: creator or participants can SELECT
CREATE POLICY match_invites_select_participants
  ON public.match_invites FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.is_match_participant(match_id));

-- Rankings: readable by authenticated users
CREATE POLICY rankings_select_authenticated
  ON public.rankings FOR SELECT
  TO authenticated
  USING (true);

-- Daily challenges: readable by authenticated users
CREATE POLICY daily_challenges_select_authenticated
  ON public.daily_challenges FOR SELECT
  TO authenticated
  USING (true);

-- idempotency_keys, rate_limits, match_audit_logs: intentionally NO client policies (server-only)

-- Ensure service_role and authenticated have schema/table grants (needed when running via SQL Editor)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT ON public.profiles, public.words, public.matches, public.match_players, public.match_moves, public.match_invites, public.rankings, public.daily_challenges TO authenticated;
GRANT UPDATE (username, avatar_url) ON public.profiles TO authenticated;
