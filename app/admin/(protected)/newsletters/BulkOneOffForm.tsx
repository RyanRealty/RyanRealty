'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, TextAreaField, TextField } from '@/components/admin/v2'
import { adminBulkOneOffSendAction } from '@/app/actions/newsletter'
import { parseEmailList } from '@/lib/newsletter/parse-emails'

/**
 * Send THIS draft issue to a pasted list of emails — this issue only. Opens a
 * confirm Dialog showing the parsed (valid, de-duped) recipient count before
 * anything sends. On confirm the server action runs the brand-voice gate, creates
 * a subscriber row per recipient (for the unsubscribe token), and enqueues through
 * the same suppression-checked drain as the audience send.
 *
 * Admin v2 (11F): shadcn Dialog/Textarea/Input/Label/Button replaced by the locked
 * admin language. The confirm keeps the base <Dialog> rather than <ConfirmDialog>
 * because the confirm button carries its own disabled logic (no pasted address and
 * no CRM tag) while Cancel is only blocked while pending — ConfirmDialog's single
 * `busy` flag would disable both. ci:admin-ui rule C counts primary v2 <Button>s
 * across the whole file, so the terminal "Confirm and send" keeps the primary
 * variant and the trigger that opens the dialog is quiet, matching the sibling
 * NewsletterScheduleControls. Presentation only: same server action, same parsed
 * count, same confirm step, same disabled logic, same strings.
 */
export default function BulkOneOffForm({ id }: { id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [emails, setEmails] = useState('')
  const [crmTag, setCrmTag] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const parsed = useMemo(() => parseEmailList(emails), [emails])

  function openConfirm() {
    setMessage(null)
    if (parsed.length === 0 && !crmTag.trim()) {
      setMessage({ type: 'err', text: 'Paste at least one valid email address or enter a CRM tag.' })
      return
    }
    setConfirmOpen(true)
  }

  function onConfirm() {
    startTransition(async () => {
      const r = await adminBulkOneOffSendAction(id, { emails, crmTag: crmTag.trim() || undefined })
      setConfirmOpen(false)
      if (r.ok) {
        const n = r.queued ?? 0
        setMessage({ type: 'ok', text: `Queued ${n.toLocaleString('en-US')} one-off recipient${n === 1 ? '' : 's'}.` })
        setEmails('')
        setCrmTag('')
        router.refresh()
      } else {
        const map: Record<string, string> = {
          empty_body: 'Add a body before sending.',
          no_recipients: 'No valid emails found in that list.',
          all_opted_out: 'Everyone on that list previously unsubscribed. Nothing was sent.',
          too_many_recipients: 'That list is over the 5,000-recipient limit for one send. Split it into batches.',
          already_sent: 'This issue has already been sent.',
          already_sending: 'This issue is already sending.',
          not_found: 'Newsletter not found.',
          unauthorized: 'You do not have access to send.',
        }
        setMessage({ type: 'err', text: map[r.error ?? ''] ?? r.error ?? 'Send failed.' })
      }
    })
  }

  return (
    <div className="space-y-3">
      <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        Sends this issue to a specific list, once. Each recipient gets a one-click unsubscribe rail, and anyone suppressed or
        opted-out is skipped automatically. It does not change your recurring subscriber list.
      </p>
      <div className="space-y-1.5">
        <TextAreaField
          label="Emails"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="Paste emails — one per line, or comma / semicolon separated."
          rows={5}
        />
        <p
          className="tabular-nums"
          style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
        >
          {parsed.length.toLocaleString('en-US')} valid recipient{parsed.length === 1 ? '' : 's'} parsed.
        </p>
      </div>
      <div className="space-y-1.5">
        <TextField
          label="CRM tag (optional)"
          value={crmTag}
          onChange={(e) => setCrmTag(e.target.value)}
          placeholder="e.g. past-client — also sends to everyone carrying that exact tag"
        />
      </div>
      <Button type="button" variant="quiet" onClick={openConfirm} disabled={pending}>
        {pending ? 'Working…' : 'Send this issue to the list'}
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
        title="Send this issue to the list?"
        description="A one-time send. The queue delivers to these recipients, skipping any suppressed or opted-out contacts."
        footer={
          <>
            <Button type="button" variant="quiet" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} disabled={pending || (parsed.length === 0 && !crmTag.trim())}>
              {pending ? 'Sending…' : 'Confirm and send'}
            </Button>
          </>
        }
      >
        <div className="py-2">
          <p
            className="tabular-nums"
            style={{ margin: 0, fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}
          >
            {parsed.length.toLocaleString('en-US')} pasted recipient{parsed.length === 1 ? '' : 's'}
          </p>
          {crmTag.trim() ? (
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              plus everyone tagged &ldquo;{crmTag.trim()}&rdquo; (realtors and suppressed excluded)
            </p>
          ) : null}
        </div>
      </Dialog>
    </div>
  )
}
