// @no-parity — internal admin surface
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getAgentActivityReport,
  type AgentActivityRow,
} from '@/lib/data/crm/getAgentActivityReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { parseColsParam, ALL_COL_KEYS, COL_LABELS, type ColKey } from '@/lib/crm/reporting-constants'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import AgentActivityFilters from './AgentActivityFilters'
import { AgentActivityChart } from './AgentActivityChart'
import { AgentActivityKpiStrip } from './AgentActivityKpiStrip'

export const metadata = { title: 'Agent Activity | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// --- Sub-nav tabs ---
const REPORTING_TABS = [
  { label: 'Overview', href: '/admin/crm/reporting', active: false },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity', active: true },
  { label: 'Properties', href: '/admin/crm/reporting/properties', active: false },
  { label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources', active: false },
  { label: 'Calls', href: '/admin/crm/reporting/calls', active: false },
  { label: 'Texts', href: '/admin/crm/reporting/texts', active: false },
  { label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails', active: false },
  { label: 'Marketing', href: '/admin/crm/reporting/marketing', active: false },
  { label: 'Deals', href: '/admin/crm/reporting/deals', active: false },
  { label: 'Appointments', href: '/admin/crm/reporting/appointments', active: false },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals', active: false },
]

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

// --- Numeric cell: non-zero = primary-colored link, zero = muted ---
function NumCell({ value, href }: { value: number; href?: string }) {
  if (value === 0) {
    return <span className="tabular-nums text-muted-foreground">0</span>
  }
  if (href) {
    return (
      <Link href={href} className="tabular-nums text-primary hover:underline">
        {value.toLocaleString('en-US')}
      </Link>
    )
  }
  return <span className="tabular-nums text-primary">{value.toLocaleString('en-US')}</span>
}

// --- Date range label ---
function dateLabel(preset: string, start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  const presets: Record<string, string> = {
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    this_year: 'This Year',
  }
  return presets[preset] ?? `${fmt(start)} – ${fmt(end)}`
}

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Sub-nav tab strip */}
      <div className="mb-6 flex items-center border-b border-border">
        <div className="no-scrollbar flex items-center gap-0 overflow-x-auto">
          {REPORTING_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                tab.active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto shrink-0 pb-0.5 pl-4">
          <Badge variant="outline" className="text-muted-foreground">
            ⓘ How Reporting works
          </Badge>
        </div>
      </div>

      {/* Header row: "Show me" selector + filter bar */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show me</span>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-foreground">
              {isDealsView
                ? 'which team member has closed the most deals'
                : 'total lead count and total agent activity'}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          {!isDealsView ? (
            <Link
              href={`/admin/crm/reporting/agent-activity?broker=${currentBroker}&date=${currentDate}&view=deals`}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Switch view →
            </Link>
          ) : (
            <Link
              href={`/admin/crm/reporting/agent-activity?broker=${currentBroker}&date=${currentDate}&view=activity`}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Switch view →
            </Link>
          )}
        </div>

        {/* Filter controls — client component (superuser only; others are scoped) */}
        {isSuperuser ? (
          <AgentActivityFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
            currentView={view}
            currentCols={currentCols}
            brokers={CRM_BROKERS.map((slug) => ({
              slug,
              label: CRM_BROKER_DISPLAY[slug],
            }))}
          />
        ) : null}
      </div>

      {/* Cache notice */}
      <p className="mb-6 text-xs text-muted-foreground">
        Reporting results may be cached for up to 10 minutes.{' '}
        <Link
          href={`/admin/crm/reporting/agent-activity?broker=${currentBroker}&date=${currentDate}&view=${view}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* ── Main view: Activity (default) ── */}
      {!isDealsView ? (
        <>
          {/* Time-series chart */}
          <AgentActivityChart
            timeSeries={timeSeries}
            prevTimeSeries={prevTimeSeries}
            prevDateStart={prevDateStart}
            prevDateEnd={prevDateEnd}
          />

          {/* KPI tile strip (with sparklines + column picker) */}
          <AgentActivityKpiStrip
            totals={totals}
            previousTotals={previousTotals}
            timeSeries={timeSeries}
            visibleCols={visibleCols}
            currentBroker={currentBroker}
            currentDate={currentDate}
            currentView={view}
          />

          {/* Agent breakdown table — no totals row (matching FUB f04 spec) */}
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-44">Name</TableHead>
                  {ALL_COL_KEYS.filter((k) => visibleCols.includes(k)).map((key) => (
                    <TableHead key={key} className="whitespace-pre-line text-right text-xs">
                      {COL_LABELS[key]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={1 + visibleCols.length}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No activity data for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
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
                    return (
                      <TableRow key={row.brokerSlug} className="hover:bg-muted/40">
                        {/* Agent name + avatar */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {row.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.avatarUrl}
                                alt=""
                                className="h-7 w-7 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                {row.brokerName.charAt(0)}
                              </span>
                            )}
                            <Link
                              href={drillBase}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {row.brokerName}
                            </Link>
                          </div>
                        </TableCell>
                        {ALL_COL_KEYS.filter((k) => visibleCols.includes(k)).map((key) => (
                          <TableCell key={key} className="text-right">
                            <NumCell
                              value={row[COL_TO_ROW_FIELD[key]] as number}
                              href={drillHrefs[key]}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : (
        /* ── Alternate view: Closed Deals by Agent ── */
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              Closed deals by agent — {dateLabel(datePreset, dateStart, dateEnd)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Deals in the Closed stage with a close_date in this period.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-48">Name</TableHead>
                <TableHead className="text-right">Closed Deals</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.brokerSlug} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.avatarUrl}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                          {row.brokerName.charAt(0)}
                        </span>
                      )}
                      <span className="text-sm font-medium text-foreground">{row.brokerName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    —
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    —
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No closed deals in this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
