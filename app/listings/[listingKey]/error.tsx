'use client'

import Link from 'next/link'
import Button from '@/components/ui/Button'

export default function ListingDetailError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-[var(--brand-cream)]">
      <h1 className="text-xl font-semibold text-[var(--brand-navy)] mb-2">Something went wrong</h1>
      <p className="text-[var(--gray-secondary)] text-center mb-6 max-w-md">
        We couldn’t load this listing. Please try again or return to search.
      </p>
      <div className="flex gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/search">
          <Button variant="outline">Go Back to Search</Button>
        </Link>
      </div>
    </div>
  )
}
