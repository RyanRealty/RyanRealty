// @no-parity — admin-internal reporting surface, no public mockup contract.
/**
 * /admin/reports/lead-flow — end-to-end funnel report. Joins the GA4 Data API
 * (sessions, generate_lead by lp_variant) with Supabase (visitor_events,
 * crm_people, valuation_requests, listing_inquiries, cmas): hero metrics, the
 * visit→engaged→lead→CMA funnel, per-surface wiring health, leads by broker and
 * channel, and a daily lead timeline.
 *
 * 11C/11D: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
 * through @/components/admin/v2. Presentation only — no metric, date window,
 * filter default, sort order, unit or rounding moved. The full carryover
 * inventory and the three §0 truth corrections are in the commit that made
 * them; what follows is only what a future editor must not break.
 *
 * DO NOT BREAK:
 *   - `getLeadIntake` is the lead system of record since the CRM cutover
 *     (2026-06-24), inbound sources only. marketing_assignments is decommissioned.
 *   - A surface with 0 sessions in the window must NOT be called a wiring gap —
 *     you cannot tell whether wiring works until traffic arrives.
 *   - The timeline is the 14 most recent days OF THE SELECTED RANGE, and
 *     maxDaily is computed over that same range. Do not re-label either as a
 *     fixed 14- or 30-day window; that mismatch was a shipped defect.
 *   - A failed GA4 call must keep leading through ReportError. Four zeros
 *     styled as measurements is how this page used to report an outage.
 *   - No unsourced benchmark. An "industry benchmark of 0.5%–2%" lived here
 *     with nothing to trace it to, on the page spend is judged from (§0).
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
// Cached GA4 wrapper (React request-dedup + 15-min Supabase ga4_query_cache
// tier) — the raw getGA4Summary fires 9 GA4 runReport calls per request on
// this force-dynamic page. Same signature and result shape; errors pass
// through uncached so the ga4Ok/ga4Error banner keeps working.
import { getGA4SummaryCached as getGA4Summary } from '@/lib/ga4-cache'
import type { GA4Summary } from '@/app/actions/ga4-report'
import { countCmasInRange } from '@/lib/data/sync/syncWrites'
import { getLeadIntake } from '@/lib/data'
import { DateRangePicker } from '@/app/admin/(protected)/analytics/_components/DateRangePicker'
import { resolveDateRange } from '@/app/admin/(protected)/analytics/_lib/queries'
import {
  SectionHead,
  StateWord,
  VerdictLine,
  ReportGrid,
  ReportNumbers,
  ReportError,
  ReportSkeleton,
  type AdminState,
  type ReportColumn,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'
import { CAP_SOURCES, CAP_WIRING, CAP_SPLIT, CAP_EVENTS, CAP_DAYS, funnelColumns, wiringColumns, splitColumns, topLeadSourcesColumns, topLeadEventColumns } from './_columns'

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

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error('Supabase service role not configured')
  }
  return createClient(url, key)
}

const MUTED = { color: 'var(--a-text-2)' }
// A table name or event name is one unbreakable token; without this a 375px
// viewport gets PAGE-level horizontal scroll, which the acceptance bar forbids.
const CODE = { fontFamily: 'var(--a-font-mono)', overflowWrap: 'anywhere' as const }

// ─── Lead-surface registry ────────────────────────────────────────────────
// Every code path that captures a lead. Used for the wiring-health table.
//
// `lp_variant` is the value the server-side fireLeadGenerated call writes to
// the GA4 event param of the same name. `assignment_source` is the value
// written to crm_people.source by the canonical tagger or the inline ledger
// insert. `path_prefix` is the URL we match in the visitor_events table to
// count raw landings on this surface.

type LeadSurface = {
  /** Short human label for the row. */
  label: string
  /** GA4 lp_variant param value. Used to pivot the GA4 lpFunnels report. */
  lp_variant: string
  /** crm_people.source value written by the server action for this surface. */
  assignment_source: string | null
  /** URL path used in visitor_events matching. */
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

/**
 * Status is text + color, never color alone (WCAG 1.4.1). Only `silent` is
 * actionable, so only `silent` gets a loud color; "no traffic yet" and
 * "server-to-server" are facts about coverage, not faults, and read neutral.
 */
