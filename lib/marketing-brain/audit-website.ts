/**
 * marketing-brain: audit-website
 *
 * Reads from public.marketing_channel_daily (ga4 + gsc + fub channels) and
 * produces a structured WebsiteAuditReport: traffic-source analysis, funnel
 * drop-off, top-page conversion, SEO signal, and a ranked opportunity list.
 *
 * Downstream: generate-briefs consumes WebsiteAuditReport.opportunities.
 * Upstream:   snapshot-channels writes the rows this module reads.
 *
 * All reads are from marketing_channel_daily. No direct GA4/GSC API calls.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Channel, Scope } from './snapshot'
import { RecommendedAction } from './diagnose'

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  _supabase = createClient(url, key)
  return _supabase
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function offsetDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A source-medium pair from GA4, e.g. 'google / organic', 'direct / none'. */
export interface TrafficSource {
  /** Raw scope_id from marketing_channel_daily, e.g. 'google / organic'. */
  source_medium: string
  sessions: number
  engaged_sessions: number
  lead_events: number
  /** Ratio of lead_events to sessions. null when sessions === 0. */
  lead_conversion_rate: number | null
  /**
   * "Qualified traffic" = engaged_sessions / sessions.
   * A source is qualified when its engagement rate is >= 50%.
   * Sessions from bots, referral spam, or zero-depth pageviews score low here.
   * Useful for ranking sources that send real, attentive visitors vs raw volume.
   */
  engagement_rate: number | null
  /** WoW session delta (absolute). null when prior-week data is missing. */
  sessions_wow_change: number | null
  /** 'growing' | 'flat' | 'declining' based on WoW session delta pct. */
  trend: 'growing' | 'flat' | 'declining'
}

export interface TrafficSourcesAnalysis {
  window_days: number
  as_of_date: string
  sources: TrafficSource[]
  /** Top 3 sources by sessions. */
  top_by_volume: string[]
  /** Top 3 sources by lead_conversion_rate among those with >= 20 sessions. */
  top_by_quality: string[]
  /** Sources with growing sessions WoW. */
  growing: string[]
  /** Sources losing sessions WoW. */
  declining: string[]
}

export interface FunnelStep {
  name: string
  value: number
  drop_off_rate: number | null // fraction lost vs previous step; null for top step
}

export interface FunnelAnalysis {
  window_days: number
  as_of_date: string
  steps: [
    FunnelStep & { name: 'sessions' },
    FunnelStep & { name: 'engaged_sessions' },
    FunnelStep & { name: 'lead_events' },
    FunnelStep & { name: 'qualified_seller_leads' },
  ]
  /** Worst single drop-off step name. */
  biggest_leak_step: string
  /** Drop-off fraction at the biggest leak step. */
  biggest_leak_rate: number | null
}

export interface PageMetrics {
  /** GA4 pagePath scope_id. */
  page_path: string
  sessions: number
  engaged_sessions: number
  lead_events: number
  /** lead_events / sessions. null when sessions === 0. */
  lead_conversion_rate: number | null
  /** Whether this page is flagged as a leak: high sessions, low conversion. */
  is_leak: boolean
}

export interface TopPagesAnalysis {
  window_days: number
  as_of_date: string
  /** Top 15 pages by sessions. */
  pages: PageMetrics[]
  /** Pages flagged as conversion leaks (high traffic, low conversion). */
  leaks: string[]
}

export interface SEOQuery {
  /** GSC query string. */
  query: string
  impressions: number
  clicks: number
  /** clicks / impressions. null when impressions === 0. */
  ctr: number | null
  /** Average position in search results. Lower is better. */
  avg_position: number | null
  /** Position delta vs the prior window (negative = improved). null when insufficient history. */
  position_delta: number | null
  /** Whether this query is flagged as an optimization candidate: high impressions, low CTR. */
  low_ctr_flag: boolean
}

export interface SEOPage {
  page_path: string
  impressions: number
  clicks: number
  ctr: number | null
  avg_position: number | null
  /** Flagged when impressions are in top 25% of the set but CTR is in bottom 25%. */
  low_ctr_flag: boolean
}

