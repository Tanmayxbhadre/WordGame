import { NextRequest } from 'next/server';
import {
  authenticateRequest,
  checkRateLimit,
  errorResponse,
  mapRpcResult,
} from '@/lib/api-helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.userId) return auth.error!;

  if (!checkRateLimit(`join_match:${auth.userId}`, 15, 60_000)) {
    return errorResponse('RATE_LIMITED', 'Too many join attempts. Please wait.', 429);
  }

  let body: { room_code?: string; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body.', 400);
  }

  const roomCode = body.room_code?.trim().toUpperCase();
  if (!roomCode || !/^[A-Z0-9]{4,8}$/.test(roomCode)) {
    return errorResponse('VALIDATION_ERROR', 'Please enter a valid 6-character room code.', 400);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('rpc_join_match', {
    p_user_id: auth.userId,
    p_room_code: roomCode,
    p_idempotency_key: body.idempotency_key ?? null,
  });

  if (error) {
    return errorResponse('INTERNAL_ERROR', error.message, 500);
  }

  return mapRpcResult(data);
}
