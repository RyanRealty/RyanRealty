'use client'

/**
 * In-drip row actions: Send now / Hold / Remove from drip (R1).
 * Review stays the address title hop to /admin/cmas/[slug].
 */

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import {
  approveAndDeliverCma,
  holdCmaInDripAction,
  removeCmaFromDripAction,
} from '@/app/actions/cma-queue'

export function DripQueueActions({ slug }: { slug: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string; outcome?: string }>) => {
      if (busy || pending) return
      setBusy(true)
      try {
        const res = await fn()
        if (!res.ok) {
          toast.error(res.error ?? 'Failed')
          return
        }
        if (res.outcome === 'sent') toast.success('Sent.')
        else toast.success('Updated.')
        startTransition(() => router.refresh())
      } finally {
        setBusy(false)
      }
    },
    [busy, pending, router],
  )

  return (
    <div className="flex flex-wrap gap-2" style={{ justifyContent: 'flex-end' }}>
      <Button
        touch
        disabled={busy || pending}
        onClick={() =>
          run(async () => {
            const res = await approveAndDeliverCma(slug, undefined, { delivery: 'now' })
            if (!res.ok) return { ok: false, error: res.error }
            return { ok: true, outcome: res.outcome }
          })
        }
      >
        {busy ? 'Working…' : 'Send now'}
      </Button>
      <Button
        touch
        variant="quiet"
        disabled={busy || pending}
        onClick={() =>
          run(async () => {
            const res = await holdCmaInDripAction(slug)
            return res.ok ? { ok: true } : { ok: false, error: res.error }
          })
        }
      >
        Hold
      </Button>
      <Button
        touch
        variant="quiet"
        disabled={busy || pending}
        onClick={() =>
          run(async () => {
            const res = await removeCmaFromDripAction(slug)
            return res.ok ? { ok: true } : { ok: false, error: res.error }
          })
        }
      >
        Remove
      </Button>
    </div>
  )
}
