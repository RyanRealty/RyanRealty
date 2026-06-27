/**
 * /admin/reports/lead-flow — end-to-end funnel report.
 *
 * Joins GA4 Data API (sessions, generate_lead events by lp_variant) with
 * Supabase (visits, marketing_assignments, valuation_requests, listing_inquiries,
 * cmas) to surface:
 *
 *   1. Hero metrics — 30-day sessions, total leads, assignment rate, CMAs out
 *   2. End-to-end funnel — visit → engaged → lead → broker assigned → CMA
 *   3. Wiring health by surface — for every lead surface in the codebase, show
 *      whether sessions, GA4 events, and marketing_assignments are aligned.
 *      A "wired" surface fires all three. A "silent" surface has sessions but
 *      no events or assignments — almost always a wiring bug.
 *   4. Top sources of identified leads — marketing_assignments grouped by
 *      source, with broker split
 *   5. Daily lead-creation timeline — assignments per day across 30 days
 *
 * Data layer notes:
 *   - GA4 lp_variant custom dimension was registered 2026-05-18 and is the
 *     primary pivot for per-LP attribution.
 *   - marketing_assignments is the canonical broker-attribution ledger
 *     (see docs/FUB_SELLER_WORKFLOW_2026-05-17.md §6).
 *   - listing_inquiries powers Path I (Schedule a showing / Ask a question
 *     from listing details).
 *   - When a surface shows 0 sessions in 30 days, "wiring gap" is suppressed
 *     because we cannot tell whether the wiring works until traffic arrives.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import DashboardSummaryStrip from '@/components/admin/DashboardSummaryStrip'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'
import { getGA4Summary, type GA4Summary } from '@/app/actions/ga4-report'
import { countCmasInRange } from '@/lib/data/sync/syncWrites'
import { DateRangePicker } from '@/app/admin/(protected)/analytics/_components/DateRangePicker'
import { resolveDateRange } from '@/app/admin/(protected)/analytics/_lib/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>
function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v
  return out
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  const pct = (numerator / denominator) * 100
  return `${pct.toFixed(1)}%`
}

function isoNDaysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error('Supabase service role not configured')
  }
  return createClient(url, key)
}

// ─── Lead-surface registry ────────────────────────────────────────────────
// Every code path that captures a lead. Used for the wiring-health table.
//
// `lp_variant` is the value the server-side fireLeadGenerated call writes to
// the GA4 event param of the same name. `assignment_source` is the value
// written to marketing_assignments.source by the canonical tagger or the
// inline ledger insert. `path_prefix` is the URL we match in the visits
// table to count raw landings on this surface.

type LeadSurface = {
  /** Short human label for the row. */
  label: string
  /** GA4 lp_variant param value. Used to pivot the GA4 lpFunnels report. */
  lp_variant: string
  /** marketing_assignments.source value written by the server action. */
  assignment_source: string | null
  /** URL path used in visits table matching. */
  path_prefix: string
  /** Notes column to surface caveats. */
  notes?: string
}

const LEAD_SURFACES: LeadSurface[] = [
  { label: 'Seller LP (gold)', lp_variant: 'seller-home-value', assignment_source: 'seller-lp', path_prefix: '/lp/seller-home-value' },
  { label: 'Buyer LP', lp_variant: 'buyer-listing-alerts', assignment_source: 'buyer-lp', path_prefix: '/lp/buyer-listing-alerts' },
  { label: 'Expired LP', lp_variant: 'expired-listing', assignment_source: 'expired-lp', path_prefix: '/lp/expired-listing' },
  { label: 'Heath CMA (Tetherow)', lp_variant: 'tetherow-heath-cma', assignment_source: 'cma-request', path_prefix: '/lp/tetherow/heath' },
  { label: 'Home valuation form', lp_variant: 'home-valuation', assignment_source: 'cma-request', path_prefix: '/home-valuation' },
  { label: 'Contact form', lp_variant: 'contact', assignment_source: 'contact-form', path_prefix: '/contact' },
  { label: 'Listing inquiry (showing/ask)', lp_variant: 'listing-detail', assignment_source: 'showings-request', path_prefix: '/listing/', notes: 'Also writes source=idx-registration for Ask-a-question.' },
  { label: 'Lead-landing (multi-LP)', lp_variant: 'lead-landing-seller', assignment_source: 'seller-lp', path_prefix: '/lp/', notes: 'Shared submit across all /lp/<area>/ pages.' },
  { label: 'Exit-intent popup', lp_variant: 'exit-intent', assignment_source: 'unknown', path_prefix: '/', notes: 'No dedicated URL; fires from anywhere.' },
  { label: 'Meta Lead Ads webhook', lp_variant: 'meta-leadgen-form', assignment_source: null, path_prefix: '/', notes: 'Server-to-server. No site session; uses fb_lead source naming.' },
]

