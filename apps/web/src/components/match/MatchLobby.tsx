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

  const copyLink = async () => {
    const inviteUrl = `${window.location.origin}/join/${match.room_code}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(match.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const shareInvite = async () => {
    const inviteUrl = `${window.location.origin}/join/${match.room_code}`;
    const shareText = `Join my WordShift match! Room code: ${match.room_code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'WordShift Invite',
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch {
        // fallback
      }
    }
    await copyLink();
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="sketch-card rounded-3xl bg-[var(--bg-secondary)] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              Room Code
            </span>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="font-mono text-3xl font-black tracking-[0.2em] text-[var(--text-primary)]">
                {match.room_code}
              </span>
              <button
                type="button"
                onClick={copyCode}
                aria-label="Copy room code"
                className="sketch-btn flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
              >
                {copied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={shareInvite}
                aria-label="Share invite"
                className="sketch-btn flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1">
              {match.word_length} Letters
            </span>
            <span className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 capitalize">
              {match.difficulty}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            { seatNum: 1, player: seat1 },
            { seatNum: 2, player: seat2 },
          ].map(({ seatNum, player }) => (
            <div
              key={seatNum}
              className={`rounded-2xl border-2 border-[var(--border-subtle)] p-4 ${
                player?.is_ready ? 'bg-[var(--success)]/15' : 'bg-[var(--bg-primary)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                  Player {seatNum}
                </span>
                {player && (
                  <span
                    className={`rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-bold ${
                      player.is_ready
                        ? 'bg-[var(--success)] text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {player.is_ready ? 'Ready!' : 'Waiting'}
                  </span>
                )}
              </div>

              {player ? (
                <div className="mt-3 flex items-center gap-2.5">
                  <div className="sketch-btn flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-black text-white">
                    {player.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[var(--text-primary)]">
                      {player.username}
                      {player.player_id === currentUserId ? ' (You)' : ''}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {player.is_connected ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                  <Users className="h-4 w-4" />
                  <span>Waiting for friend...</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onLeaveLobby}
            disabled={busy}
            className="sketch-btn flex items-center justify-center gap-2 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Leave
          </button>

          {me && (
            <button
              type="button"
              onClick={() => onSetReady(!me.is_ready)}
              disabled={busy}
              className={`sketch-btn flex-1 rounded-2xl py-3 text-sm font-extrabold disabled:opacity-50 ${
                me.is_ready
                  ? 'bg-[var(--success)] text-white'
                  : 'bg-[var(--accent)] text-white'
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
              className="sketch-btn flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent-secondary)] py-3 text-sm font-extrabold text-white disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Start!
            </button>
          )}
        </div>

        {bothReady && !isHost && (
          <p className="mt-3 text-center text-xs font-semibold text-[var(--text-secondary)]">
            Both ready! Waiting for host to start...
          </p>
        )}
      </div>
    </div>
  );
}
