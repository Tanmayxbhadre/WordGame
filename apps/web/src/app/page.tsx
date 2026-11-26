'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Calendar, Compass, Plus, Swords, Users } from 'lucide-react';
import type { CreateMatchResponse, DifficultyTier, JoinMatchResponse, WordLength } from '@wordshift/shared-types';
import { apiFetch, makeIdempotencyKey } from '@/lib/api-client';

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
      const res = await apiFetch<CreateMatchResponse>('/api/matches/create', {
        method: 'POST',
        body: JSON.stringify({
          word_length: wordLength,
          difficulty,
          idempotency_key: makeIdempotencyKey(),
        }),
      });
      if (!res.ok) {
        if (res.error.code === 'UNAUTHORIZED') {
          router.push('/auth');
          return;
        }
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
      const res = await apiFetch<JoinMatchResponse>('/api/matches/join', {
        method: 'POST',
        body: JSON.stringify({
          room_code: code,
          idempotency_key: makeIdempotencyKey(),
        }),
      });
      if (!res.ok) {
        if (res.error.code === 'UNAUTHORIZED') {
          router.push('/auth');
          return;
        }
        setError(res.error.message);
        return;
      }
      router.push(`/match/${res.data.match.id}`);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          1v1 Real-Time Word Duel
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Shift one letter. Reach the target first.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
          Share one evolving word chain with your opponent. Alternate 30-second turns, change
          exactly one letter per move, never repeat a word, and claim the target word first.
        </p>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* Play with Friend */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Play with Friend</h2>
                <p className="text-xs text-[var(--text-secondary)]">Create a private 2-player room</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)]">Word Length</label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {([4, 5] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setWordLength(len)}
                      className={`rounded-lg border py-2 text-xs font-semibold transition ${
                        wordLength === len
                          ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      {len} Letters
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="difficulty" className="block text-xs font-medium text-[var(--text-secondary)]">
                  Vocabulary
                </label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyTier)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
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
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? 'Creating Room...' : 'Create Private Room'}
          </button>
        </div>

        {/* Join with Room Code */}
        <form
          onSubmit={handleJoinRoom}
          className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6"
        >
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)]">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Join Room</h2>
                <p className="text-xs text-[var(--text-secondary)]">Enter a 6-character invite code</p>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="room-code" className="block text-xs font-medium text-[var(--text-secondary)]">
                Room Code
              </label>
              <input
                id="room-code"
                type="text"
                maxLength={8}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-3 font-mono text-lg font-semibold tracking-[0.25em] text-[var(--text-primary)] uppercase outline-none transition focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={joining || roomCode.trim().length < 4}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent)] disabled:opacity-50"
          >
            {joining ? 'Joining...' : 'Join Match'}
          </button>
        </form>
      </section>

      {/* Secondary Modes */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/practice"
          className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 transition hover:border-[var(--accent)]"
        >
          <div className="flex items-center justify-between">
            <Compass className="h-5 w-5 text-[var(--accent)]" />
            <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--success)]">
              Ready
            </span>
          </div>
          <h3 className="mt-3 font-semibold text-[var(--text-primary)]">Practice Mode</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Sharpen your word chains solo with instant feedback.
          </p>
        </Link>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 p-5 opacity-75">
          <div className="flex items-center justify-between">
            <Swords className="h-5 w-5 text-[var(--text-muted)]" />
            <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
              Coming Soon
            </span>
          </div>
          <h3 className="mt-3 font-semibold text-[var(--text-primary)]">Quick Match</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Automatic matchmaking against ranked opponents.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 p-5 opacity-75">
          <div className="flex items-center justify-between">
            <Calendar className="h-5 w-5 text-[var(--text-muted)]" />
            <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)]">
              Coming Soon
            </span>
          </div>
          <h3 className="mt-3 font-semibold text-[var(--text-primary)]">Daily Challenge</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Global daily puzzle with optimal path par.
          </p>
        </div>
      </section>
    </div>
  );
}
