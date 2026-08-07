// @no-parity — internal admin surface
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only. Carried over verbatim: the getCrmAccess guard, the
// superuser/broker scoping (non-superusers are locked at the data layer AND in
// the UI), ?broker/?date/?view/?cols/?t handling, parseColsParam, the
// getAgentActivityReport call and its catch-to-null, every zero default, the
// per-metric drill hrefs, the column-totals row that only renders with more than
// one agent row, the closed-deals view and its commission rounding, and the
// ReportingTabStrip sub-nav.
//
// AgentActivityChart stays as it is: it is shared with the Lead Sources report,
// so it is not this unit's to restyle (it migrates with that page).
//
// One change the ADMIN_UI acceptance bar requires: in the closed-deals view the
// agent's name is now a door to that broker's people list, matching the activity
// view — dead text naming a linkable thing is a defect (bar item 3).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getAgentActivityReport,
  type AgentActivityRow,
} from '@/lib/data/crm/getAgentActivityReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { parseColsParam, ALL_COL_KEYS, COL_LABELS, type ColKey } from '@/lib/crm/reporting-constants'
import { formatDate } from '@/lib/format/date'
import {
  VerdictLine,
  SectionHead,
  ReportGrid,
  ReportFreshness,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import AgentActivityFilters from './AgentActivityFilters'
import ShowMeSelector from './ShowMeSelector'
import { AgentActivityChart } from './AgentActivityChart'
import { AgentActivityKpiStrip } from './AgentActivityKpiStrip'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Agent Activity | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// --- Map ColKey → AgentActivityRow field name ---
const COL_TO_ROW_FIELD: Record<ColKey, keyof AgentActivityRow> = {
  new_leads: 'newLeads',
  initially_assigned: 'initiallyAssignedLeads',
  currently_assigned: 'currentlyAssignedLeads',
  calls: 'calls',
  emails: 'emails',
  texts: 'texts',
  notes: 'notes',
  tasks_completed: 'tasksCompleted',
  appts_set: 'appointmentsSet',
  appointments: 'appointments',
}

// --- Numeric cell: non-zero = accent link, zero = quiet ---
function NumCell({ value, href }: { value: number; href?: string }) {
  if (value === 0) return <span style={{ color: 'var(--a-text-2)' }}>0</span>
  if (href) {
    return (
      <Link href={href} style={{ color: 'var(--a-accent)' }}>
        {value.toLocaleString('en-US')}
      </Link>
    )
  }
  return <span style={{ color: 'var(--a-accent)' }}>{value.toLocaleString('en-US')}</span>
}

// --- Agent identity cell: avatar + the name, always a door ---
function AgentName({
  name,
  avatarUrl,
  href,
}: {
  name: string
  avatarUrl: string | null
  href: string
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={24}
          height={24}
          style={{ width: 24, height: 24, flex: 'none', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            width: 24,
            height: 24,
            flex: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'var(--a-inset)',
            color: 'var(--a-text-2)',
            fontSize: 'var(--a-text-xs)',
            fontWeight: 600,
          }}
        >
          {name.charAt(0)}
        </span>
      )}
      <Link href={href} style={{ color: 'var(--a-accent)' }}>
        {name}
      </Link>
    </span>
  )
}

// --- Date range label ---
function dateLabel(preset: string, start: string, end: string): string {
  const fmt = (iso: string) => formatDate(iso)
  const presets: Record<string, string> = {
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    this_year: 'This Year',
  }
  return presets[preset] ?? `${fmt(start)} – ${fmt(end)}`
}

const DEALS_COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'closed', label: 'Closed deals', numeric: true },
  { key: 'commission', label: 'Commission', numeric: true },
]

type SearchParams = {
  broker?: string
  date?: string
  lead_type?: string
  view?: string
  cols?: string
  t?: string
}

