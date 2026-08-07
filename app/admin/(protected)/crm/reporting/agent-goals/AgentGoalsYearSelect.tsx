'use client'

/**
 * Year selector for the Agent Goals report.
 *
 * 11C: restyled to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md);
 * the option list and the router.push target are carried over verbatim.
 */
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

interface Props {
  currentYear: number
}

// Show 2 prior years, current year, and 1 future year
function buildYearOptions(currentYear: number): number[] {
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]
}

export function AgentGoalsYearSelect({ currentYear }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const years = buildYearOptions(new Date().getFullYear())

  function onYearChange(value: string) {
    router.push(`${pathname}?year=${value}`)
  }

  return (
    <div style={{ maxWidth: 180 }}>
      <SelectField
        label="Year"
        value={String(currentYear)}
        onChange={(e) => onYearChange(e.target.value)}
      >
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}
          </option>
        ))}
      </SelectField>
    </div>
  )
}
