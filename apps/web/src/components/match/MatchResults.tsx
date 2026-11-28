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
    target_reached: 'Target word reached!',
    forfeit: 'Opponent forfeited',
    timeout_draw: 'Draw after 3 consecutive timeouts',
    match_duration_draw: 'Draw — 5 minute limit reached',
    disconnect_forfeit: 'Opponent disconnected',
    cancelled: 'Match cancelled',
  };

  const validChain = [
    match.start_word,
    ...moves.filter((m) => !m.is_timeout_skip).map((m) => m.word),
  ];

  return (
    <div className="mx-auto max-w-xl">
      <div className="sketch-card rounded-3xl bg-[var(--bg-secondary)] p-6 text-center sm:p-8">
        <div
          className={`sketch-btn mx-auto flex h-16 w-16 -rotate-3 items-center justify-center rounded-2xl text-white ${
            isDraw
              ? 'bg-[var(--warning)]'
              : didIWin
                ? 'bg-[var(--success)]'
                : 'bg-[var(--danger)]'
          }`}
        >
          <Trophy className="h-8 w-8" />
        </div>

        <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--text-primary)]">
          {isDraw ? 'Match Draw!' : didIWin ? 'You Won!' : `${winner?.username ?? 'Opponent'} Won`}
        </h1>
        <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
          {reasonLabel[match.result_reason ?? ''] ?? 'Match complete'}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--text-muted)]">Moves</p>
            <p className="mt-0.5 font-mono text-xl font-black text-[var(--text-primary)]">
              {moves.filter((m) => !m.is_timeout_skip).length}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-[var(--text-muted)]">Time</p>
            <p className="mt-0.5 font-mono text-xl font-black text-[var(--text-primary)]">
              {mins}:{secs.toString().padStart(2, '0')}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-[var(--text-muted)]">Target</p>
            <p className="mt-0.5 font-mono text-xl font-black uppercase text-[var(--accent)]">
              {match.target_word}
            </p>
          </div>
        </div>

        <div className="mt-6 text-left">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
            Word Chain
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {validChain.map((word, idx) => (
              <span
                key={`${word}-${idx}`}
                className={`rounded-xl border-2 border-[var(--border-subtle)] px-3 py-1.5 font-mono text-xs font-black uppercase ${
                  word === match.target_word
                    ? 'bg-[var(--success)] text-white'
                    : idx === 0
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                }`}
              >
                {word}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href="/"
            className="sketch-btn flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--bg-elevated)] py-3.5 text-sm font-extrabold text-[var(--text-primary)]"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
          <button
            type="button"
            onClick={onRematch}
            disabled={busy}
            className="sketch-btn flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {busy ? 'Creating...' : 'Rematch'}
          </button>
        </div>
      </div>
    </div>
  );
}
