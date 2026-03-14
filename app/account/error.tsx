'use client'

import { useEffect } from 'react'
import { Button } from "@/components/ui/button"

export default function AccountError({
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
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <h2 className="text-lg font-semibold text-foreground">Account error</h2>
      <p className="mt-2 text-sm text-muted-foreground">Something went wrong loading your account.</p>
      <Button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        Try again
      </Button>
    </div>
  )
}
