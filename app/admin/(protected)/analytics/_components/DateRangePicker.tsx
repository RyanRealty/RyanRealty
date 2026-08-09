'use client'

/**
 * DateRangePicker — the shared analytics/report date-range control.
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 field primitives
 * (design_system/admin/ADMIN_UI.md). Nothing about the contract moved: the same
 * five range values, the same `range` / `startDate` / `endDate` search params,
 * the same router.push on every change, the same custom-range reveal, and the
 * same three field labels. Its v2 sibling _components/v2/RangeControl renders
 * the identical shape for the pages migrated in 11C — one language, one control.
 */
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { SelectField, TextField } from '@/components/admin/v2'

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
    <div className="av2-inline-form">
      <SelectField label="Date range" value={current} onChange={(e) => update({ range: e.target.value })}>
        {RANGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </SelectField>
      {current === 'custom' && (
        <>
          <TextField
            label="Start"
            type="date"
            defaultValue={currentStart ?? ''}
            onChange={(e) => update({ startDate: e.target.value })}
          />
          <TextField
            label="End"
            type="date"
            defaultValue={currentEnd ?? ''}
            onChange={(e) => update({ endDate: e.target.value })}
          />
        </>
      )}
    </div>
  )
}
