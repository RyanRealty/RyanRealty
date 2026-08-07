'use client'
/**
 * Properties report filter — date preset only (this report has no agent or
 * lead-type dimension). 11C: restyled to the LOCKED admin v2 language.
 * navigate() is carried over verbatim — same param, same router.push target.
 */
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

interface Props {
  currentDate: string
}

export default function PropertiesFilters({ currentDate }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({ date: currentDate, ...updates })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="av2-inline-form" style={{ maxWidth: 220 }}>
      <SelectField
        label="Date range"
        value={currentDate}
        onChange={(e) => navigate({ date: e.target.value })}
      >
        <option value="today">Today</option>
        <option value="this_week">This Week</option>
        <option value="this_month">This Month</option>
        <option value="this_year">This Year</option>
      </SelectField>
    </div>
  )
}
