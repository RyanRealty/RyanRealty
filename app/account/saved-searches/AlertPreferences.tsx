'use client'

/**
 * AlertPreferences — the typed-event section of one saved-search card on
 * /account/saved-searches (Phase 3 UI, search-optimization plan §4):
 *
 * - "What to watch": the six event toggles the alert engine honors
 *   (lib/alerts/event-detection.ts), plain labels, Flexmls-inherited defaults.
 * - "Which days" (weekly cadence only): Sun–Sat chips writing
 *   listing_alerts.schedule_days (0=Sunday..6=Saturday). No days picked means
 *   one email every seven days.
 * - "Also send to": household recipients (add/remove email), capped
 *   server-side; every entry gets its own unsubscribe token on the server.
 *
 * Same optimistic dispatch shape as the parent SavedSearchControls: flip the
 * UI, fire the owner-gated server action (app/actions/alert-preferences.ts),
 * revert + surface the reason on failure. Design-system primitives only.
 */

import { useState, useTransition } from 'react'
import {
  setAlertEventsAction,
  setAlertScheduleDaysAction,
  addAlertRecipientAction,
  removeAlertRecipientAction,
} from '@/app/actions/alert-preferences'
import type { AlertEventToggles, ListingEventType } from '@/lib/alerts/event-detection'
import type { SavedSearchCadence } from '@/lib/saved-search-cadence'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

/** Visible labels for the six event toggles (sentence case). */
export const EVENT_TOGGLE_LABELS: ReadonlyArray<{ type: ListingEventType; label: string }> = [
  { type: 'new', label: 'New listings' },
  { type: 'price_change', label: 'Price changes' },
  { type: 'status_change', label: 'Pending' },
  { type: 'back_on_market', label: 'Back on market' },
  { type: 'sold', label: 'Sold' },
  { type: 'open_house', label: 'Open houses' },
]

/** Sun–Sat chip labels, index = day number (0=Sunday..6=Saturday). */
export const DAY_CHIP_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

type Props = {
  alertId: string
  /** Live cadence from the parent card — day chips only apply to weekly. */
  cadence: SavedSearchCadence
  events: AlertEventToggles
  scheduleDays: number[] | null
  recipients: Array<{ email: string; name: string | null }>
  disabled?: boolean
}

export default function AlertPreferences({
  alertId,
  cadence,
  events: initialEvents,
  scheduleDays: initialDays,
  recipients: initialRecipients,
  disabled,
}: Props) {
  const [events, setEvents] = useState<AlertEventToggles>(initialEvents)
  const [days, setDays] = useState<number[]>(initialDays ?? [])
  const [recipients, setRecipients] = useState(initialRecipients)
  const [draftEmail, setDraftEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const busy = pending || disabled === true

  function onToggleEvent(type: ListingEventType, next: boolean) {
    const prev = events
    const nextMap = { ...events, [type]: next }
    setEvents(nextMap)
    setNote(null)
    startTransition(async () => {
      const result = await setAlertEventsAction(alertId, nextMap)
      if (result.error) {
        setEvents(prev)
        setNote({ tone: 'err', text: result.error })
      }
    })
  }

  function onToggleDay(day: number) {
    const prev = days
    const next = prev.includes(day)
      ? prev.filter((d) => d !== day)
      : [...prev, day].sort((a, b) => a - b)
    setDays(next)
    setNote(null)
    startTransition(async () => {
      const result = await setAlertScheduleDaysAction(alertId, next)
      if (result.error) {
        setDays(prev)
        setNote({ tone: 'err', text: result.error })
      }
    })
  }

  function onAddRecipient() {
    const email = draftEmail.trim().toLowerCase()
    if (!email) {
      setNote({ tone: 'err', text: 'Enter an email address.' })
      return
    }
    setNote(null)
    startTransition(async () => {
      const result = await addAlertRecipientAction(alertId, email)
      if (result.error) {
        setNote({ tone: 'err', text: result.error })
        return
      }
      setRecipients((prev) => [...prev, { email, name: null }])
      setDraftEmail('')
      setNote({ tone: 'ok', text: `${email} now gets this alert.` })
    })
  }

  function onRemoveRecipient(email: string) {
    const prev = recipients
    setRecipients(prev.filter((r) => r.email !== email))
    setNote(null)
    startTransition(async () => {
      const result = await removeAlertRecipientAction(alertId, email)
      if (result.error) {
        setRecipients(prev)
        setNote({ tone: 'err', text: result.error })
      }
    })
  }

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
      {/* What to watch */}
      <div>
        <p className="text-sm font-medium text-foreground">What to watch</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick the updates this search emails you about.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {EVENT_TOGGLE_LABELS.map(({ type, label }) => {
            const switchId = `event-${type}-${alertId}`
            return (
              <div key={type} className="flex items-center justify-between gap-3">
                <Label htmlFor={switchId} className="text-sm text-foreground">
                  {label}
                </Label>
                <Switch
                  id={switchId}
                  checked={events[type]}
                  disabled={busy}
                  onCheckedChange={(next) => onToggleEvent(type, next)}
                  aria-label={`${label} updates`}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Which days (weekly only) */}
      {cadence === 'weekly' ? (
        <div>
          <p className="text-sm font-medium text-foreground">Which days</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {days.length > 0
              ? 'Your weekly email goes out on the days you pick.'
              : 'No days picked means one email every seven days.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
            {DAY_CHIP_LABELS.map((label, day) => {
              const active = days.includes(day)
              return (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  disabled={busy}
                  aria-pressed={active}
                  onClick={() => onToggleDay(day)}
                  className="h-8 w-12 px-0"
                >
                  {label}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Household recipients */}
      <div>
        <p className="text-sm font-medium text-foreground">Also send to</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Share this alert with your household. Each person can opt out on their own.
        </p>
        {recipients.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {recipients.map((recipient) => (
              <li
                key={recipient.email}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5"
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{recipient.email}</span>
                  {recipient.name ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {recipient.name}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">Gets this alert</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onRemoveRecipient(recipient.email)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onAddRecipient()
              }
            }}
            placeholder="name@example.com"
            aria-label="Add a recipient email"
            maxLength={254}
            disabled={busy}
            className="h-9 max-w-72 text-sm"
          />
          <Button type="button" size="sm" disabled={busy} onClick={onAddRecipient}>
            Add
          </Button>
        </div>
      </div>

      {note ? (
        <p
          className={cn('text-xs', note.tone === 'ok' ? 'text-success' : 'text-destructive')}
          role="status"
        >
          {note.text}
        </p>
      ) : null}
    </div>
  )
}
