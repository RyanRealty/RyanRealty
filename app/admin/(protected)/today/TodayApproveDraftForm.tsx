'use client'

/**
 * Today Yes on a ready content draft. Matt's tap is the stamp.
 * Routes through approveNowAction. Does not publish. Does not text.
 */
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { approveReadyDraftToday } from './actions'

export function TodayApproveDraftForm({ actionId }: { actionId: string }) {
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending || !actionId.trim()) return
    const fd = new FormData()
    fd.set('actionId', actionId)
    startTransition(async () => {
      const { error } = await approveReadyDraftToday(fd)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Approved.')
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <Button type="submit" disabled={pending || !actionId.trim()} aria-label="Approve this draft">
        {pending ? 'Approving' : 'Yes'}
      </Button>
    </form>
  )
}
