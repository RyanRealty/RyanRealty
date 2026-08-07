'use client'
/**
 * 11C: restyled to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * The navigation contract is carried over verbatim — changing the window pushes
 * `?date=<preset>` on the same pathname, and nothing else.
 *
 * The attribution control is carried over too, including its honesty: UTM
 * capture is session-level, which is all-touch by nature, so First touch stays
 * disabled until per-lead first-source stamping exists.
 */
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

interface Props {
  currentDate: string
}

export default function MarketingFilters({ currentDate }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="av2-inline-form" style={{ maxWidth: 380 }}>
      <SelectField label="Attribution" value="all_touch" onChange={() => {}}>
        <option value="all_touch">All touch</option>
        <option value="first_touch" disabled>
          First touch
        </option>
      </SelectField>

      <SelectField
        label="Date range"
        value={currentDate}
        onChange={(e) => router.push(`${pathname}?date=${e.target.value}`)}
      >
        <option value="today">Today</option>
        <option value="this_week">This Week</option>
        <option value="this_month">This Month</option>
        <option value="this_year">This Year</option>
      </SelectField>
    </div>
  )
}
