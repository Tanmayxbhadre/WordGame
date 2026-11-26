'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type {
  CreateMatchResponse,
  MatchStateSnapshot,
  SubmitMoveResponse,
} from '@wordshift/shared-types';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { apiFetch, makeIdempotencyKey } from '@/lib/api-client';
import { MatchLobby } from '@/components/match/MatchLobby';
import { MatchGameplay } from '@/components/match/MatchGameplay';
import { MatchResults } from '@/components/match/MatchResults';

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const matchId = params.id;

  const [snapshot, setSnapshot] = useState<MatchStateSnapshot | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'info' | 'success';
    message: string;
  } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'reconnecting' | 'offline'
  >('connected');
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  const fetchSnapshot = useCallback(async () => {
    const res = await apiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/state`);
    if (!res.ok) {
      if (res.error.code === 'UNAUTHORIZED') {
        router.push('/auth');
        return;
      }
      setError(res.error.message);
      setLoading(false);
      return;
    }
    setSnapshot(res.data);
    setServerOffsetMs(Date.parse(res.data.server_now) - Date.now());
    setLoading(false);
  }, [matchId, router]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/auth');
        return;
      }
      setUserId(data.user.id);
    });
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    void fetchSnapshot();
  }, [userId, fetchSnapshot]);

  // Supabase Realtime subscription + reconnect reconciliation
  useEffect(() => {
    if (!userId || !matchId) return;
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        () => void fetchSnapshot()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_players', filter: `match_id=eq.${matchId}` },
        () => void fetchSnapshot()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_moves', filter: `match_id=eq.${matchId}` },
        () => void fetchSnapshot()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('reconnecting');
        }
      });

    const handleOnline = () => {
      setConnectionStatus('reconnecting');
      void apiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/reconnect`, {
        method: 'POST',
      }).then((res) => {
        if (res.ok) {
          setSnapshot(res.data);
          setServerOffsetMs(Date.parse(res.data.server_now) - Date.now());
          setConnectionStatus('connected');
        }
      });
    };

    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      void supabase.removeChannel(channel);
    };
  }, [userId, matchId, fetchSnapshot]);

  const handleSetReady = async (ready: boolean) => {
    setBusy(true);
    try {
      const res = await apiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/ready`, {
        method: 'POST',
        body: JSON.stringify({ is_ready: ready, idempotency_key: makeIdempotencyKey() }),
      });
      if (res.ok) setSnapshot(res.data);
      else setError(res.error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleStartMatch = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/start`, {
        method: 'POST',
        body: JSON.stringify({ idempotency_key: makeIdempotencyKey() }),
      });
      if (res.ok) setSnapshot(res.data);
      else setError(res.error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveLobby = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/matches/${matchId}/leave`, { method: 'POST' });
      router.push('/');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitMove = async (word: string) => {
    if (!snapshot) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await apiFetch<SubmitMoveResponse>(`/api/matches/${matchId}/move`, {
        method: 'POST',
        body: JSON.stringify({
          word,
          expected_move_number: snapshot.match.move_number,
          idempotency_key: makeIdempotencyKey(),
        }),
      });

      if (!res.ok) {
        setFeedback({ type: 'error', message: res.error.message });
        if (res.error.code === 'INVALID_MATCH_STATE' || res.error.code === 'TURN_EXPIRED') {
          void fetchSnapshot();
        }
        return;
      }

      setSnapshot(res.data.snapshot);
      setServerOffsetMs(Date.parse(res.data.snapshot.server_now) - Date.now());
    } finally {
      setBusy(false);
    }
  };

  const handleForfeit = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/forfeit`, {
        method: 'POST',
        body: JSON.stringify({ idempotency_key: makeIdempotencyKey() }),
      });
      if (res.ok) setSnapshot(res.data);
    } finally {
      setBusy(false);
    }
  };

  const handleTimeoutCheck = useCallback(async () => {
    if (!snapshot) return;
    const res = await apiFetch<MatchStateSnapshot>(`/api/matches/${matchId}/timeout`, {
      method: 'POST',
      body: JSON.stringify({ expected_move_number: snapshot.match.move_number }),
    });
    if (res.ok) {
      setSnapshot(res.data);
      setServerOffsetMs(Date.parse(res.data.server_now) - Date.now());
    }
  }, [matchId, snapshot]);

  const handleRematch = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<CreateMatchResponse>(`/api/matches/${matchId}/rematch`, {
        method: 'POST',
        body: JSON.stringify({ idempotency_key: makeIdempotencyKey() }),
      });
      if (res.ok) {
        router.push(`/match/${res.data.match.id}`);
      } else {
        setError(res.error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
      </div>
    );
  }

  if (error || !snapshot || !userId) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--danger)]/40 bg-[var(--bg-secondary)] p-6 text-center">
        <p className="text-sm font-medium text-[var(--danger)]">
          {error ?? 'Unable to load match.'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-4 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (snapshot.match.status === 'waiting' || snapshot.match.status === 'ready') {
    return (
      <MatchLobby
        snapshot={snapshot}
        currentUserId={userId}
        onSetReady={handleSetReady}
        onStartMatch={handleStartMatch}
        onLeaveLobby={handleLeaveLobby}
        busy={busy}
      />
    );
  }

  if (
    snapshot.match.status === 'finished' ||
    snapshot.match.status === 'cancelled' ||
    snapshot.match.status === 'expired'
  ) {
    return (
      <MatchResults
        snapshot={snapshot}
        currentUserId={userId}
        onRematch={handleRematch}
        busy={busy}
      />
    );
  }

  return (
    <MatchGameplay
      snapshot={snapshot}
      currentUserId={userId}
      connectionStatus={connectionStatus}
      serverOffsetMs={serverOffsetMs}
      feedback={feedback}
      submitting={busy}
      onSubmitMove={handleSubmitMove}
      onForfeit={handleForfeit}
      onTimeoutCheck={handleTimeoutCheck}
    />
  );
}
