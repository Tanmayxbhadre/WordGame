'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Flag, RotateCcw, Send, Wifi, WifiOff } from 'lucide-react';
import type { MatchStateSnapshot } from '@wordshift/shared-types';
import { countLetterDifferences, findChangedPosition } from '@wordshift/game-engine';

interface MatchGameplayProps {
  snapshot: MatchStateSnapshot;
  currentUserId: string;
  connectionStatus: 'connected' | 'reconnecting' | 'offline';
  serverOffsetMs: number;
  feedback: { type: 'error' | 'info' | 'success'; message: string } | null;
  submitting: boolean;
  onSubmitMove: (word: string) => Promise<void>;
  onForfeit: () => Promise<void>;
  onTimeoutCheck: () => Promise<void>;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export function MatchGameplay({
  snapshot,
  currentUserId,
  connectionStatus,
  serverOffsetMs,
  feedback,
  submitting,
  onSubmitMove,
  onForfeit,
  onTimeoutCheck,
}: MatchGameplayProps) {
  const { match, players, moves } = snapshot;
  const me = players.find((p) => p.player_id === currentUserId);
  const opponent = players.find((p) => p.player_id !== currentUserId);
  const isMyTurn = me?.seat === match.current_turn_seat;

  const [selectedPos, setSelectedPos] = useState<number>(0);
  const [draftWord, setDraftWord] = useState<string>(match.current_word);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number>(30);
  const [matchSecondsLeft, setMatchSecondsLeft] = useState<number>(300);
  const [confirmForfeit, setConfirmForfeit] = useState(false);

  // Sync draftWord whenever the authoritative current_word advances
  useEffect(() => {
    setDraftWord(match.current_word);
    setSelectedPos(0);
  }, [match.current_word, match.move_number]);

  // Server-authoritative countdown ticker
  useEffect(() => {
    let triggeredTimeout = false;

    const tick = () => {
      const serverNow = Date.now() + serverOffsetMs;
      if (match.turn_deadline_at) {
        const remaining = Math.max(
          0,
          Math.ceil((Date.parse(match.turn_deadline_at) - serverNow) / 1000)
        );
        setTurnSecondsLeft(remaining);
        if (remaining === 0 && !triggeredTimeout) {
          triggeredTimeout = true;
          void onTimeoutCheck();
        }
      }
      if (match.match_deadline_at) {
        const matchRem = Math.max(
          0,
          Math.ceil((Date.parse(match.match_deadline_at) - serverNow) / 1000)
        );
        setMatchSecondsLeft(matchRem);
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [match.turn_deadline_at, match.match_deadline_at, match.move_number, serverOffsetMs, onTimeoutCheck]);

  const diffCount = useMemo(
    () => countLetterDifferences(match.current_word, draftWord),
    [match.current_word, draftWord]
  );
  const changedPos = useMemo(
    () => findChangedPosition(match.current_word, draftWord),
    [match.current_word, draftWord]
  );
  const canSubmit = isMyTurn && diffCount === 1 && !submitting && turnSecondsLeft > 0;

  const applyLetter = useCallback(
    (letter: string) => {
      if (!isMyTurn || submitting) return;
      const lower = letter.toLowerCase();
      if (!/^[a-z]$/.test(lower)) return;
      const chars = match.current_word.split('');
      chars[selectedPos] = lower;
      setDraftWord(chars.join(''));
    },
    [isMyTurn, submitting, match.current_word, selectedPos]
  );

  // Physical keyboard support on desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isMyTurn || submitting) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedPos((p) => (p > 0 ? p - 1 : match.word_length - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedPos((p) => (p + 1) % match.word_length);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setDraftWord(match.current_word);
      } else if (e.key === 'Enter' && canSubmit) {
        e.preventDefault();
        void onSubmitMove(draftWord);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        applyLetter(e.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMyTurn, submitting, match.word_length, match.current_word, canSubmit, draftWord, applyLetter, onSubmitMove]);

  const matchMins = Math.floor(matchSecondsLeft / 60);
  const matchSecs = matchSecondsLeft % 60;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              isMyTurn
                ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isMyTurn ? 'animate-pulse bg-[var(--accent)]' : 'bg-[var(--text-muted)]'
              }`}
            />
            {isMyTurn ? 'Your Turn' : `${opponent?.username ?? 'Opponent'}'s Turn`}
          </div>

          <span className="font-mono text-xs text-[var(--text-muted)]">
            Match {matchMins}:{matchSecs.toString().padStart(2, '0')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {connectionStatus === 'connected' ? (
              <Wifi className="h-3.5 w-3.5 text-[var(--success)]" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-[var(--warning)]" />
            )}
            <span className="hidden text-[var(--text-secondary)] sm:inline capitalize">
              {connectionStatus}
            </span>
          </div>

          <div
            data-testid="turn-timer"
            className={`min-w-[54px] rounded-lg px-2.5 py-1 text-center font-mono text-sm font-bold ${
              turnSecondsLeft <= 7
                ? 'bg-[var(--danger)]/15 text-[var(--danger)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
            }`}
          >
            {turnSecondsLeft}s
          </div>
        </div>
      </div>

      {/* Players Strip */}
      <div className="grid grid-cols-2 gap-3">
        {[me, opponent].map((p, idx) => {
          if (!p) return null;
          const active = p.seat === match.current_turn_seat;
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {p.username} {idx === 0 ? '(You)' : ''}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Player {p.seat} · {p.is_connected ? 'Online' : 'Reconnecting...'}
                </p>
              </div>
              {p.timeout_count > 0 && (
                <span className="rounded bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                  {p.timeout_count} TO
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Board: Start -> Current -> Target */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 sm:p-6">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          <div>
            Start:{' '}
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {match.start_word.toUpperCase()}
            </span>
          </div>
          <div>
            Target:{' '}
            <span className="rounded-md bg-[var(--accent)]/15 px-2 py-0.5 font-mono font-bold text-[var(--accent)]">
              {match.target_word.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Interactive Letter Tiles */}
        <div className="mt-6 flex justify-center gap-2.5 sm:gap-3" role="group" aria-label="Word letter tiles">
          {draftWord.split('').map((ch, idx) => {
            const isSelected = idx === selectedPos;
            const isChanged = changedPos === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPos(idx)}
                aria-label={`Letter ${idx + 1}: ${ch.toUpperCase()}`}
                className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 font-mono text-2xl font-bold uppercase transition sm:h-16 sm:w-16 sm:text-3xl ${
                  isChanged
                    ? 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]'
                    : isSelected && isMyTurn
                      ? 'border-[var(--accent)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                      : 'border-[var(--tile-border)] bg-[var(--tile-bg)] text-[var(--text-primary)]'
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-[var(--text-secondary)]">
          {isMyTurn
            ? diffCount === 1
              ? `Proposed word: ${draftWord.toUpperCase()} (ready to submit)`
              : 'Tap a tile and choose a new letter below'
            : `Waiting for ${opponent?.username ?? 'opponent'} to play...`}
        </p>

        {feedback && (
          <div
            role="status"
            className={`mt-3 rounded-xl px-3.5 py-2.5 text-center text-xs font-medium sm:text-sm ${
              feedback.type === 'error'
                ? 'border border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]'
                : feedback.type === 'success'
                  ? 'border border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]'
                  : 'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Action Row */}
        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setDraftWord(match.current_word)}
            disabled={!isMyTurn || diffCount === 0 || submitting}
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-4 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>

          <button
            type="button"
            onClick={() => void onSubmitMove(draftWord)}
            disabled={!canSubmit}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting...' : 'Submit Word'}
          </button>

          {!confirmForfeit ? (
            <button
              type="button"
              onClick={() => setConfirmForfeit(true)}
              aria-label="Forfeit match"
              className="flex h-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] px-3.5 text-xs font-medium text-[var(--text-muted)] transition hover:border-[var(--danger)]/50 hover:text-[var(--danger)]"
            >
              <Flag className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void onForfeit()}
                className="h-11 rounded-xl bg-[var(--danger)] px-3 text-xs font-semibold text-white"
              >
                Confirm Forfeit
              </button>
              <button
                type="button"
                onClick={() => setConfirmForfeit(false)}
                className="h-11 rounded-xl border border-[var(--border-subtle)] px-2.5 text-xs text-[var(--text-secondary)]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shared Word Chain */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Shared Word Chain ({moves.filter((m) => !m.is_timeout_skip).length} moves)
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-[var(--accent)]">
            {match.start_word}
          </span>
          {moves.map((move) =>
            move.is_timeout_skip ? (
              <span
                key={move.id}
                className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-2 py-1 text-[11px] font-medium text-[var(--warning)]"
              >
                Timeout (P{move.seat})
              </span>
            ) : (
              <span
                key={move.id}
                className="animate-tile-pop rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1 font-mono text-xs font-bold uppercase text-[var(--text-primary)]"
              >
                {move.word.split('').map((c, idx) => (
                  <span
                    key={idx}
                    className={idx === move.changed_position ? 'text-[var(--success)]' : ''}
                  >
                    {c}
                  </span>
                ))}
              </span>
            )
          )}
        </div>
      </div>

      {/* On-Screen Keyboard */}
      <div className="space-y-1.5 pt-1" role="group" aria-label="On-screen keyboard">
        {KEYBOARD_ROWS.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
            {row.map((letter) => (
              <button
                key={letter}
                type="button"
                disabled={!isMyTurn || submitting}
                onClick={() => applyLetter(letter)}
                className="flex h-11 min-w-[30px] flex-1 max-w-[44px] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] active:scale-95 disabled:opacity-40"
              >
                {letter}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
