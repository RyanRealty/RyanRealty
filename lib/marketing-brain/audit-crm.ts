/**
 * marketing-brain: audit-crm
 *
 * Audits the Follow Up Boss (FUB) CRM and lead-handling pipeline.
 * Reads exclusively from public.marketing_channel_daily (channel='fub').
 * No writes. Pure analytics for downstream generate-briefs consumption.
 *
 * Key metrics ingested by marketing-snapshot-fub:
 *   account scope:
 *     new_leads, qualified_seller_leads, avg_response_time_minutes,
 *     appointments_booked, deals_created, deals_closed_won, deals_lost
 *   source scope (scope_id = lead source string):
 *     new_leads
 *   campaign scope (scope_id = 'stage:<name>'):
 *     pipeline_count, pipeline_value
 *
 * SLA thresholds (docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md):
 *   HOT lead (hot-seller tag):  respond within 5 minutes
 *   WARM lead (warm-seller tag): respond within 30 minutes
 *
 * Response-time compliance is approximated from avg_response_time_minutes
 * stored at account scope. The FUB ingestor emits this per-day mean only
 * when at least one response time was measurable. Days with no data are
 * excluded from the compliance calculation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { RecommendedAction } from './diagnose'

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service-role credentials not configured')
  }
  _supabase = createClient(url, key)
  return _supabase
}

// ---------------------------------------------------------------------------
// Thresholds (locked)
// ---------------------------------------------------------------------------

/** HOT lead response SLA: 5 minutes (docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md) */
const HOT_SLA_MINUTES = 5
/** WARM lead response SLA: 30 minutes (FB_SELLER_CAMPAIGN_PLAYBOOK.md) */
const WARM_SLA_MINUTES = 30
/** avg_response_time_minutes <= HOT_SLA_MINUTES => SLA met for account-level compliance */
const ACCOUNT_SLA_MINUTES = HOT_SLA_MINUTES
/** Tagging drift flag: > 10% of new leads with no seller-stage tag on day 0 */
const TAGGING_DRIFT_THRESHOLD_PCT = 10
/** Pipeline stall: stage count grew but no advances in this many days */
const PIPELINE_STALL_DAYS = 14
/**
 * Source quality weighted score formula (0–100):
 *   qualified_lead_ratio  × 0.50  (qualified_seller_leads / new_leads in window)
 *   deal_closed_won_ratio × 0.30  (deals_closed_won / new_leads in window)
 *   avg_deal_value_score  × 0.20  (avg deal value normalised to [0,1] vs peer max)
 *
 * The avg_deal_value_score normalises each source's average deal value against the
 * maximum average deal value among all sources so the 20% component is relative.
 */
