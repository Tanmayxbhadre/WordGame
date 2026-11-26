'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, Flame, Trophy } from 'lucide-react';
import type { PlayerStatsResponse } from '@wordshift/shared-types';
import { apiFetch } from '@/lib/api-client';

export default function ProfilePage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlayerStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PlayerStatsResponse>('/api/player/stats').then((res) => {
      if (!res.ok) {
        if (res.error.code === 'UNAUTHORIZED') {
          router.push('/auth');
          return;
        }
      } else {
        setStats(res.data);
      }
      setLoading(false);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 text-center">
        <p className="text-sm text-[var(--text-secondary)]">Could not load profile.</p>
      </div>
    );
  }

  const { profile, recent_matches } = stats;
  const winRate =
    profile.total_matches > 0 ? Math.round((profile.wins / profile.total_matches) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/15 text-lg font-bold text-[var(--accent)]">
            {profile.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{profile.username}</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Member since {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3.5 py-2">
          <Flame className="h-4 w-4 text-[var(--warning)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {profile.current_streak} streak (best {profile.best_streak})
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Wins', value: profile.wins, icon: Trophy },
          { label: 'Losses', value: profile.losses, icon: Award },
          { label: 'Draws', value: profile.draws, icon: Award },
          { label: 'Win Rate', value: `${winRate}%`, icon: Trophy },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
          >
            <p className="text-xs text-[var(--text-muted)]">{item.label}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-[var(--text-primary)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Match History */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Recent Matches
        </h2>

        {recent_matches.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">
            No matches played yet. Create a room from the home screen to start!
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--border-subtle)]">
            {recent_matches.map((m) => {
              const won = m.winner_id === profile.id;
              const draw = m.status === 'finished' && m.winner_id === null;
              return (
                <Link
                  key={m.match_id}
                  href={`/match/${m.match_id}`}
                  className="flex items-center justify-between py-3 transition hover:opacity-80"
                >
                  <div>
                    <p className="font-mono text-sm font-bold uppercase text-[var(--text-primary)]">
                      {m.start_word} → {m.target_word}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      vs {m.opponent_username ?? 'Waiting'} · {m.move_count} moves
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      m.status !== 'finished'
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                        : draw
                          ? 'bg-[var(--warning)]/15 text-[var(--warning)]'
                          : won
                            ? 'bg-[var(--success)]/15 text-[var(--success)]'
                            : 'bg-[var(--danger)]/15 text-[var(--danger)]'
                    }`}
                  >
                    {m.status !== 'finished'
                      ? m.status
                      : draw
                        ? 'Draw'
                        : won
                          ? 'Win'
                          : 'Loss'}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
