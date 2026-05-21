'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const RANGE_OPTIONS = [
  { value: 'today',  label: 'Today' },
  { value: '7d',     label: 'Last 7 days' },
  { value: '30d',    label: 'Last 30 days' },
  { value: '90d',    label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
] as const

export function DateRangePicker({ current, currentStart, currentEnd }: { current: string; currentStart?: string; currentEnd?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const update = useCallback((patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k)
      else next.set(k, v)
    }
    router.push(`${pathname}?${next.toString()}`)
  }, [router, params, pathname])

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date range</Label>
        <Select value={current} onValueChange={(v) => update({ range: v })}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {current === 'custom' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start</Label>
            <Input
              type="date"
              defaultValue={currentStart ?? ''}
              onChange={(e) => update({ startDate: e.target.value })}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">End</Label>
            <Input
              type="date"
              defaultValue={currentEnd ?? ''}
              onChange={(e) => update({ endDate: e.target.value })}
              className="w-44"
            />
          </div>
        </>
      )}
    </div>
  )
}
