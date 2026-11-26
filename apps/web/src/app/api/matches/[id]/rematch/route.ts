import { NextRequest } from 'next/server';
import { generatePuzzle } from '@wordshift/game-engine';
import { GAME_RULES, type DifficultyTier } from '@wordshift/shared-types';
import {
  authenticateRequest,
  checkRateLimit,
  errorResponse,
  generateSecureRoomCode,
  mapRpcResult,
} from '@/lib/api-helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.userId) return auth.error!;

  const { id: oldMatchId } = await params;

  if (!checkRateLimit(`rematch:${auth.userId}`, 10, 60_000)) {
    return errorResponse('RATE_LIMITED', 'Too many rematch requests.', 429);
  }

  let body: { idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    // optional
  }

  const admin = createSupabaseAdminClient();
  const { data: oldMatch } = await admin
    .from('matches')
    .select('word_length, difficulty')
    .eq('id', oldMatchId)
    .maybeSingle();

  const wordLength = oldMatch?.word_length === 5 ? 5 : 4;
  const difficulty = (oldMatch?.difficulty as DifficultyTier) ?? 'mixed';
  const puzzle = generatePuzzle({ wordLength, difficulty });
  const roomCode = generateSecureRoomCode(GAME_RULES.ROOM_CODE_LENGTH);

  const { data, error } = await admin.rpc('rpc_create_match', {
    p_user_id: auth.userId,
    p_word_length: wordLength,
    p_difficulty: difficulty,
    p_start_word: puzzle.startWord,
    p_target_word: puzzle.targetWord,
    p_room_code: roomCode,
    p_idempotency_key: body.idempotency_key ?? null,
  });

  if (error) {
    return errorResponse('INTERNAL_ERROR', error.message, 500);
  }

  return mapRpcResult(data);
}
