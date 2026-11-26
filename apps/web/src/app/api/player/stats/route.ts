import { NextRequest } from 'next/server';
import {
  authenticateRequest,
  errorResponse,
  successResponse,
} from '@/lib/api-helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.userId) return auth.error!;

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', auth.userId)
    .single();

  if (profileError || !profile) {
    return errorResponse('INTERNAL_ERROR', 'Failed to load profile.', 500);
  }

  const { data: playerMatches } = await admin
    .from('match_players')
    .select('match_id')
    .eq('player_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const matchIds = (playerMatches ?? []).map((pm) => pm.match_id);
  let recent_matches: Array<Record<string, unknown>> = [];

  if (matchIds.length > 0) {
    const { data: matches } = await admin
      .from('matches')
      .select('id, room_code, start_word, target_word, status, result_reason, winner_id, move_number, started_at, ended_at, created_at')
      .in('id', matchIds)
      .order('created_at', { ascending: false });

    const { data: allPlayers } = await admin
      .from('match_players')
      .select('match_id, player_id, profiles(username)')
      .in('match_id', matchIds);

    recent_matches = (matches ?? []).map((m) => {
      const opp = (allPlayers ?? []).find(
        (p) => p.match_id === m.id && p.player_id !== auth.userId
      );
      const oppProfile = opp?.profiles as unknown as { username: string } | null;
      const durationSeconds =
        m.started_at && m.ended_at
          ? Math.max(0, Math.round((Date.parse(m.ended_at) - Date.parse(m.started_at)) / 1000))
          : null;

      return {
        match_id: m.id,
        room_code: m.room_code,
        start_word: m.start_word,
        target_word: m.target_word,
        status: m.status,
        result_reason: m.result_reason,
        winner_id: m.winner_id,
        move_count: m.move_number,
        duration_seconds: durationSeconds,
        opponent_username: oppProfile?.username ?? null,
        ended_at: m.ended_at,
        created_at: m.created_at,
      };
    });
  }

  return successResponse({
    profile,
    recent_matches,
  });
}
