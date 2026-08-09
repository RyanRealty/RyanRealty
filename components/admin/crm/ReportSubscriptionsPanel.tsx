'use client'

/**
 * ReportSubscriptionsPanel — manage which market reports a contact receives and
 * how often. Presentational + form-only: it renders the current subscription
 * state and posts changes to the `setAction` server action (which owns the DB
 * write + any consent gating). This island never queries the database.
 *
 * The controls carry no `name`, so each one mirrors its value into a hidden
 * input the FormData picks up:
 *   - active  -> "on" | "off"
 *   - areas   -> repeated "areas" entries (one per selected slug)
 *   - frequency -> "weekly" | "monthly" | "quarterly"
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop, handler, action and user-visible
 * string is unchanged. Four notes on the swap:
 *  - The Card shell becomes `av2-pane`, the barrel's stacked context section.
 *  - Switch / ToolbarCheck / SelectField are native inputs rather than Radix
 *    ones, but they are still UNNAMED, so the hidden mirrors above remain the
 *    only fields the FormData sees. Adding a `name` to any of them would post a
 *    second, duplicate value — do not.
 *  - The Checkbox + Label pair becomes ToolbarCheck, whose label element WRAPS
 *    its input; the id/htmlFor association is replaced by a stronger one, not
 *    dropped. Same for the Frequency Label + SelectTrigger id, which SelectField
 *    now owns end to end (its own useId pair, so passing an id would break it).
 *  - Only the Save button is primary; "Send report now" is quiet, per the
 *    one-primary-action rule.
 */
import { useState, useTransition } from 'react'
import { Button, SelectField, Switch, ToolbarCheck } from '@/components/admin/v2'
import { cn } from '@/lib/utils'

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly'

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

const MUTED_STYLE: React.CSSProperties = { color: 'var(--a-text-2)' }

export type ReportSubscriptionsPanelProps = {
  current: {
    isActive: boolean
    areas: string[]
    frequency: ReportFrequency
  } | null
  areaOptions: { slug: string; label: string }[]
  setAction: (fd: FormData) => Promise<void>
  /** One-off immediate send of the selected areas to this contact (no cadence). */
  sendNowAction?: (fd: FormData) => Promise<{ ok: true } | { ok: false; error: string }>
  className?: string
}

export default function ReportSubscriptionsPanel({
  current,
  areaOptions,
  setAction,
  sendNowAction,
  className,
}: ReportSubscriptionsPanelProps) {
  const [isActive, setIsActive] = useState(current?.isActive ?? false)
  const [areas, setAreas] = useState<Set<string>>(() => new Set(current?.areas ?? []))
  const [frequency, setFrequency] = useState<ReportFrequency>(current?.frequency ?? 'monthly')
  const [pending, startTransition] = useTransition()
  const [sendNote, setSendNote] = useState<{ ok: boolean; text: string } | null>(null)

  function onSendNow() {
    if (!sendNowAction) return
    const fd = new FormData()
    for (const slug of areas) fd.append('areas', slug)
    setSendNote(null)
    startTransition(async () => {
      const r = await sendNowAction(fd)
      setSendNote(r.ok ? { ok: true, text: 'Report sent.' } : { ok: false, text: r.error })
    })
  }

  function toggleArea(slug: string, next: boolean) {
    setAreas((prev) => {
      const out = new Set(prev)
      if (next) out.add(slug)
      else out.delete(slug)
      return out
    })
  }

  function onSubmit(fd: FormData) {
    startTransition(async () => {
      await setAction(fd)
    })
  }

  return (
    <div className={cn('av2-pane', className)}>
      <div className="text-base font-medium" style={{ color: 'var(--a-text)' }}>Market reports</div>
      <div>
        <form action={onSubmit} className="space-y-5">
          {/* hidden mirrors for the unnamed controls */}
          <input type="hidden" name="active" value={isActive ? 'on' : 'off'} />
          <input type="hidden" name="frequency" value={frequency} />
          {[...areas].map((slug) => (
            <input key={slug} type="hidden" name="areas" value={slug} />
          ))}

          <div className="flex items-center justify-between gap-3 min-h-11">
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--a-text)' }}>Receiving reports</p>
              <p className="text-xs" style={MUTED_STYLE}>
                {isActive ? 'On' : 'Off'}
              </p>
            </div>
            <Switch
              label="Receiving market reports"
              labelHidden
              checked={isActive}
              disabled={pending}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </div>

          <fieldset
            className="space-y-2"
            disabled={pending || !isActive}
            aria-disabled={pending || !isActive}
          >
            <legend className="text-xs font-semibold uppercase tracking-wide mb-1" style={MUTED_STYLE}>
              Areas
            </legend>
            {areaOptions.length === 0 ? (
              <p className="text-sm" style={MUTED_STYLE}>No areas available.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {areaOptions.map((opt) => {
                  const id = `report-area-${opt.slug}`
                  return (
                    <div key={opt.slug} className="flex items-center gap-2 min-h-11">
                      <ToolbarCheck
                        id={id}
                        label={opt.label}
                        checked={areas.has(opt.slug)}
                        disabled={pending || !isActive}
                        onChange={(e) => toggleArea(opt.slug, e.target.checked)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </fieldset>

          <div className="space-y-1.5">
            <SelectField
              label="Frequency"
              value={frequency}
              disabled={pending || !isActive}
              onChange={(e) => setFrequency(e.target.value as ReportFrequency)}
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="submit" touch disabled={pending} className="w-full sm:w-auto">
              {pending ? 'Saving' : 'Save report settings'}
            </Button>
            {sendNowAction ? (
              <Button
                type="button"
                variant="quiet"
                touch
                disabled={pending || areas.size === 0}
                onClick={onSendNow}
                className="w-full sm:w-auto"
                title={areas.size === 0 ? 'Pick at least one area first' : undefined}
              >
                Send report now
              </Button>
            ) : null}
          </div>
          {sendNote ? (
            <p
              className="text-sm"
              style={{ color: sendNote.ok ? 'var(--a-ok)' : 'var(--a-danger)' }}
              role="status"
            >
              {sendNote.text}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}
