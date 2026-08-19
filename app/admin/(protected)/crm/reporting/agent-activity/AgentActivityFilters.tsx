'use client'
// 11C: restyled to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Carried over verbatim: navigate()'s param set and order, the CSV export URL
// (broker + date + cols, same route, same `download`), the superuser-only agent
// scope with the locked "Me" state for everyone else, and the honest lead-type
// control whose two CRM-parity options stay disabled because the CRM has no
// web-vs-manual lead classification.
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

type Broker = { slug: string; label: string }

interface Props {
  currentBroker: string
  currentDate: string
  currentView: string
  currentCols?: string
  brokers: Broker[]
  /** Superusers may change the agent scope; everyone else is locked to "Me" */
  isSuperuser: boolean
  /** Display name for the locked "Me" state (non-superusers) */
  lockedBrokerLabel?: string
}

export default function AgentActivityFilters({
  currentBroker,
  currentDate,
  currentView,
  currentCols,
  brokers,
  isSuperuser,
  lockedBrokerLabel,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      view: currentView,
      ...(currentCols ? { cols: currentCols } : {}),
      ...updates,
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  // Build the CSV export URL from current filter state
  const exportParams = new URLSearchParams({
    broker: currentBroker,
    date: currentDate,
    ...(currentCols ? { cols: currentCols } : {}),
  })
  const exportHref = `/admin/crm/reporting/agent-activity/export?${exportParams.toString()}`

  return (
    <div>
      <div className="av2-inline-form" style={{ maxWidth: 620 }}>
        {/* Agent scope — locked to "Me" for non-superusers (data-layer scoped too) */}
        {isSuperuser ? (
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
        ) : (
          <SelectField label="Agent" value="me" disabled onChange={() => {}}>
            <option value="me">{lockedBrokerLabel ?? 'Me'}</option>
          </SelectField>
        )}

        {/* Lead type — the CRM has no web-vs-manual lead classification, so only
            "All leads" is real; the CRM-parity options render disabled (honest UI) */}
        <SelectField label="Lead type" value="all" onChange={() => {}}>
          <option value="all">All leads</option>
          <option value="web" disabled>
            Web leads
          </option>
          <option value="manual" disabled>
            Manual leads
          </option>
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

      {/* Export — the server route re-scopes to the caller's role */}
      <a
        href={exportHref}
        download
        className="av2-btn av2-btn--quiet"
        style={{ textDecoration: 'none', marginTop: 12 }}
      >
        Download CSV
      </a>
    </div>
  )
}
