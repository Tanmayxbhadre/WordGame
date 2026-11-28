import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { apiFetch } from '@/lib/api-client';

export interface SessionResult {
  userId: string | null;
  error?: string;
}

export async function ensurePlayerSession(): Promise<SessionResult> {
  const supabase = createSupabaseBrowserClient();
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user) {
    return { userId: existing.user.id };
  }

  // 1. Try Supabase anonymous sign-in
  const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
  if (!anonError && anonData.user) {
    return { userId: anonData.user.id };
  }

  // 2. Fallback: server-provisioned guest user (requires SUPABASE_SERVICE_ROLE_KEY)
  const res = await apiFetch<{ email: string; password: string }>('/api/auth/guest', {
    method: 'POST',
  });
  if (res.ok) {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: res.data.email,
      password: res.data.password,
    });
    if (!signInErr && signInData.user) {
      return { userId: signInData.user.id };
    }
  }

  // 3. Fallback: client signUp (works when Supabase "Confirm email" is OFF)
  const rand = Math.random().toString(36).slice(2, 10);
  const guestEmail = `guest_${Date.now()}_${rand}@example.com`;
  const guestPassword = `ws_${rand}_${Date.now()}`;
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: guestEmail,
    password: guestPassword,
    options: { data: { username: `Player_${rand.slice(0, 4)}`, is_guest: true } },
  });
  if (!signUpErr && signUpData.session?.user) {
    return { userId: signUpData.session.user.id };
  }

  const serverErr = !res.ok ? res.error.message : undefined;
  return {
    userId: null,
    error:
      serverErr ||
      anonError?.message ||
      signUpErr?.message ||
      'Enable Anonymous Sign-Ins in Supabase Dashboard or add SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local.',
  };
}
