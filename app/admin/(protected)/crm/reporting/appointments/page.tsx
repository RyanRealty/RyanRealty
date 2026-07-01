// @no-parity — internal admin surface
//
// INFERRED REPORT: No dedicated FUB screen was captured for the Appointments
// report. Layout and KPI set are inferred from the FUB hub description
// ("See a list of appointments & outcomes with details on lead source and agent.")
// + standard FUB Appointments report conventions (total / set / by-outcome KPIs
// + a detail table with date, person, agent, type, outcome, lead source).
//
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, ChevronDown } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getAppointmentsReport,
  type AppointmentRow,
  type AppointmentsTotals,
  type OutcomeBucket,
} from '@/lib/data/crm/getAppointmentsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { formatDate, formatDateTime as fmtDateTimeFn } from '@/lib/format/date'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import AppointmentsFilters from './AppointmentsFilters'

export const metadata = { title: 'Appointments | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Sub-nav tabs (Appointments is active) ────────────────────────────────────
const REPORTING_TABS = [
  { label: 'Overview', href: '/admin/crm/reporting', active: false },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity', active: false },
  { label: 'Properties', href: '/admin/crm/reporting/properties', active: false },
  { label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources', active: false },
  { label: 'Calls', href: '/admin/crm/reporting/calls', active: false },
  { label: 'Texts', href: '/admin/crm/reporting/texts', active: false },
  { label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails', active: false },
  { label: 'Marketing', href: '/admin/crm/reporting/marketing', active: false },
  { label: 'Deals', href: '/admin/crm/reporting/deals', active: false },
  { label: 'Appointments', href: '/admin/crm/reporting/appointments', active: true },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals', active: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an ISO datetime for display: "Jun 30, 2026" or "Jun 30, 2026, 2:00 PM" */
function formatAppointmentDate(iso: string, allDay: boolean): string {
  return allDay ? formatDate(iso) : fmtDateTimeFn(iso)
}

/** Delta arrow + value for KPI tiles. */
function renderDelta(current: number, previous: number): React.ReactNode {
  if (previous === 0) return null
  const diff = current - previous
  if (diff === 0) return <span className="text-xs text-muted-foreground">no change</span>
  const isUp = diff > 0
  return (
    <span className={cn('text-xs tabular-nums', isUp ? 'text-primary' : 'text-destructive')}>
      {isUp ? '↑' : '↓'} {Math.abs(diff)} vs prev
    </span>
  )
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

/**
 * Appointments KPI tile.
 * Follows the Calls report pattern: count large, optional delta sub-label,
 * no sparkline (the Appointments report has no time-series chart).
 */
function ApptKpiTile({
  label,
  value,
  delta,
}: {
  label: string
  value: number
  delta?: React.ReactNode
}) {
  return (
    <Card className="min-w-36 shrink-0 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-bold leading-none tabular-nums text-foreground">
        {value.toLocaleString('en-US')}
      </p>
      <div className="mt-1 h-4 leading-none">{delta ?? null}</div>
    </Card>
  )
}

// ── Page params ───────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AppointmentsReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)
  const isSuperuser = access.role === 'superuser'

  const datePreset = (sp.date ?? 'this_month') as string

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  // Fetch report data
  const report = await getAppointmentsReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const totals: AppointmentsTotals = report?.totals ?? {
    total: 0, set: 0, previousTotal: 0, previousSet: 0,
  }
  const rows: AppointmentRow[] = report?.rows ?? []
  const byOutcome: OutcomeBucket[] = report?.byOutcome ?? []

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
            <span className="font-medium text-primary underline underline-offset-2">
              appointment report
            </span>
            <ChevronDown className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* Filter controls — superuser only; non-superusers are broker-scoped */}
        {isSuperuser ? (
          <AppointmentsFilters
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
          href={`/admin/crm/reporting/appointments?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* ── KPI Tile strip ─────────────────────────────────────────────────────
        KPIs (inferred from FUB Appointments report conventions):
          APPOINTMENTS (total)  — crm_appointments, broker-scoped, start_at in range
          SET (has person)      — same WHERE person_id IS NOT NULL
          + per-outcome buckets — tally from the 500-row detail fetch

        Honest empty states:
          byOutcome buckets are absent when no outcome data exists (no guesses).
      */}
      <div className="no-scrollbar mb-6 flex gap-3 overflow-x-auto pb-2">
        <ApptKpiTile
          label="Appointments"
          value={totals.total}
          delta={renderDelta(totals.total, totals.previousTotal)}
        />
        <ApptKpiTile
          label="Set"
          value={totals.set}
          delta={renderDelta(totals.set, totals.previousSet)}
        />
        {byOutcome.map((bucket) => (
          <ApptKpiTile
            key={bucket.outcomeName}
            label={bucket.outcomeName}
            value={bucket.count}
          />
        ))}
      </div>

      {/* ── Appointments detail table ──────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-48 text-xs">Date / Time</TableHead>
              <TableHead className="text-xs">Person</TableHead>
              <TableHead className="text-xs">Agent</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Outcome</TableHead>
              <TableHead className="text-xs">Lead Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No appointments for this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  {/* Date / Time */}
                  <TableCell className="text-sm text-foreground tabular-nums">
                    {formatAppointmentDate(row.startAt, row.allDay)}
                  </TableCell>

                  {/* Person — link to CRM contact if available */}
                  <TableCell>
                    {row.personId ? (
                      <Link
                        href={`/admin/crm/${row.personId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {row.personName ?? `Person #${row.personId}`}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Agent */}
                  <TableCell className="text-sm text-foreground">
                    {row.brokerName}
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    {row.typeLabel ? (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {row.typeLabel}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Outcome */}
                  <TableCell>
                    {row.outcomeLabel ? (
                      <Badge variant="outline" className="text-xs font-normal">
                        {row.outcomeLabel}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Lead Source */}
                  <TableCell className="text-sm text-muted-foreground">
                    {row.leadSource ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {rows.length >= 500 ? (
          <div className="border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing the 500 most recent appointments. Narrow the date range to see
              earlier records.
            </p>
          </div>
        ) : null}
      </Card>

      {/* ── Calendar link ── */}
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          Schedule and manage appointments in the{' '}
          <Link href="/admin/crm?filter=appointments" className="text-primary hover:underline">
            CRM Calendar
          </Link>
          .
        </span>
      </div>
    </div>
  )
}
