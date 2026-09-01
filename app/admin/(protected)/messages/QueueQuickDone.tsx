'use client'

/**
 * QueueQuickDone — one-tap "Done" on a folder-view queue row (fold final
 * slice): marks the conversation handled through the same guarded inbox
 * action and refreshes, so sweeping a folder is tap-tap-tap instead of
 * open-thread-per-row. Rendered only in folder views, never on Recent.
 */
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/admin/v2'
import { setConversationStateAction } from '@/app/actions/crm-inbox'

export function QueueQuickDone({ personId }: { personId: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="quiet"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setConversationStateAction(personId, 'handled')
          if (res.ok) router.refresh()
        })
      }
    >
      {pending ? '…' : 'Done'}
    </Button>
  )
}
