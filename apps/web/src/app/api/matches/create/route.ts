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

const VALID_DIFFICULTIES = new Set<DifficultyTier>(['easy', 'medium', 'hard', 'mixed']);

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.userId) return auth.error!;

  if (!checkRateLimit(`create_match:${auth.userId}`, 10, 60_000)) {
    return errorResponse('RATE_LIMITED', 'Too many rooms created. Please wait a moment.', 429);
  }

  let body: { word_length?: number; difficulty?: DifficultyTier; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body.', 400);
  }

  const wordLength = body.word_length ?? GAME_RULES.DEFAULT_WORD_LENGTH;
  if (wordLength !== 4 && wordLength !== 5) {
    return errorResponse('VALIDATION_ERROR', 'word_length must be 4 or 5.', 400);
  }

  const difficulty: DifficultyTier = body.difficulty ?? 'mixed';
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return errorResponse('VALIDATION_ERROR', 'Invalid difficulty tier.', 400);
  }

  const puzzle = generatePuzzle({ wordLength, difficulty });
  const roomCode = generateSecureRoomCode(GAME_RULES.ROOM_CODE_LENGTH);

  const admin = createSupabaseAdminClient();
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
