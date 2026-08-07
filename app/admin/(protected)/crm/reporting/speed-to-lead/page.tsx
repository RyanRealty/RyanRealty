// @no-parity — internal admin surface
// INFERRED REPORT — see lib/data/crm/getSpeedToLeadReport.ts for the definition note.
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only. Carried over verbatim: the getCrmAccess guard, the
// superuser/broker scoping, the ?broker/?date/?t handling, the DAL call and its
// catch-to-null, every default, formatElapsed, the contact-rate computation,
// the sub-5-minute highlight rule, the per-source drill hrefs, and the
// ReportingTabStrip sub-nav (shared machinery, migrates with its own unit).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getSpeedToLeadReport,
  type SpeedToLeadRow,
  type SpeedToLeadTotals,
} from '@/lib/data/crm/getSpeedToLeadReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import {
  VerdictLine,
  SectionHead,
  ReportGrid,
  ReportNumbers,
  ReportFreshness,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import SpeedToLeadFilters from './SpeedToLeadFilters'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Speed to Lead | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Duration formatter ─────────────────────────────────────────────────────────

/**
 * Format elapsed seconds as a human-readable string.
 * Examples: "45 sec" · "15 min" · "2h 15m" · "3 days" · "3 days 4h"
 * Returns "—" for null (no data).
 */