// ─── Data types ───────────────────────────────────────────────────────────

type AssignmentRow = {
  audience: 'seller' | 'buyer'
  broker: 'matt' | 'rebecca' | 'paul'
  source: string | null
  tier: string | null
  assigned_at: string
  fub_person_id: number | null
}

type VisitsByPath = { path: string; visits: number; sessions: number }

type WiringStatus = 'wired' | 'silent' | 'untested' | 'meta-only'

type WiringRow = {
  surface: LeadSurface
  sessions: number
  ga4_events: number
  assignments: number
  status: WiringStatus
}

type DailySeries = { date: string; count: number }

// ─── Wiring classification ────────────────────────────────────────────────

function classifyWiring(sessions: number, ga4Events: number, assignments: number, surface: LeadSurface): WiringStatus {
  // The Meta lead-ads webhook is server-to-server. No site sessions exist.
  // Classify it by GA4 events only (the webhook fires fireGa4Event directly).
  if (surface.lp_variant === 'meta-leadgen-form') {
    return ga4Events > 0 ? 'wired' : 'meta-only'
  }

  if (sessions === 0 && ga4Events === 0 && assignments === 0) {
    return 'untested'
  }

  // If any session arrived but neither the event nor an assignment did, the
  // wiring is suspect.
  if (sessions > 0 && ga4Events === 0 && assignments === 0) {
    return 'silent'
  }

  return 'wired'
}

function statusBadgeVariant(s: WiringStatus): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (s) {
    case 'wired':
      return 'default'
    case 'silent':
      return 'destructive'
    case 'meta-only':
      return 'secondary'
    case 'untested':
    default:
      return 'outline'
  }
}

function statusLabel(s: WiringStatus): string {
  switch (s) {
    case 'wired':
      return 'Wired'
    case 'silent':
      return 'Silent (sessions but no events)'
    case 'meta-only':
      return 'Meta-only (server-to-server)'
    case 'untested':
      return 'No traffic yet'
  }
}

// ─── The async data content ───────────────────────────────────────────────

