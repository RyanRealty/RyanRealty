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
 */

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getAlertEngineSettingsAction,
  updateAlertEngineSettingsAction,
  type AlertEngineSettings,
} from '@/app/actions/alert-admin'
import type { AlertEventToggles, ListingEventType } from '@/lib/alerts/event-detection'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

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
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alert settings</DialogTitle>
          <DialogDescription>
            {settings
              ? `${settings.name} for ${settings.email}.`
              : 'What this alert watches and how it goes out.'}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive" role="alert">{loadError}</p>
        ) : !settings || !events ? (
          <div className="grid gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ) : (
          <div className="grid gap-5">
            {/* Preview mode */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div className="min-w-0">
                <Label htmlFor={`preview-${alertId}`} className="text-sm font-medium text-foreground">
                  Preview mode
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Hold matches in the approval queue instead of sending right away.
                </p>
              </div>
              <Switch
                id={`preview-${alertId}`}
                checked={previewMode}
                disabled={pending}
                onCheckedChange={setPreviewMode}
              />
            </div>

            {/* Event toggles */}
            <div>
              <p className="text-sm font-medium text-foreground">What to watch</p>
              <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {EVENT_ROWS.map(({ type, label }) => (
                  <div key={type} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`admin-event-${type}-${alertId}`} className="text-sm text-foreground">
                      {label}
                    </Label>
                    <Switch
                      id={`admin-event-${type}-${alertId}`}
                      checked={events[type]}
                      disabled={pending}
                      onCheckedChange={(next) => setEvents({ ...events, [type]: next })}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly day-of-week schedule */}
            {settings.frequency === 'weekly' ? (
              <div>
                <p className="text-sm font-medium text-foreground">Which days</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
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
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        disabled={pending}
                        aria-pressed={active}
                        onClick={() =>
                          setDays((prev) =>
                            prev.includes(day)
                              ? prev.filter((d) => d !== day)
                              : [...prev, day].sort((a, b) => a - b),
                          )
                        }
                        className="h-8 w-12 px-0"
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending || !settings || !events}>
            {pending ? 'Saving...' : 'Save settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
