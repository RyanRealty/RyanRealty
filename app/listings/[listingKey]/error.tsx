'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ListingDetailError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-muted">
      <h1 className="text-xl font-semibold text-primary mb-2">Something went wrong</h1>
      <p className="text-muted-foreground text-center mb-6 max-w-md">
        We couldn’t load this listing. Please try again or return to search.
      </p>
      <div className="flex gap-3">
        <Button variant="default" onClick={reset}>
          Try again
        </Button>
        <Link href="/homes-for-sale">
          <Button variant="outline">Go Back to Search</Button>
        </Link>
      </div>
    </div>
  )
}
