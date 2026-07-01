// @no-parity — internal admin surface
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown, Trash2 } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getLeadSourcesReport } from '@/lib/data/crm/getLeadSourcesReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { ALL_COL_KEYS, type ColKey, LS_COL_KEYS } from '@/lib/crm/reporting-constants'
import { Button } from '@/components/ui/button'
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
import LeadSourcesFilters from './LeadSourcesFilters'
import { AgentActivityChart } from '../agent-activity/AgentActivityChart'
import { LeadSourcesKpiStrip } from './LeadSourcesKpiStrip'

export const metadata = { title: 'Lead Sources | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Sub-nav tabs (same list across all reporting pages; only active differs) ──
const REPORTING_TABS = [
  { label: 'Overview', href: '/admin/crm/reporting' },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity' },
  { label: 'Properties', href: '/admin/crm/reporting/properties' },
  { label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources', active: true },
  { label: 'Calls', href: '/admin/crm/reporting/calls' },
  { label: 'Texts', href: '/admin/crm/reporting/texts' },
  { label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails' },
  { label: 'Marketing', href: '/admin/crm/reporting/marketing' },
  { label: 'Deals', href: '/admin/crm/reporting/deals' },
  { label: 'Appointments', href: '/admin/crm/reporting/appointments' },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals' },
]

// ── Column set for Lead Sources (7 metrics, no initially/currently assigned) ──

function parseLsColsParam(raw: string | undefined): ColKey[] {
  if (!raw) return [...LS_COL_KEYS]
  const parts = raw.split(',').map((s) => s.trim()) as ColKey[]
  const valid = parts.filter((k) => (ALL_COL_KEYS as readonly string[]).includes(k))
  return valid.length > 0 ? valid : [...LS_COL_KEYS]
}

// ── Column header labels for the table (concise, multi-line OK) ──────────────
const TABLE_COL_LABELS: Partial<Record<ColKey, string>> = {
  new_leads: 'New Leads',
  calls: 'Calls',
  emails: 'Emails',
  texts: 'Texts',
  notes: 'Notes',
  tasks_completed: 'Tasks\nCompleted',
  appointments: 'Appointments',
}

// ── Numeric cell: non-zero = primary-colored link, zero = muted ───────────────
function NumCell({ value, href }: { value: number; href?: string }) {
  if (value === 0) return <span className="tabular-nums text-muted-foreground">0</span>
  if (href) {
    return (
      <Link href={href} className="tabular-nums text-primary hover:underline">
        {value.toLocaleString('en-US')}
      </Link>
    )
  }
  return <span className="tabular-nums text-primary">{value.toLocaleString('en-US')}</span>
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

  // Fetch report data
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

  // Which metrics to show in the per-source table (visible + within LS_COL_KEYS)
  const visibleLsCols = visibleCols.filter((k): k is ColKey => LS_COL_KEYS.includes(k as ColKey))

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
              total lead count and total activity by lead source
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Filter controls — client component (superuser only; others scoped) */}
        {isSuperuser ? (
          <LeadSourcesFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
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
          href={`/admin/crm/reporting/lead-sources?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* Time-series chart (reuses AgentActivityChart — same TimeSeriesPoint type) */}
      <AgentActivityChart
        timeSeries={timeSeries}
        prevTimeSeries={prevTimeSeries}
        prevDateStart={prevDateStart}
        prevDateEnd={prevDateEnd}
      />

      {/* KPI tile strip */}
      <LeadSourcesKpiStrip
        totals={totals}
        previousTotals={previousTotals}
        timeSeries={timeSeries}
        visibleCols={visibleCols}
        currentBroker={currentBroker}
        currentDate={currentDate}
      />

      {/* Lead Sources breakdown table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-52">Name</TableHead>
              {visibleLsCols.map((key) => (
                <TableHead key={key} className="whitespace-pre-line text-right text-xs">
                  {TABLE_COL_LABELS[key] ?? key}
                </TableHead>
              ))}
              {/* Actions column — trash icon, right-aligned */}
              <TableHead className="w-12 text-right text-xs text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2 + visibleLsCols.length}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No lead source data for this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                // Drill-through href for source name — filters People list by source
                const sourceParam = row.sourceKey
                  ? encodeURIComponent(row.sourceKey)
                  : '__unspecified__'
                const drillBase = `/admin/crm?source=${sourceParam}&date=${currentDate}`

                // Per-metric drill hrefs
                const drillHrefs: Partial<Record<ColKey, string>> = {
                  new_leads: `${drillBase}&metric=new_leads`,
                  calls: `${drillBase}&metric=calls`,
                  emails: `${drillBase}&metric=emails`,
                  texts: `${drillBase}&metric=texts`,
                  notes: `${drillBase}&metric=notes`,
                  tasks_completed: `${drillBase}&metric=tasks`,
                  appointments: `${drillBase}&metric=appointments`,
                }

                return (
                  <TableRow key={row.sourceName} className="hover:bg-muted/40">
                    {/* Source name — hyperlink matching FUB's blue link treatment */}
                    <TableCell>
                      <Link
                        href={drillBase}
                        className="text-sm text-primary hover:underline"
                      >
                        {row.sourceName}
                      </Link>
                    </TableCell>

                    {/* Metric columns */}
                    {visibleLsCols.map((key) => {
                      const val =
                        key === 'new_leads' ? row.newLeads
                        : key === 'calls' ? row.calls
                        : key === 'emails' ? row.emails
                        : key === 'texts' ? row.texts
                        : key === 'notes' ? row.notes
                        : key === 'tasks_completed' ? row.tasksCompleted
                        : key === 'appointments' ? row.appointments
                        : 0

                      return (
                        <TableCell key={key} className="text-right">
                          <NumCell value={val} href={drillHrefs[key]} />
                        </TableCell>
                      )
                    })}

                    {/* Actions — trash icon (V1: visible but non-functional; source label
                        deletion would require a FUB API call or crm_people bulk update) */}
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled
                        aria-label={`Delete source "${row.sourceName}"`}
                        title="Source deletion not yet available"
                        className="h-7 w-7 opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
