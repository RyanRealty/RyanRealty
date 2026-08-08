'use client'

import { useState, useTransition } from 'react'
import { setWeeklyReportRecipientsAction } from '@/app/actions/crm-company-settings'
import { Button, IconButton, SearchField } from '@/components/admin/v2'

/**
 * WeeklyRecipientsEditor — spec §1.7 / AC-10.
 *
 * "+ Add Email" opens an inline email input; addresses render as a chip list
 * with a per-chip × remove. Add/remove save immediately through their own flow
 * (§1.9 — not the form's Save button). These recipients receive the REAL Monday
 * weekly pipeline digest (app/api/cron/weekly-pipeline-digest); when the list
 * is empty the digest falls back to the account owner.
 *
 * P11F: migrated to the LOCKED admin v2 language. "+ Add Email" and the inline
 * "Add" never render together, but ci:admin-ui rule C counts primary Buttons
 * per FILE — the commit ("Add") keeps the one primary, the opener is quiet.
 */
export function WeeklyRecipientsEditor({ recipients: initial }: { recipients: string[] }) {
  const [recipients, setRecipients] = useState<string[]>(initial)
  const [adding, setAdding] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function persist(list: string[]) {
    // Dedupe client-side too (the action also dedupes) so a repeat add can't
    // render duplicate chips / duplicate React keys.
    const next = Array.from(new Set(list))
    setError('')
    startTransition(async () => {
      try {
        await setWeeklyReportRecipientsAction(next)
        setRecipients(next)
        setEmail('')
        setAdding(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save recipients')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s2)' }}>
      {recipients.length === 0 && !adding && (
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          No recipients added — the weekly report goes to the account owner.
        </p>
      )}

      {recipients.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 'var(--a-s1)' }}>
          {recipients.map((r) => (
            <span
              key={r}
              className="inline-flex items-center"
              style={{
                gap: 2,
                fontSize: 'var(--a-text-xs)',
                color: 'var(--a-text-2)',
                border: '1px solid var(--a-border)',
                borderRadius: 'var(--a-r-sm)',
                padding: '1px 6px',
              }}
            >
              {r}
              <IconButton
                label={`Remove ${r}`}
                tone="danger"
                disabled={isPending}
                onClick={() => persist(recipients.filter((x) => x !== r))}
                style={{ width: 18, height: 18, borderRadius: 999 }}
              >
                ×
              </IconButton>
            </span>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex items-center" style={{ gap: 'var(--a-s2)' }}>
          <SearchField
            type="email"
            aria-label="Add Email"
            value={email}
            placeholder="name@example.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (email.trim()) persist([...recipients, email.trim().toLowerCase()])
              }
            }}
            style={{ maxWidth: 256 }}
            autoFocus
          />
          <Button
            disabled={isPending || !email.trim()}
            onClick={() => persist([...recipients, email.trim().toLowerCase()])}
          >
            {isPending ? 'Saving...' : 'Add'}
          </Button>
          <Button
            variant="quiet"
            disabled={isPending}
            onClick={() => {
              setAdding(false)
              setError('')
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="quiet" onClick={() => setAdding(true)}>
            + Add Email
          </Button>
        </div>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>{error}</p>
      )}
    </div>
  )
}
