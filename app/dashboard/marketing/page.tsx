/**
 * /dashboard/marketing — Marketing Brain dashboard.
 *
 * Admin-gate: mirrors the pattern in app/admin/(protected)/layout.tsx.
 * Uses getSession() + getAdminRoleForEmail() and redirects to /auth-error
 * if the user is not an admin.
 *
 * Data: reads from marketing_channel_daily, content_briefs, content_calendar,
 * marketing_decisions, and competitor_intel via Supabase service-role client.
 * All queries are server-side; no client JS required for this page.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { EmptyState } from './_components/EmptyState'

export const revalidate = 60

// ─── service-role client ────────────────────────────────────────────────────

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  return createClient(url, key)
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** ISO date N days ago (UTC, YYYY-MM-DD) */
function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Human-readable relative time from an ISO string */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

/** WoW delta display: value, sign, color */
function deltaInfo(current: number, prior: number) {
  if (prior === 0 && current === 0) return { label: '—', variant: 'outline' as const }
  if (prior === 0) return { label: `+${current.toFixed(0)}`, variant: 'default' as const }
  const pct = ((current - prior) / Math.abs(prior)) * 100
  const sign = pct >= 0 ? '+' : ''
  const label = `${sign}${pct.toFixed(0)}%`
  if (pct > 5) return { label, variant: 'soft-popular' as const }
  if (pct < -5) return { label, variant: 'destructive' as const }
  return { label, variant: 'outline' as const }
}

/** Freshness badge variant based on days since last data */
function freshnessBadge(dateStr: string | null): { variant: 'soft-popular' | 'soft-price-drop' | 'destructive'; label: string } {
  if (!dateStr) return { variant: 'destructive', label: 'No data' }
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days <= 2) return { variant: 'soft-popular', label: dateStr }
  if (days <= 7) return { variant: 'soft-price-drop', label: dateStr }
  return { variant: 'destructive', label: `${dateStr} (${days}d stale)` }
}

/** Format a number with commas and optional decimal */
function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

// ─── canonical channel list ─────────────────────────────────────────────────

const ALL_CHANNELS = [
  'meta_ads',
  'meta_page',
  'instagram',
  'ga4',
  'gsc',
  'fub',
  'youtube',
  'linkedin',
  'x',
  'tiktok',
  'gbp',
] as const

type Channel = (typeof ALL_CHANNELS)[number]

// ─── data fetching ───────────────────────────────────────────────────────────

interface ChannelFreshness {
  channel: Channel
  lastDate: string | null
}

interface MetricDelta {
  metric: string
  channel: string
  current7d: number
  prior7d: number
  absDelta: number
}

interface DecisionRow {
  id: string
  decided_at: string
  decision_type: string
  decision_summary: string
  reviewer: string
  final_decision: string
}

interface BriefStatusCount {
  status: string
  count: number
}

interface CalendarEntry {
  id: string
  platform: string
  scheduled_for: string
  status: string
  topic: string | null
}

interface CompetitorSummary {
  competitor: string
  rowCount: number
  latestDate: string
  sources: string[]
}

interface ActionCategoryRow {
  category: string                 // 'content' | 'site' | 'ops' | 'analyze' | 'comms'
  pending: number
  ready: number
  approved: number
  executed: number
  killed: number
}

interface AuditRunSummary {
  audit_id: string
  status: string
  started_at: string
  completed_at: string | null
  competitors_with_data: number
  posts_classified: number
  apify_cost_usd: number
  classifier_cost_usd: number
  findings_action_id: string | null
}

interface BlockerRow {
  label: string
  severity: 'high' | 'medium' | 'low'
  detail: string
}

