export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="h-16 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
      <div className="h-56 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
    </div>
  );
}
