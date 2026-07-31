'use client'

/**
 * MarkAllSeenButton — one write that resets the "new since last visit"
 * baseline on every saved search the signed-in visitor owns (Phase 4.1).
 * Same optimistic dispatch shape as the other /account islands: flip, fire the
 * owner-scoped server action, surface the reason on failure.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markAllSavedSearchesSeen } from '@/app/actions/saved-searches'
import { Button } from '@/components/ui/button'

export default function MarkAllSeenButton({ label = 'Mark all as seen' }: { label?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await markAllSavedSearchesSeen()
      if (result.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onClick}>
        {label}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="status">
          {error}
        </p>
      ) : null}
    </div>
  )
}
