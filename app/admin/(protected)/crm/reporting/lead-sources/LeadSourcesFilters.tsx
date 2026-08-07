'use client'
// 11C: restyled to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
// mirroring the Agent Activity filter bar so the two reports read the same.
// Carried over verbatim: navigate()'s param set and order, and the CSV export
// URL (broker + date + cols, same route, same `download`).
//
// The lead-type control keeps its FUB-parity shape but stops lying: it used to
// read "Web leads" while the report counted every lead. The CRM has no
// web-vs-manual classification, so "All leads" is the only real option and the
// other two render disabled.
import { useRouter, usePathname } from 'next/navigation'
import { SelectField } from '@/components/admin/v2'

type Broker = { slug: string; label: string }

interface Props {
  currentBroker: string
  currentDate: string
  currentCols?: string
  brokers: Broker[]
}

export default function LeadSourcesFilters({
  currentBroker,
  currentDate,
  currentCols,
  brokers,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      ...(currentCols ? { cols: currentCols } : {}),
      ...updates,
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  const exportParams = new URLSearchParams({
    broker: currentBroker,
    date: currentDate,
    ...(currentCols ? { cols: currentCols } : {}),
  })

  return (
    <div>
      <div className="av2-inline-form" style={{ maxWidth: 620 }}>
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
        href={`/admin/crm/reporting/lead-sources/export?${exportParams.toString()}`}
        download
        className="av2-btn av2-btn--quiet"
        style={{ textDecoration: 'none', marginTop: 12 }}
      >
        Download CSV
      </a>
    </div>
  )
}
