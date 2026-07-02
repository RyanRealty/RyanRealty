'use client'

import { useState, useTransition } from 'react'
import { setWeeklyReportRecipientsAction } from '@/app/actions/crm-company-settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * WeeklyRecipientsEditor — spec §1.7 / AC-10.
 *
 * "+ Add Email" opens an inline email input; addresses render as a chip list
 * with a per-chip × remove. Add/remove save immediately through their own flow
 * (§1.9 — not the form's Save button). These recipients receive the REAL Monday
 * weekly pipeline digest (app/api/cron/weekly-pipeline-digest); when the list
 * is empty the digest falls back to the account owner.
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
    <div className="space-y-2">
      {recipients.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          No recipients added — the weekly report goes to the account owner.
        </p>
      )}

      {recipients.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recipients.map((r) => (
            <Badge key={r} variant="secondary" className="gap-0.5 pr-0.5 font-normal">
              {r}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${r}`}
                className="h-4 w-4 rounded-full text-muted-foreground hover:text-destructive"
                disabled={isPending}
                onClick={() => persist(recipients.filter((x) => x !== r))}
              >
                ×
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            type="email"
            value={email}
            placeholder="name@example.com"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (email.trim()) persist([...recipients, email.trim().toLowerCase()])
              }
            }}
            className="h-8 max-w-64"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={isPending || !email.trim()}
            onClick={() => persist([...recipients, email.trim().toLowerCase()])}
          >
            {isPending ? 'Saving...' : 'Add'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
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
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm text-primary"
          onClick={() => setAdding(true)}
        >
          + Add Email
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
