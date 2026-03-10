'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function CitiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-[var(--brand-navy)]">Something went wrong</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          We couldn&apos;t load the cities page. Please try again or go back home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[var(--gray-border)] bg-white px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--gray-bg)]"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