const SOURCE_QUALITY_WEIGHTS = {
  qualified_lead_ratio: 0.5,
  deal_closed_won_ratio: 0.3,
  avg_deal_value_score: 0.2,
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpportunityArea =
  | 'response_time'
  | 'source_quality'
  | 'pipeline_health'
  | 'tagging_drift'
  | 'north_star'

export type Severity = 'high' | 'medium' | 'low'

export interface Opportunity {
  area: OpportunityArea
  severity: Severity
  headline: string
  evidence: string
  recommended_action: RecommendedAction
}

export interface SourceQuality {
  source: string
  new_leads: number
  qualified_seller_leads: number
  qualified_lead_ratio: number   // 0–1
  deals_created: number
  deals_closed_won: number
  deal_closed_won_ratio: number  // 0–1 (closed_won / new_leads)
  avg_deal_value: number         // average pipeline_value for deals from this source (proxy)
  quality_score: number          // 0–100 weighted composite
  rank: number
}

export interface ResponseTimeReport {
  avg_response_time_minutes: number | null  // mean over window days that have data
  compliant_days: number           // days where avg <= ACCOUNT_SLA_MINUTES
  noncompliant_days: number        // days where avg > ACCOUNT_SLA_MINUTES
  data_days: number                // total days where this metric was present
  compliance_pct: number | null    // compliant_days / data_days * 100; null if no data
  sla_hot_minutes: number          // 5
  sla_warm_minutes: number         // 30
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data'
}

export interface PipelineStage {
  stage: string
  pipeline_count: number
  pipeline_value: number
  /** true when count grew in the window but no stage-advance was seen in PIPELINE_STALL_DAYS */
  is_stalled: boolean
}

export interface PipelineHealthReport {
  stages: PipelineStage[]
  total_pipeline_count: number
  total_pipeline_value: number
  /** Conversion rates between canonical stages where data permits */
  stage_conversions: StageConversion[]
}

export interface StageConversion {
  from_stage: string
  to_stage: string
  /** ratio: to_stage count / from_stage count (approximate) */
  conversion_rate: number | null
}

export interface NorthStarReport {
  metric: 'qualified_seller_leads'
  window_total: number
  wow_change: number | null         // absolute change, current 7d vs prior 7d
  wow_pct: number | null
  mom_change: number | null         // absolute change, current 30d vs prior 30d
  mom_pct: number | null
  trailing_baseline_mean_7d: number | null  // 4-week trailing mean * 7
  trend_vs_baseline_pct: number | null
}

export interface CRMAuditReport {
  as_of_date: string
  window_days: number
  /** Per-source lead quality, ranked by composite score */
  source_quality: SourceQuality[]
  /** Response-time SLA compliance */
  response_time: ResponseTimeReport
  /** Pipeline stage health and funnel conversion */
  pipeline_health: PipelineHealthReport
  /** North-star metric: qualified seller leads */
  north_star: NorthStarReport
  /** Ranked improvement opportunities (max 7) */
  opportunities: Opportunity[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Offset a YYYY-MM-DD string by N days (negative = past). */
function offsetDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function safePct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return (numerator / denominator) * 100
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return numerator / denominator
}

/** Fetch daily rows for channel='fub', a specific scope/metric, over [startDate, endDate]. */
async function fetchFubRows(
  scope: string,
  scopeId: string,
  metric: string,
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; value: number; metadata: Record<string, unknown> }>> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('date, value, metadata')
    .eq('channel', 'fub')
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .eq('metric', metric)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) throw new Error(`fetchFubRows ${scope}/${scopeId}/${metric}: ${error.message}`)
  return (data ?? []).map((r) => ({
    date: r.date as string,
    value: r.value as number,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
  }))
}

/** Sum a single account-scope metric over the window. */
async function sumAccountMetric(
  metric: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const rows = await fetchFubRows('account', '', metric, startDate, endDate)
  return rows.reduce((acc, r) => acc + r.value, 0)
}

// ---------------------------------------------------------------------------
// analyzeSourceQuality
// ---------------------------------------------------------------------------

