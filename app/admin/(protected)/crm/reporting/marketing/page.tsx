// @no-parity — internal admin surface
//
// §11.15 Marketing (UTM) Report — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md), through the reporting family's shared
// presentation kit (../_v2/ReportGrid). Presentation only.
//
// Carried over verbatim: the getCrmAccess guard, `?date=` handling and its
// `this_month` default, the getMarketingUtmReport(datePreset) read and its
// catch-to-null, the refresh href, the column set, the sort, and every figure
// and metric definition.
//
// One state was added, not changed: a FAILED read used to render as an
// innocent "no sessions with UTM parameters" table. A broken query now says so.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getMarketingUtmReport } from '@/lib/data/crm/getMarketingUtmReport'
import type { DatePreset } from '@/lib/data/crm/getAgentActivityReport'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import {
  ReportGrid,
  ReportFreshness,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
} from '../_v2/ReportGrid'
import MarketingFilters from './MarketingFilters'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Marketing | Reporting | CRM' }
export const dynamic = 'force-dynamic'

const COLUMNS: ReportColumn[] = [
  { key: 'platform', label: 'Platform' },
  { key: 'sessions', label: 'Sessions', numeric: true },
  { key: 'leads', label: 'Leads', numeric: true },
  { key: 'appointments', label: 'Appointments', numeric: true },
  { key: 'dealsClosed', label: 'Deals closed', numeric: true },
  { key: 'dealValue', label: 'Deal value', numeric: true },
]

/** Zero reads muted, a real figure reads live — the legacy NumCell rule. */
function num(value: number) {
  return value === 0 ? (
    <span style={{ color: 'var(--a-text-2)' }}>0</span>
  ) : (
    value.toLocaleString('en-US')
  )
}

export default async function MarketingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const datePreset = (sp.date ?? 'this_month') as DatePreset

  const report = await getMarketingUtmReport(datePreset).catch(() => null)
  const rows = report?.rows ?? []

  const nowMs = Date.now()
  const refreshHref = `/admin/crm/reporting/marketing?date=${datePreset}&t=${nowMs}`

  const gridRows: ReportGridRow[] = rows.map((row) => ({
    key: row.platform,
    cells: [
      row.platform,
      num(row.sessions),
      num(row.leads),
      num(row.appointments),
      num(row.dealsClosed),
      <span key="v" style={{ color: row.dealValue > 0 ? undefined : 'var(--a-text-2)' }}>
        ${Math.round(row.dealValue).toLocaleString('en-US')}
      </span>,
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingTabStrip active="marketing" />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={report === null ? 'attention' : 'ok'}>
          {report === null ? (
            <>
              <b>The UTM report could not be read.</b> Nothing below is a measurement.
            </>
          ) : (
            <>
              <b>
                {report.totalSessions.toLocaleString('en-US')} tagged{' '}
                {report.totalSessions === 1 ? 'session' : 'sessions'} across {rows.length}{' '}
                {rows.length === 1 ? 'platform' : 'platforms'}.
              </b>{' '}
              Platform is the utm_source stamped on a website session. Leads, appointments and
              closed deals are attributed through the identified contact.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? <ReportError what="The UTM report" href={refreshHref} /> : null}

      <div className="av2-rfilters">
        <MarketingFilters currentDate={datePreset} />
      </div>

      <ReportFreshness href={refreshHref} nowMs={nowMs} />

      <SectionHead>By platform — the platforms sending nothing sit at the bottom</SectionHead>
      <ReportGrid
        label="Marketing platforms by session"
        columns={COLUMNS}
        template="minmax(140px, 1.6fr) repeat(5, minmax(84px, 1fr))"
        minWidth={720}
        rows={gridRows}
        empty={
          <>
            No session in this window carried a utm_source. Widen the window above, or tag the next
            campaign link so it lands here. For every source, tagged or not, see the{' '}
            <Link href="/admin/crm/reporting/lead-sources" style={{ color: 'var(--a-accent)' }}>
              Lead Sources report
            </Link>
            .
          </>
        }
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Sorted by sessions, most first. Sessions come from visitor_sessions carrying a utm_source;
        leads are the identified CRM contacts among those sessions; appointments and closed deals
        are contact-attributed, so they may fall outside the window the session did. For every
        source, tagged or not, see the{' '}
        <Link href="/admin/crm/reporting/lead-sources" style={{ color: 'var(--a-accent)' }}>
          Lead Sources report
        </Link>
        .
      </p>
    </div>
  )
}
