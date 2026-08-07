'use client'

/**
 * The report's view switch — Agent Activity has two documented views.
 *
 * 11C: restyled to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * VIEW_OPTIONS and selectView() are carried over verbatim: the same two values,
 * the same four params, the same router.push target. The legacy version dressed
 * this as an interactive page title; the locked bar bans page-title chrome, so
 * it is now a labelled control alongside the other filters.
 */
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

const VIEW_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'activity', label: 'total lead count and total agent activity' },
  { value: 'deals', label: 'which team member has closed the most deals' },
]

interface Props {
  currentView: string
  currentBroker: string
  currentDate: string
  currentCols?: string
}

export default function ShowMeSelector({
  currentView,
  currentBroker,
  currentDate,
  currentCols,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const active = VIEW_OPTIONS.find((o) => o.value === currentView) ?? VIEW_OPTIONS[0]

  function selectView(value: string) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      view: value,
      ...(currentCols ? { cols: currentCols } : {}),
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <SelectField
        label="Show me"
        value={active.value}
        onChange={(e) => selectView(e.target.value)}
      >
        {VIEW_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </SelectField>
    </div>
  )
}
