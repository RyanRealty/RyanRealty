'use client'

/**
 * MobileStatusButton — the compact Close/Reopen control on the phone thread view
 * (< md). Desktop uses ThreadHeader (assignee dropdown + Close/Reopen); the
 * phone header only carries the one action. State only — never a send path.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { ConversationStatus } from '@/lib/data/crm/getInboxQueue'

export default function MobileStatusButton({
  status,
  setStatusAction,
}: {
  status: ConversationStatus
  setStatusAction: (status: ConversationStatus) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const closed = status === 'closed'
  return (
    <Button
      type="button"
      size="sm"
      variant={closed ? 'outline' : 'destructive'}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setStatusAction(closed ? 'open' : 'closed')
          if (res.ok) router.refresh()
        })
      }
    >
      {closed ? 'Reopen' : 'Close'}
    </Button>
  )
}