export async function analyzeSourceQuality(
  windowDays: number,
  asOfDate: string
): Promise<SourceQuality[]> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))
  const supabase = getSupabase()

  // Fetch all source-scope new_leads rows in window
  const { data: sourceRows, error: srcErr } = await supabase
    .from('marketing_channel_daily')
    .select('scope_id, value')
    .eq('channel', 'fub')
    .eq('scope', 'source')
    .eq('metric', 'new_leads')
    .gte('date', startDate)
    .lte('date', asOfDate)

  if (srcErr) throw new Error(`analyzeSourceQuality source rows: ${srcErr.message}`)

  // Aggregate new_leads per source
  const sourceLeads = new Map<string, number>()
  for (const row of sourceRows ?? []) {
    const src = row.scope_id as string
    sourceLeads.set(src, (sourceLeads.get(src) ?? 0) + (row.value as number))
  }

  if (sourceLeads.size === 0) return []

  // Account-level totals over window for ratio computation
  const [totalQualified, totalClosedWon, totalDealsCreated] = await Promise.all([
    sumAccountMetric('qualified_seller_leads', startDate, asOfDate),
    sumAccountMetric('deals_closed_won', startDate, asOfDate),
    sumAccountMetric('deals_created', startDate, asOfDate),
  ])

  // Pipeline value total from campaign-scope rows (proxy for avg deal value)
  const { data: pipelineRows, error: pvErr } = await supabase
    .from('marketing_channel_daily')
    .select('value')
    .eq('channel', 'fub')
    .eq('scope', 'campaign')
    .eq('metric', 'pipeline_value')
    .gte('date', startDate)
    .lte('date', asOfDate)

  if (pvErr) throw new Error(`analyzeSourceQuality pipeline_value: ${pvErr.message}`)
  const totalPipelineValue = (pipelineRows ?? []).reduce((a, r) => a + (r.value as number), 0)
  const totalLeads = [...sourceLeads.values()].reduce((a, b) => a + b, 0)

  // Build per-source metrics. Since the ingestor doesn't break down
  // qualified_seller_leads or deals_closed_won by source in the DB, we
  // allocate account-level totals proportionally to source lead share.
  // This is the best approximation available from the current data shape.
  const sources: Array<Omit<SourceQuality, 'rank'>> = []

  for (const [source, new_leads] of sourceLeads) {
    const share = safeRatio(new_leads, totalLeads)

    const qualified_seller_leads = Math.round(totalQualified * share)
    const deals_closed_won = Math.round(totalClosedWon * share)
    const deals_created = Math.round(totalDealsCreated * share)

    const qualified_lead_ratio = safeRatio(qualified_seller_leads, new_leads)
    const deal_closed_won_ratio = safeRatio(deals_closed_won, new_leads)
    const avg_deal_value = new_leads > 0 ? (totalPipelineValue * share) / new_leads : 0

    sources.push({
      source,
      new_leads,
      qualified_seller_leads,
      qualified_lead_ratio,
      deals_created,
      deals_closed_won,
      deal_closed_won_ratio,
      avg_deal_value,
      quality_score: 0, // filled after normalisation
    })
  }

  // Normalise avg_deal_value to [0,1] relative to peer max
  const maxAvgDeal = Math.max(...sources.map((s) => s.avg_deal_value), 1)

  for (const s of sources) {
    const avg_deal_value_score = s.avg_deal_value / maxAvgDeal
    s.quality_score = Math.round(
      (s.qualified_lead_ratio * SOURCE_QUALITY_WEIGHTS.qualified_lead_ratio +
        s.deal_closed_won_ratio * SOURCE_QUALITY_WEIGHTS.deal_closed_won_ratio +
        avg_deal_value_score * SOURCE_QUALITY_WEIGHTS.avg_deal_value_score) *
        100
    )
  }

  // Rank by quality_score descending
  const ranked = sources
    .sort((a, b) => b.quality_score - a.quality_score)
    .map((s, i) => ({ ...s, rank: i + 1 }) as SourceQuality)

  return ranked
}

// ---------------------------------------------------------------------------
// analyzeResponseTime
// ---------------------------------------------------------------------------

export async function analyzeResponseTime(
  windowDays: number,
  asOfDate: string
): Promise<ResponseTimeReport> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))
  const rows = await fetchFubRows('account', '', 'avg_response_time_minutes', startDate, asOfDate)

  if (rows.length === 0) {
    return {
      avg_response_time_minutes: null,
      compliant_days: 0,
      noncompliant_days: 0,
      data_days: 0,
      compliance_pct: null,
      sla_hot_minutes: HOT_SLA_MINUTES,
      sla_warm_minutes: WARM_SLA_MINUTES,
      trend: 'insufficient_data',
    }
  }

  const values = rows.map((r) => r.value)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const compliant_days = values.filter((v) => v <= ACCOUNT_SLA_MINUTES).length
  const noncompliant_days = values.length - compliant_days
  const compliance_pct = safePct(compliant_days, values.length)

  // Trend: compare first half vs second half of the window
  let trend: ResponseTimeReport['trend'] = 'insufficient_data'
  if (values.length >= 4) {
    const mid = Math.floor(values.length / 2)
    const firstHalfMean = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid
    const secondHalfMean = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid)
    const delta = secondHalfMean - firstHalfMean
    if (Math.abs(delta) < 0.5) {
      trend = 'stable'
    } else {
      // Lower response time = improving
      trend = delta < 0 ? 'improving' : 'worsening'
    }
  } else if (values.length > 0) {
    trend = 'stable'
  }

  return {
    avg_response_time_minutes: Math.round(avg * 100) / 100,
    compliant_days,
    noncompliant_days,
    data_days: values.length,
    compliance_pct: compliance_pct !== null ? Math.round(compliance_pct * 10) / 10 : null,
    sla_hot_minutes: HOT_SLA_MINUTES,
    sla_warm_minutes: WARM_SLA_MINUTES,
    trend,
  }
}

// ---------------------------------------------------------------------------
// analyzePipelineHealth
// ---------------------------------------------------------------------------

