import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8 text-center">
      <p className="font-mono text-sm font-bold text-[var(--accent)]">404</p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Page not found</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        The match or page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
      >
        Back to Home
      </Link>
    </div>
  );
}
