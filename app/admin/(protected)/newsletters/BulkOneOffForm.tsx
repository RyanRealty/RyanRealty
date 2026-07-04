'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { adminBulkOneOffSendAction } from '@/app/actions/newsletter'
import { parseEmailList } from '@/lib/newsletter/parse-emails'

/**
 * Send THIS draft issue to a pasted list of emails — this issue only. Opens a
 * confirm Dialog showing the parsed (valid, de-duped) recipient count before
 * anything sends. On confirm the server action runs the brand-voice gate, creates
 * a subscriber row per recipient (for the unsubscribe token), and enqueues through
 * the same suppression-checked drain as the audience send.
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
      <p className="text-sm text-muted-foreground">
        Sends this issue to a specific list, once. Each recipient gets a one-click unsubscribe rail, and anyone suppressed or
        opted-out is skipped automatically. It does not change your recurring subscriber list.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="oneoff-emails">Emails</Label>
        <Textarea
          id="oneoff-emails"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="Paste emails — one per line, or comma / semicolon separated."
          rows={5}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {parsed.length.toLocaleString('en-US')} valid recipient{parsed.length === 1 ? '' : 's'} parsed.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="oneoff-tag">CRM tag (optional)</Label>
        <Input
          id="oneoff-tag"
          value={crmTag}
          onChange={(e) => setCrmTag(e.target.value)}
          placeholder="e.g. past-client — also sends to everyone carrying that exact tag"
        />
      </div>
      <Button type="button" onClick={openConfirm} disabled={pending}>
        {pending ? 'Working…' : 'Send this issue to the list'}
      </Button>
      {message ? (
        <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'} role="alert">
          {message.text}
        </p>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this issue to the list?</DialogTitle>
            <DialogDescription>
              A one-time send. The queue delivers to these recipients, skipping any suppressed or opted-out contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-lg font-semibold text-foreground tabular-nums">
              {parsed.length.toLocaleString('en-US')} pasted recipient{parsed.length === 1 ? '' : 's'}
            </p>
            {crmTag.trim() ? (
              <p className="text-sm text-muted-foreground">plus everyone tagged &ldquo;{crmTag.trim()}&rdquo; (realtors and suppressed excluded)</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} disabled={pending || (parsed.length === 0 && !crmTag.trim())}>
              {pending ? 'Sending…' : 'Confirm and send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
