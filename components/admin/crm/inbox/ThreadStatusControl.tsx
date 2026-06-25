'use client'

/**
 * ThreadStatusControl — the per-conversation triage control shown above the open
 * thread (Wave 7). Flips a single conversation's status (handled / closed /
 * reopen) through the suppression-safe state action passed in pre-bound. State
 * only — never a send path.
 */

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConversationStatus } from '@/lib/data/crm/getInboxQueue'

const STATUS_LABEL: Record<ConversationStatus, string> = {
  unread: 'Unread',
  open: 'Open',
  handled: 'Handled',
  closed: 'Closed',
}

const STATUS_TONE: Record<ConversationStatus, string> = {
  unread: 'bg-primary text-primary-foreground',
  open: 'bg-secondary text-secondary-foreground',
  handled: 'bg-success text-success-foreground',
  closed: 'bg-muted text-muted-foreground',
}

export default function ThreadStatusControl({
  status,
  setStatusAction,
}: {
  status: ConversationStatus
  setStatusAction: (status: ConversationStatus) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const run = (next: ConversationStatus) => {
    setError(null)
    startTransition(async () => {
      const res = await setStatusAction(next)
      if (!res.ok) {
        setError(res.error ?? 'Could not update the conversation')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn('shrink-0', STATUS_TONE[status])}>{STATUS_LABEL[status]}</Badge>
        {status !== 'handled' ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run('handled')}>
            Mark handled
          </Button>
        ) : null}
        {status !== 'closed' ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run('closed')}>
            Close
          </Button>
        ) : null}
        {status === 'closed' || status === 'handled' ? (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run('open')}>
            Reopen
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  )
}
