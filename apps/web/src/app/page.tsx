'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, Calendar, Compass, Plus, Users } from 'lucide-react';
import type { CreateMatchResponse, DifficultyTier, JoinMatchResponse, WordLength } from '@wordshift/shared-types';
import { apiFetch, makeIdempotencyKey } from '@/lib/api-client';
import { ensurePlayerSession } from '@/lib/ensure-session';

export default function HomePage() {
  const router = useRouter();
  const [wordLength, setWordLength] = useState<WordLength>(4);
  const [difficulty, setDifficulty] = useState<DifficultyTier>('mixed');
  const [roomCode, setRoomCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setError(null);
    setCreating(true);
    try {
      const session = await ensurePlayerSession();
      if (!session.userId) {
        setError(session.error ?? 'Could not initialize player session.');
        return;
      }
      const res = await apiFetch<CreateMatchResponse>('/api/matches/create', {
        method: 'POST',
        body: JSON.stringify({
          word_length: wordLength,
          difficulty,
          idempotency_key: makeIdempotencyKey(),
        }),
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.push(`/match/${res.data.match.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Enter a valid room code.');
      return;
    }

    setJoining(true);
    try {
      const session = await ensurePlayerSession();
      if (!session.userId) {
        setError(session.error ?? 'Could not initialize player session.');
        return;
      }
      const res = await apiFetch<JoinMatchResponse>('/api/matches/join', {
        method: 'POST',
        body: JSON.stringify({
          room_code: code,
          idempotency_key: makeIdempotencyKey(),
        }),
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.push(`/match/${res.data.match.id}`);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Playful Sketch Hero */}
      <section className="space-y-4 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          {['C', 'O', 'L', 'D'].map((ch, i) => (
            <span
              key={i}
              className={`sketch-tile flex h-10 w-10 items-center justify-center rounded-xl font-mono text-lg font-black ${
                i === 2
                  ? 'rotate-3 bg-[var(--accent)] text-white'
                  : 'bg-[var(--tile-bg)] text-[var(--text-primary)]'
              }`}
            >
              {ch}
            </span>
          ))}
          <span className="px-1 font-mono text-lg font-bold text-[var(--text-muted)]">→</span>
          {['W', 'A', 'R', 'M'].map((ch, i) => (
            <span
              key={i}
              className="sketch-tile flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--success)]/20 font-mono text-lg font-black text-[var(--success)]"
            >
              {ch}
            </span>
          ))}
        </div>

        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Shift one letter. Beat your friend.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
          Take 30-second turns changing one letter at a time on a shared word chain. First player to
          reach the target word wins!
        </p>
      </section>

      {error && (
        <div role="alert" className="sketch-card rounded-2xl bg-[var(--danger)]/15 px-4 py-3 text-sm font-semibold text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* Main Two Cards */}
      <section className="grid gap-5 md:grid-cols-2">
        <div className="sketch-card flex flex-col justify-between rounded-3xl bg-[var(--bg-secondary)] p-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="sketch-btn flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Play with Friend</h2>
                <p className="text-xs font-medium text-[var(--text-secondary)]">Create a 2-player private room</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Word Length
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {([4, 5] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setWordLength(len)}
                      className={`sketch-btn rounded-xl py-2 text-xs font-bold ${
                        wordLength === len
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      }`}
                    >
                      {len} Letters
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="difficulty" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Words
                </label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyTier)}
                  className="mt-1.5 w-full rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="mixed">Mixed</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={creating}
            className="sketch-btn mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? 'Creating Room...' : 'Create Private Room'}
          </button>
        </div>

        <form
          onSubmit={handleJoinRoom}
          className="sketch-card flex flex-col justify-between rounded-3xl bg-[var(--bg-secondary)] p-6"
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="sketch-btn flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-secondary)] text-white">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Join Room</h2>
                <p className="text-xs font-medium text-[var(--text-secondary)]">Got a 6-letter code?</p>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="room-code" className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Room Code
              </label>
              <input
                id="room-code"
                type="text"
                maxLength={8}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="mt-1.5 w-full rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-3 font-mono text-xl font-black tracking-[0.25em] text-[var(--text-primary)] uppercase outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={joining || roomCode.trim().length < 4}
            className="sketch-btn mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--bg-elevated)] py-3.5 text-sm font-extrabold text-[var(--text-primary)] disabled:opacity-50"
          >
            {joining ? 'Joining...' : 'Join Match'}
          </button>
        </form>
      </section>

      {/* Secondary Modes */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/vs-computer"
          className="sketch-btn rounded-2xl bg-[var(--bg-secondary)] p-5"
        >
          <div className="flex items-center justify-between">
            <Bot className="h-5 w-5 text-[var(--accent-secondary)]" />
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--success)]/20 px-2.5 py-0.5 text-[11px] font-bold text-[var(--success)]">
              Play Now
            </span>
          </div>
          <h3 className="mt-3 font-extrabold text-[var(--text-primary)]">Play vs Computer</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Challenge Easy, Medium, or Hard WordBot.
          </p>
        </Link>

        <Link
          href="/practice"
          className="sketch-btn rounded-2xl bg-[var(--bg-secondary)] p-5"
        >
          <div className="flex items-center justify-between">
            <Compass className="h-5 w-5 text-[var(--accent)]" />
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--success)]/20 px-2.5 py-0.5 text-[11px] font-bold text-[var(--success)]">
              Play Now
            </span>
          </div>
          <h3 className="mt-3 font-extrabold text-[var(--text-primary)]">Practice Mode</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Solo word puzzles with instant feedback.
          </p>
        </Link>

        <div className="sketch-card rounded-2xl bg-[var(--bg-secondary)]/70 p-5 opacity-75">
          <div className="flex items-center justify-between">
            <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--text-muted)]">
              Soon
            </span>
          </div>
          <h3 className="mt-3 font-extrabold text-[var(--text-primary)]">Daily Challenge</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            One shared puzzle every day.
          </p>
        </div>
      </section>
    </div>
  );
}
