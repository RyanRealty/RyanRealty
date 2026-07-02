// @no-parity — internal admin surface
//
// INFERRED: No dedicated FUB frame exists for Contact Attempts as a standalone page.
// FUB surfaces this as a subview of Lead Sources
// (hub href: /admin/crm/reporting/lead-sources?view=attempts).
// Metric semantics — avg outbound contacts per lead by source — are inferred from
// FUB's documentation and the hub card copy. See getContactAttemptsReport.ts.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getContactAttemptsReport } from '@/lib/data/crm/getContactAttemptsReport'
import type { ContactAttemptsRow, ContactAttemptsTotals } from '@/lib/data/crm/getContactAttemptsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import ContactAttemptsFilters from './ContactAttemptsFilters'

export const metadata = { title: 'Contact Attempts | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Sub-nav tabs ───────────────────────────────────────────────────────────────
// Contact Attempts is inserted between Batch Emails and Appointments to
// keep lead-source and activity reports grouped together.
const REPORTING_TABS = [
  { label: 'Overview', href: '/admin/crm/reporting' },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity' },
  { label: 'Properties', href: '/admin/crm/reporting/properties' },
  { label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources' },
  { label: 'Calls', href: '/admin/crm/reporting/calls' },
  { label: 'Texts', href: '/admin/crm/reporting/texts' },
  { label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails' },
  { label: 'Contact Attempts', href: '/admin/crm/reporting/contact-attempts', active: true },
  { label: 'Marketing', href: '/admin/crm/reporting/marketing' },
  { label: 'Deals', href: '/admin/crm/reporting/deals' },
  { label: 'Appointments', href: '/admin/crm/reporting/appointments' },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals' },
] as const

// ── KPI tile — inline server component (no sparkline for this report) ──────────

function KpiTile({
  label,
  value,
  valueText,
  subLabel,
}: {
  label: string
  /** Numeric count (rendered large, toLocaleString). Pass null to use valueText. */
  value?: number | null
  /** Alternate display for computed strings (e.g. "4.8" for avg). */
  valueText?: string
  /** Sub-label line below the value. */
  subLabel?: string
}) {
  const display =
    valueText !== undefined
      ? valueText
      : value != null
        ? value.toLocaleString('en-US')
        : '0'

  return (
    <Card className="min-w-36 shrink-0 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-bold leading-none tabular-nums text-foreground">
        {display}
      </p>
      {subLabel ? (
        <p className="mt-1 text-xs text-muted-foreground">{subLabel}</p>
      ) : (
        <div className="mt-1 h-4" />
      )}
    </Card>
  )
}

// ── Search params ──────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  t?: string
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ContactAttemptsPage({
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

  // Fetch report data — failure returns null and renders the honest empty state
  const report = await getContactAttemptsReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const rows: ContactAttemptsRow[] = report?.rows ?? []
  const totals: ContactAttemptsTotals = report?.totals ?? {
    leads: 0,
    totalAttempts: 0,
    avgAttempts: 0,
  }
  const previousTotals: ContactAttemptsTotals = report?.previousTotals ?? {
    leads: 0,
    totalAttempts: 0,
    avgAttempts: 0,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* ── Sub-nav tab strip ── */}
      <div className="mb-6 flex items-center border-b border-border">
        <div className="no-scrollbar flex items-center gap-0 overflow-x-auto">
          {REPORTING_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                'active' in tab && tab.active
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

      {/* ── Header: "Show me" selector + filter bar ── */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show me</span>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-foreground">
              average contact attempts by lead source
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Filter controls — superuser only; non-superuser is broker-scoped via RBAC */}
        {isSuperuser ? (
          <ContactAttemptsFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
            brokers={CRM_BROKERS.map((slug) => ({
              slug,
              label: CRM_BROKER_DISPLAY[slug],
            }))}
          />
        ) : null}
      </div>

      {/* ── Cache notice + refresh ── */}
      <p className="mb-6 text-xs text-muted-foreground">
        Reporting results may be cached for up to 10 minutes.{' '}
        <Link
          href={`/admin/crm/reporting/contact-attempts?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* ── KPI tile strip ── */}
      {/*
        Three tiles match the three core metrics of this report:
          TOTAL LEADS      — leads with a lead_created event in period for scoped brokers
          TOTAL ATTEMPTS   — outbound contact events on those leads (call, voicemail, email, text)
          AVG / LEAD       — totalAttempts / leads; the headline metric FUB surfaces

        Sub-labels show the equivalent figure from the prior period for quick trend reading.
        No sparklines — the per-source table is the primary insight surface here.
      */}
      <div className="no-scrollbar mb-6 flex gap-3 overflow-x-auto pb-2">
        <KpiTile
          label="Total Leads"
          value={totals.leads}
          subLabel={
            previousTotals.leads > 0
              ? `vs ${previousTotals.leads.toLocaleString('en-US')} prior period`
              : undefined
          }
        />
        <KpiTile
          label="Total Attempts"
          value={totals.totalAttempts}
          subLabel={
            previousTotals.totalAttempts > 0
              ? `vs ${previousTotals.totalAttempts.toLocaleString('en-US')} prior period`
              : undefined
          }
        />
        <KpiTile
          label="Avg / Lead"
          valueText={totals.leads > 0 ? totals.avgAttempts.toFixed(1) : '—'}
          subLabel={
            previousTotals.leads > 0
              ? `vs ${previousTotals.avgAttempts.toFixed(1)} prior period`
              : undefined
          }
        />
      </div>

      {/* ── Per-source breakdown table ── */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-52">Source</TableHead>
              <TableHead className="text-right text-xs">Leads</TableHead>
              <TableHead className="text-right text-xs">
                Avg Attempts
                <span
                  className="ml-1 text-muted-foreground opacity-60"
                  title="Average outbound contact events per lead in this period. Includes calls, voicemails, emails, and texts logged by scoped brokers. Excludes automated drip sequences."
                >
                  ⓘ
                </span>
              </TableHead>
              <TableHead className="text-right text-xs">Total Attempts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No contact attempt data for this period.
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
                    {/* Source name — links to People list filtered by source */}
                    <TableCell>
                      <Link
                        href={drillHref}
                        className="text-sm text-primary hover:underline"
                      >
                        {row.sourceName}
                      </Link>
                    </TableCell>

                    {/* Leads count */}
                    <TableCell className="text-right">
                      {row.leads === 0 ? (
                        <span className="tabular-nums text-muted-foreground">0</span>
                      ) : (
                        <span className="tabular-nums text-foreground">
                          {row.leads.toLocaleString('en-US')}
                        </span>
                      )}
                    </TableCell>

                    {/* Avg attempts — em-dash when no leads (data unavailable placeholder) */}
                    <TableCell className="text-right">
                      {row.leads === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : row.avgAttempts === 0 ? (
                        <span className="tabular-nums text-muted-foreground">0.0</span>
                      ) : (
                        <span className="tabular-nums font-medium text-foreground">
                          {row.avgAttempts.toFixed(1)}
                        </span>
                      )}
                    </TableCell>

                    {/* Total attempts */}
                    <TableCell className="text-right">
                      {row.totalAttempts === 0 ? (
                        <span className="tabular-nums text-muted-foreground">0</span>
                      ) : (
                        <span className="tabular-nums text-foreground">
                          {row.totalAttempts.toLocaleString('en-US')}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Footer note ── */}
      <p className="mt-4 text-xs text-muted-foreground">
        Contact attempts include outbound calls, voicemails, emails, and texts logged by
        scoped brokers on leads created in the selected period. Automated drip sequences
        are excluded.
      </p>
    </div>
  )
}
