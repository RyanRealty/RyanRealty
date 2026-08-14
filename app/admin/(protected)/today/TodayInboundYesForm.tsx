'use client'

/**
 * Today inbound Yes — one governed SMS. Pending blocks a double tap.
 * The idempotency key is per mount so a sub-frame double-submit reuses it.
 */
import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/admin/v2'
import { newIdempotencyKey } from '@/lib/admin/mutation-result'
import { sendTodayInboundReply } from './actions'

export function TodayInboundYesForm({ personId, body }: { personId: number; body: string }) {
  const [pending, startTransition] = useTransition()
  const idempotencyKeyRef = useRef<string | null>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending || !body.trim()) return
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = newIdempotencyKey()
    const fd = new FormData(e.currentTarget)
    fd.set('idempotencyKey', idempotencyKeyRef.current)
    startTransition(async () => {
      const { error } = await sendTodayInboundReply(fd)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Sent.')
    })
  }

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="body" value={body} />
      <Button type="submit" disabled={pending || !body.trim()} aria-label="Send the recommended text">
        {pending ? 'Sending' : 'Yes'}
      </Button>
    </form>
  )
}
