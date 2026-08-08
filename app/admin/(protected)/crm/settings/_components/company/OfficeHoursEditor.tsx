'use client'

import { useState, useTransition } from 'react'
import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'
import { updateOfficeHoursAction } from '@/app/actions/crm-company-settings'
import { OFFICE_DAYS } from '@/lib/crm/office-hours'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * OfficeHoursEditor — spec §1.5 / AC-7.
 *
 * "+ Add office hours" opens an inline block form: day-of-week checkboxes +
 * start/end time pickers. Saved blocks render as rows with day/time labels and
 * a remove control; multiple blocks allowed. Saves through its own flow
 * (updateOfficeHoursAction), not the form's Save button, per §1.9.
 *
 * Enforcement is REAL: the inbound Twilio voice webhook routes callers to
 * voicemail outside these hours (lib/crm/office-hours.ts). An empty list means
 * always open.
 */
export function OfficeHoursEditor({ blocks: initial }: { blocks: OfficeHoursBlock[] }) {
  const [blocks, setBlocks] = useState<OfficeHoursBlock[]>(initial)
  const [adding, setAdding] = useState(false)
  const [days, setDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('18:00')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function persist(next: OfficeHoursBlock[]) {
    setError('')
    startTransition(async () => {
      try {
        await updateOfficeHoursAction(next)
        setBlocks(next)
        setAdding(false)
        setDays([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save office hours')
      }
    })
  }

  function addBlock() {
    if (days.length === 0) {
      setError('Pick at least one day.')
      return
    }
    // Keep day order canonical Mon..Sun regardless of click order.
    const ordered = OFFICE_DAYS.filter((d) => days.includes(d))
    persist([...blocks, { days: ordered, start_time: startTime, end_time: endTime }])
  }

  return (
    <div className="space-y-2">
      {blocks.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No office hours configured — calls ring through at all hours.</p>
      )}

      {blocks.length > 0 && (
        <ul className="space-y-1.5">
          {blocks.map((block, i) => (
            <li
              key={`${block.days.join('-')}-${block.start_time}-${i}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
            >
              <span className="text-sm text-foreground">
                {block.days.join(', ')} · {block.start_time} to {block.end_time}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                disabled={isPending}
                onClick={() => persist(blocks.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div className="flex flex-wrap gap-3">
            {OFFICE_DAYS.map((day) => (
              <Label key={day} className="flex items-center gap-1.5 text-sm font-normal text-foreground">
                <Checkbox
                  checked={days.includes(day)}
                  onCheckedChange={(checked) =>
                    setDays((prev) => (checked ? [...prev, day] : prev.filter((d) => d !== day)))
                  }
                  aria-label={day}
                />
                {day}
              </Label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="office-start" className="text-xs text-muted-foreground">Start</Label>
              <Input
                id="office-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 h-8 w-28"
              />
            </div>
            <div>
              <Label htmlFor="office-end" className="text-xs text-muted-foreground">End</Label>
              <Input
                id="office-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 h-8 w-28"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" className="h-8" disabled={isPending} onClick={addBlock}>
                {isPending ? 'Saving...' : 'Save hours'}
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
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-sm text-primary"
          onClick={() => setAdding(true)}
        >
          + Add office hours
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
