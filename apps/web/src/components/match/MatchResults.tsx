'use client';

import React from 'react';
import Link from 'next/link';
import { Home, RotateCcw, Trophy } from 'lucide-react';
import type { MatchStateSnapshot } from '@wordshift/shared-types';

interface MatchResultsProps {
  snapshot: MatchStateSnapshot;
  currentUserId: string;
  onRematch: () => Promise<void>;
  busy: boolean;
}

export function MatchResults({
  snapshot,
  currentUserId,
  onRematch,
  busy,
}: MatchResultsProps) {
  const { match, players, moves } = snapshot;

  const winner = players.find((p) => p.player_id === match.winner_id);
  const isDraw = match.winner_id === null;
  const didIWin = match.winner_id === currentUserId;

  const durationSeconds =
    match.started_at && match.ended_at
      ? Math.max(0, Math.round((Date.parse(match.ended_at) - Date.parse(match.started_at)) / 1000))
      : 0;

  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;

  const reasonLabel: Record<string, string> = {
    target_reached: 'Target word reached',
    forfeit: 'Opponent forfeited',
    timeout_draw: 'Draw after 3 consecutive timeouts',
    match_duration_draw: 'Draw — 5 minute match limit reached',
    disconnect_forfeit: 'Opponent disconnected',
    cancelled: 'Match cancelled',
  };

  const validChain = [
    match.start_word,
    ...moves.filter((m) => !m.is_timeout_skip).map((m) => m.word),
  ];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 text-center sm:p-8">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            isDraw
              ? 'bg-[var(--warning)]/15 text-[var(--warning)]'
              : didIWin
                ? 'bg-[var(--success)]/15 text-[var(--success)]'
                : 'bg-[var(--danger)]/15 text-[var(--danger)]'
          }`}
        >
          <Trophy className="h-7 w-7" />
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {isDraw ? 'Match Draw' : didIWin ? 'You Won!' : `${winner?.username ?? 'Opponent'} Won`}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {reasonLabel[match.result_reason ?? ''] ?? 'Match complete'}
        </p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Moves</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">
              {moves.filter((m) => !m.is_timeout_skip).length}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Duration</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">
              {mins}:{secs.toString().padStart(2, '0')}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Target</p>
            <p className="mt-0.5 font-mono text-lg font-bold uppercase text-[var(--accent)]">
              {match.target_word}
            </p>
          </div>
        </div>

        {/* Complete Word Chain */}
        <div className="mt-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Complete Word Chain
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {validChain.map((word, idx) => (
              <span
                key={`${word}-${idx}`}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold uppercase ${
                  word === match.target_word
                    ? 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]'
                    : idx === 0
                      ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]'
                }`}
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-3">
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] py-3 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)]"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <button
            type="button"
            onClick={onRematch}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {busy ? 'Creating...' : 'Rematch'}
          </button>
        </div>
      </div>
    </div>
  );
}
