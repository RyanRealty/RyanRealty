'use client'
// 11C: restyled to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// navigate() is carried over verbatim — same params, same router.push target.
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

type Broker = { slug: string; label: string }

interface Props {
  currentBroker: string
  currentDate: string
  brokers: Broker[]
}

/**
 * Contact Attempts report filter bar — agent selector + date preset.
 * Mirrors the Speed to Lead filter pattern.
 */
export default function ContactAttemptsFilters({
  currentBroker,
  currentDate,
  brokers,
}: Props) {
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
