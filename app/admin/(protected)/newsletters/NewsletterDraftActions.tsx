'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { adminSendNewsletterAction, adminDeleteNewsletterAction } from '@/app/actions/newsletter'

/**
 * Send-now + delete controls for a draft newsletter. Send asks for an explicit
 * confirm (it fans out real email), then on success refreshes the page into the
 * stats view. Delete returns to the management home.
 */
export default function NewsletterDraftActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function onSend() {
    if (!window.confirm('Approve and send this newsletter to its audience? It will be delivered by the send queue.')) return
    setMessage(null)
    startTransition(async () => {
      const r = await adminSendNewsletterAction(id)
      if (r.ok) {
        const n = r.queued ?? 0
        const split = r.brokerSplit
          ? ' (' + Object.entries(r.brokerSplit).map(([b, c]) => `${b} ${c}`).join(' · ') + ')'
          : ''
        setMessage({
          type: 'ok',
          text: `Queued ${n} recipient${n === 1 ? '' : 's'}${split}. The send queue is delivering now${r.large ? ', tranched over the next several days' : ''}.`,
        })
        router.refresh()
      } else {
        const map: Record<string, string> = {
          empty_body: 'Add a body before sending.',
          no_recipients: 'No active subscribers match this audience.',
          already_sent: 'This newsletter has already been sent.',
          already_sending: 'This newsletter is already sending.',
          not_found: 'Newsletter not found.',
          unauthorized: 'You do not have access to send.',
        }
        setMessage({ type: 'err', text: map[r.error ?? ''] ?? r.error ?? 'Send failed.' })
      }
    })
  }

  function onDelete() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return
    setMessage(null)
    startTransition(async () => {
      const r = await adminDeleteNewsletterAction(id)
      if (r.ok) {
        router.push('/admin/newsletters')
      } else {
        setMessage({ type: 'err', text: 'Could not delete the draft.' })
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={onSend} disabled={pending}>
        {pending ? 'Working…' : 'Send now'}
      </Button>
      <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
        Delete draft
      </Button>
      {message ? (
        <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'} role="alert">
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