export interface SEOAnalysis {
  window_days: number
  as_of_date: string
  top_queries: SEOQuery[]
  top_pages: SEOPage[]
  /** Queries gaining position (position_delta < -1). */
  gaining_queries: string[]
  /** Queries losing position (position_delta > 1). */
  losing_queries: string[]
  /** Pages with top-quartile impressions but bottom-quartile CTR. */
  low_ctr_pages: string[]
}

export interface Opportunity {
  area: 'seo' | 'funnel' | 'traffic' | 'page'
  severity: 'high' | 'medium' | 'low'
  headline: string
  /** Numbers from the data that support this opportunity. */
  evidence: string
  recommended_action: RecommendedAction
}

/** Data availability flag for a single channel. */
export interface DataAvailabilityFlag {
  channel: Channel
  metric: string
  days_found: number
  required_days: number
}

export interface WebsiteAuditReport {
  as_of_date: string
  window_days: number
  /**
   * 'ok' when enough data exists for a meaningful audit.
   * 'insufficient_data' when fewer than 14 days of GA4 rows exist for the window.
   */
  status: 'ok' | 'insufficient_data'
  /** Populated only when status === 'insufficient_data'. */
  missing_data?: DataAvailabilityFlag[]
  traffic_sources?: TrafficSourcesAnalysis
  funnel?: FunnelAnalysis
  top_pages?: TopPagesAnalysis
  seo?: SEOAnalysis
  /** Ranked top opportunities (max 7). Empty when status === 'insufficient_data'. */
  opportunities: Opportunity[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MIN_GA4_DAYS = 14

/** Fetch all rows for given channels/scope in the window, keyed by scope_id. */
async function fetchMetricsByScope(
  channels: Channel[],
  scope: Scope,
  metrics: string[],
  startDate: string,
  endDate: string
): Promise<{ channel: Channel; scope_id: string; metric: string; value: number }[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('channel, scope_id, metric, value')
    .in('channel', channels)
    .eq('scope', scope)
    .in('metric', metrics)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(`fetchMetricsByScope: ${error.message}`)
  return (data ?? []) as { channel: Channel; scope_id: string; metric: string; value: number }[]
}

/** Sum a single metric across account scope for a channel+window. */
async function sumAccountMetric(
  channel: Channel,
  metric: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('value')
    .eq('channel', channel)
    .eq('scope', 'account')
    .eq('scope_id', '')
    .eq('metric', metric)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(`sumAccountMetric: ${error.message}`)
  return (data ?? []).reduce((acc, r) => acc + (r.value as number), 0)
}

/** Count distinct non-zero days for a channel/metric in the window. */
async function countNonZeroDays(
  channel: Channel,
  metric: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('date, value')
    .eq('channel', channel)
    .eq('metric', metric)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(`countNonZeroDays: ${error.message}`)
  return (data ?? []).filter((r) => (r.value as number) > 0).length
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null
  return ((current - prior) / prior) * 100
}

function trend(wow: number | null): 'growing' | 'flat' | 'declining' {
  if (wow === null) return 'flat'
  if (wow > 5) return 'growing'
  if (wow < -5) return 'declining'
  return 'flat'
}

// ---------------------------------------------------------------------------
// analyzeTrafficSources
// ---------------------------------------------------------------------------

/**
 * Analyzes GA4 source-medium rows from marketing_channel_daily (scope='source').
 *
 * Qualified traffic definition (applied inside this function):
 *   A source-medium is "qualified" when its engagement_rate (engaged_sessions /
 *   sessions) is >= 0.50 AND it has at least 20 sessions in the window. This
 *   filters out bot traffic, referral spam, and channels that bounce immediately.
 *   The top_by_quality ranking is restricted to qualified sources only.
 */
export async function analyzeTrafficSources(
  windowDays: number,
  asOfDate: string
): Promise<TrafficSourcesAnalysis> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))
  const priorStart = offsetDate(asOfDate, -(windowDays * 2 - 1))
  const priorEnd = offsetDate(asOfDate, -windowDays)

  const METRICS = ['sessions', 'engaged_sessions', 'lead_events']

  const [currentRows, priorRows] = await Promise.all([
    fetchMetricsByScope(['ga4', 'fub'], 'source', METRICS, startDate, asOfDate),
    fetchMetricsByScope(['ga4'], 'source', ['sessions'], priorStart, priorEnd),
  ])

  // Aggregate by source_medium for current window
  const current = new Map<string, { sessions: number; engaged_sessions: number; lead_events: number }>()
  for (const row of currentRows) {
    const key = row.scope_id
    const existing = current.get(key) ?? { sessions: 0, engaged_sessions: 0, lead_events: 0 }
    if (row.metric === 'sessions') existing.sessions += row.value
    if (row.metric === 'engaged_sessions') existing.engaged_sessions += row.value
    if (row.metric === 'lead_events') existing.lead_events += row.value
    current.set(key, existing)
  }

  // Aggregate prior sessions per source_medium
  const priorSessions = new Map<string, number>()
  for (const row of priorRows) {
    priorSessions.set(row.scope_id, (priorSessions.get(row.scope_id) ?? 0) + row.value)
  }

  const sources: TrafficSource[] = []
  for (const [sm, agg] of current) {
    const prior = priorSessions.get(sm) ?? null
    const wowChange = prior !== null ? agg.sessions - prior : null
    const wowPct = prior !== null ? pctChange(agg.sessions, prior) : null

    sources.push({
      source_medium: sm,
      sessions: agg.sessions,
      engaged_sessions: agg.engaged_sessions,
      lead_events: agg.lead_events,
      lead_conversion_rate: safeDivide(agg.lead_events, agg.sessions),
      engagement_rate: safeDivide(agg.engaged_sessions, agg.sessions),
      sessions_wow_change: wowChange,
      trend: trend(wowPct),
    })
  }

  sources.sort((a, b) => b.sessions - a.sessions)

  const QUALIFIED_MIN_SESSIONS = 20
  const QUALIFIED_ENGAGEMENT_RATE = 0.5

  const qualified = sources.filter(
    (s) => s.sessions >= QUALIFIED_MIN_SESSIONS && (s.engagement_rate ?? 0) >= QUALIFIED_ENGAGEMENT_RATE
  )
  const byQuality = [...qualified].sort(
    (a, b) => (b.lead_conversion_rate ?? 0) - (a.lead_conversion_rate ?? 0)
  )

  return {
    window_days: windowDays,
    as_of_date: asOfDate,
    sources,
    top_by_volume: sources.slice(0, 3).map((s) => s.source_medium),
    top_by_quality: byQuality.slice(0, 3).map((s) => s.source_medium),
    growing: sources.filter((s) => s.trend === 'growing').map((s) => s.source_medium),
    declining: sources.filter((s) => s.trend === 'declining').map((s) => s.source_medium),
  }
}