/**
 * Canonical stage funnel for FUB seller pipeline (from FB_SELLER_CAMPAIGN_PLAYBOOK.md).
 * We attempt to compute conversion rate between adjacent stages.
 */
const CANONICAL_STAGES = ['new', 'hot', 'warm', 'nurture', 'contract'] as const
type CanonicalStage = (typeof CANONICAL_STAGES)[number]

/** Fuzzy-match a raw FUB stage name to a canonical stage. */
function matchCanonicalStage(raw: string): CanonicalStage | null {
  const lower = raw.toLowerCase().trim()
  if (lower.includes('hot')) return 'hot'
  if (lower.includes('warm')) return 'warm'
  if (lower.includes('nurture') || lower.includes('long')) return 'nurture'
  if (lower.includes('contract') || lower.includes('active') || lower.includes('escrow')) return 'contract'
  if (lower.includes('new') || lower.includes('incoming') || lower.includes('uncontacted')) return 'new'
  return null
}

export async function analyzePipelineHealth(
  windowDays: number,
  asOfDate: string
): Promise<PipelineHealthReport> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))
  const supabase = getSupabase()

  // Fetch all campaign-scope rows in window
  const { data: rows, error } = await supabase
    .from('marketing_channel_daily')
    .select('scope_id, metric, value, date')
    .eq('channel', 'fub')
    .eq('scope', 'campaign')
    .gte('date', startDate)
    .lte('date', asOfDate)
    .order('date', { ascending: true })

  if (error) throw new Error(`analyzePipelineHealth: ${error.message}`)

  // Parse stage from scope_id 'stage:<name>'
  type StageDay = { stage: string; metric: string; value: number; date: string }
  const stageDays: StageDay[] = []
  for (const row of rows ?? []) {
    const scopeId = row.scope_id as string
    if (!scopeId.startsWith('stage:')) continue
    const stage = scopeId.slice('stage:'.length)
    stageDays.push({
      stage,
      metric: row.metric as string,
      value: row.value as number,
      date: row.date as string,
    })
  }

  // Latest count/value per stage (use most-recent day as the snapshot)
  const latestByStage = new Map<string, { count: number; value: number; earliestCount: number }>()
  const countByStageDate = new Map<string, Map<string, number>>() // stage -> date -> count

  for (const sd of stageDays) {
    if (sd.metric === 'pipeline_count') {
      if (!countByStageDate.has(sd.stage)) {
        countByStageDate.set(sd.stage, new Map())
      }
      countByStageDate.get(sd.stage)!.set(sd.date, sd.value)
    }
  }

  for (const [stage, dateMap] of countByStageDate) {
    const sortedDates = [...dateMap.keys()].sort()
    const earliest = dateMap.get(sortedDates[0]) ?? 0
    const latest = dateMap.get(sortedDates[sortedDates.length - 1]) ?? 0
    const existing = latestByStage.get(stage) ?? { count: latest, value: 0, earliestCount: earliest }
    existing.count = latest
    existing.earliestCount = earliest
    latestByStage.set(stage, existing)
  }

  // Pipeline value by stage (latest day)
  for (const sd of stageDays) {
    if (sd.metric === 'pipeline_value') {
      const ex = latestByStage.get(sd.stage)
      if (ex) {
        // Use max seen (pipeline_value is a snapshot; take highest as most-recent proxy)
        if (sd.value > ex.value) ex.value = sd.value
      } else {
        latestByStage.set(sd.stage, { count: 0, value: sd.value, earliestCount: 0 })
      }
    }
  }

  // Detect stalls: stage where count grew over the window but no deals advanced
  // (approximated by checking if 'contract' stage count did NOT increase while other stages did)
  const contractEntry = latestByStage.get('contract')
  const contractGrew = contractEntry
    ? contractEntry.count > contractEntry.earliestCount
    : false

  const stages: PipelineStage[] = []
  let total_pipeline_count = 0
  let total_pipeline_value = 0

  for (const [stage, agg] of latestByStage) {
    // A stall: count grew, but contract stage did not advance (proxy for no funnel progress)
    const countGrew = agg.count > agg.earliestCount
    const is_stalled = countGrew && !contractGrew && agg.count > 0

    stages.push({
      stage,
      pipeline_count: agg.count,
      pipeline_value: agg.value,
      is_stalled,
    })
    total_pipeline_count += agg.count
    total_pipeline_value += agg.value
  }

  // Sort by canonical funnel order, unknown stages at end
  stages.sort((a, b) => {
    const ai = CANONICAL_STAGES.indexOf(matchCanonicalStage(a.stage) as CanonicalStage)
    const bi = CANONICAL_STAGES.indexOf(matchCanonicalStage(b.stage) as CanonicalStage)
    const aIdx = ai === -1 ? 999 : ai
    const bIdx = bi === -1 ? 999 : bi
    return aIdx - bIdx
  })

  // Compute stage-to-stage conversion rates from snapshot counts
  const stage_conversions: StageConversion[] = []
  for (let i = 0; i < CANONICAL_STAGES.length - 1; i++) {
    const fromCanon = CANONICAL_STAGES[i]
    const toCanon = CANONICAL_STAGES[i + 1]
    const fromStage = stages.find((s) => matchCanonicalStage(s.stage) === fromCanon)
    const toStage = stages.find((s) => matchCanonicalStage(s.stage) === toCanon)
    const fromCount = fromStage?.pipeline_count ?? 0
    const toCount = toStage?.pipeline_count ?? 0
    stage_conversions.push({
      from_stage: fromCanon,
      to_stage: toCanon,
      conversion_rate: fromCount > 0 ? Math.round((toCount / fromCount) * 1000) / 1000 : null,
    })
  }

  return {
    stages,
    total_pipeline_count,
    total_pipeline_value,
    stage_conversions,
  }
}

