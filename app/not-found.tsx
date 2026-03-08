import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-[var(--text-primary)]">Page not found</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        The page you’re looking for doesn’t exist or was moved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)]"
        >
          Go to homepage
        </Link>
        <Link
          href="/listings"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        >
          Browse listings
        </Link>
      </div>
    </div>
  )
}
