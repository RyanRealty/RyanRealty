'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SelectField, TextAreaField, TextField } from '@/components/admin/v2'
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
 *
 * Admin v2 (11F): shadcn Textarea/Input/Label/Select/Button replaced by the locked
 * admin language. The helper lines stay BELOW their control rather than moving into
 * the field primitive's `hint` slot, which renders above the input — the swap is a
 * primitive swap, not a re-ordering of the form. Presentation only: same server
 * action, same parsing, same result breakdown, same strings.
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
        <TextAreaField
          label="Emails"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="Paste emails — one per line, or comma / semicolon separated."
          rows={6}
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Invalid and duplicate addresses are dropped automatically. Cap 5,000 per batch.
        </p>
      </div>
      <div className="space-y-1.5">
        <TextField
          label="CRM tag (optional)"
          value={crmTag}
          onChange={(e) => setCrmTag(e.target.value)}
          placeholder="e.g. past-client — enrolls everyone carrying that exact tag"
        />
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Realtors and already-suppressed contacts are excluded automatically. The tag must match exactly.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {/* Not w-full: as a direct child of `flex flex-wrap`, width:100% makes
            this select consume the whole row on phones and pushes the submit
            onto its own line. The old w-full sat on the trigger INSIDE this
            wrapper, so the wrapper stayed shrink-to-fit. */}
        <div className="sm:w-40">
          <SelectField
            label="Segment"
            value={segment}
            onChange={(e) => setSegment(e.target.value as NewsletterSegment)}
          >
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
        </div>
        <Button type="submit" disabled={pending}>{pending ? 'Enrolling…' : 'Add subscribers'}</Button>
      </div>
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
    </form>
  )
}
