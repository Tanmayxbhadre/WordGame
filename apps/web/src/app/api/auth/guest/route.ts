import { randomBytes, randomInt } from 'node:crypto';
import { NextRequest } from 'next/server';
import { checkRateLimit, errorResponse, successResponse } from '@/lib/api-helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const ADJECTIVES = ['Swift', 'Clever', 'Bright', 'Lucky', 'Brave', 'Quick', 'Bold', 'Sunny'];
const NOUNS = ['Fox', 'Owl', 'Wolf', 'Hawk', 'Bear', 'Lynx', 'Hare', 'Seal'];

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (!checkRateLimit(`guest_auth:${ip}`, 15, 60_000)) {
    return errorResponse('RATE_LIMITED', 'Too many guest sessions created.', 429);
  }

  const adj = ADJECTIVES[randomInt(0, ADJECTIVES.length)];
  const noun = NOUNS[randomInt(0, NOUNS.length)];
  const num = randomInt(100, 999);
  const username = `${adj}${noun}${num}`;
  const id = randomBytes(8).toString('hex');
  const email = `guest_${id}@guest.wordshift.local`;
  const password = randomBytes(24).toString('base64url');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse(
      'INTERNAL_ERROR',
      'Add SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local (or enable Anonymous Sign-Ins in Supabase Auth).',
      500
    );
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      is_guest: true,
    },
  });

  if (error) {
    return errorResponse('INTERNAL_ERROR', error.message, 500);
  }

  return successResponse({ email, password, username });
}
