'use client'

/**
 * QueueDoneAll — one-tap "Done all" for a Messages folder view (fold final
 * slice). Replaces the retired inbox's multi-select bulk triage with the
 * simpler form of the same capability: every listed conversation moves to
 * handled through the same scope-checked bulk action (out-of-scope ids are
 * skipped server-side, so a restricted broker clears only their own).
 * Rendered only in folder views with rows, never on Recent.
 */
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/admin/v2'
import { bulkConversationStateAction } from '@/app/actions/crm-inbox'

export function QueueDoneAll({ personIds }: { personIds: number[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (personIds.length < 2) return null
  return (
    <Button
      variant="quiet"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await bulkConversationStateAction(personIds, 'handled')
          if (res.ok) router.refresh()
        })
      }
    >
      {pending ? '…' : `Done all ${personIds.length}`}
    </Button>
  )
}
