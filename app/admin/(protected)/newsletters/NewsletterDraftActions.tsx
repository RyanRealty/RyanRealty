'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  adminSendNewsletterAction,
  adminDeleteNewsletterAction,
  adminNewsletterAudiencePreviewAction,
} from '@/app/actions/newsletter'

/**
 * Send-now + delete controls for a draft newsletter. Send opens a confirm
 * Dialog that first resolves the audience size + per-broker split (so the admin
 * sees exactly who it reaches before approving), then on confirm enqueues the
 * send and refreshes into the stats view. Delete returns to the management home.
 */
export default function NewsletterDraftActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [audience, setAudience] = useState<{ total: number; brokerSplit: Record<string, number> } | null>(null)
  const [audienceError, setAudienceError] = useState<string | null>(null)

  function openConfirm() {
    setMessage(null)
    setAudience(null)
    setAudienceError(null)
    setConfirmOpen(true)
    startTransition(async () => {
      const r = await adminNewsletterAudiencePreviewAction(id)
      if (r.ok) {
        setAudience({ total: r.total ?? 0, brokerSplit: r.brokerSplit ?? {} })
      } else {
        setAudienceError(r.error ?? 'Could not resolve the audience.')
      }
    })
  }

  function onConfirmSend() {
    setMessage(null)
    startTransition(async () => {
      const r = await adminSendNewsletterAction(id)
      setConfirmOpen(false)
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

  const splitLine = audience
    ? Object.entries(audience.brokerSplit)
        .sort((a, b) => b[1] - a[1])
        .map(([b, c]) => `${b[0].toUpperCase()}${b.slice(1)} ${c.toLocaleString('en-US')}`)
        .join(' · ')
    : ''

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={openConfirm} disabled={pending}>
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve and send this newsletter?</DialogTitle>
            <DialogDescription>
              It enqueues immediately. The send queue delivers to active subscribers, skipping any suppressed contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {audienceError ? (
              <p className="text-sm text-destructive" role="alert">{audienceError}</p>
            ) : audience ? (
              <div>
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {audience.total.toLocaleString('en-US')} recipient{audience.total === 1 ? '' : 's'}
                </p>
                {splitLine ? (
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">{splitLine}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Resolving the audience…</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirmSend}
              disabled={pending || !audience || audience.total === 0}
            >
              {pending ? 'Sending…' : 'Confirm and send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