function formatElapsed(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds} sec`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    return `${m} min`
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  return h > 0 ? `${d} days ${h}h` : `${d} days`
}

/** Sub-5-minute responses (<= 300 seconds) read as the good state. */
const FAST_SECONDS = 300

function Elapsed({ seconds }: { seconds: number | null }) {
  if (seconds === null) return <span style={{ color: 'var(--a-text-2)' }}>—</span>
  const fast = seconds <= FAST_SECONDS
  return (
    <span style={{ color: fast ? 'var(--a-ok)' : 'var(--a-text)', fontWeight: fast ? 600 : 400 }}>
      {formatElapsed(seconds)}
    </span>
  )
}

function Rate({ contacted, total }: { contacted: number; total: number }) {
  if (total === 0) return <span style={{ color: 'var(--a-text-2)' }}>—</span>
  const pct = Math.round((contacted / total) * 100)
  return (
    <>
      {contacted.toLocaleString('en-US')}{' '}
      <span style={{ color: 'var(--a-text-2)' }}>{pct}%</span>
    </>
  )
}

const COLUMNS: ReportColumn[] = [
  { key: 'source', label: 'Source' },
  { key: 'leads', label: 'Leads', numeric: true },
  { key: 'contacted', label: 'Contacted', numeric: true },
  { key: 'median', label: 'Median speed', numeric: true },
  { key: 'avg', label: 'Avg speed', numeric: true },
]

// ── Search params ─────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SpeedToLeadPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)
  const isSuperuser = access.role === 'superuser'

  const datePreset = (sp.date ?? 'this_month') as
    | 'today'
    | 'this_week'
    | 'this_month'
    | 'this_year'
    | 'custom'

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  // ── Data fetch ────────────────────────────────────────────────────────────────
  // All data access is via the DAL (no raw .from() in the page).
  const report = await getSpeedToLeadReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const rows: SpeedToLeadRow[] = report?.rows ?? []

  const totals: SpeedToLeadTotals = report?.totals ?? {
    totalLeads: 0,
    contactedLeads: 0,
    medianSeconds: null,
    avgSeconds: null,
  }

  // Contact rate (for the numbers strip)
  const contactRatePct =
    totals.totalLeads > 0
      ? Math.round((totals.contactedLeads / totals.totalLeads) * 100)
      : null

  const nowMs = Date.now()
  const refreshHref = `/admin/crm/reporting/speed-to-lead?broker=${currentBroker}&date=${currentDate}&t=${nowMs}`

  const fastEnough = totals.medianSeconds !== null && totals.medianSeconds <= FAST_SECONDS

  const gridRows: ReportGridRow[] = rows.map((row) => {
    const sourceParam = row.sourceKey
      ? encodeURIComponent(row.sourceKey)
      : '__unspecified__'
    const drillHref = `/admin/crm?source=${sourceParam}&date=${currentDate}`
    return {
      key: row.sourceName,
      cells: [
        // Source name — links to the People list filtered by this source
        <Link key="s" href={drillHref} style={{ color: 'var(--a-accent)' }}>
          {row.sourceName}
        </Link>,
        row.totalLeads === 0 ? (
          <span key="l" style={{ color: 'var(--a-text-2)' }}>
            0
          </span>
        ) : (
          row.totalLeads.toLocaleString('en-US')
        ),
        <Rate key="c" contacted={row.contactedLeads} total={row.totalLeads} />,
        <Elapsed key="m" seconds={row.medianSeconds} />,
        <Elapsed key="a" seconds={row.avgSeconds} />,
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingTabStrip active="speed-to-lead" />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={fastEnough ? 'ok' : 'attention'}>
          {totals.totalLeads === 0 ? (
            <>
              <b>No lead came in this period.</b> There is no first-response time to report.
            </>
          ) : (
            <>
              <b>Median first response: {formatElapsed(totals.medianSeconds)}.</b>{' '}
              {totals.contactedLeads.toLocaleString('en-US')} of{' '}
              {totals.totalLeads.toLocaleString('en-US')} leads contacted
              {contactRatePct !== null ? ` (${contactRatePct}%)` : ''}.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? (
        <ReportError what="Speed to lead" href={refreshHref} />
      ) : null}

      {isSuperuser ? (
        <div className="av2-rfilters">
          <SpeedToLeadFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
            brokers={CRM_BROKERS.map((slug) => ({
              slug,
              label: CRM_BROKER_DISPLAY[slug],
            }))}
          />
        </div>
      ) : null}

      <ReportFreshness href={refreshHref} nowMs={nowMs} />

      {/*
        TOTAL LEADS   — leads created in the selected period (from lead_created events)
        CONTACTED     — leads that received at least one outbound contact
        MEDIAN SPEED  — median elapsed time from lead_created → first contact
        AVG SPEED     — average elapsed time (right-skewed by outliers; median is more useful)
      */}
      <ReportNumbers
        items={[
          {
            key: 'total',
            label: 'Total leads',
            value: totals.totalLeads.toLocaleString('en-US'),
            delta: { text: 'in period', direction: 'flat' },
          },
          {
            key: 'contacted',
            label: 'Contacted',
            value: totals.contactedLeads.toLocaleString('en-US'),
            delta:
              contactRatePct !== null
                ? { text: `${contactRatePct}% of leads`, direction: 'flat' }
                : undefined,
          },
          {
            key: 'median',
            label: 'Median speed',
            value: formatElapsed(totals.medianSeconds),
            delta: { text: 'to first contact', direction: 'flat' },
          },
          {
            key: 'avg',
            label: 'Avg speed',
            value: formatElapsed(totals.avgSeconds),
            delta: { text: 'to first contact', direction: 'flat' },
          },
        ]}
      />

      <SectionHead>By lead source</SectionHead>
      <ReportGrid
        label="Speed to first contact by lead source"
        columns={COLUMNS}
        template="minmax(150px, 1.7fr) repeat(4, minmax(84px, 1fr))"
        minWidth={620}
        rows={gridRows}
        empty={
          <>
            No lead was created in this period, so there is nothing to time.{' '}
            <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
              Open the people list
            </Link>{' '}
            or widen the date range above.
          </>
        }
      />

      {/* Methodology note — absorbs the two column tooltips the legacy table hid
          behind a `title` attribute (ADMIN_UI bans title-attribute tooltips). */}
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Speed to lead measures the time from when a lead is created to the first outbound
        call, email, or text sent to that person. Automated drip emails count as first contact.
        Leads not yet contacted show no speed value. Contacted counts leads with at least one
        outbound call, email, or text after creation. Average is right-skewed by slow outliers;
        median is the more reliable signal. Sources are ordered by lead volume, highest first.
      </p>
    </div>
  )
}
