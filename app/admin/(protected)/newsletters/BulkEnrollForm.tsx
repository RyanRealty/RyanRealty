'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
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
  const [crmTag, setCrmTag] = useState('')
  const [segment, setSegment] = useState<NewsletterSegment>('general')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!emails.trim() && !crmTag.trim()) {
      setMessage({ type: 'err', text: 'Paste at least one email address or enter a CRM tag.' })
      return
    }
    startTransition(async () => {
      const r = await adminBulkEnrollNewsletterAction({ emails, crmTag: crmTag.trim() || undefined, segment })
      if (r.ok) {
        const n = (v?: number) => (v ?? 0).toLocaleString('en-US')
        // M2/M3: break down WHY addresses didn't enroll instead of one opaque "skipped".
        const parts = [`Enrolled ${n(r.enrolled)}`]
        if (r.optedOut) parts.push(`${n(r.optedOut)} skipped (previously unsubscribed)`)
        if (r.failed) parts.push(`${n(r.failed)} failed to save`)
        if (r.dropped) parts.push(`${n(r.dropped)} dropped over the 5,000 cap`)
        if (r.enrolled === 0 && !r.optedOut && !r.failed) parts.push('(check the tag spelling — 0 people matched)')
        setMessage({ type: 'ok', text: parts.join(' · ') + '.' })
        setEmails('')
        setCrmTag('')
        router.refresh()
      } else {
        const map: Record<string, string> = {
          no_recipients: 'No valid emails found in that list.',
          unauthorized: 'Only the account owner can bulk-enroll.',
          lookup_failed: 'Could not verify opt-out status. Nothing was enrolled. Try again.',
        }
        setMessage({ type: 'err', text: map[r.error ?? ''] ?? 'Could not enroll. Try again.' })
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
      <div className="space-y-1.5">
        <Label htmlFor="bulk-tag">CRM tag (optional)</Label>
        <Input
          id="bulk-tag"
          value={crmTag}
          onChange={(e) => setCrmTag(e.target.value)}
          placeholder="e.g. past-client — enrolls everyone carrying that exact tag"
        />
        <p className="text-xs text-muted-foreground">Realtors and already-suppressed contacts are excluded automatically. The tag must match exactly.</p>
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