async function fetchDashboardData() {
  const db = getServiceSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const d7 = daysAgo(7)
  const d14 = daysAgo(14)

  // 1. Channel freshness: latest date per channel
  const { data: freshnessRows } = await db
    .from('marketing_channel_daily')
    .select('channel, date')
    .order('date', { ascending: false })

  const channelLastDate: Map<string, string> = new Map()
  if (freshnessRows) {
    for (const r of freshnessRows) {
      if (!channelLastDate.has(r.channel)) {
        channelLastDate.set(r.channel, r.date)
      }
    }
  }

  const freshnessGrid: ChannelFreshness[] = ALL_CHANNELS.map((ch) => ({
    channel: ch,
    lastDate: channelLastDate.get(ch) ?? null,
  })).sort((a, b) => {
    if (!a.lastDate && !b.lastDate) return 0
    if (!a.lastDate) return 1
    if (!b.lastDate) return -1
    return b.lastDate.localeCompare(a.lastDate)
  })

  // 2. North star: qualified_seller_leads last 7d and prior 7d
  const { data: leadRows7 } = await db
    .from('marketing_channel_daily')
    .select('value')
    .eq('channel', 'fub')
    .eq('metric', 'qualified_seller_leads')
    .gte('date', d7)
    .lte('date', today)

  const { data: leadRowsPrior } = await db
    .from('marketing_channel_daily')
    .select('value')
    .eq('channel', 'fub')
    .eq('metric', 'qualified_seller_leads')
    .gte('date', d14)
    .lt('date', d7)

  const leads7d = (leadRows7 ?? []).reduce((s, r) => s + Number(r.value), 0)
  const leadsPrior = (leadRowsPrior ?? []).reduce((s, r) => s + Number(r.value), 0)

  // 3. Freshest timestamp overall
  const { data: freshestRow } = await db
    .from('marketing_channel_daily')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single()

  const freshestAt: string | null = freshestRow?.fetched_at ?? null

  // 4. Top metrics by absolute delta (15 rows)
  const { data: metrics7 } = await db
    .from('marketing_channel_daily')
    .select('metric, channel, value')
    .eq('scope', 'account')
    .gte('date', d7)
    .lte('date', today)

  const { data: metricsPrior } = await db
    .from('marketing_channel_daily')
    .select('metric, channel, value')
    .eq('scope', 'account')
    .gte('date', d14)
    .lt('date', d7)

  // Aggregate by (channel, metric)
  const agg7: Map<string, number> = new Map()
  for (const r of metrics7 ?? []) {
    const key = `${r.channel}::${r.metric}`
    agg7.set(key, (agg7.get(key) ?? 0) + Number(r.value))
  }
  const aggPrior: Map<string, number> = new Map()
  for (const r of metricsPrior ?? []) {
    const key = `${r.channel}::${r.metric}`
    aggPrior.set(key, (aggPrior.get(key) ?? 0) + Number(r.value))
  }

  const allKeys = new Set([...agg7.keys(), ...aggPrior.keys()])
  const deltas: MetricDelta[] = []
  for (const key of allKeys) {
    const [channel, metric] = key.split('::')
    const current7d = agg7.get(key) ?? 0
    const prior7d = aggPrior.get(key) ?? 0
    deltas.push({ metric, channel, current7d, prior7d, absDelta: Math.abs(current7d - prior7d) })
  }
  const topMetrics = deltas.sort((a, b) => b.absDelta - a.absDelta).slice(0, 15)

  // 5. Recent decisions
  const { data: decisionRows } = await db
    .from('marketing_decisions')
    .select('id, decided_at, decision_type, decision_summary, reviewer, final_decision')
    .order('decided_at', { ascending: false })
    .limit(20)

  const decisions: DecisionRow[] = (decisionRows ?? []).map((r) => ({
    id: r.id,
    decided_at: r.decided_at,
    decision_type: r.decision_type,
    decision_summary: r.decision_summary,
    reviewer: r.reviewer,
    final_decision: r.final_decision,
  }))

  // 6. Content pipeline: brief counts by status
  const { data: briefRows } = await db
    .from('content_briefs')
    .select('status')

  const statusCounts: Map<string, number> = new Map()
  for (const r of briefRows ?? []) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1)
  }
  const briefStatuses: BriefStatusCount[] = [
    'pending', 'in_production', 'ready', 'approved', 'executed', 'measured', 'killed',
  ].map((s) => ({ status: s, count: statusCounts.get(s) ?? 0 }))

  // 7. Next 5 calendar entries
  const { data: calRows } = await db
    .from('content_calendar')
    .select('id, platform, scheduled_for, status, content_briefs(topic)')
    .gte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(5)

  const calendarEntries: CalendarEntry[] = (calRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    platform: r.platform as string,
    scheduled_for: r.scheduled_for as string,
    status: r.status as string,
    topic: (r.content_briefs as { topic?: string } | null)?.topic ?? null,
  }))

  // 8. Competitor intel last 7d
  const { data: compRows } = await db
    .from('competitor_intel')
    .select('competitor, source, observation_date')
    .gte('observation_date', d7)
    .order('observation_date', { ascending: false })

  const compMap: Map<string, { count: number; latestDate: string; sources: Set<string> }> = new Map()
  for (const r of compRows ?? []) {
    const entry = compMap.get(r.competitor) ?? { count: 0, latestDate: r.observation_date, sources: new Set() }
    entry.count += 1
    if (r.observation_date > entry.latestDate) entry.latestDate = r.observation_date
    entry.sources.add(r.source)
    compMap.set(r.competitor, entry)
  }
  const competitors: CompetitorSummary[] = [...compMap.entries()].map(([competitor, data]) => ({
    competitor,
    rowCount: data.count,
    latestDate: data.latestDate,
    sources: [...data.sources],
  })).sort((a, b) => b.rowCount - a.rowCount)

  // 9. Action queue by category (pending/ready/approved/executed/killed by action_type prefix)
  const { data: actionRows } = await db
    .from('marketing_brain_actions')
    .select('action_type, status')

  const categoryMap: Map<string, ActionCategoryRow> = new Map()
  for (const r of actionRows ?? []) {
    const prefix = (r.action_type as string | null)?.split(':')[0] || 'legacy'
    const row = categoryMap.get(prefix) ?? {
      category: prefix, pending: 0, ready: 0, approved: 0, executed: 0, killed: 0,
    }
    const status = r.status as string
    if (status === 'pending') row.pending += 1
    else if (status === 'in_production' || status === 'ready') row.ready += 1
    else if (status === 'approved') row.approved += 1
    else if (status === 'executed' || status === 'measured') row.executed += 1
    else if (status === 'killed') row.killed += 1
    categoryMap.set(prefix, row)
  }
  const ORDER = ['content', 'site', 'ops', 'analyze', 'comms', 'legacy']
  const actionCategories: ActionCategoryRow[] = ORDER
    .map((c) => categoryMap.get(c))
    .filter((r): r is ActionCategoryRow => r !== undefined)

  // 10. Most recent audit run
  const { data: auditRunRow } = await db
    .from('audit_runs')
    .select('audit_id, status, started_at, completed_at, competitors_with_data, posts_classified, apify_cost_usd, classifier_cost_usd, findings_action_id')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const latestAuditRun: AuditRunSummary | null = auditRunRow
    ? {
        audit_id: auditRunRow.audit_id as string,
        status: auditRunRow.status as string,
        started_at: auditRunRow.started_at as string,
        completed_at: (auditRunRow.completed_at as string) ?? null,
        competitors_with_data: Number(auditRunRow.competitors_with_data ?? 0),
        posts_classified: Number(auditRunRow.posts_classified ?? 0),
        apify_cost_usd: Number(auditRunRow.apify_cost_usd ?? 0),
        classifier_cost_usd: Number(auditRunRow.classifier_cost_usd ?? 0),
        findings_action_id: (auditRunRow.findings_action_id as string) ?? null,
      }
    : null

  // 11. Voice failures in last 7d
  const { count: voiceFailures7d } = await db
    .from('marketing_decisions')
    .select('id', { count: 'exact', head: true })
    .eq('decision_type', 'voice_violation')
    .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())

  // 12. Operational blockers — derived, not stored
  const blockers: BlockerRow[] = []
  if (!process.env.ANTHROPIC_API_KEY) {
    blockers.push({
      label: 'ANTHROPIC_API_KEY missing',
      severity: 'high',
      detail: 'Audit classifier returns missing-key error on every call. Add to Vercel env to unblock audit-run.',
    })
  }
  // mail.ryan-realty.com unverified — read from Resend if possible; for now, surface as a known blocker
  blockers.push({
    label: 'Resend domain unverified',
    severity: 'medium',
    detail: 'mail.ryan-realty.com pending DNS verification. ops-email-send producer + email tier of daily digest blocked. See marketing_brain_skills/tools_registry/resend/SKILL.md.',
  })
  blockers.push({
    label: 'LinkedIn dev-app architecture pending',
    severity: 'medium',
    detail: 'Community Management API conflicts with Share-on-LinkedIn on the same app. LinkedIn analytics stays at 0 until Matt picks a path.',
  })

  return {
    freshestAt,
    leads7d,
    leadsPrior,
    freshnessGrid,
    topMetrics,
    decisions,
    briefStatuses,
    calendarEntries,
    competitors,
    actionCategories,
    latestAuditRun,
    voiceFailures7d: voiceFailures7d ?? 0,
    blockers,
  }
}

