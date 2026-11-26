import type { ApiResponse } from '@wordshift/shared-types';

export function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  try {
    const json = (await res.json()) as ApiResponse<T>;
    return json;
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
