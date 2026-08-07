'use client'
/**
 * West Side cohort window picker — 11C. Replaces the three preset LINKS the
 * pre-migration page rendered as a pill row (the locked acceptance bar: a
 * filter set is ONE compact control, never a row of pills). The URL contract is
 * unchanged: `?days=7|14|30` on the same pathname, parsed by parseDays on the
 * server, which still falls back to 7 for anything else.
 */
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

export default function WestsideFilters({ currentDays }: { currentDays: number }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="av2-inline-form" style={{ maxWidth: 220 }}>
      <SelectField
        label="Window"
        value={String(currentDays)}
        onChange={(e) => router.push(`${pathname}?days=${e.target.value}`)}
      >
        <option value="7">Last 7 days</option>
        <option value="14">Last 14 days</option>
        <option value="30">Last 30 days</option>
      </SelectField>
    </div>
  )
}
