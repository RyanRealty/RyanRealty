'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { H1 } from '@/components/site/primitives'

/**
 * HTTP 500 for a /communities/<slug> render that threw (listings or the
 * community read did not answer). Next keeps the last good ISR copy for
 * later requests. This document is not the community page: it is noindex
 * so a crawler that hits a cold miss does not index "did not load".
 */
export default function CommunityError({
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
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <meta name="robots" content="noindex, nofollow" />
      <div className="max-w-md text-center">
        <H1 className="text-2xl text-primary">This community did not load</H1>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button type="button" onClick={reset} variant="default">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/communities">View all communities</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
