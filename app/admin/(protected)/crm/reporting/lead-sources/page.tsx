// @no-parity — internal admin surface
//
// Lead Sources report — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the reporting family's shared
// presentation kit (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the getCrmAccess guard, scopeBroker + the superuser
// broker-filter rule, `?broker=` / `?date=` / `?cols=` handling and their
// defaults (everyone · this_month · LS_COL_KEYS), parseLsColsParam, the
// getLeadSourcesReport read and its catch-to-null, the AgentActivityChart
// props, every per-metric drill-through href, the CSV export href, the
// superuser-only gating of the control bar, and the DAL's new-leads-desc sort.
//
// Shape changed, data did not: the KPI tile board became the family's
// typographic numbers strip (same totals, same deltas, same sparkline series),
// the shadcn table became the family's grid, and the inert "Actions" column —
// a permanently disabled trash button wired to nothing — is gone. A FAILED read
// now says so instead of rendering an innocent all-zero report.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getLeadSourcesReport } from '@/lib/data/crm/getLeadSourcesReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { ALL_COL_KEYS, type ColKey, LS_COL_KEYS } from '@/lib/crm/reporting-constants'
import {
  SectionHead,
  VerdictLine,
  ReportGrid,
  ReportFreshness,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import LeadSourcesFilters from './LeadSourcesFilters'
import { AgentActivityChart } from '../agent-activity/AgentActivityChart'
import { LeadSourcesKpiStrip } from './LeadSourcesKpiStrip'
import { ReportingSubNav } from '../_components/ReportingSubNav'

export const metadata = { title: 'Lead Sources | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Column set for Lead Sources (7 metrics, no initially/currently assigned) ──

function parseLsColsParam(raw: string | undefined): ColKey[] {
  if (!raw) return [...LS_COL_KEYS]
  const parts = raw.split(',').map((s) => s.trim()) as ColKey[]
  const valid = parts.filter((k) => (ALL_COL_KEYS as readonly string[]).includes(k))
  return valid.length > 0 ? valid : [...LS_COL_KEYS]
}

// ── Column header labels for the grid ────────────────────────────────────────
const TABLE_COL_LABELS: Partial<Record<ColKey, string>> = {
  new_leads: 'New leads',
  calls: 'Calls',
  emails: 'Emails',
  texts: 'Texts',
  notes: 'Notes',
  tasks_completed: 'Tasks done',
  appointments: 'Appts',
}

// ── Drill-through param per metric (carried verbatim) ────────────────────────
const DRILL_METRIC: Partial<Record<ColKey, string>> = {
  new_leads: 'new_leads',
  calls: 'calls',
  emails: 'emails',
  texts: 'texts',
  notes: 'notes',
  tasks_completed: 'tasks',
  appointments: 'appointments',
}

// ── Search params ─────────────────────────────────────────────────────────────
type SearchParams = {
  broker?: string
  date?: string
  cols?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LeadSourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)
  const isSuperuser = access.role === 'superuser'

  // Parse filter params
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

  const visibleCols = parseLsColsParam(sp.cols)
  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset
  const currentCols = sp.cols ?? undefined

  // Fetch report data — failure returns null and renders the honest failed-read state
  const report = await getLeadSourcesReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const rows = report?.rows ?? []
  const totals = report?.totals ?? {
    newLeads: 0, calls: 0, emails: 0, texts: 0, notes: 0, tasksCompleted: 0, appointments: 0,
  }
  const previousTotals = report?.previousTotals ?? { ...totals }
  const timeSeries = report?.timeSeries ?? []
  const prevTimeSeries = report?.prevTimeSeries ?? []
  const prevDateStart = report?.prevDateStart ?? new Date().toISOString()
  const prevDateEnd = report?.prevDateEnd ?? new Date().toISOString()

  // Which metrics to show in the per-source grid (visible + within LS_COL_KEYS)
  const visibleLsCols = visibleCols.filter((k): k is ColKey => LS_COL_KEYS.includes(k as ColKey))

  const nowMs = Date.now()
  const refreshHref = `/admin/crm/reporting/lead-sources?broker=${currentBroker}&date=${currentDate}&t=${nowMs}`

  const columns: ReportColumn[] = [
    { key: 'source', label: 'Source' },
    ...visibleLsCols.map((key) => ({
      key,
      label: TABLE_COL_LABELS[key] ?? key,
      numeric: true,
    })),
  ]

  const gridRows: ReportGridRow[] = rows.map((row) => {
    // Drill-through href for source name — filters People list by source
    const sourceParam = row.sourceKey ? encodeURIComponent(row.sourceKey) : '__unspecified__'
    const drillBase = `/admin/crm?source=${sourceParam}&date=${currentDate}`

    const metric = (key: ColKey): number =>
      key === 'new_leads'
        ? row.newLeads
        : key === 'calls'
          ? row.calls
          : key === 'emails'
            ? row.emails
            : key === 'texts'
              ? row.texts
              : key === 'notes'
                ? row.notes
                : key === 'tasks_completed'
                  ? row.tasksCompleted
                  : key === 'appointments'
                    ? row.appointments
                    : 0

    return {
      key: row.sourceName,
      cells: [
        <Link key="s" href={drillBase} style={{ color: 'var(--a-accent)' }}>
          {row.sourceName}
        </Link>,
        ...visibleLsCols.map((key) => {
          const value = metric(key)
          if (value === 0) {
            return (
              <span key={key} style={{ color: 'var(--a-text-2)' }}>
                0
              </span>
            )
          }
          return (
            <Link
              key={key}
              href={`${drillBase}&metric=${DRILL_METRIC[key]}`}
              style={{ color: 'var(--a-accent)' }}
            >
              {value.toLocaleString('en-US')}
            </Link>
          )
        }),
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingSubNav active="lead-sources" />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={report === null ? 'attention' : 'ok'}>
          {report === null ? (
            <>
              <b>The lead-source report could not be read.</b> Nothing below is a measurement.
            </>
          ) : (
            <>
              <b>
                {totals.newLeads.toLocaleString('en-US')} new{' '}
                {totals.newLeads === 1 ? 'lead' : 'leads'} from {rows.length}{' '}
                {rows.length === 1 ? 'source' : 'sources'}.
              </b>{' '}
              Every figure below opens the people it counts.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? <ReportError what="Lead sources" href={refreshHref} /> : null}

      {/* Control bar — superuser only, exactly as before the migration */}
      {isSuperuser ? (
        <div className="av2-rfilters">
          <LeadSourcesFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
            currentCols={currentCols}
            brokers={CRM_BROKERS.map((slug) => ({
              slug,
              label: CRM_BROKER_DISPLAY[slug],
            }))}
          />
        </div>
      ) : null}

      <ReportFreshness href={refreshHref} nowMs={nowMs} />

      <LeadSourcesKpiStrip
        totals={totals}
        previousTotals={previousTotals}
        timeSeries={timeSeries}
        visibleCols={visibleCols}
        currentBroker={currentBroker}
        currentDate={currentDate}
      />

      <SectionHead>Day by day</SectionHead>
      {/* Reuses AgentActivityChart — same TimeSeriesPoint type, same props */}
      <AgentActivityChart
        timeSeries={timeSeries}
        prevTimeSeries={prevTimeSeries}
        prevDateStart={prevDateStart}
        prevDateEnd={prevDateEnd}
      />

      <SectionHead>By source — the sources sending nothing sit at the bottom</SectionHead>
      <ReportGrid
        label="Lead sources by activity"
        columns={columns}
        template={`minmax(150px, 1.8fr) repeat(${visibleLsCols.length}, minmax(72px, 0.8fr))`}
        minWidth={200 + visibleLsCols.length * 92}
        rows={gridRows}
        empty={
          <>
            No lead reached us from any source in this window. Widen the date range above, or check{' '}
            <Link href="/admin/crm/settings/lead-flows" style={{ color: 'var(--a-accent)' }}>
              lead flows
            </Link>{' '}
            if you expected traffic.
          </>
        }
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Sorted by new leads, most first, then alphabetically. A source counts a lead when the
        contact was created in the window; the activity columns count what was logged against those
        contacts. Columns are chosen in the picker above.
      </p>
    </div>
  )
}
