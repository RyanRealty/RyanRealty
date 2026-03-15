'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'last12m' | 'custom'

export type DateRange = {
  preset: DateRangePreset
  start: string
  end: string
}

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'last12m', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
]

function getRangeForPreset(preset: DateRangePreset): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      break
    case 'yesterday':
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      break
    case 'last7':
      start.setDate(start.getDate() - 7)
      break
    case 'last30':
      start.setDate(start.getDate() - 30)
      break
    case 'last90':
      start.setDate(start.getDate() - 90)
      break
    case 'last12m':
      start.setFullYear(start.getFullYear() - 1)
      break
    default:
      start.setDate(start.getDate() - 30)
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

type Props = {
  value: DateRange
  onChange: (range: DateRange) => void
}

export default function DateRangeSelector({ value, onChange }: Props) {
  const [preset, setPreset] = useState<DateRangePreset>(value.preset)
  const [start, setStart] = useState(value.start)
  const [end, setEnd] = useState(value.end)

  function handlePresetChange(p: DateRangePreset) {
    setPreset(p)
    if (p !== 'custom') {
      const r = getRangeForPreset(p)
      setStart(r.start)
      setEnd(r.end)
      onChange({ preset: p, start: r.start, end: r.end })
    }
  }

  function handleCustomApply() {
    setPreset('custom')
    onChange({ preset: 'custom', start, end })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground">Date range</span>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ value: p, label }) => (
          <Button
            key={p}
            type="button"
            onClick={() => handlePresetChange(p)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              preset === p
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-border'
            }`}
          >
            {label}
          </Button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded border border-border px-2 py-1 text-sm"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded border border-border px-2 py-1 text-sm"
          />
          <Button
            type="button"
            onClick={handleCustomApply}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary"
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  )
}

export function getDefaultDateRange(): DateRange {
  const { start, end } = getRangeForPreset('last30')
  return { preset: 'last30', start, end }
}
