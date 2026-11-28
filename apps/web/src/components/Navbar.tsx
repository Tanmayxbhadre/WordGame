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
    <header className="sticky top-0 z-30 border-b-2 border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
          <span className="sketch-btn flex h-9 w-9 -rotate-3 items-center justify-center rounded-xl bg-[var(--accent)] text-base font-black text-white">
            W
          </span>
          <span className="text-lg text-[var(--text-primary)]">WordShift</span>
        </Link>

        <nav className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="sketch-btn flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Link
            href="/settings"
            aria-label="Settings"
            className={`sketch-btn flex h-9 w-9 items-center justify-center rounded-xl ${
              pathname === '/settings'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
            }`}
          >
            <Settings className="h-4 w-4" />
          </Link>

          {userEmail ? (
            <Link
              href="/profile"
              className={`sketch-btn flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold ${
                pathname === '/profile'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
              }`}
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          ) : (
            <Link
              href="/auth"
              className="sketch-btn flex h-9 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-bold text-white"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
