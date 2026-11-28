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

  useEffect(() => {
    setDraftWord(match.current_word);
    setSelectedPos(0);
  }, [match.current_word, match.move_number]);

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
    <div className="mx-auto max-w-xl space-y-3">
      {/* Turn + Timers Bar */}
      <div className="sketch-card flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-secondary)] px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className={`rounded-full border-2 border-[var(--border-subtle)] px-3 py-0.5 text-xs font-extrabold ${
              isMyTurn
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
            }`}
          >
            {isMyTurn ? 'Your Turn' : `${opponent?.username ?? 'Opponent'}'s Turn`}
          </span>

          <div className="hidden items-center gap-2 text-xs font-bold text-[var(--text-secondary)] sm:flex">
            <span>{me?.username ?? 'You'}</span>
            <span className="text-[var(--text-muted)]">vs</span>
            <span>{opponent?.username ?? 'Opponent'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-[var(--text-muted)]" title="Match time remaining">
            Match {matchMins}:{matchSecs.toString().padStart(2, '0')}
          </span>
          {connectionStatus === 'connected' ? (
            <Wifi className="h-3.5 w-3.5 text-[var(--success)]" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-[var(--warning)]" />
          )}
          <div
            data-testid="turn-timer"
            title="Turn countdown"
            className={`min-w-[48px] rounded-xl border-2 border-[var(--border-subtle)] px-2 py-0.5 text-center font-mono text-sm font-black ${
              turnSecondsLeft <= 7
                ? 'bg-[var(--danger)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
            }`}
          >
            {turnSecondsLeft}s
          </div>
        </div>
      </div>

      {/* Main Sketch Board */}
      <div className="sketch-card rounded-3xl bg-[var(--bg-secondary)] p-4 sm:p-5">
        {/* Clear Goal Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--border-muted)] pb-3">
          <p className="text-xs font-bold text-[var(--text-secondary)]">
            Change <span className="font-black text-[var(--text-primary)]">1 letter</span> at a time to reach:
          </p>
          <div className="flex items-center gap-1">
            {match.target_word.split('').map((ch, idx) => {
              const matchesTarget = draftWord[idx] === ch;
              return (
                <span
                  key={idx}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[var(--border-subtle)] font-mono text-xs font-black uppercase ${
                    matchesTarget
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  }`}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        </div>

        {/* Tactile Letter Tiles */}
        <div className="mt-4 flex justify-center gap-2.5 sm:gap-3" role="group" aria-label="Word letter tiles">
          {draftWord.split('').map((ch, idx) => {
            const isSelected = idx === selectedPos;
            const isChanged = changedPos === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPos(idx)}
                aria-label={`Letter ${idx + 1}: ${ch.toUpperCase()}`}
                className={`sketch-tile flex h-14 w-14 items-center justify-center rounded-2xl font-mono text-2xl font-black uppercase sm:h-16 sm:w-16 sm:text-3xl ${
                  isChanged
                    ? 'bg-[var(--success)] text-white'
                    : isSelected && isMyTurn
                      ? '-translate-y-1 bg-[var(--accent)] text-white'
                      : 'bg-[var(--tile-bg)] text-[var(--text-primary)]'
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs font-semibold text-[var(--text-secondary)]">
          {isMyTurn
            ? diffCount === 1
              ? `New word: ${draftWord.toUpperCase()} — tap Submit!`
              : 'Tap any letter tile above, then pick a new letter below'
            : `Waiting for ${opponent?.username ?? 'opponent'} to play...`}
        </p>

        {feedback && (
          <div
            role="status"
            className={`mt-2.5 rounded-xl border-2 border-[var(--border-subtle)] px-3 py-1.5 text-center text-xs font-bold ${
              feedback.type === 'error'
                ? 'bg-[var(--danger)]/15 text-[var(--danger)]'
                : 'bg-[var(--success)]/15 text-[var(--success)]'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraftWord(match.current_word)}
            disabled={!isMyTurn || diffCount === 0 || submitting}
            className="sketch-btn flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--bg-elevated)] px-3.5 text-xs font-bold text-[var(--text-primary)] disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Undo
          </button>

          <button
            type="button"
            onClick={() => void onSubmitMove(draftWord)}
            disabled={!canSubmit}
            className="sketch-btn flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-extrabold text-white disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {submitting
              ? 'Sending...'
              : diffCount === 1
                ? `Submit ${draftWord.toUpperCase()}`
                : 'Submit Word'}
          </button>

          {!confirmForfeit ? (
            <button
              type="button"
              onClick={() => setConfirmForfeit(true)}
              aria-label="Forfeit match"
              title="Leave / Forfeit match"
              className="sketch-btn flex h-10 items-center justify-center rounded-xl bg-[var(--bg-elevated)] px-3 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--danger)]"
            >
              <Flag className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void onForfeit()}
                className="sketch-btn h-10 rounded-xl bg-[var(--danger)] px-3 text-xs font-bold text-white"
              >
                Quit
              </button>
              <button
                type="button"
                onClick={() => setConfirmForfeit(false)}
                className="sketch-btn h-10 rounded-xl bg-[var(--bg-elevated)] px-2.5 text-xs font-bold text-[var(--text-primary)]"
              >
                Stay
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compact Word Chain */}
      <div className="sketch-card rounded-2xl bg-[var(--bg-secondary)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
            Chain:
          </span>
          <span className="rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--accent)]/15 px-2 py-0.5 font-mono text-xs font-black uppercase text-[var(--accent)]">
            {match.start_word}
          </span>
          {moves.map((move) =>
            move.is_timeout_skip ? (
              <span
                key={move.id}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--warning)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--warning)]"
              >
                Timed out
              </span>
            ) : (
              <React.Fragment key={move.id}>
                <span className="text-xs font-bold text-[var(--text-muted)]">→</span>
                <span className="animate-tile-pop rounded-lg border-2 border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-0.5 font-mono text-xs font-black uppercase text-[var(--text-primary)]">
                  {move.word.split('').map((c, idx) => (
                    <span
                      key={idx}
                      className={idx === move.changed_position ? 'text-[var(--success)]' : ''}
                    >
                      {c}
                    </span>
                  ))}
                </span>
              </React.Fragment>
            )
          )}
        </div>
      </div>

      {/* Playful On-Screen Keyboard */}
      <div className="space-y-1.5" role="group" aria-label="On-screen keyboard">
        {KEYBOARD_ROWS.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
            {row.map((letter) => (
              <button
                key={letter}
                type="button"
                disabled={!isMyTurn || submitting}
                onClick={() => applyLetter(letter)}
                className="sketch-tile flex h-10 min-w-[30px] flex-1 max-w-[44px] items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-sm font-extrabold text-[var(--text-primary)] disabled:opacity-40 sm:h-11"
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
