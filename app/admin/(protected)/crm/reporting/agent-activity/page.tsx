// @no-parity — internal admin surface
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getAgentActivityReport,
  type AgentActivityRow,
  type AgentActivityTotals,
} from '@/lib/data/crm/getAgentActivityReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
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

// --- KPI tile component ---
type KpiTileProps = {
  label: string
  value: number
  auxiliaryHref?: string
  auxiliaryLabel?: string
}

function KpiTile({ label, value, auxiliaryHref, auxiliaryLabel }: KpiTileProps) {
  return (
    <Card className="min-w-36 shrink-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {auxiliaryHref && auxiliaryLabel ? (
          <Link href={auxiliaryHref} className="text-xs text-primary hover:underline">
            {auxiliaryLabel}
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
        {value.toLocaleString('en-US')}
      </p>
    </Card>
  )
}

// --- Numeric cell: non-zero = primary-colored, zero = muted ---
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

// --- Date range label for display ---
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

  // Broker filter: superusers can filter to any broker; restricted brokers see only themselves
  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const view = sp.view ?? 'activity'
  const isDealsView = view === 'deals'

  // Fetch report data
  const report = await getAgentActivityReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const rows: AgentActivityRow[] = report?.rows ?? []
  const totals: AgentActivityTotals = report?.totals ?? {
    newLeads: 0,
    initiallyAssignedLeads: 0,
    currentlyAssignedLeads: 0,
    calls: 0,
    emails: 0,
    texts: 0,
    notes: 0,
    tasksCompleted: 0,
    appointmentsSet: 0,
    appointments: 0,
  }
  const dateStart = report?.dateStart ?? new Date().toISOString()
  const dateEnd = report?.dateEnd ?? new Date().toISOString()

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Sub-nav tab strip */}
      <div className="mb-6 flex items-center border-b border-border">
        <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
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
        {/* "Show me" interactive title */}
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
          {/* View switcher */}
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
          {/* KPI tile strip */}
          <div className="mb-6 flex gap-3 overflow-x-auto no-scrollbar pb-2">
            <KpiTile label="NEW LEADS" value={totals.newLeads} />
            <KpiTile label="INITIALLY ASSIGNED LEADS" value={totals.initiallyAssignedLeads} />
            <KpiTile label="CURRENTLY ASSIGNED LEADS" value={totals.currentlyAssignedLeads} />
            <KpiTile
              label="CALLS"
              value={totals.calls}
              auxiliaryHref="/admin/crm/reporting/calls"
              auxiliaryLabel="Call Logs"
            />
            <KpiTile label="EMAILS" value={totals.emails} />
            <KpiTile label="TEXTS" value={totals.texts} />
            <KpiTile label="NOTES" value={totals.notes} />
            <KpiTile label="TASKS COMPLETED" value={totals.tasksCompleted} />
            <KpiTile label="APPOINTMENTS SET" value={totals.appointmentsSet} />
            <KpiTile label="APPOINTMENTS" value={totals.appointments} />
            {/* + Add Columns ghost card */}
            <Card className="flex min-w-36 shrink-0 cursor-pointer items-center justify-center border-dashed p-4 text-sm text-muted-foreground hover:text-foreground">
              + Add Columns
            </Card>
          </div>

          {/* Agent breakdown table */}
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-44">Name</TableHead>
                  <TableHead className="text-right">New Leads</TableHead>
                  <TableHead className="text-right">Initially Assigned</TableHead>
                  <TableHead className="text-right">Currently Assigned</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Emails</TableHead>
                  <TableHead className="text-right">Texts</TableHead>
                  <TableHead className="text-right">Notes</TableHead>
                  <TableHead className="text-right">Tasks Completed</TableHead>
                  <TableHead className="text-right">Appts Set</TableHead>
                  <TableHead className="text-right">Appointments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No activity data for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {rows.map((row) => {
                      const drillBase = `/admin/crm?broker=${row.brokerSlug}&date=${currentDate}`
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
                          <TableCell className="text-right">
                            <NumCell
                              value={row.newLeads}
                              href={`${drillBase}&metric=new_leads`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell
                              value={row.initiallyAssignedLeads}
                              href={`${drillBase}&metric=initially_assigned`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell
                              value={row.currentlyAssignedLeads}
                              href={`${drillBase}&metric=currently_assigned`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell value={row.calls} href={`${drillBase}&metric=calls`} />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell value={row.emails} href={`${drillBase}&metric=emails`} />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell value={row.texts} href={`${drillBase}&metric=texts`} />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell value={row.notes} href={`${drillBase}&metric=notes`} />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell
                              value={row.tasksCompleted}
                              href={`${drillBase}&metric=tasks`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell value={row.appointmentsSet} />
                          </TableCell>
                          <TableCell className="text-right">
                            <NumCell value={row.appointments} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {/* Totals row */}
                    <TableRow className="border-t-2 border-border bg-muted/30 font-semibold">
                      <TableCell className="text-sm text-muted-foreground">All agents</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.newLeads.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.initiallyAssignedLeads.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.currentlyAssignedLeads.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.calls.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.emails.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.texts.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.notes.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.tasksCompleted.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.appointmentsSet.toLocaleString('en-US')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.appointments.toLocaleString('en-US')}
                      </TableCell>
                    </TableRow>
                  </>
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
