'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminBulkEnrollNewsletterAction } from '@/app/actions/newsletter'
import type { NewsletterSegment } from '@/lib/data'

const SEGMENTS: { value: NewsletterSegment; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'past-client', label: 'Past client' },
]

/**
 * Paste-many-emails bulk enroll. Enrolled subscribers receive every future issue;
 * the unique(lower(email)) index de-dupes, so pasting a name already on the list is
 * a no-op. Addresses that previously unsubscribed are never re-added — they count as
 * skipped, not resurrected (S-10).
 */
export function BulkEnrollForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [emails, setEmails] = useState('')
  const [segment, setSegment] = useState<NewsletterSegment>('general')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!emails.trim()) {
      setMessage({ type: 'err', text: 'Paste at least one email address.' })
      return
    }
    startTransition(async () => {
      const r = await adminBulkEnrollNewsletterAction({ emails, segment })
      if (r.ok) {
        setMessage({ type: 'ok', text: `Enrolled ${r.enrolled.toLocaleString('en-US')}, skipped ${r.skipped.toLocaleString('en-US')}.` })
        setEmails('')
        router.refresh()
      } else {
        setMessage({
          type: 'err',
          text: r.error === 'no_recipients' ? 'No valid emails found in that list.' : 'Could not enroll. Try again.',
        })
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="bulk-emails">Emails</Label>
        <Textarea
          id="bulk-emails"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="Paste emails — one per line, or comma / semicolon separated."
          rows={6}
        />
        <p className="text-xs text-muted-foreground">Invalid and duplicate addresses are dropped automatically. Cap 5,000 per batch.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-segment">Segment</Label>
          <Select value={segment} onValueChange={(v) => setSegment(v as NewsletterSegment)}>
            <SelectTrigger id="bulk-segment" className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Enrolling…' : 'Add subscribers'}</Button>
      </div>
      {message ? (
        <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'} role="alert">
          {message.text}
        </p>
      ) : null}
    </form>
  )
}
