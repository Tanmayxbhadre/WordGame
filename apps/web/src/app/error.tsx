'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[var(--danger)]/40 bg-[var(--bg-secondary)] p-8 text-center">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">Something went wrong</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
