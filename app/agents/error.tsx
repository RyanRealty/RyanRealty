'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from "@/components/ui/button"

export default function AgentsError({
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
        <h1 className="text-2xl font-bold text-primary">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t load the agents page. Please try again or go back home.
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
