'use client'

/**
 * ReportSubscriptionsPanel — manage which market reports a contact receives and
 * how often. Presentational + form-only: it renders the current subscription
 * state and posts changes to the `setAction` server action (which owns the DB
 * write + any consent gating). This island never queries the database.
 *
 * Radix controls (Switch, Checkbox, Select) are not native form elements, so
 * each one mirrors its value into a hidden <input> the FormData picks up:
 *   - active  -> "on" | "off"
 *   - areas   -> repeated "areas" entries (one per selected slug)
 *   - frequency -> "weekly" | "monthly" | "quarterly"
 */
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly'

const FREQUENCY_OPTIONS: { value: ReportFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

export type ReportSubscriptionsPanelProps = {
  current: {
    isActive: boolean
    areas: string[]
    frequency: ReportFrequency
  } | null
  areaOptions: { slug: string; label: string }[]
  setAction: (fd: FormData) => Promise<void>
  className?: string
}

export default function ReportSubscriptionsPanel({
  current,
  areaOptions,
  setAction,
  className,
}: ReportSubscriptionsPanelProps) {
  const [isActive, setIsActive] = useState(current?.isActive ?? false)
  const [areas, setAreas] = useState<Set<string>>(() => new Set(current?.areas ?? []))
  const [frequency, setFrequency] = useState<ReportFrequency>(current?.frequency ?? 'monthly')
  const [pending, startTransition] = useTransition()

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
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base">Market reports</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-5">
          {/* hidden mirrors for the radix controls */}
          <input type="hidden" name="active" value={isActive ? 'on' : 'off'} />
          <input type="hidden" name="frequency" value={frequency} />
          {[...areas].map((slug) => (
            <input key={slug} type="hidden" name="areas" value={slug} />
          ))}

          <div className="flex items-center justify-between gap-3 min-h-11">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Receiving reports</p>
              <p className="text-xs text-muted-foreground">
                {isActive ? 'On' : 'Off'}
              </p>
            </div>
            <Switch
              checked={isActive}
              disabled={pending}
              onCheckedChange={setIsActive}
              aria-label="Receiving market reports"
            />
          </div>

          <fieldset
            className="space-y-2"
            disabled={pending || !isActive}
            aria-disabled={pending || !isActive}
          >
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Areas
            </legend>
            {areaOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No areas available.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {areaOptions.map((opt) => {
                  const id = `report-area-${opt.slug}`
                  return (
                    <div key={opt.slug} className="flex items-center gap-2 min-h-11">
                      <Checkbox
                        id={id}
                        checked={areas.has(opt.slug)}
                        disabled={pending || !isActive}
                        onCheckedChange={(v) => toggleArea(opt.slug, v === true)}
                      />
                      <Label htmlFor={id} className="text-sm font-normal">
                        {opt.label}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="report-frequency" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Frequency
            </Label>
            <Select
              value={frequency}
              disabled={pending || !isActive}
              onValueChange={(v) => setFrequency(v as ReportFrequency)}
            >
              <SelectTrigger id="report-frequency" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
            {pending ? 'Saving' : 'Save report settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
