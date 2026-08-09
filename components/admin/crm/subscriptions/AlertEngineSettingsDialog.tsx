'use client'

/**
 * AlertEngineSettingsDialog — broker-side editor for one listing alert's
 * typed-event engine settings: preview mode (hold events in the approval
 * queue instead of sending), the six event toggles, and the weekly
 * day-of-week schedule. Self-fetching by alert id so any surface (the
 * approval queue tab, the alert tables) can open it with just the id.
 *
 * Reads getAlertEngineSettingsAction, writes updateAlertEngineSettingsAction
 * (both CRM-admin gated in app/actions/alert-admin.ts).
 *
 * P11F: on the LOCKED admin v2 language. shadcn Dialog/Switch/Label/Skeleton/
 * Button are gone: the v2 Dialog, the v2 Switch (a native checkbox with
 * role="switch" — so `onCheckedChange` becomes `onChange`), plain <label
 * htmlFor> carrying the v2 label token, av2-rskel rows, and v2 Buttons. The
 * seven day toggles stay aria-pressed quiet Buttons. "Save settings" is this
 * file's one primary.
 */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getAlertEngineSettingsAction,
  updateAlertEngineSettingsAction,
} from '@/app/actions/alert-admin'
import type { AlertEngineSettings } from '@/lib/data/leads/listingAlertApprovals'
import type { AlertEventToggles, ListingEventType } from '@/lib/alerts/event-detection'
import { Button, Dialog, Switch } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'

const EVENT_ROWS: ReadonlyArray<{ type: ListingEventType; label: string }> = [
  { type: 'new', label: 'New listings' },
  { type: 'price_change', label: 'Price changes' },
  { type: 'status_change', label: 'Pending' },
  { type: 'back_on_market', label: 'Back on market' },
  { type: 'sold', label: 'Sold' },
  { type: 'open_house', label: 'Open houses' },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export default function AlertEngineSettingsDialog({
  alertId,
  onClose,
  onSaved,
}: {
  alertId: string
  onClose: () => void
  onSaved?: () => void
}) {
  const [settings, setSettings] = useState<AlertEngineSettings | null>(null)
  const [loadError, setLoadError] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [events, setEvents] = useState<AlertEventToggles | null>(null)
  const [days, setDays] = useState<number[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getAlertEngineSettingsAction(alertId)
      if (cancelled) return
      if (!res.data) {
        setLoadError(res.error ?? 'Could not load alert settings')
        return
      }
      setSettings(res.data)
      setPreviewMode(res.data.previewMode)
      setEvents(res.data.events)
      setDays(res.data.scheduleDays ?? [])
    })()
    return () => { cancelled = true }
  }, [alertId])

  function handleSave() {
    if (!events) return
    startTransition(async () => {
      const res = await updateAlertEngineSettingsAction(alertId, {
        previewMode,
        events,
        scheduleDays: days,
      })
      if (!res.data) {
        toast.error(res.error ?? 'Could not save those settings')
        return
      }
      toast.success('Saved alert settings')
      onSaved?.()
      onClose()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Alert settings"
      description={
        settings
          ? `${settings.name} for ${settings.email}.`
          : 'What this alert watches and how it goes out.'
      }
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || !settings || !events}>
            {pending ? 'Saving...' : 'Save settings'}
          </Button>
        </>
      }
    >
      {loadError ? (
        <p className="text-sm" style={{ color: 'var(--a-danger)' }} role="alert">{loadError}</p>
      ) : !settings || !events ? (
        <div className="grid gap-2" aria-hidden="true">
          <div className="av2-rskel__row" style={{ height: 32, margin: 0 }} />
          <div className="av2-rskel__row" style={{ height: 32, margin: 0 }} />
          <div className="av2-rskel__row w-2/3" style={{ height: 32, margin: 0 }} />
        </div>
      ) : (
        <div className="grid gap-5">
          {/* Preview mode */}
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
            style={{ border: '1px solid var(--a-border)' }}
          >
            {/* Switch renders its OWN <label> around the input, so the visible
                text stays click-to-toggle without a detached raw <label> — which
                is what the design-token gate bans. */}
            <div className="min-w-0">
              <Switch
                label="Preview mode"
                id={`preview-${alertId}`}
                checked={previewMode}
                disabled={pending}
                onChange={(e) => setPreviewMode(e.target.checked)}
              />
              <p className="mt-0.5 text-xs" style={{ color: 'var(--a-text-2)' }}>
                Hold matches in the approval queue instead of sending right away.
              </p>
            </div>
          </div>

          {/* Event toggles */}
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>What to watch</p>
            <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {EVENT_ROWS.map(({ type, label }) => (
                <div key={type} className="flex items-center justify-between gap-3">
                  {/* The primitive owns its label; a detached raw <label> is what
                      the design-token gate bans and it is not needed here. */}
                  <Switch
                    label={label}
                    id={`admin-event-${type}-${alertId}`}
                    checked={events[type]}
                    disabled={pending}
                    onChange={(e) => setEvents({ ...events, [type]: e.target.checked })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Weekly day-of-week schedule */}
          {settings.frequency === 'weekly' ? (
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>Which days</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--a-text-2)' }}>
                {days.length > 0
                  ? 'The weekly email goes out on the picked days.'
                  : 'No days picked means one email every seven days.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
                {DAY_LABELS.map((label, day) => {
                  const active = days.includes(day)
                  return (
                    <Button
                      key={label}
                      variant="quiet"
                      disabled={pending}
                      aria-pressed={active}
                      onClick={() =>
                        setDays((prev) =>
                          prev.includes(day)
                            ? prev.filter((d) => d !== day)
                            : [...prev, day].sort((a, b) => a - b),
                        )
                      }
                      // Pressed reads as the accent BORDER + text, never an
                      // inline background: .av2-btn--quiet carries its hover in
                      // the stylesheet and an inline background would outrank
                      // it. FilterChip would be the pill for this, but it has no
                      // :hover rule, and these buttons have one today.
                      style={
                        active
                          ? { minWidth: 48, borderColor: 'var(--a-accent)', color: 'var(--a-accent)' }
                          : { minWidth: 48, color: 'var(--a-text-2)' }
                      }
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  )
}
