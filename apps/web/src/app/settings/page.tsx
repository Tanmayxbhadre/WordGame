'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAppSettings } from '@/components/ThemeProvider';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, soundEnabled, setSoundEnabled, reducedMotion, setReducedMotion } =
    useAppSettings();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push('/auth');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Settings</h1>

      {/* Appearance */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Appearance & Accessibility
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
            <p className="text-xs text-[var(--text-secondary)]">Dark mode is primary; light mode available</p>
          </div>
          <div className="flex rounded-xl border border-[var(--border-subtle)] p-1">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                theme === 'dark'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Moon className="h-3.5 w-3.5" /> Dark
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                theme === 'light'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <Sun className="h-3.5 w-3.5" /> Light
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Sound Effects</p>
            <p className="text-xs text-[var(--text-secondary)]">Subtle audio cues for turns and wins</p>
          </div>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              soundEnabled
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Reduced Motion</p>
            <p className="text-xs text-[var(--text-secondary)]">Minimize tile and chain animations</p>
          </div>
          <button
            type="button"
            onClick={() => setReducedMotion(!reducedMotion)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              reducedMotion
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {reducedMotion ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Account
        </h2>
        {userEmail ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Signed in as</p>
              <p className="text-xs text-[var(--text-secondary)]">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--danger)]/40 px-3.5 py-2 text-xs font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? 'Signing out...' : 'Log out'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Not signed in.</p>
        )}
      </section>
    </div>
  );
}