// ---------------------------------------------------------------------------
// analyzeFunnel
// ---------------------------------------------------------------------------

/**
 * Full-funnel analysis: sessions -> engaged_sessions -> lead_events ->
 * qualified_seller_leads (from FUB).
 *
 * All metrics read from marketing_channel_daily at account scope.
 * Drop-off rate = (prev_step - step) / prev_step.
 */
export async function analyzeFunnel(
  windowDays: number,
  asOfDate: string
): Promise<FunnelAnalysis> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))

  const [sessions, engaged, leadEvents, qualifiedLeads] = await Promise.all([
    sumAccountMetric('ga4', 'sessions', startDate, asOfDate),
    sumAccountMetric('ga4', 'engaged_sessions', startDate, asOfDate),
    sumAccountMetric('ga4', 'lead_events', startDate, asOfDate),
    sumAccountMetric('fub', 'qualified_seller_leads', startDate, asOfDate),
  ])

  const stepValues = [sessions, engaged, leadEvents, qualifiedLeads]
  const stepNames = ['sessions', 'engaged_sessions', 'lead_events', 'qualified_seller_leads'] as const

  const steps = stepNames.map((name, i) => {
    const value = stepValues[i]
    const prev = i === 0 ? null : stepValues[i - 1]
    const drop_off_rate = prev !== null && prev > 0 ? (prev - value) / prev : null
    return { name, value, drop_off_rate } as FunnelStep & { name: typeof name }
  }) as FunnelAnalysis['steps']

  // Identify the biggest single leak (highest drop-off rate, step index >= 1)
  let biggestLeakStep = 'engaged_sessions'
  let biggestLeakRate: number | null = null
  for (const step of steps.slice(1)) {
    if (step.drop_off_rate !== null && (biggestLeakRate === null || step.drop_off_rate > biggestLeakRate)) {
      biggestLeakRate = step.drop_off_rate
      biggestLeakStep = step.name
    }
  }

  return {
    window_days: windowDays,
    as_of_date: asOfDate,
    steps,
    biggest_leak_step: biggestLeakStep,
    biggest_leak_rate: biggestLeakRate,
  }
}

