'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { listingsBrowsePath } from '@/lib/slug'
import { H1 } from '@/components/site/primitives'

export default function CompareError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <H1 className="text-xl text-foreground">Something went wrong</H1>
      <p className="mt-2 text-muted-foreground">We couldn&apos;t load the comparison page. Please try again.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button
          type="button"
          onClick={reset}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted"
        >
          Try again
        </Button>
        <Link href={listingsBrowsePath()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Browse Listings
        </Link>
      </div>
    </main>
  )
}
