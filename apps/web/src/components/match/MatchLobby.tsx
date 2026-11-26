'use client';

import React, { useState } from 'react';
import { Check, Copy, LogOut, Play, Share2, Users } from 'lucide-react';
import type { MatchStateSnapshot } from '@wordshift/shared-types';

interface MatchLobbyProps {
  snapshot: MatchStateSnapshot;
  currentUserId: string;
  onSetReady: (ready: boolean) => Promise<void>;
  onStartMatch: () => Promise<void>;
  onLeaveLobby: () => Promise<void>;
  busy: boolean;
}

export function MatchLobby({
  snapshot,
  currentUserId,
  onSetReady,
  onStartMatch,
  onLeaveLobby,
  busy,
}: MatchLobbyProps) {
  const [copied, setCopied] = useState(false);
  const { match, players } = snapshot;

  const me = players.find((p) => p.player_id === currentUserId);
  const seat1 = players.find((p) => p.seat === 1);
  const seat2 = players.find((p) => p.seat === 2);
  const bothReady = players.length === 2 && players.every((p) => p.is_ready);
  const isHost = match.created_by === currentUserId;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(match.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const shareInvite = async () => {
    const shareText = `Join my WordShift match! Room code: ${match.room_code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'WordShift Invite',
          text: shareText,
          url: window.location.href,
        });
        return;
      } catch {
        // fallback to copy
      }
    }
    await copyCode();
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Private Room
            </span>
            <div className="mt-1 flex items-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-[0.2em] text-[var(--text-primary)]">
                {match.room_code}
              </span>
              <button
                type="button"
                onClick={copyCode}
                aria-label="Copy room code"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                {copied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={shareInvite}
                aria-label="Share invite"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1 font-medium">
              {match.word_length} Letters
            </span>
            <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1 font-medium capitalize">
              {match.difficulty}
            </span>
          </div>
        </div>

        {/* Player Seats */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { seatNum: 1, player: seat1 },
            { seatNum: 2, player: seat2 },
          ].map(({ seatNum, player }) => (
            <div
              key={seatNum}
              className={`rounded-xl border p-4 transition ${
                player?.is_ready
                  ? 'border-[var(--success)]/50 bg-[var(--success)]/5'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-primary)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Player {seatNum} {seatNum === 1 ? '(Starts)' : ''}
                </span>
                {player && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      player.is_ready
                        ? 'bg-[var(--success)]/15 text-[var(--success)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {player.is_ready ? 'Ready' : 'Waiting'}
                  </span>
                )}
              </div>

              {player ? (
                <div className="mt-3 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-bold text-[var(--accent)]">
                    {player.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {player.username}
                      {player.player_id === currentUserId ? ' (You)' : ''}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {player.is_connected ? 'Connected' : 'Offline'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Users className="h-4 w-4" />
                  <span>Waiting for opponent...</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onLeaveLobby}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Leave
          </button>

          {me && (
            <button
              type="button"
              onClick={() => onSetReady(!me.is_ready)}
              disabled={busy}
              className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition disabled:opacity-50 ${
                me.is_ready
                  ? 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]'
                  : 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)]/25'
              }`}
            >
              {me.is_ready ? 'Ready ✓ (Tap to Unready)' : 'Mark Ready'}
            </button>
          )}

          {bothReady && isHost && (
            <button
              type="button"
              onClick={onStartMatch}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Start Match
            </button>
          )}
        </div>

        {bothReady && !isHost && (
          <p className="mt-3 text-center text-xs text-[var(--text-secondary)]">
            Both players ready! Waiting for host to start the match...
          </p>
        )}
      </div>
    </div>
  );
}