// ---------------------------------------------------------------------------
// analyzeTopPages
// ---------------------------------------------------------------------------

const HIGH_TRAFFIC_PCT = 0.7   // top 30% by sessions
const LOW_CONVERSION_PCT = 0.3  // bottom 30% by lead_conversion_rate (among pages with >= 1 lead event session)
const MIN_SESSIONS_FOR_LEAK = 20

/**
 * Top 15 landing pages by sessions, with lead-conversion rates.
 * Flags pages that have high traffic but low conversion (leak candidates).
 *
 * Pages scope_id values are GA4 pagePath strings (e.g. '/listings', '/blog/...').
 */
export async function analyzeTopPages(
  windowDays: number,
  asOfDate: string
): Promise<TopPagesAnalysis> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))
  const METRICS = ['sessions', 'engaged_sessions', 'lead_events']

  const rows = await fetchMetricsByScope(['ga4'], 'page', METRICS, startDate, asOfDate)

  // Aggregate by page_path
  const byPage = new Map<string, { sessions: number; engaged_sessions: number; lead_events: number }>()
  for (const row of rows) {
    const existing = byPage.get(row.scope_id) ?? { sessions: 0, engaged_sessions: 0, lead_events: 0 }
    if (row.metric === 'sessions') existing.sessions += row.value
    if (row.metric === 'engaged_sessions') existing.engaged_sessions += row.value
    if (row.metric === 'lead_events') existing.lead_events += row.value
    byPage.set(row.scope_id, existing)
  }

  const sorted = [...byPage.entries()]
    .map(([page_path, agg]) => ({
      page_path,
      ...agg,
      lead_conversion_rate: safeDivide(agg.lead_events, agg.sessions),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 15)

  // Determine leak threshold: pages with high sessions but low conversion
  const sessionValues = sorted.map((p) => p.sessions)
  const sessionP70 = sessionValues.length > 0
    ? [...sessionValues].sort((a, b) => a - b)[Math.floor(sessionValues.length * HIGH_TRAFFIC_PCT)]
    : Infinity

  const conversionValues = sorted
    .filter((p) => p.sessions >= MIN_SESSIONS_FOR_LEAK && p.lead_conversion_rate !== null)
    .map((p) => p.lead_conversion_rate as number)
  const conversionP30 = conversionValues.length > 0
    ? [...conversionValues].sort((a, b) => a - b)[Math.floor(conversionValues.length * LOW_CONVERSION_PCT)]
    : 0

  const pages: PageMetrics[] = sorted.map((p) => ({
    page_path: p.page_path,
    sessions: p.sessions,
    engaged_sessions: p.engaged_sessions,
    lead_events: p.lead_events,
    lead_conversion_rate: p.lead_conversion_rate,
    is_leak:
      p.sessions >= sessionP70 &&
      p.sessions >= MIN_SESSIONS_FOR_LEAK &&
      p.lead_conversion_rate !== null &&
      p.lead_conversion_rate <= conversionP30,
  }))

  return {
    window_days: windowDays,
    as_of_date: asOfDate,
    pages,
    leaks: pages.filter((p) => p.is_leak).map((p) => p.page_path),
  }
}

// ---------------------------------------------------------------------------
// analyzeSEO
// ---------------------------------------------------------------------------

/**
 * GSC query and page performance for the window.
 * Scope 'source' -> scope_id is the query string.
 * Scope 'page'   -> scope_id is the page URL.
 * Metrics: impressions, clicks, avg_position.
 *
 * Gains/losses determined by comparing avg_position in current vs prior window.
 * Low-CTR flag = top-quartile impressions + bottom-quartile CTR.
 */
export async function analyzeSEO(
  windowDays: number,
  asOfDate: string
): Promise<SEOAnalysis> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))
  const priorStart = offsetDate(asOfDate, -(windowDays * 2 - 1))
  const priorEnd = offsetDate(asOfDate, -windowDays)

  const GSC_METRICS = ['impressions', 'clicks', 'avg_position']

  const [currentQueryRows, priorQueryRows, currentPageRows] = await Promise.all([
    fetchMetricsByScope(['gsc'], 'source', GSC_METRICS, startDate, asOfDate),
    fetchMetricsByScope(['gsc'], 'source', ['avg_position'], priorStart, priorEnd),
    fetchMetricsByScope(['gsc'], 'page', GSC_METRICS, startDate, asOfDate),
  ])

  // --- Queries ---
  const queryAgg = new Map<string, { impressions: number; clicks: number; positions: number[] }>()
  for (const row of currentQueryRows) {
    const existing = queryAgg.get(row.scope_id) ?? { impressions: 0, clicks: 0, positions: [] }
    if (row.metric === 'impressions') existing.impressions += row.value
    if (row.metric === 'clicks') existing.clicks += row.value
    if (row.metric === 'avg_position' && row.value > 0) existing.positions.push(row.value)
    queryAgg.set(row.scope_id, existing)
  }

  const priorQueryPos = new Map<string, number[]>()
  for (const row of priorQueryRows) {
    const existing = priorQueryPos.get(row.scope_id) ?? []
    if (row.value > 0) existing.push(row.value)
    priorQueryPos.set(row.scope_id, existing)
  }

  const avgOf = (arr: number[]): number | null =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length

  const queryList = [...queryAgg.entries()]
    .map(([query, agg]) => {
      const avg_position = avgOf(agg.positions)
      const priorPos = avgOf(priorQueryPos.get(query) ?? [])
      const position_delta =
        avg_position !== null && priorPos !== null ? avg_position - priorPos : null
      return {
        query,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ctr: safeDivide(agg.clicks, agg.impressions),
        avg_position,
        position_delta,
        low_ctr_flag: false, // set below
      }
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20)

  // Flag low CTR in query list
  const queryCTRs = queryList.filter((q) => q.ctr !== null).map((q) => q.ctr as number)
  queryCTRs.sort((a, b) => a - b)
  const ctrP25 = queryCTRs.length > 0 ? queryCTRs[Math.floor(queryCTRs.length * 0.25)] : 0
  const impressionP75 = (() => {
    const vals = queryList.map((q) => q.impressions).sort((a, b) => a - b)
    return vals.length > 0 ? vals[Math.floor(vals.length * 0.75)] : Infinity
  })()
  const topQueries: SEOQuery[] = queryList.map((q) => ({
    ...q,
    low_ctr_flag: q.impressions >= impressionP75 && q.ctr !== null && q.ctr <= ctrP25,
  }))

  // --- Pages ---
  const pageAgg = new Map<string, { impressions: number; clicks: number; positions: number[] }>()
  for (const row of currentPageRows) {
    const existing = pageAgg.get(row.scope_id) ?? { impressions: 0, clicks: 0, positions: [] }
    if (row.metric === 'impressions') existing.impressions += row.value
    if (row.metric === 'clicks') existing.clicks += row.value
    if (row.metric === 'avg_position' && row.value > 0) existing.positions.push(row.value)
    pageAgg.set(row.scope_id, existing)
  }

  const pageList = [...pageAgg.entries()]
    .map(([page_path, agg]) => ({
      page_path,
      impressions: agg.impressions,
      clicks: agg.clicks,
      ctr: safeDivide(agg.clicks, agg.impressions),
      avg_position: avgOf(agg.positions),
      low_ctr_flag: false,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)

  // Flag low CTR in page list
  const pageCTRs = pageList.filter((p) => p.ctr !== null).map((p) => p.ctr as number)
  pageCTRs.sort((a, b) => a - b)
  const pageCtrP25 = pageCTRs.length > 0 ? pageCTRs[Math.floor(pageCTRs.length * 0.25)] : 0
  const pageImprP75 = (() => {
    const vals = pageList.map((p) => p.impressions).sort((a, b) => a - b)
    return vals.length > 0 ? vals[Math.floor(vals.length * 0.75)] : Infinity
  })()
  const topPages: SEOPage[] = pageList.map((p) => ({
    ...p,
    low_ctr_flag: p.impressions >= pageImprP75 && p.ctr !== null && p.ctr <= pageCtrP25,
  }))

  return {
    window_days: windowDays,
    as_of_date: asOfDate,
    top_queries: topQueries,
    top_pages: topPages,
    gaining_queries: topQueries
      .filter((q) => q.position_delta !== null && q.position_delta < -1)
      .map((q) => q.query),
    losing_queries: topQueries
      .filter((q) => q.position_delta !== null && q.position_delta > 1)
      .map((q) => q.query),
    low_ctr_pages: topPages.filter((p) => p.low_ctr_flag).map((p) => p.page_path),
  }
}

// ---------------------------------------------------------------------------
// findOpportunities
// ---------------------------------------------------------------------------

/**
 * Synthesizes traffic, funnel, page, and SEO analyses into a ranked list of
 * up to 7 Opportunity items. Severity tiers:
 *   high   — funnel drop-off > 80%, or leak page with > 2× median sessions
 *   medium — funnel drop-off 50–80%, low-CTR pages, losing queries
 *   low    — declining source with no quality fallback, SEO gains to capitalize
 */
export function findOpportunities(report: Omit<WebsiteAuditReport, 'opportunities'>): Opportunity[] {
  const opps: Opportunity[] = []

  const { funnel, traffic_sources, top_pages, seo } = report

  // --- Funnel opportunities ---
  if (funnel) {
    for (const step of funnel.steps.slice(1)) {
      const rate = step.drop_off_rate
      if (rate === null) continue

      const prevStep = funnel.steps[funnel.steps.indexOf(step as typeof funnel.steps[number]) - 1]

      if (rate >= 0.5) {
        const severity: Opportunity['severity'] = rate >= 0.8 ? 'high' : 'medium'
        const action: RecommendedAction =
          step.name === 'engaged_sessions'
            ? 'audit_landing_page'
            : step.name === 'lead_events'
            ? 'audit_landing_page'
            : 'investigate_drop'

        opps.push({
          area: 'funnel',
          severity,
          headline: `${Math.round(rate * 100)}% of visitors lost at ${step.name.replace(/_/g, ' ')}`,
          evidence: `${prevStep.value.toLocaleString()} → ${step.value.toLocaleString()} (${Math.round(rate * 100)}% drop-off)`,
          recommended_action: action,
        })
      }
    }
  }

  // --- Page-level leak opportunities ---
  if (top_pages && top_pages.leaks.length > 0) {
    const leakPages = top_pages.pages.filter((p) => p.is_leak)
    const medianSessions =
      top_pages.pages.length > 0
        ? top_pages.pages[Math.floor(top_pages.pages.length / 2)].sessions
        : 0

    for (const page of leakPages.slice(0, 3)) {
      const severity: Opportunity['severity'] =
        page.sessions > medianSessions * 2 ? 'high' : 'medium'
      const convPct =
        page.lead_conversion_rate !== null
          ? `${(page.lead_conversion_rate * 100).toFixed(1)}% conversion`
          : 'near-zero conversion'

      opps.push({
        area: 'page',
        severity,
        headline: `High-traffic page "${page.page_path}" not converting`,
        evidence: `${page.sessions.toLocaleString()} sessions, ${convPct}`,
        recommended_action: 'audit_landing_page',
      })
    }
  }

  // --- SEO: low-CTR pages (title/meta optimization candidates) ---
  if (seo && seo.low_ctr_pages.length > 0) {
    const worstPage = seo.top_pages.find((p) => p.low_ctr_flag)
    if (worstPage) {
      opps.push({
        area: 'seo',
        severity: 'medium',
        headline: `"${worstPage.page_path}" has high impressions but low CTR`,
        evidence: `${worstPage.impressions.toLocaleString()} impressions, ${worstPage.ctr !== null ? (worstPage.ctr * 100).toFixed(1) + '% CTR' : 'unknown CTR'}`,
        recommended_action: 'test_new_creative',
      })
    }
  }

  // --- SEO: losing queries ---
  if (seo && seo.losing_queries.length > 0) {
    const losingQuery = seo.top_queries.find((q) => q.position_delta !== null && q.position_delta > 1)
    if (losingQuery) {
      opps.push({
        area: 'seo',
        severity: 'medium',
        headline: `Query "${losingQuery.query}" losing search position`,
        evidence: `Position drifted +${losingQuery.position_delta?.toFixed(1)} places; ${losingQuery.impressions.toLocaleString()} impressions`,
        recommended_action: 'investigate_drop',
      })
    }
  }

  // --- SEO: gaining queries to capitalize on ---
  if (seo && seo.gaining_queries.length > 0) {
    const gainingQuery = seo.top_queries.find((q) => q.position_delta !== null && q.position_delta < -1)
    if (gainingQuery) {
      opps.push({
        area: 'seo',
        severity: 'low',
        headline: `Query "${gainingQuery.query}" gaining ground — capitalize`,
        evidence: `Position improved ${Math.abs(gainingQuery.position_delta as number).toFixed(1)} places; ${gainingQuery.clicks.toLocaleString()} clicks`,
        recommended_action: 'capitalize_on_spike',
      })
    }
  }

  // --- Traffic: declining high-quality sources ---
  if (traffic_sources && traffic_sources.declining.length > 0) {
    for (const sm of traffic_sources.declining.slice(0, 2)) {
      const src = traffic_sources.sources.find((s) => s.source_medium === sm)
      if (!src) continue
      opps.push({
        area: 'traffic',
        severity: 'low',
        headline: `"${sm}" traffic declining`,
        evidence: `${src.sessions.toLocaleString()} sessions this window, WoW change ${src.sessions_wow_change?.toLocaleString() ?? 'unknown'}`,
        recommended_action: 'investigate_drop',
      })
    }
  }

  // Rank: high > medium > low, then by area priority (funnel > page > seo > traffic)
  const severityScore: Record<Opportunity['severity'], number> = { high: 3, medium: 2, low: 1 }
  const areaScore: Record<Opportunity['area'], number> = { funnel: 4, page: 3, seo: 2, traffic: 1 }

  opps.sort(
    (a, b) =>
      severityScore[b.severity] - severityScore[a.severity] ||
      areaScore[b.area] - areaScore[a.area]
  )

  return opps.slice(0, 7)
}

// ---------------------------------------------------------------------------
// auditWebsite — top-level
// ---------------------------------------------------------------------------

/**
 * Full website audit for a given date window.
 *
 * @param asOfDate  End date of the audit window (YYYY-MM-DD). Defaults to today.
 * @param windowDays  Number of days to analyse (default 30). Min 14 for GA4.
 *
 * Returns WebsiteAuditReport. If fewer than MIN_GA4_DAYS (14) of GA4 data
 * exist for the window, returns status='insufficient_data' with flags listing
 * what's missing and an empty opportunities array.
 */
export async function auditWebsite(
  asOfDate: string,
  windowDays: number = 30
): Promise<WebsiteAuditReport> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))

  // --- Data availability check ---
  const [ga4Days, gscDays, fubDays] = await Promise.all([
    countNonZeroDays('ga4', 'sessions', startDate, asOfDate),
    countNonZeroDays('gsc', 'impressions', startDate, asOfDate),
    countNonZeroDays('fub', 'qualified_seller_leads', startDate, asOfDate),
  ])

  if (ga4Days < MIN_GA4_DAYS) {
    const missing: DataAvailabilityFlag[] = [
      { channel: 'ga4', metric: 'sessions', days_found: ga4Days, required_days: MIN_GA4_DAYS },
    ]
    if (gscDays < MIN_GA4_DAYS) {
      missing.push({ channel: 'gsc', metric: 'impressions', days_found: gscDays, required_days: MIN_GA4_DAYS })
    }
    if (fubDays < MIN_GA4_DAYS) {
      missing.push({ channel: 'fub', metric: 'qualified_seller_leads', days_found: fubDays, required_days: MIN_GA4_DAYS })
    }
    return {
      as_of_date: asOfDate,
      window_days: windowDays,
      status: 'insufficient_data',
      missing_data: missing,
      opportunities: [],
    }
  }

  // --- Run all analyses in parallel ---
  const [traffic_sources, funnel, top_pages, seo] = await Promise.all([
    analyzeTrafficSources(windowDays, asOfDate),
    analyzeFunnel(windowDays, asOfDate),
    analyzeTopPages(windowDays, asOfDate),
    analyzeSEO(windowDays, asOfDate),
  ])

  const partialReport: Omit<WebsiteAuditReport, 'opportunities'> = {
    as_of_date: asOfDate,
    window_days: windowDays,
    status: 'ok',
    traffic_sources,
    funnel,
    top_pages,
    seo,
  }

  const opportunities = findOpportunities(partialReport)

  return { ...partialReport, opportunities }
}
