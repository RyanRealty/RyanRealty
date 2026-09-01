'use client'

/**
 * CompetitionControls — the competition report's three facets (side, year,
 * merge view) as compact selects. One control per facet, never a pill row
 * (ADMIN_UI surface bar, rule 2 — same idiom as VariantControl).
 */
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

const VIEWS = [
  ['brand', 'Brand family'],
  ['entity', 'Office entity'],
  ['raw', 'Raw string'],
] as const

export function CompetitionControls({
  side,
  year,
  view,
  years,
}: {
  side: 'list' | 'buy'
  year: number
  view: string
  years: number[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const push = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="av2-scope" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <SelectField label="Side" value={side} onChange={(e) => push('side', e.target.value)}>
        <option value="list">List side</option>
        <option value="buy">Buy side</option>
      </SelectField>
      <SelectField label="Year" value={String(year)} onChange={(e) => push('year', e.target.value)}>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </SelectField>
      <SelectField label="View" value={view} onChange={(e) => push('view', e.target.value)}>
        {VIEWS.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </SelectField>
    </div>
  )
}