function statusTone(s: WiringStatus): AdminState {
  switch (s) {
    case 'wired':
      return 'ok'
    case 'silent':
      return 'down'
    default:
      return 'waiting'
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

async function LeadFlowContent({
  range,
  refreshHref,
}: {
  range: { startDate: string; endDate: string }
  refreshHref: string
}) {
  const cutoffIso = `${range.startDate}T00:00:00.000Z`
  // Honor the SELECTED end date for every CRM-side read, matching GA4. The
  // old code ran leads/CMAs/visits through now(), so a custom historical
  // range compared mismatched windows in the funnel and wiring tables.
  const untilIso = `${range.endDate}T23:59:59.999Z`
  const startDate = range.startDate
  const endDate = range.endDate
  const lookbackDays = Math.round((new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1
  const windowLabel = `${range.startDate} to ${range.endDate}`

  const supabase = getServiceSupabase()

  // visitor_events can exceed 1000 rows in a window, and PostgREST silently
  // caps a single response at 1000 regardless of .limit() — page with .range()
  // until a short read (same pattern as getLeadIntake).
  async function fetchAllVisitPaths(): Promise<Array<{ path: string }>> {
    const rows: Array<{ path: string }> = []
    const PAGE = 1000
    for (let from = 0; from < 200_000; from += PAGE) {
      // Repointed off the retired `visits` table to visitor_events (W1.5) — the
      // per-page-view source, so mid-session LP hits are counted (a session's
      // landing_page would miss them). page_url is a full URL; reduce it to a
      // path so the prefix matching below (row.path.startsWith('/lp/…')) works.
      const { data, error } = await supabase
        .from('visitor_events')
        .select('page_url')
        .gte('event_at', cutoffIso)
        .lte('event_at', untilIso)
        .order('event_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) break
      const page = (data ?? []) as Array<{ page_url: string | null }>
      for (const r of page) {
        const raw = r.page_url ?? ''
        let path = raw
        if (raw.startsWith('http')) { try { path = new URL(raw).pathname } catch { path = raw } }
        if (path) rows.push({ path })
      }
      if (page.length < PAGE) break
    }
    return rows
  }

  // Parallel fetch: GA4 + every Supabase table the dashboard needs.
  // `cmas` is read via the canonical DAL helper (countCmasInRange) so this
  // page respects the DAL-boundary rule. The other tables here are not in
  // the DAL-boundary banned list, so direct supabase.from() reads are
  // allowed for them today.
  const [
    ga4Result,
    intake,
    valuationReqRes,
    listingInquiriesRes,
    cmaCount,
    visitRows,
  ] = await Promise.all([
    getGA4Summary(startDate, endDate),
    // Day-granular ISO bounds match the analytics pages' rangeToIso exactly,
    // so both surfaces share one getLeadIntake cache entry per range (a
    // millisecond now() end bound forced a cache miss on every render).
    getLeadIntake({ startIso: `${range.startDate}T00:00:00Z`, endIso: `${range.endDate}T23:59:59Z` }),
    // Count-only reads: only the totals render, and { count:'exact',
    // head:true } returns the real COUNT(*) — a .limit(5000) row fetch is
    // silently capped at 1000 by PostgREST.
    supabase
      .from('valuation_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', cutoffIso)
      .lte('created_at', untilIso),
    supabase
      .from('listing_inquiries')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', cutoffIso)
      .lte('created_at', untilIso),
    countCmasInRange({ fromIso: cutoffIso, toIso: untilIso }),
    fetchAllVisitPaths(),
  ])

  const ga4Ok = ga4Result.ok
  const ga4: GA4Summary | null = ga4Ok ? ga4Result.data : null
  const ga4Error = ga4Ok ? null : ga4Result.error

  const valuationCount = valuationReqRes.count ?? 0
  const listingInquiryCount = listingInquiriesRes.count ?? 0

  // Aggregate visits per path prefix.
  const visitsByPath: VisitsByPath[] = (() => {
    const tally = new Map<string, number>()
    for (const v of visitRows) {
      tally.set(v.path, (tally.get(v.path) ?? 0) + 1)
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

  // CRM lead tallies by raw source (inbound/attributable only). Keyed by the
  // same source strings the surfaces write (seller-lp, buyer-lp, expired-lp, …).
  const assignmentsBySource = new Map<string, number>()
  for (const s of intake.bySource) {
    assignmentsBySource.set(s.source, s.count)
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

  // Broker split of inbound leads.
  const brokerSplit = new Map<string, number>()
  for (const b of intake.byBroker) brokerSplit.set(b.broker, b.count)

  // Channel split (replaces the old CRM audience split — channel is what we can
  // derive accurately from crm_people.source and it's more actionable).
  const channelSplit = new Map<string, number>()
  for (const c of intake.byChannel) {
    if (c.attributable) channelSplit.set(c.label, c.count)
  }

  // Daily timeline of inbound leads — anchored to the SELECTED end date, not
  // today, so a custom historical range charts its own days.
  const dailyTally = new Map<string, number>()
  for (const d of intake.byDay) dailyTally.set(d.date, d.inbound)
  const rangeEndMs = new Date(`${range.endDate}T00:00:00Z`).getTime()
  const dailySeries: DailySeries[] = []
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const d = new Date(rangeEndMs - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailySeries.push({ date: key, count: dailyTally.get(key) ?? 0 })
  }
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.count))

  // Funnel stage counts (best-effort: each stage uses the most authoritative source).
  const ga4Sessions = ga4?.sessions ?? 0
  const ga4LeadEvents = ga4?.totalLeadEvents ?? 0
  const totalAssignments = intake.inboundLeads
  const totalInquiries = valuationCount + listingInquiryCount  // form-level submits

  const heroFigures: ReportNumberItem[] = [
    { key: 'sessions', label: 'Sessions · GA4, all sources', value: formatInt(ga4Sessions) },
    { key: 'events', label: 'Lead events · GA4 generate_lead + siblings', value: formatInt(ga4LeadEvents) },
    { key: 'leads', label: 'Leads captured · crm_people, inbound sources', value: formatInt(totalAssignments) },
    { key: 'cmas', label: 'CMAs created · cmas table inserts', value: formatInt(cmaCount) },
  ]

  const funnelStages = [
    { stage: 'Sessions', source: 'GA4', count: ga4Sessions, pct: '100%' },
    { stage: 'Form submits', source: 'valuation_requests + listing_inquiries', count: totalInquiries, pct: formatPct(totalInquiries, ga4Sessions) },
    { stage: 'Lead events fired', source: 'GA4 generate_lead', count: ga4LeadEvents, pct: formatPct(ga4LeadEvents, ga4Sessions) },
    { stage: 'Leads captured (CRM)', source: 'crm_people, inbound sources', count: totalAssignments, pct: formatPct(totalAssignments, ga4Sessions) },
    { stage: 'CMAs created', source: 'cmas', count: cmaCount, pct: formatPct(cmaCount, ga4Sessions) },
  ]

  const funnelGrid: ReportGridRow[] = funnelStages.slice(0, 8).map((r) => ({
    key: r.stage,
    cells: [
      r.stage,
      <span key="s" style={MUTED}>{r.source}</span>,
      formatInt(r.count),
      <span key="p" style={MUTED}>{r.pct}</span>,
    ],
  }))

  const wiringGrid: ReportGridRow[] = wiringRows.slice(0, CAP_WIRING).map((row) => ({
    key: row.surface.lp_variant,
    cells: [
      row.surface.label,
      formatInt(row.sessions),
      formatInt(row.ga4_events),
      formatInt(row.assignments),
      <StateWord key="st" state={statusTone(row.status)}>{statusLabel(row.status)}</StateWord>,
      <span key="n" style={MUTED}>{row.surface.notes ?? ''}</span>,
    ],
  }))

  const brokerRows = Array.from(brokerSplit.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([broker, count]) => ({ broker, count }))
  const channelRows = Array.from(channelSplit.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([channel, count]) => ({ channel, count }))

  const brokerGrid: ReportGridRow[] = brokerRows.slice(0, CAP_SPLIT).map((r) => ({
    key: r.broker,
    cells: [
      <span key="b" style={{ textTransform: 'capitalize' }}>{r.broker}</span>,
      formatInt(r.count),
      <span key="s" style={MUTED}>{formatPct(r.count, totalAssignments)}</span>,
    ],
  }))

  const channelGrid: ReportGridRow[] = channelRows.slice(0, CAP_SPLIT).map((r) => ({
    key: r.channel,
    cells: [
      r.channel,
      formatInt(r.count),
      <span key="s" style={MUTED}>{formatPct(r.count, totalAssignments)}</span>,
    ],
  }))

  const timelineRows = [...dailySeries].reverse().slice(0, CAP_DAYS)

  return (
    <>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={ga4Ok ? 'ok' : 'attention'}>
          {ga4Ok ? (
            <>
              <b>
                {formatInt(totalAssignments)}{' '}
                {totalAssignments === 1 ? 'lead' : 'leads'} captured from{' '}
                {formatInt(ga4Sessions)} {ga4Sessions === 1 ? 'session' : 'sessions'}
              </b>{' '}
              over {windowLabel} — {formatPct(totalAssignments, ga4Sessions)} of sessions.
            </>
          ) : (
            <>
              <b>GA4 could not be read, so every session and event figure below is a zero.</b> The
              Supabase-side figures — leads, submits, CMAs — are still measurements.
            </>
          )}
        </VerdictLine>
      </div>

      {!ga4Ok ? (
        <>
          <ReportError what="The GA4 Data API" href={refreshHref} />
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
            The call returned:{' '}
            <code style={CODE}>{ga4Error}</code>. Sessions and
            event counts stay at zero until the service account regains access.
          </p>
        </>
      ) : null}

      <ReportNumbers items={heroFigures} />

      <SectionHead>End-to-end funnel · {windowLabel}</SectionHead>
      <ReportGrid
        label={`End-to-end funnel, ${windowLabel}`}
        columns={funnelColumns}
        template="minmax(150px, 1.2fr) minmax(200px, 2fr) minmax(84px, 0.7fr) minmax(90px, 0.7fr)"
        minWidth={640}
        rows={funnelGrid}
        empty={<>No funnel data for {windowLabel}.</>}
      />
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
        Visitor → engaged → form submit → broker assigned → CMA. Sessions and engagement come from
        GA4 (undercounts vs first-party — do not read as “traffic is dead”; primary volume is visitor_sessions, see MEASUREMENT_DUAL_SOURCE.md); submits from valuation_requests + listing_inquiries; leads and CMAs from the Supabase
        canonical tables. Sessions-to-lead conversion (vs GA4 only):{' '}
        <span style={{ color: 'var(--a-text)', fontVariantNumeric: 'tabular-nums' }}>
          {formatPct(totalAssignments, ga4Sessions)}
        </span>
        .
      </p>

      <SectionHead>Wiring health by lead surface</SectionHead>
      <ReportGrid
        label="Wiring health by lead surface"
        columns={wiringColumns}
        template="minmax(180px, 1.6fr) minmax(84px, 0.7fr) minmax(94px, 0.7fr) minmax(90px, 0.7fr) minmax(150px, 1.2fr) minmax(180px, 1.6fr)"
        minWidth={880}
        rows={wiringGrid}
        empty={<>No lead surfaces registered.</>}
      />
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
        Per surface: traffic that reached its URL prefix, GA4 generate_lead events tagged with its
        lp_variant, and CRM leads carrying its source. A surface reads Silent when traffic arrived
        but neither an event nor a lead did — that is the wiring regression to chase. A surface
        with no traffic is not judged.
      </p>

      {ga4 && ga4.leadSources.length > 0 ? (
        <>
          <SectionHead>Top lead sources (GA4)</SectionHead>
          <ReportGrid
            label="Top lead sources from GA4"
            columns={topLeadSourcesColumns}
            template="minmax(200px, 2fr) minmax(100px, 0.8fr) minmax(80px, 0.7fr)"
            minWidth={460}
            rows={ga4.leadSources.slice(0, CAP_SOURCES).map((src) => ({
              key: src.sourceMedium,
              cells: [src.sourceMedium, formatInt(src.leadEvents), formatInt(src.users)],
            }))}
            empty={<>No GA4 lead sources for {windowLabel}.</>}
          />
          {ga4.leadSources.length > CAP_SOURCES ? (
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', fontVariantNumeric: 'tabular-nums', marginTop: 10 }}>
              Showing {CAP_SOURCES} of {ga4.leadSources.length}.
            </p>
          ) : null}
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
            source/medium attribution from GA4 for sessions that fired any generate_lead family
            event.
          </p>
        </>
      ) : null}

      <SectionHead>Leads by broker · {windowLabel}</SectionHead>
      <ReportGrid
        label={`Inbound leads by broker, ${windowLabel}`}
        columns={splitColumns('Broker')}
        template="minmax(160px, 2fr) minmax(80px, 0.7fr) minmax(80px, 0.7fr)"
        minWidth={360}
        rows={brokerGrid}
        empty={<>No leads in window.</>}
      />

      <SectionHead>Leads by channel · {windowLabel}</SectionHead>
      <ReportGrid
        label={`Inbound leads by channel, ${windowLabel}`}
        columns={splitColumns('Channel')}
        template="minmax(160px, 2fr) minmax(80px, 0.7fr) minmax(80px, 0.7fr)"
        minWidth={360}
        rows={channelGrid}
        empty={<>No leads in window.</>}
      />
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
        Both lists are ordered by count, most first. Share is against the{' '}
        {formatInt(totalAssignments)} inbound {totalAssignments === 1 ? 'lead' : 'leads'} in the
        window.
      </p>

      <SectionHead>Daily leads — the {CAP_DAYS} most recent days in the window</SectionHead>
      {dailySeries.some((d) => d.count > 0) ? (
        <>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              fontFamily: 'var(--a-font-mono)',
              fontSize: 'var(--a-text-xs)',
            }}
          >
            {timelineRows.map((d) => {
              const bars = Math.round((d.count / maxDaily) * 30)
              return (
                <li key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 0' }}>
                  <span style={{ width: 96, flexShrink: 0, color: 'var(--a-text-2)' }}>{d.date}</span>
                  <span style={{ width: 32, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {d.count}
                  </span>
                  <span style={{ color: 'var(--a-accent)', overflow: 'hidden' }}>{'█'.repeat(bars)}</span>
                </li>
              )
            })}
          </ul>
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', fontVariantNumeric: 'tabular-nums', marginTop: 10 }}>
            Showing {timelineRows.length} of {dailySeries.length} days, most recent first. Bar
            length is proportional to the busiest day in the selected window ({maxDaily}).
          </p>
        </>
      ) : (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
          No inbound lead was recorded for {windowLabel}.
        </p>
      )}

      {ga4 && ga4.topLeadEvents.length > 0 ? (
        <>
          <SectionHead>Top GA4 lead-event names · {windowLabel}</SectionHead>
          <ReportGrid
            label={`Top GA4 lead-event names, ${windowLabel}`}
            columns={topLeadEventColumns}
            template="minmax(200px, 2fr) minmax(80px, 0.7fr) minmax(80px, 0.7fr)"
            minWidth={420}
            rows={ga4.topLeadEvents.slice(0, CAP_EVENTS).map((ev) => ({
              key: ev.eventName,
              cells: [ev.eventName, formatInt(ev.eventCount), formatInt(ev.users)],
            }))}
            empty={<>No GA4 lead-event names for {windowLabel}.</>}
          />
          {ga4.topLeadEvents.length > CAP_EVENTS ? (
            <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', fontVariantNumeric: 'tabular-nums', marginTop: 10 }}>
              Showing {CAP_EVENTS} of {ga4.topLeadEvents.length}.
            </p>
          ) : null}
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
            How the generate_lead family broke down by name — use it to spot duplicate naming.
          </p>
        </>
      ) : null}

      <SectionHead>Where these numbers come from</SectionHead>
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 10px' }}>
        Sessions from the GA4 Data API for the property the service account can reach. Lead events
        filtered to <code style={CODE}>generate_lead</code>,{' '}
        <code style={CODE}>listing_inquiry</code>,{' '}
        <code style={CODE}>home_valuation_cta_click</code> and the
        legacy names. Leads from{' '}
        <code style={CODE}>crm_people</code> via{' '}
        <code style={CODE}>getLeadIntake</code>, inbound sources
        only, created {range.startDate} to {range.endDate} inclusive. Wiring helpers:{' '}
        <code style={CODE}>lib/lead-tracking.ts</code>,{' '}
        <code style={CODE}>lib/canonical-lead-tagger.ts</code>,{' '}
        <code style={CODE}>lib/ga4-measurement-protocol.ts</code>.
      </p>
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: 0 }}>
        <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>Back to Performance</Link>
        {' · '}
        <Link href="/admin/analytics/funnel-breakdown" style={{ color: 'var(--a-accent)' }}>
          Funnel breakdown (visitor_sessions)
        </Link>
        {' · '}
        <Link href="/admin/analytics/lp-leaderboard" style={{ color: 'var(--a-accent)' }}>
          LP leaderboard
        </Link>
      </p>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function LeadFlowReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)

  // Re-read the SAME window the reader is looking at, never a reset to 30d.
  const refreshParams = new URLSearchParams()
  if (sp.range) refreshParams.set('range', sp.range)
  if (sp.startDate) refreshParams.set('startDate', sp.startDate)
  if (sp.endDate) refreshParams.set('endDate', sp.endDate)
  refreshParams.set('t', String(Date.now()))
  const refreshHref = `/admin/reports/lead-flow?${refreshParams.toString()}`

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <div className="av2-rfilters">
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </div>

      <Suspense fallback={<ReportSkeleton />}>
        <LeadFlowContent range={range} refreshHref={refreshHref} />
      </Suspense>
    </div>
  )
}
