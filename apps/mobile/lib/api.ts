import type { ApiResponse } from '@wordshift/shared-types';
import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export function makeIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function mobileApiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Unexpected server response (${res.status}).`,
      },
    };
  }
}