// ─── decision type → badge variant ──────────────────────────────────────────

function decisionTypeBadge(type: string) {
  if (type.includes('approved') || type === 'publish_approved') return 'soft-popular' as const
  if (type.includes('rejected') || type.includes('fail') || type.includes('violation')) return 'destructive' as const
  if (type.includes('anomaly') || type.includes('signal')) return 'soft-price-drop' as const
  if (type.includes('generated') || type.includes('started')) return 'soft-hot' as const
  return 'secondary' as const
}

function finalDecisionBadge(fd: string) {
  if (fd === 'approved' || fd === 'auto_applied') return 'soft-popular' as const
  if (fd === 'rejected') return 'destructive' as const
  if (fd === 'awaiting_review') return 'soft-price-drop' as const
  if (fd === 'modified') return 'soft-trending' as const
  return 'outline' as const
}

function calStatusBadge(status: string) {
  if (status === 'published' || status === 'measured') return 'soft-popular' as const
  if (status === 'failed') return 'destructive' as const
  if (status === 'ready') return 'soft-hot' as const
  if (status === 'rendering') return 'soft-trending' as const
  return 'outline' as const
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function MarketingBrainPage() {
  // Admin gate — mirrors app/admin/(protected)/layout.tsx
  const session = await getSession()
  if (!session?.user) {
    redirect('/auth-error?next=/dashboard/marketing')
  }
  const adminRole = await getAdminRoleForEmail(session.user.email)
  if (!adminRole) {
    redirect('/admin/access-denied')
  }

  const {
    freshestAt,
    leads7d,
    leadsPrior,
    freshnessGrid,
    topMetrics,
    decisions,
    briefStatuses,
    calendarEntries,
    competitors,
    actionCategories,
    latestAuditRun,
    voiceFailures7d,
    blockers,
  } = await fetchDashboardData()

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const leadsWow = deltaInfo(leads7d, leadsPrior)
  const hasAnyData = freshnessGrid.some((ch) => ch.lastDate !== null)

  const POPULATE_CMD =
    'curl -H "Authorization: Bearer $CRON_SECRET" "https://ryanrealty.vercel.app/api/cron/marketing-snapshot-ga4?startDate=2026-02-12&endDate=2026-05-12"'
  const COMP_CMD =
    'curl -H "Authorization: Bearer $CRON_SECRET" "https://ryanrealty.vercel.app/api/cron/marketing-snapshot-competitor?startDate=2026-05-05&endDate=2026-05-12"'
  const DECISIONS_CMD =
    'curl -H "Authorization: Bearer $CRON_SECRET" "https://ryanrealty.vercel.app/api/cron/marketing-brain-cycle"'

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Marketing Brain</h1>
          <p className="text-sm text-muted-foreground">
            What the brain sees today, {today}.
          </p>
        </div>
        {freshestAt ? (
          <Badge variant="outline" className="shrink-0 mt-1">
            Last ingest {relativeTime(freshestAt)}
          </Badge>
        ) : (
          <Badge variant="destructive" className="shrink-0 mt-1">
            No data yet
          </Badge>
        )}
      </div>

      {/* ── North star ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium text-muted-foreground">
            Qualified Seller Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leads7d === 0 && leadsPrior === 0 ? (
            <div className="space-y-3">
              <p className="text-4xl font-bold text-foreground">—</p>
              <EmptyState
                title="Awaiting first ingest"
                message="FUB snapshot has not run yet. Run the ingestor to populate qualified_seller_leads."
                command={POPULATE_CMD.replace('ga4', 'fub')}
              />
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold text-foreground">{fmt(leads7d)}</p>
              <div className="mb-1 space-y-0.5">
                <Badge variant={leadsWow.variant}>{leadsWow.label} WoW</Badge>
                <p className="text-xs text-muted-foreground">Last 7 days · prior 7d: {fmt(leadsPrior)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Channel freshness grid ───────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
          Channel freshness
        </h2>
        {!hasAnyData ? (
          <EmptyState
            title="Awaiting first ingest"
            message="No channels have data yet. Run any snapshot ingestor to start."
            command={POPULATE_CMD}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {freshnessGrid.map((ch) => {
              const fb = freshnessBadge(ch.lastDate)
              return (
                <Card key={ch.channel} className="p-3">
                  <p className="text-xs font-semibold text-foreground mb-1.5">
                    {ch.channel.toUpperCase().replace('_', ' ')}
                  </p>
                  <Badge variant={fb.variant} className="text-xs">
                    {fb.label}
                  </Badge>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Operational blockers ─────────────────────────────── */}
      {blockers.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
            Operational blockers
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {blockers.map((b) => (
              <Card key={b.label} className={cn(
                'p-3',
                b.severity === 'high' && 'border-destructive',
              )}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{b.label}</p>
                  <Badge variant={b.severity === 'high' ? 'destructive' : b.severity === 'medium' ? 'soft-price-drop' : 'outline'}>
                    {b.severity}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{b.detail}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* ── Action queue by category ─────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
          Action queue by category
        </h2>
        {actionCategories.length === 0 ? (
          <EmptyState
            title="Empty queue"
            message="No action rows yet. Run the weekly cycle to generate the first set of briefs."
            command={DECISIONS_CMD}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Ready</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead className="text-right">Executed</TableHead>
                <TableHead className="text-right">Killed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actionCategories.map((c) => (
                <TableRow key={c.category}>
                  <TableCell className="font-mono text-sm">{c.category}:*</TableCell>
                  <TableCell className="text-right">
                    {c.pending > 0 ? <Badge variant="soft-hot">{c.pending}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.ready > 0 ? <Badge variant="soft-trending">{c.ready}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.approved > 0 ? <Badge variant="soft-price-drop">{c.approved}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.executed > 0 ? <Badge variant="soft-popular">{c.executed}</Badge> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{c.killed > 0 ? c.killed : '0'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Categories: content (renders + posts), site (page edits via site-edit producer), ops (Meta Ads + FUB CRM mutations), analyze (anomaly drilldowns), comms (matt alerts + summaries). Legacy = pre-Item-3 rows.
        </p>
      </div>

      <Separator />

      {/* ── Audit run + voice failures ───────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Audit run */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">
              Most recent audit run
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!latestAuditRun ? (
              <div className="space-y-2">
                <p className="text-2xl font-semibold text-muted-foreground">No audit run yet</p>
                <p className="text-xs text-muted-foreground">
                  Trigger the first audit (cost-bearing). Set <code className="font-mono">ANTHROPIC_API_KEY</code> in Vercel env first.
                </p>
                <p className="font-mono text-[10px] text-muted-foreground break-all">
                  curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; &quot;https://ryanrealty.vercel.app/api/cron/marketing-audit-run?dryRun=true&quot;
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <p className="font-mono text-lg font-semibold text-foreground">{latestAuditRun.audit_id}</p>
                  <Badge variant={
                    latestAuditRun.status === 'published' ? 'soft-popular' :
                    latestAuditRun.status === 'killed' ? 'destructive' :
                    'soft-trending'
                  }>
                    {latestAuditRun.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Posts classified</p>
                    <p className="font-semibold">{fmt(latestAuditRun.posts_classified)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Competitors w/ data</p>
                    <p className="font-semibold">{latestAuditRun.competitors_with_data}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Apify cost</p>
                    <p className="font-semibold">${latestAuditRun.apify_cost_usd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Classifier cost</p>
                    <p className="font-semibold">${latestAuditRun.classifier_cost_usd.toFixed(2)}</p>
                  </div>
                </div>
                {latestAuditRun.findings_action_id && (
                  <p className="text-xs text-muted-foreground">
                    Findings action row: <span className="font-mono">{latestAuditRun.findings_action_id.slice(0, 8)}</span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice failures */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">
              Voice failures (last 7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-bold text-foreground">{voiceFailures7d}</p>
              <div className="mb-1 space-y-0.5">
                <Badge variant={voiceFailures7d > 0 ? 'soft-price-drop' : 'soft-popular'}>
                  {voiceFailures7d === 0 ? 'clean' : 'review'}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Briefs blocked by voice_guidelines.md §6
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Voice failures persist as marketing_decisions rows with decision_type=&apos;voice_violation&apos;. Review and rewrite or kill.
            </p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ── Top metrics table ────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
          Top metrics by WoW delta
        </h2>
        {topMetrics.length === 0 ? (
          <EmptyState
            title="Awaiting first ingest"
            message="Metric deltas will appear once at least two weeks of data are available."
            command={POPULATE_CMD}
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Last 7d</TableHead>
                  <TableHead className="text-right">Prior 7d</TableHead>
                  <TableHead>WoW</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topMetrics.map((row) => {
                  const d = deltaInfo(row.current7d, row.prior7d)
                  return (
                    <TableRow key={`${row.channel}::${row.metric}`}>
                      <TableCell className="font-mono text-xs">{row.metric}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {row.channel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.current7d, 1)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmt(row.prior7d, 1)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.variant}>{d.label}</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Separator />

      {/* ── Recent decisions ─────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
          Recent decisions
        </h2>
        {decisions.length === 0 ? (
          <EmptyState
            title="Awaiting first brain cycle"
            message="Decisions will appear once the marketing brain cycle has run."
            command={DECISIONS_CMD}
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {relativeTime(d.decided_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={decisionTypeBadge(d.decision_type)} className="text-xs">
                        {d.decision_type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-foreground">
                      {d.decision_summary}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.reviewer}</TableCell>
                    <TableCell>
                      <Badge variant={finalDecisionBadge(d.final_decision)} className="text-xs">
                        {d.final_decision.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Separator />

      {/* ── Content pipeline ─────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
          Content pipeline
        </h2>

        {/* Status bar */}
        {briefStatuses.every((s) => s.count === 0) ? (
          <EmptyState
            title="Awaiting first brief"
            message="No content briefs have been generated yet. Run the brain cycle to produce briefs."
            command={DECISIONS_CMD}
          />
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap gap-3">
                {briefStatuses.map((s) => (
                  <div key={s.status} className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        s.status === 'published' || s.status === 'measured'
                          ? 'soft-popular'
                          : s.status === 'killed'
                          ? 'destructive'
                          : s.status === 'ready'
                          ? 'soft-hot'
                          : s.status === 'in_production'
                          ? 'soft-trending'
                          : 'outline'
                      }
                    >
                      {s.count}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {calendarEntries.length === 0 ? (
              <EmptyState
                title="No upcoming scheduled items"
                message="Content calendar is empty. Schedule briefs to populate upcoming slots."
              />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Next 5 scheduled</CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calendarEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(e.scheduled_for).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {e.platform}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs text-sm text-foreground">
                          {e.topic ?? <span className="text-muted-foreground italic">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={calStatusBadge(e.status)} className="text-xs">
                            {e.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Competitor radar ─────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
          Competitor radar (last 7 days)
        </h2>
        {competitors.length === 0 ? (
          <EmptyState
            title="Awaiting first competitor scrape"
            message="No competitor observations in the last 7 days. Run the competitor scraper to populate."
            command={COMP_CMD}
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competitor</TableHead>
                  <TableHead className="text-right">Observations</TableHead>
                  <TableHead>Latest</TableHead>
                  <TableHead>Sources</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((c) => (
                  <TableRow key={c.competitor}>
                    <TableCell className="font-medium text-sm">
                      {c.competitor.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.rowCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.latestDate}</TableCell>
                    <TableCell>
                      <div className={cn('flex flex-wrap gap-1')}>
                        {c.sources.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  )
}
