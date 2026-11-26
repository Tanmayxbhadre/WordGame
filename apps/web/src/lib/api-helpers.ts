import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, ErrorCode } from '@wordshift/shared-types';
import { createSupabaseAdminClient, createSupabaseServerClient } from './supabase/server';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSecureRoomCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message, details },
    },
    { status }
  );
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export async function authenticateRequest(req: NextRequest): Promise<{
  userId: string | null;
  error?: NextResponse<ApiResponse<never>>;
}> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      return {
        userId: null,
        error: errorResponse('UNAUTHORIZED', 'Invalid or expired bearer token.', 401),
      };
    }
    return { userId: data.user.id };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return {
      userId: null,
      error: errorResponse('UNAUTHORIZED', 'Authentication required.', 401),
    };
  }
  return { userId: data.user.id };
}

// In-memory sliding window rate limiter for single-instance + DB fallback ready
const rateBucket = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = 30,
  windowMs = 10_000
): boolean {
  const now = Date.now();
  const existing = rateBucket.get(key);
  if (!existing || now > existing.resetAt) {
    rateBucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxRequests) {
    return false;
  }
  existing.count += 1;
  return true;
}

export function mapRpcResult<T>(rpcData: unknown): NextResponse<ApiResponse<T>> {
  const res = rpcData as ApiResponse<T> | null;
  if (!res) {
    return errorResponse('INTERNAL_ERROR', 'Empty response from database.', 500);
  }
  if (!res.ok) {
    const statusMap: Partial<Record<ErrorCode, number>> = {
      UNAUTHORIZED: 401,
      NOT_A_PLAYER: 403,
      NOT_YOUR_TURN: 409,
      INVALID_MATCH_STATE: 409,
      MATCH_FINISHED: 409,
      TURN_EXPIRED: 409,
      ROOM_FULL: 409,
      ROOM_EXPIRED: 410,
      RATE_LIMITED: 429,
    };
    const status = statusMap[res.error.code] ?? 400;
    return NextResponse.json(res, { status });
  }
  return NextResponse.json(res, { status: 200 });
}
