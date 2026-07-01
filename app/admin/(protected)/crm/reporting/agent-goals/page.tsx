// @no-parity — internal admin surface
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getAgentGoalsReport, type AgentGoalsRow } from '@/lib/data/crm/getAgentGoalsReport'
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
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { AgentGoalsYearSelect } from './AgentGoalsYearSelect'

export const metadata = { title: 'Agent Goals | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Sub-nav (shared pattern — Agent Goals marked active) ──────────────────────

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
  { label: 'Appointments', href: '/admin/crm/reporting/appointments', active: false },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals', active: true },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(dollars: number): string {
  if (dollars === 0) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(dollars)
}

function GoalProgress({ earned, goal }: { earned: number; goal: number | null }) {
  if (goal === null || goal === 0) {
    return <span className="tabular-nums text-muted-foreground">—</span>
  }
  const pct = Math.min(100, Math.round((earned / goal) * 100))
  return (
    <div className="flex min-w-32 items-center gap-2">
      <Progress value={pct} className="h-2 flex-1" />
      <span className="tabular-nums text-xs text-muted-foreground">{pct}%</span>
    </div>
  )
}

function AgentCell({ row }: { row: AgentGoalsRow }) {
  return (
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
      <span className="text-sm font-medium text-foreground">{row.brokerName}</span>
    </div>
  )
}

// ── Search params ─────────────────────────────────────────────────────────────

type SearchParams = {
  year?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AgentGoalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)

  const currentYear = (() => {
    const raw = parseInt(sp.year ?? '', 10)
    if (!isNaN(raw) && raw >= 2020 && raw <= 2030) return raw
    return new Date().getFullYear()
  })()

  // Goals report is always shown for the full roster (no per-agent filter —
  // matches FUB Screen 8 which has a year selector only, no agent filter).
  // For non-superusers, scope them to their own row only (broker sees their own).
  const brokerSlug = scope  // null = superuser sees everyone

  const report = await getAgentGoalsReport({ year: currentYear, brokerSlug }).catch(() => null)
  const rows: AgentGoalsRow[] = report?.rows ?? []

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

      {/* Header row: "{year} Goals" title + year selector */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-foreground">{currentYear} Goals</h1>
        {/* Year selector — top-right, matching FUB Screen 8 */}
        <AgentGoalsYearSelect currentYear={currentYear} />
      </div>

      {/* Cache notice */}
      <p className="mb-6 text-xs text-muted-foreground">
        Reporting results may be cached for up to 10 minutes.{' '}
        <Link
          href={`/admin/crm/reporting/agent-goals?year=${currentYear}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* No-goals-config notice — honest about V1 state */}
      <div className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Annual commission goals are not yet configured. Use the{' '}
          <span className="font-medium text-foreground">Set goal</span> link per agent to set
          a target once goal-setting is available.
        </p>
      </div>

      {/* Goals table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {/* Agent col — FUB shows ↑ indicating ascending sort on this col (V1: static) */}
              <TableHead className="w-48">
                Agent <span className="ml-0.5 text-muted-foreground">↑</span>
              </TableHead>
              <TableHead className="text-right">Closed Deals</TableHead>
              <TableHead className="text-right">Upcoming Deals</TableHead>
              <TableHead className="text-right">Commission Earned</TableHead>
              <TableHead className="text-right">Commission Goal</TableHead>
              <TableHead className="min-w-40">Goal Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No broker data available.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.brokerSlug} className="hover:bg-muted/40">
                  {/* Agent name + avatar */}
                  <TableCell>
                    <AgentCell row={row} />
                  </TableCell>

                  {/* Closed deals count */}
                  <TableCell className="text-right">
                    {row.closedDeals === 0 ? (
                      <span className="tabular-nums text-muted-foreground">0</span>
                    ) : (
                      <span className="tabular-nums text-primary">
                        {row.closedDeals.toLocaleString('en-US')}
                      </span>
                    )}
                  </TableCell>

                  {/* Upcoming (open pipeline) deals count */}
                  <TableCell className="text-right">
                    {row.upcomingDeals === 0 ? (
                      <span className="tabular-nums text-muted-foreground">0</span>
                    ) : (
                      <span className="tabular-nums text-primary">
                        {row.upcomingDeals.toLocaleString('en-US')}
                      </span>
                    )}
                  </TableCell>

                  {/* Commission earned (sum of commission_dollars on closed deals in year) */}
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        'tabular-nums',
                        row.commissionEarned === 0
                          ? 'text-muted-foreground'
                          : 'text-foreground',
                      )}
                    >
                      {fmtCurrency(row.commissionEarned)}
                    </span>
                  </TableCell>

                  {/* Commission goal — "Set goal" link when unset */}
                  <TableCell className="text-right">
                    {row.commissionGoal === null ? (
                      /* FUB uses an inline blue hyperlink for goal-setting.
                         Linking to a future settings route; placeholder for now. */
                      <Link
                        href={`/admin/crm/reporting/agent-goals/set-goal?broker=${row.brokerSlug}&year=${currentYear}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Set goal
                      </Link>
                    ) : (
                      <span className="tabular-nums text-foreground">
                        {fmtCurrency(row.commissionGoal)}
                      </span>
                    )}
                  </TableCell>

                  {/* Goal progress — progress bar when goal set, dash when not */}
                  <TableCell>
                    <GoalProgress
                      earned={row.commissionEarned}
                      goal={row.commissionGoal}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
