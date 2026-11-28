'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup' | 'recovery';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode !== 'recovery' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup' && username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === 'login') {
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (authErr) {
          setError(authErr.message);
          return;
        }
        router.push('/');
        router.refresh();
      } else if (mode === 'signup') {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: { username: username.trim() },
          },
        });
        if (signUpErr) {
          setError(signUpErr.message);
          return;
        }
        setMessage('Account created! Check your email to confirm, or sign in if confirmation is disabled.');
      } else {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (resetErr) {
          setError(resetErr.message);
          return;
        }
        setMessage('Password recovery link sent to your email.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-6">
      <div className="sketch-card rounded-3xl bg-[var(--bg-secondary)] p-6 sm:p-8">
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
          {mode === 'login'
            ? 'Sign in to WordShift'
            : mode === 'signup'
              ? 'Create your account'
              : 'Reset password'}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          {mode === 'login'
            ? 'Enter your credentials to play private 1v1 matches.'
            : mode === 'signup'
              ? 'Choose a username and start playing.'
              : 'We will email you a password recovery link.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="username" className="block text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="wordsmith"
                autoComplete="username"
                required
                className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
            />
          </div>

          {mode !== 'recovery' && (
            <div>
              <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
              />
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3.5 py-2.5 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-[var(--success)]/40 bg-[var(--success)]/10 px-3.5 py-2.5 text-sm text-[var(--success)]">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="sketch-btn w-full rounded-2xl bg-[var(--accent)] py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Send recovery link'}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-secondary)]">
          {mode === 'login' ? (
            <>
              <button type="button" onClick={() => { setMode('signup'); setError(null); setMessage(null); }} className="hover:text-[var(--text-primary)]">
                Need an account? Sign up
              </button>
              <button type="button" onClick={() => { setMode('recovery'); setError(null); setMessage(null); }} className="hover:text-[var(--text-primary)]">
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { setMode('login'); setError(null); setMessage(null); }} className="hover:text-[var(--text-primary)]">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
