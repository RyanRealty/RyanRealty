'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog } from '@/components/admin/v2'
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
 *
 * Admin v2 (11F): shadcn Dialog/Button replaced by the locked admin language.
 * The confirm keeps the base <Dialog> rather than <ConfirmDialog> because the
 * confirm button carries its own disabled logic (blocked until an audience
 * resolves and is non-empty) while Cancel is only blocked while pending —
 * ConfirmDialog's single `busy` flag would disable both. ci:admin-ui rule C
 * counts primary v2 <Button>s across the whole file, so the terminal "Confirm
 * and send" keeps the primary variant and the trigger that opens the dialog is
 * quiet, matching the sibling NewsletterScheduleControls. Presentation only:
 * same server actions, same confirm step, same disabled logic, same strings.
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
      {/* NEITHER ROW BUTTON IS SOLID, on purpose. The migration left "Delete
          draft" as variant="danger" (solid red) while "Send now" was quiet, so
          the only filled control on a newsletter draft was the destructive one
          and the eye landed on Delete where the intended action is Send.
          Promoting Send to primary would fix the optics and break rule C —
          ci:admin-ui counts primaries across the WHOLE file, and the terminal
          "Confirm" inside the dialog below is the one that should hold it, since
          that is the button that actually sends. So Send stays quiet and Delete
          becomes quiet-with-danger-colour: the inversion is gone, the single
          primary still belongs to the irreversible step. */}
      <Button type="button" variant="quiet" onClick={openConfirm} disabled={pending}>
        {pending ? 'Working…' : 'Send now'}
      </Button>
      <Button
        type="button"
        variant="quiet"
        onClick={onDelete}
        disabled={pending}
        style={{ color: 'var(--a-danger)' }}
      >
        Delete draft
      </Button>
      {message ? (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 'var(--a-text-sm)',
            color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)',
          }}
        >
          {message.text}
        </p>
      ) : null}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Approve and send this newsletter?"
        description="It enqueues immediately. The send queue delivers to active subscribers, skipping any suppressed contacts."
        footer={
          <>
            <Button type="button" variant="quiet" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirmSend}
              disabled={pending || !audience || audience.total === 0}
            >
              {pending ? 'Sending…' : 'Confirm and send'}
            </Button>
          </>
        }
      >
        <div className="py-2">
          {audienceError ? (
            <p role="alert" style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
              {audienceError}
            </p>
          ) : audience ? (
            <div>
              <p
                className="tabular-nums"
                style={{ margin: 0, fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}
              >
                {audience.total.toLocaleString('en-US')} recipient{audience.total === 1 ? '' : 's'}
              </p>
              {splitLine ? (
                <p
                  className="tabular-nums"
                  style={{ margin: '4px 0 0', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}
                >
                  {splitLine}
                </p>
              ) : null}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Resolving the audience…</p>
          )}
        </div>
      </Dialog>
    </div>
  )
}
