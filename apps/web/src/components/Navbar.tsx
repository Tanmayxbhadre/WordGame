'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Settings, Sun, User } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAppSettings } from './ThemeProvider';

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useAppSettings();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
            W
          </span>
          <span className="text-base text-[var(--text-primary)]">WordShift</span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Link
            href="/settings"
            aria-label="Settings"
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
              pathname === '/settings'
                ? 'border-[var(--accent)] bg-[var(--bg-elevated)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Settings className="h-4 w-4" />
          </Link>

          {userEmail ? (
            <Link
              href="/profile"
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
                pathname === '/profile'
                  ? 'border-[var(--accent)] bg-[var(--bg-elevated)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          ) : (
            <Link
              href="/auth"
              className="flex h-9 items-center rounded-lg bg-[var(--accent)] px-3.5 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
