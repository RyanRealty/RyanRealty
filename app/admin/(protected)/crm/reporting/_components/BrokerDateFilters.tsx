'use client'

/**
 * BrokerDateFilters — the agent selector + date preset filter bar shared by the
 * Calls, Call Logs, Texts and Appointments reports.
 *
 * 11F: these were THREE byte-identical files (CallsFilters, TextsFilters,
 * AppointmentsFilters) that call-logs already cross-imported one of, and that
 * overview/page.tsx carries a comment about not being able to borrow safely.
 * Same failure mode the sub-nav was built to end — a copy per page is how the
 * set drifts. Behaviour is carried over unchanged: same query params, same
 * option values in the same order, same router.push target.
 *
 * Migrated off components/ui Select to a native <select className="av2-input">,
 * the one compact control the acceptance bar asks for (precedent:
 * app/admin/(protected)/prospecting/FilterSelect.tsx).
 */
import { useRouter, usePathname } from 'next/navigation'
import { ToolbarSelect } from '@/components/admin/v2'

type Broker = { slug: string; label: string }

interface Props {
  currentBroker: string
  currentDate: string
  brokers: Broker[]
}

const DATE_PRESETS: Array<{ value: string; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
]

export default function BrokerDateFilters({ currentBroker, currentDate, brokers }: Props) {
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
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <ToolbarSelect
        aria-label="Filter by agent"
        value={currentBroker}
        onChange={(e) => navigate({ broker: e.target.value })}
      >
        <option value="everyone">Everyone</option>
        {brokers.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.label}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect
        aria-label="Filter by date range"
        value={currentDate}
        onChange={(e) => navigate({ date: e.target.value })}
      >
        {DATE_PRESETS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </ToolbarSelect>
    </div>
  )
}
