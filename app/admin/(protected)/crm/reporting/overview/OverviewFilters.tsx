'use client'
// 11C: Overview's own agent + date filter, on the LOCKED admin v2 language.
// Behaviour is byte-for-byte the contract the page had before (it borrowed the
// Calls report's filter bar): the same two params, the same defaults, the same
// router.push(`${pathname}?${params}`) target. It is a separate file only
// because CallsFilters is shared with four legacy report pages that have not
// migrated yet — this page may not restyle a component it does not own.
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

type Broker = { slug: string; label: string }

interface Props {
  currentBroker: string
  currentDate: string
  brokers: Broker[]
}

export default function OverviewFilters({ currentBroker, currentDate, brokers }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      ...updates,
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="av2-inline-form" style={{ maxWidth: 380 }}>
      <SelectField
        label="Agent"
        value={currentBroker}
        onChange={(e) => navigate({ broker: e.target.value })}
      >
        <option value="everyone">Everyone</option>
        {brokers.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.label}
          </option>
        ))}
      </SelectField>

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