async function LeadFlowContent({ range }: { range: { startDate: string; endDate: string } }) {
  const cutoffIso = `${range.startDate}T00:00:00.000Z`
  const startDate = range.startDate
  const endDate = range.endDate
  const lookbackDays = Math.round((new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1
  const windowLabel = `${range.startDate} to ${range.endDate}`

  const supabase = getServiceSupabase()

  // Parallel fetch: GA4 + every Supabase table the dashboard needs.
  // `cmas` is read via the canonical DAL helper (countCmasInRange) so this
  // page respects the DAL-boundary rule. The other tables here are not in
  // the DAL-boundary banned list, so direct supabase.from() reads are
  // allowed for them today.
  const [
    ga4Result,
    assignmentsRes,
    valuationReqRes,
    listingInquiriesRes,
    cmaCount,
    visitsRes,
  ] = await Promise.all([
    getGA4Summary(startDate, endDate),
    supabase
      .from('marketing_assignments')
      .select('audience, broker, source, tier, assigned_at, fub_person_id')
      .gte('assigned_at', cutoffIso)
      .limit(5000),
    supabase
      .from('valuation_requests')
      .select('id, created_at, email, source_url')
      .gte('created_at', cutoffIso)
      .limit(5000),
    supabase
      .from('listing_inquiries')
      .select('id, created_at, type, listing_url')
      .gte('created_at', cutoffIso)
      .limit(5000),
    countCmasInRange({ fromIso: cutoffIso }),
    supabase
      .from('visits')
      .select('path')
      .gte('created_at', cutoffIso)
      .limit(20000),
  ])

  const ga4Ok = ga4Result.ok
  const ga4: GA4Summary | null = ga4Ok ? ga4Result.data : null
  const ga4Error = ga4Ok ? null : ga4Result.error

  const assignments: AssignmentRow[] = (assignmentsRes.data ?? []) as AssignmentRow[]
  const valuationCount = valuationReqRes.data?.length ?? 0
  const listingInquiries = listingInquiriesRes.data ?? []
  const listingInquiryCount = listingInquiries.length

  // Aggregate visits per path prefix.
  const visitsByPath: VisitsByPath[] = (() => {
    const tally = new Map<string, number>()
    for (const v of visitsRes.data ?? []) {
      const path = (v as { path: string }).path
      tally.set(path, (tally.get(path) ?? 0) + 1)
    }
    return Array.from(tally.entries()).map(([path, visits]) => ({ path, visits, sessions: visits }))
  })()

  // GA4 lp_variant event tallies (already split by lp_variant × event).
  const ga4EventsByLp = new Map<string, number>()
  if (ga4) {
    for (const row of ga4.lpFunnels) {
      if (!/generate_lead|listing_inquiry|home_valuation_cta_click/i.test(row.eventName)) continue
      ga4EventsByLp.set(row.lpVariant, (ga4EventsByLp.get(row.lpVariant) ?? 0) + row.eventCount)
    }
  }

  // marketing_assignments tallies by source.
  const assignmentsBySource = new Map<string, number>()
  for (const a of assignments) {
    const src = a.source ?? 'unspecified'
    assignmentsBySource.set(src, (assignmentsBySource.get(src) ?? 0) + 1)
  }

  // Sessions per surface = sum of visits whose path starts with the prefix.
  function sessionsForPrefix(prefix: string): number {
    let total = 0
    for (const row of visitsByPath) {
      if (row.path === prefix || row.path.startsWith(prefix)) total += row.visits
    }
    return total
  }

  const wiringRows: WiringRow[] = LEAD_SURFACES.map((surface) => {
    const sessions = surface.lp_variant === 'meta-leadgen-form' ? 0 : sessionsForPrefix(surface.path_prefix)
    const ga4_events = ga4EventsByLp.get(surface.lp_variant) ?? 0
    const assignments_count = surface.assignment_source ? assignmentsBySource.get(surface.assignment_source) ?? 0 : 0
    const status = classifyWiring(sessions, ga4_events, assignments_count, surface)
    return { surface, sessions, ga4_events, assignments: assignments_count, status }
  })

  // Broker split of assignments.
  const brokerSplit = new Map<string, number>()
  for (const a of assignments) {
    brokerSplit.set(a.broker, (brokerSplit.get(a.broker) ?? 0) + 1)
  }

  // Audience split.
  const audienceSplit = new Map<string, number>()
  for (const a of assignments) {
    audienceSplit.set(a.audience, (audienceSplit.get(a.audience) ?? 0) + 1)
  }

  // Daily timeline.
  const dailyTally = new Map<string, number>()
  for (const a of assignments) {
    const day = a.assigned_at.slice(0, 10)
    dailyTally.set(day, (dailyTally.get(day) ?? 0) + 1)
  }
  const dailySeries: DailySeries[] = []
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailySeries.push({ date: key, count: dailyTally.get(key) ?? 0 })
  }
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.count))

  // Funnel stage counts (best-effort: each stage uses the most authoritative source).
  const ga4Sessions = ga4?.sessions ?? 0
  const ga4LeadEvents = ga4?.totalLeadEvents ?? 0
  const totalAssignments = assignments.length
  const totalInquiries = valuationCount + listingInquiryCount  // form-level submits
  const conversionRate = ga4Sessions > 0 ? totalAssignments / ga4Sessions : 0

  return (
    <div className="space-y-6">
      {/* GA4 access warning if the service account call failed */}
      {!ga4Ok && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">
            GA4 Data API call failed: <code className="rounded bg-muted px-1">{ga4Error}</code>. Sessions and event counts will show as zero until the service account regains access. Supabase-side numbers (assignments, inquiries, CMAs) are still accurate.
          </AlertDescription>
        </Alert>
      )}

      {/* 1. Hero metrics */}
      <DashboardSummaryStrip
        stats={[
          { label: `Sessions (${windowLabel})`, value: formatInt(ga4Sessions), caption: 'GA4, all sources' },
          { label: `Lead events (${windowLabel})`, value: formatInt(ga4LeadEvents), caption: 'GA4 generate_lead + siblings' },
          { label: `Broker assignments (${windowLabel})`, value: formatInt(totalAssignments), caption: 'marketing_assignments rows' },
          { label: `CMAs created (${windowLabel})`, value: formatInt(cmaCount), caption: 'cmas table inserts' },
        ]}
      />

      {/* 2. End-to-end funnel */}
      <Card>
        <CardHeader>
          <CardTitle>End-to-end funnel ({windowLabel})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Visitor → engaged → form submit → broker assigned → CMA. Sessions and engagement come from GA4. Submits come from valuation_requests + listing_inquiries. Assignments and CMAs from Supabase canonical tables.
          </p>
        </CardHeader>
        <CardContent>
          <TableWithMobileCards
            rows={[
              { stage: 'Sessions', source: 'GA4', count: ga4Sessions, pct: '100%' },
              { stage: 'Form submits', source: 'valuation_requests + listing_inquiries', count: totalInquiries, pct: formatPct(totalInquiries, ga4Sessions) },
              { stage: 'Lead events fired', source: 'GA4 generate_lead', count: ga4LeadEvents, pct: formatPct(ga4LeadEvents, ga4Sessions) },
              { stage: 'Broker assignments', source: 'marketing_assignments', count: totalAssignments, pct: formatPct(totalAssignments, ga4Sessions) },
              { stage: 'CMAs created', source: 'cmas', count: cmaCount, pct: formatPct(cmaCount, ga4Sessions) },
            ]}
            cap={8}
            getRowKey={(r) => r.stage}
            columns={[
              { key: 'stage', header: 'Stage', className: 'whitespace-nowrap font-medium', cell: (r) => r.stage },
              { key: 'source', header: 'Source', className: 'whitespace-nowrap text-xs text-muted-foreground', cell: (r) => r.source },
              { key: 'count', header: 'Count', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.count) },
              { key: 'pct', header: 'vs sessions', className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', cell: (r) => r.pct },
            ]}
            renderCard={(r) => (
              <Card>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{r.stage}</span>
                    <span className="shrink-0 text-sm tabular-nums text-foreground">{formatInt(r.count)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{r.source}</span>
                    <span className="shrink-0 tabular-nums">{r.pct} of sessions</span>
                  </div>
                </CardContent>
              </Card>
            )}
            empty={<>No funnel data for {windowLabel}.</>}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Sessions-to-assignment conversion rate: <span className="font-medium text-foreground">{formatPct(totalAssignments, ga4Sessions)}</span>. Industry benchmark for real-estate sites with mixed paid + organic traffic is 0.5%–2%; below 0.3% usually means wiring gaps or page-friction issues, not traffic quality.
          </p>
        </CardContent>
      </Card>

      {/* 3. Wiring health by surface */}
      <Card>
        <CardHeader>
          <CardTitle>Wiring health by lead surface</CardTitle>
          <p className="text-xs text-muted-foreground">
            For each lead-capture surface in the codebase: how much traffic reached it (30d sessions to the URL prefix), how many GA4 generate_lead events fired tagged with that lp_variant, and how many marketing_assignments rows landed with that source. A surface marked silent has traffic but no events or assignments — typically a wiring regression to investigate.
          </p>
        </CardHeader>
        <CardContent>
          <TableWithMobileCards
            rows={wiringRows}
            cap={12}
            getRowKey={(row) => row.surface.lp_variant}
            columns={[
              { key: 'surface', header: 'Surface', className: 'font-medium', cell: (row) => row.surface.label },
              { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums', cell: (row) => formatInt(row.sessions) },
              { key: 'events', header: 'GA4 events', className: 'text-right tabular-nums', cell: (row) => formatInt(row.ga4_events) },
              { key: 'assignments', header: 'Assignments', className: 'text-right tabular-nums', cell: (row) => formatInt(row.assignments) },
              { key: 'status', header: 'Status', cell: (row) => <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge> },
              { key: 'notes', header: 'Notes', className: 'text-xs text-muted-foreground', cell: (row) => row.surface.notes ?? '' },
            ]}
            renderCard={(row) => (
              <Card>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-sm font-medium text-foreground">{row.surface.label}</span>
                    <Badge variant={statusBadgeVariant(row.status)} className="shrink-0">{statusLabel(row.status)}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>
                      <div className="uppercase tracking-wide">Sessions</div>
                      <div className="tabular-nums text-foreground">{formatInt(row.sessions)}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide">GA4 events</div>
                      <div className="tabular-nums text-foreground">{formatInt(row.ga4_events)}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wide">Assignments</div>
                      <div className="tabular-nums text-foreground">{formatInt(row.assignments)}</div>
                    </div>
                  </div>
                  {row.surface.notes ? (
                    <p className="text-xs text-muted-foreground">{row.surface.notes}</p>
                  ) : null}
                </CardContent>
              </Card>
            )}
            empty={<>No lead surfaces registered.</>}
          />
        </CardContent>
      </Card>

      {/* 4. Top GA4 lead sources (utm + medium) */}
      {ga4 && ga4.leadSources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top lead sources (GA4)</CardTitle>
            <p className="text-xs text-muted-foreground">
              source/medium attribution from GA4 for sessions that fired any generate_lead family event. Useful for paid-ad ROAS decisions.
            </p>
          </CardHeader>
          <CardContent>
            <TableWithMobileCards
              rows={ga4.leadSources}
              cap={10}
              getRowKey={(src) => src.sourceMedium}
              columns={[
                { key: 'src', header: 'Source / Medium', className: 'whitespace-nowrap text-xs', cell: (src) => src.sourceMedium },
                { key: 'events', header: 'Lead events', className: 'whitespace-nowrap text-right tabular-nums', cell: (src) => formatInt(src.leadEvents) },
                { key: 'users', header: 'Users', className: 'whitespace-nowrap text-right tabular-nums', cell: (src) => formatInt(src.users) },
              ]}
              renderCard={(src) => (
                <Card>
                  <CardContent className="space-y-1">
                    <p className="break-words text-xs font-medium text-foreground">{src.sourceMedium}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatInt(src.leadEvents)} lead events · {formatInt(src.users)} users</p>
                  </CardContent>
                </Card>
              )}
              empty={<>No GA4 lead sources for {windowLabel}.</>}
            />
          </CardContent>
        </Card>
      )}

      {/* 5. Broker + audience split of assignments */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assignments by broker ({windowLabel})</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWithMobileCards
              rows={Array.from(brokerSplit.entries()).sort((a, b) => b[1] - a[1]).map(([broker, count]) => ({ broker, count }))}
              cap={10}
              getRowKey={(r) => r.broker}
              columns={[
                { key: 'broker', header: 'Broker', className: 'whitespace-nowrap font-medium capitalize', cell: (r) => r.broker },
                { key: 'count', header: 'Count', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.count) },
                { key: 'share', header: 'Share', className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', cell: (r) => formatPct(r.count, totalAssignments) },
              ]}
              renderCard={(r) => (
                <Card>
                  <CardContent className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium capitalize text-foreground">{r.broker}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatInt(r.count)} · {formatPct(r.count, totalAssignments)}</span>
                  </CardContent>
                </Card>
              )}
              empty={<>No assignments in window.</>}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignments by audience ({windowLabel})</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWithMobileCards
              rows={Array.from(audienceSplit.entries()).sort((a, b) => b[1] - a[1]).map(([audience, count]) => ({ audience, count }))}
              cap={10}
              getRowKey={(r) => r.audience}
              columns={[
                { key: 'audience', header: 'Audience', className: 'whitespace-nowrap font-medium capitalize', cell: (r) => r.audience },
                { key: 'count', header: 'Count', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.count) },
                { key: 'share', header: 'Share', className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', cell: (r) => formatPct(r.count, totalAssignments) },
              ]}
              renderCard={(r) => (
                <Card>
                  <CardContent className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium capitalize text-foreground">{r.audience}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatInt(r.count)} · {formatPct(r.count, totalAssignments)}</span>
                  </CardContent>
                </Card>
              )}
              empty={<>No assignments in window.</>}
            />
          </CardContent>
        </Card>
      </div>

      {/* 6. Daily timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Daily assignments (last 14 days)</CardTitle>
          <p className="text-xs text-muted-foreground">
            One row per day, most recent first. Bar length is proportional to the busiest day in the 30-day window.
          </p>
        </CardHeader>
        <CardContent>
          {dailySeries.some((d) => d.count > 0) ? (
            <>
              <ul className="space-y-1 font-mono text-xs">
                {[...dailySeries].reverse().slice(0, 14).map((d) => {
                  const bars = Math.round((d.count / maxDaily) * 30)
                  return (
                    <li key={d.date} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-muted-foreground">{d.date}</span>
                      <span className="w-8 shrink-0 text-right tabular-nums text-foreground">{d.count}</span>
                      <span className="text-primary">{'█'.repeat(bars)}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground tabular-nums">Showing 14 of {dailySeries.length} days.</p>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No assignments recorded for {windowLabel}.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7. Top GA4 lead-event names */}
      {ga4 && ga4.topLeadEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top GA4 lead-event names ({windowLabel})</CardTitle>
            <p className="text-xs text-muted-foreground">
              How the generate_lead family events broke down by name. Use this to spot duplicate naming or events that should be consolidated.
            </p>
          </CardHeader>
          <CardContent>
            <TableWithMobileCards
              rows={ga4.topLeadEvents}
              cap={10}
              getRowKey={(ev) => ev.eventName}
              columns={[
                { key: 'name', header: 'Event name', className: 'whitespace-nowrap text-xs', cell: (ev) => ev.eventName },
                { key: 'count', header: 'Count', className: 'whitespace-nowrap text-right tabular-nums', cell: (ev) => formatInt(ev.eventCount) },
                { key: 'users', header: 'Users', className: 'whitespace-nowrap text-right tabular-nums', cell: (ev) => formatInt(ev.users) },
              ]}
              renderCard={(ev) => (
                <Card>
                  <CardContent className="space-y-1">
                    <p className="break-words text-xs font-medium text-foreground">{ev.eventName}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatInt(ev.eventCount)} events · {formatInt(ev.users)} users</p>
                  </CardContent>
                </Card>
              )}
              empty={<>No GA4 lead-event names for {windowLabel}.</>}
            />
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Doc panel */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Documentation:</strong>{' '}
          <Link href="/admin/reports" className="underline hover:no-underline">Back to Reports</Link>
          {' · '}
          <Link href="/admin/analytics/funnel-breakdown" className="underline hover:no-underline">Funnel breakdown (visitor_sessions)</Link>
          {' · '}
          <Link href="/admin/analytics/lp-leaderboard" className="underline hover:no-underline">LP leaderboard</Link>
        </p>
        <p>
          <strong className="text-foreground">Wiring helpers:</strong> <code className="rounded bg-muted px-1">lib/lead-tracking.ts</code> (fireLeadGenerated), <code className="rounded bg-muted px-1">lib/canonical-lead-tagger.ts</code> (canonicallyTagLead), <code className="rounded bg-muted px-1">lib/ga4-measurement-protocol.ts</code> (fireGa4Event).
        </p>
        <p>
          <strong className="text-foreground">Methodology:</strong> Sessions counted from GA4 Data API for the property the service account has access to. Lead events filtered to <code className="rounded bg-muted px-1">generate_lead</code>, <code className="rounded bg-muted px-1">listing_inquiry</code>, <code className="rounded bg-muted px-1">home_valuation_cta_click</code>, plus the legacy event names (<code className="rounded bg-muted px-1">contact_agent</code>, <code className="rounded bg-muted px-1">valuation_requested</code>, etc.). Assignments come from <code className="rounded bg-muted px-1">marketing_assignments</code> filtered on <code className="rounded bg-muted px-1">assigned_at &gt;= {range.startDate}</code>.
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function LeadFlowReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Lead-flow report</h1>
        <p className="text-sm text-muted-foreground">
          End-to-end visibility from GA4 session to broker-assigned lead. Joins GA4 Data API with the Supabase canonical tables (marketing_assignments, valuation_requests, listing_inquiries, cmas). Use the wiring-health section to spot lead surfaces with traffic but no recorded leads.
        </p>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LeadFlowContent range={range} />
      </Suspense>
    </div>
  )
}
