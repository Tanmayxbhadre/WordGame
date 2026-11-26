import { NextRequest } from 'next/server';
import {
  authenticateRequest,
  checkRateLimit,
  errorResponse,
  mapRpcResult,
} from '@/lib/api-helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.userId) return auth.error!;

  const { id: matchId } = await params;

  if (!checkRateLimit(`submit_move:${auth.userId}`, 30, 10_000)) {
    return errorResponse('RATE_LIMITED', 'Too many move submissions.', 429);
  }

  let body: {
    word?: string;
    expected_move_number?: number;
    idempotency_key?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body.', 400);
  }

  if (typeof body.word !== 'string' || body.word.trim().length === 0) {
    return errorResponse('VALIDATION_ERROR', 'word is required.', 400);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('rpc_submit_move', {
    p_user_id: auth.userId,
    p_match_id: matchId,
    p_word: body.word,
    p_expected_move_number:
      typeof body.expected_move_number === 'number' ? body.expected_move_number : null,
    p_idempotency_key: body.idempotency_key ?? null,
  });

  if (error) {
    return errorResponse('INTERNAL_ERROR', error.message, 500);
  }

  return mapRpcResult(data);
}
