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
  if (!checkRateLimit(`set_ready:${auth.userId}`, 20, 10_000)) {
    return errorResponse('RATE_LIMITED', 'Too many requests.', 429);
  }

  let body: { is_ready?: boolean; idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Invalid JSON body.', 400);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('rpc_set_ready', {
    p_user_id: auth.userId,
    p_match_id: matchId,
    p_is_ready: Boolean(body.is_ready),
    p_idempotency_key: body.idempotency_key ?? null,
  });

  if (error) {
    return errorResponse('INTERNAL_ERROR', error.message, 500);
  }

  return mapRpcResult(data);
}
