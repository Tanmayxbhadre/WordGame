import { NextRequest } from 'next/server';
import {
  authenticateRequest,
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
  let body: { idempotency_key?: string } = {};
  try {
    body = await req.json();
  } catch {
    // optional
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('rpc_forfeit_match', {
    p_user_id: auth.userId,
    p_match_id: matchId,
    p_idempotency_key: body.idempotency_key ?? null,
  });

  if (error) {
    return errorResponse('INTERNAL_ERROR', error.message, 500);
  }

  return mapRpcResult(data);
}
