'use client'

/**
 * Pending-draft watch — the admin Build CMA form queues the worker and lands
 * here before html exists. Refresh the server page until the draft is ready
 * so the broker never sits on an empty review with no signal.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function CmaBuildWatch({ building }: { building: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!building) return
    const id = window.setInterval(() => {
      router.refresh()
    }, 4000)
    return () => window.clearInterval(id)
  }, [building, router])

  if (!building) return null

  return (
    <p
      style={{
        background: 'var(--a-accent-wash)',
        borderRadius: 'var(--a-r-lg)',
        padding: '12px 16px',
        margin: '12px 0 0',
        fontSize: 'var(--a-text-sm)',
        color: 'var(--a-text-2)',
      }}
    >
      Building this CMA in the background. This page refreshes when the draft is ready. Nothing
      sends.
    </p>
  )
}
