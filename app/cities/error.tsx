'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { H1 } from '@/components/site/primitives'

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
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <H1 className="text-2xl text-primary">Something went wrong</H1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t load the cities page. Please try again or go back home.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-6 py-3 font-semibold text-primary hover:bg-accent/90"
          >
            Try again
          </Button>
          <Link
            href="/"
            className="rounded-lg border border-border bg-card px-6 py-3 font-semibold text-primary hover:bg-muted"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  )
}
