// @no-parity — internal admin surface
// INFERRED REPORT — see lib/data/crm/getSpeedToLeadReport.ts for the definition note.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getSpeedToLeadReport,
  type SpeedToLeadRow,
  type SpeedToLeadTotals,
} from '@/lib/data/crm/getSpeedToLeadReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { Badge } from '@/components/ui/badge'
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
import SpeedToLeadFilters from './SpeedToLeadFilters'

export const metadata = { title: 'Speed to Lead | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Sub-nav tabs (matches other reporting pages; Speed to Lead is active) ─────
const REPORTING_TABS = [
  { label: 'Overview', href: '/admin/crm/reporting' },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity' },
  { label: 'Properties', href: '/admin/crm/reporting/properties' },
  { label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources' },
  { label: 'Speed to Lead', href: '/admin/crm/reporting/speed-to-lead', active: true },
  { label: 'Calls', href: '/admin/crm/reporting/calls' },
  { label: 'Texts', href: '/admin/crm/reporting/texts' },
  { label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails' },
  { label: 'Marketing', href: '/admin/crm/reporting/marketing' },
  { label: 'Deals', href: '/admin/crm/reporting/deals' },
  { label: 'Appointments', href: '/admin/crm/reporting/appointments' },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals' },
]

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

// ── KPI Tile ──────────────────────────────────────────────────────────────────
//
// Matches the CallsKpiTile pattern: no sparkline (time metrics, not counts),
// text-formatted values for speed metrics, numeric for lead counts.

function KpiTile({
  label,
  value,
  valueText,
  subLabel,
}: {
  label: string
  value?: number | null
  /** Formatted string for duration/rate metrics instead of a count. */
  valueText?: string
  subLabel?: string
}) {
  return (
    <Card className="min-w-40 shrink-0 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-bold leading-none tabular-nums text-foreground">
        {valueText ?? (value != null ? value.toLocaleString('en-US') : '—')}
      </p>
      {subLabel ? (
        <p className="mt-1 text-xs text-muted-foreground">{subLabel}</p>
      ) : (
        <div className="mt-1 h-4" />
      )}
    </Card>
  )
}

// ── Elapsed cell: highlighted when fast, muted when missing ───────────────────

function ElapsedCell({ seconds }: { seconds: number | null }) {
  const text = formatElapsed(seconds)
  if (seconds === null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span
      className={cn(
        'tabular-nums',
        // Highlight sub-5-minute responses (under 300 seconds)
        seconds <= 300 ? 'font-semibold text-success' : 'text-foreground',
      )}
    >
      {text}
    </span>
  )
}

// ── Contacted rate cell ───────────────────────────────────────────────────────

function RateCell({ contacted, total }: { contacted: number; total: number }) {
  if (total === 0) return <span className="text-muted-foreground">—</span>
  const pct = Math.round((contacted / total) * 100)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="tabular-nums font-medium text-foreground">
        {contacted.toLocaleString('en-US')}
      </span>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  )
}

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

  // Contact rate (for KPI sub-label)
  const contactRatePct =
    totals.totalLeads > 0
      ? Math.round((totals.contactedLeads / totals.totalLeads) * 100)
      : null

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

      {/* Header row: "Show me" label + filter bar */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show me</span>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-foreground">
              speed to first contact by lead source
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {isSuperuser ? (
          <SpeedToLeadFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
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
          href={`/admin/crm/reporting/speed-to-lead?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* ── KPI Tile strip ── */}
      {/*
        Four tiles:
          TOTAL LEADS   — leads created in the selected period (from lead_created events)
          CONTACTED     — leads that received at least one outbound contact
          MEDIAN SPEED  — median elapsed time from lead_created → first contact
          AVG SPEED     — average elapsed time (right-skewed by outliers; median is more useful)

        INFERRED: No FUB reference frame. These four tiles mirror the most common
        Speed to Lead dashboard conventions in CRM reporting tools.
      */}
      <div className="no-scrollbar mb-6 flex gap-3 overflow-x-auto pb-2">
        <KpiTile
          label="Total Leads"
          value={totals.totalLeads}
          subLabel="in period"
        />
        <KpiTile
          label="Contacted"
          value={totals.contactedLeads}
          subLabel={
            contactRatePct !== null
              ? `${contactRatePct}% of leads`
              : undefined
          }
        />
        <KpiTile
          label="Median Speed"
          valueText={formatElapsed(totals.medianSeconds)}
          subLabel="to first contact"
        />
        <KpiTile
          label="Avg Speed"
          valueText={formatElapsed(totals.avgSeconds)}
          subLabel="to first contact"
        />
      </div>

      {/* ── Per-source breakdown table ── */}
      {/*
        Columns:
          Source          — lead source name (linked to people list filtered by source)
          Leads           — total leads from this source in the period
          Contacted       — leads contacted + contact rate %
          Median Speed    — median time to first outbound contact
          Avg Speed       — average time to first outbound contact

        Honest empty state: if no lead_created events exist in the period,
        the table shows a single "No data" row. The report never fabricates data.
      */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-52">Source</TableHead>
              <TableHead className="text-right text-xs">Leads</TableHead>
              <TableHead className="text-right text-xs">
                Contacted
                <span
                  className="ml-1 text-muted-foreground opacity-60"
                  title="Leads with at least one outbound call, email, or text after creation"
                >
                  ⓘ
                </span>
              </TableHead>
              <TableHead className="text-right text-xs whitespace-pre-line">
                Median{'\n'}Speed
              </TableHead>
              <TableHead className="text-right text-xs whitespace-pre-line">
                Avg{'\n'}Speed
                <span
                  className="ml-1 text-muted-foreground opacity-60"
                  title="Average is right-skewed by slow outliers; median is the more reliable signal"
                >
                  ⓘ
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No lead data for this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const sourceParam = row.sourceKey
                  ? encodeURIComponent(row.sourceKey)
                  : '__unspecified__'
                const drillHref = `/admin/crm?source=${sourceParam}&date=${currentDate}`

                return (
                  <TableRow key={row.sourceName} className="hover:bg-muted/40">
                    {/* Source name — links to People list filtered by this source */}
                    <TableCell>
                      <Link
                        href={drillHref}
                        className="text-sm text-primary hover:underline"
                      >
                        {row.sourceName}
                      </Link>
                    </TableCell>

                    {/* Total leads */}
                    <TableCell className="text-right">
                      {row.totalLeads === 0 ? (
                        <span className="tabular-nums text-muted-foreground">0</span>
                      ) : (
                        <span className="tabular-nums text-foreground">
                          {row.totalLeads.toLocaleString('en-US')}
                        </span>
                      )}
                    </TableCell>

                    {/* Contacted — count + rate % */}
                    <TableCell className="text-right">
                      <RateCell
                        contacted={row.contactedLeads}
                        total={row.totalLeads}
                      />
                    </TableCell>

                    {/* Median speed to first contact */}
                    <TableCell className="text-right">
                      <ElapsedCell seconds={row.medianSeconds} />
                    </TableCell>

                    {/* Average speed to first contact */}
                    <TableCell className="text-right">
                      <ElapsedCell seconds={row.avgSeconds} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Methodology note */}
      <p className="mt-4 text-xs text-muted-foreground">
        Speed to lead measures the time from when a lead is created to the first outbound
        call, email, or text sent to that person. Automated drip emails count as first contact.
        Leads not yet contacted show no speed value.
      </p>
    </div>
  )
}
