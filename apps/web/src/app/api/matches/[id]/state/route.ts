import { NextRequest } from 'next/server';
import {
  authenticateRequest,
  checkRateLimit,
  errorResponse,
  mapRpcResult,
} from '@/lib/api-helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.userId) return auth.error!;

  const { id: matchId } = await params;

  if (!checkRateLimit(`get_state:${auth.userId}`, 60, 10_000)) {
    return errorResponse('RATE_LIMITED', 'Too many state requests.', 429);
  }

  const admin = createSupabaseAdminClient();

  // Verify membership
  const { data: member } = await admin
    .from('match_players')
    .select('id')
    .eq('match_id', matchId)
    .eq('player_id', auth.userId)
    .maybeSingle();

  if (!member) {
    return errorResponse('NOT_A_PLAYER', 'You are not a player in this match.', 403);
  }

  // Process any pending timeout before returning authoritative snapshot
  const { data, error } = await admin.rpc('rpc_process_timeout', {
    p_match_id: matchId,
    p_expected_move_number: null,
  });

  if (error) {
    return errorResponse('INTERNAL_ERROR', error.message, 500);
  }

  return mapRpcResult(data);
}
