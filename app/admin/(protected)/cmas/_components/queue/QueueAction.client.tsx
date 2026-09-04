'use client'

/**
 * The row's ONE button.
 *
 * The old surfaces offered five (Build, Approve, Send, Send again, Publish) and
 * left the operator to work out which applied. Here the row's state has already
 * decided: there is exactly one thing to do, the label says what it will do —
 * "Approve & send" vs "Approve & queue" is the difference between an email
 * leaving now and one joining the cold drip — and the result says what happened.
 */

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import type { ApproveAndDeliverResult } from '@/app/actions/cma-queue'

export function QueueAction({
  slug,
  label,
  approve,
}: {
  slug: string
  label: string
  approve: (slug: string) => Promise<ApproveAndDeliverResult>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  const onClick = useCallback(async () => {
    if (busy || pending) return
    setBusy(true)
    try {
      const res = await approve(slug)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.outcome === 'sent') toast.success('Sent.')
      else if (res.outcome === 'queued') toast.success(`Queued — ${res.position} waiting in the drip.`)
      else toast.success(res.reason)
      startTransition(() => router.refresh())
    } finally {
      setBusy(false)
    }
  }, [approve, busy, pending, router, slug])

  return (
    <Button touch disabled={busy || pending} onClick={onClick}>
      {busy ? 'Working…' : label}
    </Button>
  )
}
