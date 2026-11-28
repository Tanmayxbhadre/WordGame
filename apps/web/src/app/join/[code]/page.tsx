'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { JoinMatchResponse } from '@wordshift/shared-types';
import { apiFetch, makeIdempotencyKey } from '@/lib/api-client';
import { ensurePlayerSession } from '@/lib/ensure-session';

export default function JoinByCodePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = (params.code ?? '').trim().toUpperCase();
    if (!code) {
      setError('Invalid invite link.');
      return;
    }

    let cancelled = false;
    (async () => {
      const session = await ensurePlayerSession();
      if (cancelled) return;
      if (!session.userId) {
        setError(session.error ?? 'Could not start guest session.');
        return;
      }

      const res = await apiFetch<JoinMatchResponse>('/api/matches/join', {
        method: 'POST',
        body: JSON.stringify({
          room_code: code,
          idempotency_key: makeIdempotencyKey(),
        }),
      });

      if (cancelled) return;
      if (!res.ok) {
        setError(res.error.message);
        return;
      }

      router.replace(`/match/${res.data.match.id}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [params.code, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md">
        <div className="sketch-card rounded-3xl bg-[var(--bg-secondary)] p-6 text-center">
          <p className="text-sm font-bold text-[var(--danger)]">{error}</p>
          <Link
            href="/"
            className="sketch-btn mt-4 inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-extrabold text-white"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="sketch-card rounded-3xl bg-[var(--bg-secondary)] p-8 text-center">
        <p className="font-mono text-2xl font-black tracking-[0.2em] text-[var(--accent)]">
          {(params.code ?? '').toUpperCase()}
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
          Joining room...
        </p>
      </div>
    </div>
  );
}