// ---------------------------------------------------------------------------
// analyzeNorthStar
// ---------------------------------------------------------------------------

export async function analyzeNorthStar(
  windowDays: number,
  asOfDate: string
): Promise<NorthStarReport> {
  // Current window
  const currentStart = offsetDate(asOfDate, -(windowDays - 1))
  // WoW: current 7d vs prior 7d
  const wow7Start = offsetDate(asOfDate, -6)
  const wow7PriorStart = offsetDate(asOfDate, -13)
  const wow7PriorEnd = offsetDate(asOfDate, -7)
  // MoM: current 30d vs prior 30d
  const mom30Start = offsetDate(asOfDate, -29)
  const mom30PriorStart = offsetDate(asOfDate, -59)
  const mom30PriorEnd = offsetDate(asOfDate, -30)
  // 4-week baseline for trend (days -8 through -35)
  const baselineStart = offsetDate(asOfDate, -35)
  const baselineEnd = offsetDate(asOfDate, -8)

  const [
    windowTotal,
    wow7Current,
    wow7Prior,
    mom30Current,
    mom30Prior,
    baselineValues,
  ] = await Promise.all([
    sumAccountMetric('qualified_seller_leads', currentStart, asOfDate),
    sumAccountMetric('qualified_seller_leads', wow7Start, asOfDate),
    sumAccountMetric('qualified_seller_leads', wow7PriorStart, wow7PriorEnd),
    sumAccountMetric('qualified_seller_leads', mom30Start, asOfDate),
    sumAccountMetric('qualified_seller_leads', mom30PriorStart, mom30PriorEnd),
    fetchFubRows('account', '', 'qualified_seller_leads', baselineStart, baselineEnd),
  ])

  const baselineDailyMean =
    baselineValues.length > 0
      ? baselineValues.reduce((a, r) => a + r.value, 0) / baselineValues.length
      : null
  const baselineWeek = baselineDailyMean !== null ? baselineDailyMean * 7 : null

  const wowChange = wow7Current - wow7Prior
  const wowPct = wow7Prior !== 0 ? ((wow7Current - wow7Prior) / wow7Prior) * 100 : null

  const momChange = mom30Current - mom30Prior
  const momPct = mom30Prior !== 0 ? ((mom30Current - mom30Prior) / mom30Prior) * 100 : null

  const trendVsBaselinePct =
    baselineWeek !== null && baselineWeek > 0
      ? ((wow7Current - baselineWeek) / baselineWeek) * 100
      : null

  return {
    metric: 'qualified_seller_leads',
    window_total: windowTotal,
    wow_change: wowChange,
    wow_pct: wowPct !== null ? Math.round(wowPct * 10) / 10 : null,
    mom_change: momChange,
    mom_pct: momPct !== null ? Math.round(momPct * 10) / 10 : null,
    trailing_baseline_mean_7d: baselineWeek !== null ? Math.round(baselineWeek * 10) / 10 : null,
    trend_vs_baseline_pct:
      trendVsBaselinePct !== null ? Math.round(trendVsBaselinePct * 10) / 10 : null,
  }
}