export default async function AgentActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)

  // Parse filter params
  const datePreset = (sp.date ?? 'this_month') as
    | 'today'
    | 'this_week'
    | 'this_month'
    | 'this_year'
    | 'custom'
  const isSuperuser = access.role === 'superuser'

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const view = sp.view ?? 'activity'
  const isDealsView = view === 'deals'

  // Column visibility — from ?cols= param
  const visibleCols = parseColsParam(sp.cols)

  // Fetch report data
  const report = await getAgentActivityReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const rows: AgentActivityRow[] = report?.rows ?? []
  const closedDealRows = report?.closedDeals ?? []
  const totals = report?.totals ?? {
    newLeads: 0, initiallyAssignedLeads: 0, currentlyAssignedLeads: 0,
    calls: 0, emails: 0, texts: 0, notes: 0,
    tasksCompleted: 0, appointmentsSet: 0, appointments: 0,
  }
  const previousTotals = report?.previousTotals ?? { ...totals }
  const timeSeries = report?.timeSeries ?? []
  const prevTimeSeries = report?.prevTimeSeries ?? []
  const dateStart = report?.dateStart ?? new Date().toISOString()
  const dateEnd = report?.dateEnd ?? new Date().toISOString()
  const prevDateStart = report?.prevDateStart ?? dateStart
  const prevDateEnd = report?.prevDateEnd ?? dateEnd

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset
  const currentCols = sp.cols ?? undefined

  const nowMs = Date.now()
  const refreshHref = `/admin/crm/reporting/agent-activity?broker=${currentBroker}&date=${currentDate}&view=${view}&t=${nowMs}`

  const shownCols = ALL_COL_KEYS.filter((k) => visibleCols.includes(k))

  const activityColumns: ReportColumn[] = [
    { key: 'name', label: 'Name' },
    ...shownCols.map((key) => ({ key, label: COL_LABELS[key], numeric: true })),
  ]

  const activityRows: ReportGridRow[] = rows.map((row) => {
    const drillBase = `/admin/crm?broker=${row.brokerSlug}&date=${currentDate}`
    const drillHrefs: Partial<Record<ColKey, string>> = {
      new_leads: `${drillBase}&metric=new_leads`,
      initially_assigned: `${drillBase}&metric=initially_assigned`,
      currently_assigned: `${drillBase}&metric=currently_assigned`,
      calls: `${drillBase}&metric=calls`,
      emails: `${drillBase}&metric=emails`,
      texts: `${drillBase}&metric=texts`,
      notes: `${drillBase}&metric=notes`,
      tasks_completed: `${drillBase}&metric=tasks`,
    }
    return {
      key: row.brokerSlug,
      cells: [
        <AgentName key="n" name={row.brokerName} avatarUrl={row.avatarUrl} href={drillBase} />,
        ...shownCols.map((key) => (
          <NumCell
            key={key}
            value={row[COL_TO_ROW_FIELD[key]] as number}
            href={drillHrefs[key]}
          />
        )),
      ],
    }
  })

  // Column totals row (aggregate sum per column) — only with more than one agent
  if (rows.length > 1) {
    activityRows.push({
      key: '__total__',
      total: true,
      cells: [
        'Total',
        ...shownCols.map((key) =>
          (totals[COL_TO_ROW_FIELD[key] as keyof typeof totals] as number).toLocaleString(
            'en-US',
          ),
        ),
      ],
    })
  }

  const dealsRows: ReportGridRow[] = closedDealRows.map((row) => ({
    key: row.brokerSlug,
    cells: [
      <AgentName
        key="n"
        name={row.brokerName}
        avatarUrl={row.avatarUrl}
        href={`/admin/crm?broker=${row.brokerSlug}&date=${currentDate}`}
      />,
      <span key="c" style={{ color: row.closedDeals > 0 ? 'var(--a-text)' : 'var(--a-text-2)' }}>
        {row.closedDeals.toLocaleString('en-US')}
      </span>,
      <span key="m" style={{ color: row.commission > 0 ? 'var(--a-text)' : 'var(--a-text-2)' }}>
        ${Math.round(row.commission).toLocaleString('en-US')}
      </span>,
    ],
  }))

  const dealsTotal = closedDealRows.reduce((n, r) => n + r.closedDeals, 0)

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingTabStrip active="agent-activity" />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={(isDealsView ? dealsTotal : totals.newLeads) > 0 ? 'ok' : 'attention'}>
          {isDealsView ? (
            dealsTotal === 0 ? (
              <>
                <b>No deal closed in this period.</b> Switch the date range to look further
                back.
              </>
            ) : (
              <>
                <b>
                  {dealsTotal.toLocaleString('en-US')} deal
                  {dealsTotal === 1 ? '' : 's'} closed this period.
                </b>{' '}
                Ordered by closed count, most first.
              </>
            )
          ) : totals.newLeads === 0 ? (
            <>
              <b>No new lead in this period.</b> {totals.calls.toLocaleString('en-US')} calls,{' '}
              {totals.texts.toLocaleString('en-US')} texts and{' '}
              {totals.emails.toLocaleString('en-US')} emails still went out.
            </>
          ) : (
            <>
              <b>{totals.newLeads.toLocaleString('en-US')} new leads this period.</b>{' '}
              {totals.calls.toLocaleString('en-US')} calls,{' '}
              {totals.texts.toLocaleString('en-US')} texts,{' '}
              {totals.emails.toLocaleString('en-US')} emails across the team.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? <ReportError what="Agent activity" href={refreshHref} /> : null}

      <div className="av2-rfilters">
        <ShowMeSelector
          currentView={view}
          currentBroker={currentBroker}
          currentDate={currentDate}
          currentCols={currentCols}
        />

        {/* Date range for everyone; agent scope superuser-only */}
        <AgentActivityFilters
          currentBroker={currentBroker}
          currentDate={currentDate}
          currentView={view}
          currentCols={currentCols}
          isSuperuser={isSuperuser}
          lockedBrokerLabel={scope ? CRM_BROKER_DISPLAY[scope] : undefined}
          brokers={CRM_BROKERS.map((slug) => ({
            slug,
            label: CRM_BROKER_DISPLAY[slug],
          }))}
        />
      </div>

      <ReportFreshness href={refreshHref} nowMs={nowMs} />

      {!isDealsView ? (
        <>
          {/* Time-series chart — shared with the Lead Sources report, carried as-is */}
          <AgentActivityChart
            timeSeries={timeSeries}
            prevTimeSeries={prevTimeSeries}
            prevDateStart={prevDateStart}
            prevDateEnd={prevDateEnd}
          />

          <AgentActivityKpiStrip
            totals={totals}
            previousTotals={previousTotals}
            timeSeries={timeSeries}
            visibleCols={visibleCols}
            currentBroker={currentBroker}
            currentDate={currentDate}
            currentView={view}
          />

          <SectionHead>Per agent — {dateLabel(datePreset, dateStart, dateEnd)}</SectionHead>
          <ReportGrid
            label="Agent activity by agent"
            columns={activityColumns}
            template={`minmax(140px, 1.4fr) repeat(${shownCols.length}, minmax(78px, 1fr))`}
            minWidth={150 + shownCols.length * 88}
            rows={activityRows}
            empty={
              <>
                No agent logged activity in this period.{' '}
                <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
                  Open the people list
                </Link>{' '}
                or widen the date range above.
              </>
            }
          />
        </>
      ) : (
        <>
          <SectionHead>
            Closed deals by agent — {dateLabel(datePreset, dateStart, dateEnd)}
          </SectionHead>
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
            Deals in a closed stage with a close date in this period. Commission = stored deal
            commission.
          </p>
          <ReportGrid
            label="Closed deals by agent"
            columns={DEALS_COLUMNS}
            template="minmax(160px, 1.6fr) repeat(2, minmax(110px, 1fr))"
            minWidth={520}
            rows={dealsRows}
            empty={
              <>
                No closed deal in this period.{' '}
                <Link href="/admin/crm/deals" style={{ color: 'var(--a-accent)' }}>
                  Open the deal pipeline
                </Link>{' '}
                or widen the date range above.
              </>
            }
          />
        </>
      )}
    </div>
  )
}