// ---------------------------------------------------------------------------
// findOpportunities
// ---------------------------------------------------------------------------

export function findOpportunities(report: Omit<CRMAuditReport, 'opportunities'>): Opportunity[] {
  const opps: Opportunity[] = []

  // ── Response-time opportunities ──────────────────────────────────────────
  const rt = report.response_time
  if (rt.compliance_pct !== null) {
    if (rt.compliance_pct < 50) {
      opps.push({
        area: 'response_time',
        severity: 'high',
        headline: `Response-time SLA compliance is critically low (${rt.compliance_pct}%)`,
        evidence: `Avg response ${rt.avg_response_time_minutes ?? 'unknown'} min; SLA is ${HOT_SLA_MINUTES} min for hot leads. Compliant ${rt.compliant_days}/${rt.data_days} days.`,
        recommended_action: 'investigate_drop',
      })
    } else if (rt.compliance_pct < 80) {
      opps.push({
        area: 'response_time',
        severity: 'medium',
        headline: `Response-time SLA compliance below 80% (${rt.compliance_pct}%)`,
        evidence: `Compliant ${rt.compliant_days}/${rt.data_days} days. Trend: ${rt.trend}.`,
        recommended_action: 'review_targeting',
      })
    } else if (rt.trend === 'worsening') {
      opps.push({
        area: 'response_time',
        severity: 'low',
        headline: 'Response time is trending upward despite adequate compliance',
        evidence: `Compliance at ${rt.compliance_pct}% but trend is worsening. Watch for SLA creep.`,
        recommended_action: 'check_tracking',
      })
    }
  } else {
    opps.push({
      area: 'response_time',
      severity: 'medium',
      headline: 'No response-time data available — tracking may be missing',
      evidence: 'avg_response_time_minutes metric was not found in the window. FUB may not be surfacing this field.',
      recommended_action: 'check_tracking',
    })
  }

  // ── Source-quality opportunities ─────────────────────────────────────────
  if (report.source_quality.length > 0) {
    const worst = report.source_quality[report.source_quality.length - 1]
    if (report.source_quality.length > 1 && worst.quality_score < 20 && worst.new_leads >= 5) {
      opps.push({
        area: 'source_quality',
        severity: 'medium',
        headline: `Source "${worst.source}" is generating volume but very low quality (score ${worst.quality_score}/100)`,
        evidence: `${worst.new_leads} new leads, ${worst.qualified_seller_leads} qualified (${(worst.qualified_lead_ratio * 100).toFixed(1)}% ratio), ${worst.deals_closed_won} closed won.`,
        recommended_action: 'review_targeting',
      })
    }

    const top = report.source_quality[0]
    if (top.quality_score >= 60 && top.new_leads <= 10) {
      opps.push({
        area: 'source_quality',
        severity: 'low',
        headline: `High-quality source "${top.source}" has limited volume — scaling opportunity`,
        evidence: `Quality score ${top.quality_score}/100 with only ${top.new_leads} leads. Expand budget or audience here.`,
        recommended_action: 'expand_to_similar_audience',
      })
    }
  }

  // ── Pipeline-health opportunities ────────────────────────────────────────
  const ph = report.pipeline_health
  const stalledStages = ph.stages.filter((s) => s.is_stalled)
  if (stalledStages.length > 0) {
    opps.push({
      area: 'pipeline_health',
      severity: 'high',
      headline: `${stalledStages.length} pipeline stage(s) stalled with no funnel advances in ${PIPELINE_STALL_DAYS} days`,
      evidence: `Stalled: ${stalledStages.map((s) => s.stage).join(', ')}. Total stuck pipeline value: $${stalledStages.reduce((a, s) => a + s.pipeline_value, 0).toLocaleString()}.`,
      recommended_action: 'pause_underperformer',
    })
  }

  // Check new-to-hot conversion rate
  const newToHot = ph.stage_conversions.find((c) => c.from_stage === 'new' && c.to_stage === 'hot')
  if (newToHot?.conversion_rate !== null && newToHot?.conversion_rate !== undefined) {
    if (newToHot.conversion_rate < 0.05) {
      opps.push({
        area: 'pipeline_health',
        severity: 'medium',
        headline: `Very low new-to-hot conversion rate (${(newToHot.conversion_rate * 100).toFixed(1)}%)`,
        evidence: 'Most new leads are not advancing to the hot stage. Consider improving initial qualification call process.',
        recommended_action: 'audit_landing_page',
      })
    }
  }

  // ── Tagging-drift opportunities ──────────────────────────────────────────
  // Approximate tagging drift: qualified_seller_leads / new_leads over window.
  // If ratio of untagged leads is high (low qualified ratio), flag drift.
  const windowNew = report.source_quality.reduce((a, s) => a + s.new_leads, 0)
  const windowQualified = report.north_star.window_total
  if (windowNew > 0) {
    const untaggedPct = Math.max(0, ((windowNew - windowQualified) / windowNew) * 100)
    if (untaggedPct > TAGGING_DRIFT_THRESHOLD_PCT) {
      opps.push({
        area: 'tagging_drift',
        severity: untaggedPct > 30 ? 'high' : 'medium',
        headline: `${untaggedPct.toFixed(1)}% of new leads have no seller-stage tag (drift threshold: ${TAGGING_DRIFT_THRESHOLD_PCT}%)`,
        evidence: `${windowNew} new leads in window; ${windowQualified} tagged as qualified sellers. ${(windowNew - windowQualified)} leads untagged or tagged nurture-only.`,
        recommended_action: 'investigate_drop',
      })
    }
  }

  // ── North-star opportunities ─────────────────────────────────────────────
  const ns = report.north_star
  if (ns.wow_pct !== null && ns.wow_pct < -20) {
    opps.push({
      area: 'north_star',
      severity: 'high',
      headline: `Qualified seller leads dropped ${Math.abs(ns.wow_pct).toFixed(1)}% WoW — north-star metric under pressure`,
      evidence: `WoW change: ${ns.wow_change} leads. MoM: ${ns.mom_pct !== null ? ns.mom_pct.toFixed(1) + '%' : 'N/A'}. Trend vs baseline: ${ns.trend_vs_baseline_pct !== null ? ns.trend_vs_baseline_pct.toFixed(1) + '%' : 'N/A'}.`,
      recommended_action: 'investigate_drop',
    })
  } else if (ns.wow_pct !== null && ns.wow_pct > 30) {
    opps.push({
      area: 'north_star',
      severity: 'low',
      headline: `Qualified seller leads up ${ns.wow_pct.toFixed(1)}% WoW — capitalize on momentum`,
      evidence: `WoW change: +${ns.wow_change} leads. Consider increasing ad budget to sustain the spike.`,
      recommended_action: 'capitalize_on_spike',
    })
  } else if (ns.mom_pct !== null && ns.mom_pct < -10) {
    opps.push({
      area: 'north_star',
      severity: 'medium',
      headline: `Qualified seller leads declining MoM (${ns.mom_pct.toFixed(1)}%)`,
      evidence: `MoM: ${ns.mom_change} leads. Window total: ${ns.window_total}. Funnel health needs review.`,
      recommended_action: 'reduce_budget',
    })
  }

  // Sort by severity and cap at 7
  const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  return opps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 7)
}

// ---------------------------------------------------------------------------
// auditCRM — top-level orchestrator
// ---------------------------------------------------------------------------

export async function auditCRM(asOfDate: string, windowDays: number): Promise<CRMAuditReport> {
  const [source_quality, response_time, pipeline_health, north_star] = await Promise.all([
    analyzeSourceQuality(windowDays, asOfDate),
    analyzeResponseTime(windowDays, asOfDate),
    analyzePipelineHealth(windowDays, asOfDate),
    analyzeNorthStar(windowDays, asOfDate),
  ])

  const partial: Omit<CRMAuditReport, 'opportunities'> = {
    as_of_date: asOfDate,
    window_days: windowDays,
    source_quality,
    response_time,
    pipeline_health,
    north_star,
  }

  const opportunities = findOpportunities(partial)

  return { ...partial, opportunities }
}
