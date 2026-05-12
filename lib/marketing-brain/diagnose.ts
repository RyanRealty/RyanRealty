/**
 * marketing-brain diagnostic primitives.
 *
 * Reads from public.marketing_channel_daily (written by snapshot ingestors)
 * and computes deltas, z-score anomalies, channel rankings, and structured
 * insight summaries that downstream skills (generate-briefs, etc.) consume.
 *
 * Every function is pure-query against Supabase service-role. No writes here
 * except flagging anomalies into marketing_decisions via flagAnomaly().
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Channel, Scope } from './snapshot'

// ---------------------------------------------------------------------------
// Supabase client (single instance per module load)
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
// Types
// ---------------------------------------------------------------------------

export type Significance = 'stable' | 'rising' | 'falling' | 'spike' | 'crash'

export interface PeriodDelta {
  current: number
  prior: number
  absolute_change: number
  percent_change: number | null // null when prior is zero
  significance: Significance
}

export interface DeltaReport {
  channel: Channel
  metric: string
  scope: Scope
  scope_id: string
  as_of_date: string
  wow: PeriodDelta // 7-day window vs prior 7-day window
  mom: PeriodDelta // 30-day window vs prior 30-day window
  trend_vs_baseline: PeriodDelta // current 7-day vs trailing 4-week mean
  trailing_30_mean: number
  trailing_30_std: number
}

export interface Anomaly {
  channel: Channel
  metric: string
  scope: Scope
  scope_id: string
  z_score: number
  current_value: number
  baseline_mean: number
  baseline_std: number
  insufficient_data: false
}

export interface InsufficientDataFlag {
  channel: Channel
  metric: string
  scope: Scope
  scope_id: string
  insufficient_data: true
  non_zero_days: number
}

export type AnomalyResult = Anomaly | InsufficientDataFlag

export interface ChannelRank {
  channel: Channel
  total: number
  rank: number
}

export type RecommendedAction =
  | 'increase_budget'
  | 'reduce_budget'
  | 'test_new_creative'
  | 'audit_landing_page'
  | 'investigate_drop'
  | 'capitalize_on_spike'
  | 'check_tracking'
  | 'review_targeting'
  | 'expand_to_similar_audience'
  | 'pause_underperformer'

export interface InsightSummary {
  channel: Channel
  as_of_date: string
  headline: string
  deltas: DeltaReport[]
  anomalies: AnomalyResult[]
  recommended_actions: RecommendedAction[]
}

// ---------------------------------------------------------------------------
// Statistical thresholds (locked)
// ---------------------------------------------------------------------------
// - ANOMALY_Z_THRESHOLD: |z| > 2.0 qualifies as an anomaly
// - MIN_NON_ZERO_DAYS: fewer than 14 non-zero days in the trailing 30 ->
//   skip z-score, return insufficient_data flag
// - SIGNIFICANCE_STABLE_PCT: |%change| < 5% -> 'stable'
// - SIGNIFICANCE_MODERATE_PCT: 5% <= |%change| <= 20% -> 'rising' or 'falling'
// - SIGNIFICANCE_EXTREME_PCT: |%change| > 20% AND outside 2-sigma band ->
//   'spike' or 'crash'; if not outside 2-sigma, still 'rising' / 'falling'
// ---------------------------------------------------------------------------
const ANOMALY_Z_THRESHOLD = 2.0
const MIN_NON_ZERO_DAYS = 14
const SIGNIFICANCE_STABLE_PCT = 5
const SIGNIFICANCE_EXTREME_PCT = 20

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stddev(values: number[], mu: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((acc, v) => acc + (v - mu) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/** Sum values for a date window. Returns 0 if no rows found. */
async function sumWindow(
  channel: Channel,
  metric: string,
  scope: Scope,
  scopeId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('value')
    .eq('channel', channel)
    .eq('metric', metric)
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(`sumWindow: ${error.message}`)
  return (data ?? []).reduce((acc, row) => acc + (row.value as number), 0)
}

/** Fetch daily values for a date window. Returns array of numbers (one per row found). */
async function dailyValues(
  channel: Channel,
  metric: string,
  scope: Scope,
  scopeId: string,
  startDate: string,
  endDate: string
): Promise<number[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('value')
    .eq('channel', channel)
    .eq('metric', metric)
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (error) throw new Error(`dailyValues: ${error.message}`)
  return (data ?? []).map((row) => row.value as number)
}

/** Offset a YYYY-MM-DD string by N days (negative = past). */
function offsetDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Classify percent change relative to the 2-sigma band of the trailing 30-day
 * distribution. Uses the trailingStd computed outside.
 */
function classifySignificance(
  pctChange: number | null,
  absoluteChange: number,
  trailingMean: number,
  trailingStd: number
): Significance {
  if (pctChange === null) {
    // Prior is zero: treat non-zero current as a spike/crash based on direction.
    return absoluteChange > 0 ? 'spike' : 'stable'
  }
  const absPct = Math.abs(pctChange)
  if (absPct < SIGNIFICANCE_STABLE_PCT) return 'stable'

  const twoSigma = 2 * trailingStd
  const outsideBand = Math.abs(absoluteChange) > twoSigma || trailingMean === 0

  if (absPct > SIGNIFICANCE_EXTREME_PCT && outsideBand) {
    return pctChange > 0 ? 'spike' : 'crash'
  }
  return pctChange > 0 ? 'rising' : 'falling'
}

function buildDelta(
  current: number,
  prior: number,
  trailingMean: number,
  trailingStd: number
): PeriodDelta {
  const absoluteChange = current - prior
  const pctChange = prior !== 0 ? ((current - prior) / prior) * 100 : null
  const significance = classifySignificance(pctChange, absoluteChange, trailingMean, trailingStd)
  return { current, prior, absolute_change: absoluteChange, percent_change: pctChange, significance }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute WoW, MoM, and trend-vs-baseline deltas for a single metric.
 */
export async function computeDelta(
  channel: Channel,
  metric: string,
  scope: Scope,
  scopeId: string,
  asOfDate: string
): Promise<DeltaReport> {
  // Window boundaries
  const wowCurrentStart = offsetDate(asOfDate, -6) // last 7 days inclusive
  const wowPriorStart = offsetDate(asOfDate, -13)
  const wowPriorEnd = offsetDate(asOfDate, -7)

  const momCurrentStart = offsetDate(asOfDate, -29) // last 30 days inclusive
  const momPriorStart = offsetDate(asOfDate, -59)
  const momPriorEnd = offsetDate(asOfDate, -30)

  // Trailing 30-day daily values for std/mean (includes current 30-day window)
  const trailing30 = await dailyValues(channel, metric, scope, scopeId, momCurrentStart, asOfDate)
  const trailingMean = mean(trailing30)
  const trailingStd = stddev(trailing30, trailingMean)

  // 4-week baseline mean (days -8 through -35, i.e. the 28 days before current 7-day window)
  const baselineStart = offsetDate(asOfDate, -35)
  const baselineEnd = offsetDate(asOfDate, -8)
  const baselineValues = await dailyValues(
    channel,
    metric,
    scope,
    scopeId,
    baselineStart,
    baselineEnd
  )
  const baselineMean = mean(baselineValues)

  const [wowCurrent, wowPrior, momCurrent, momPrior, trendCurrent] = await Promise.all([
    sumWindow(channel, metric, scope, scopeId, wowCurrentStart, asOfDate),
    sumWindow(channel, metric, scope, scopeId, wowPriorStart, wowPriorEnd),
    sumWindow(channel, metric, scope, scopeId, momCurrentStart, asOfDate),
    sumWindow(channel, metric, scope, scopeId, momPriorStart, momPriorEnd),
    sumWindow(channel, metric, scope, scopeId, wowCurrentStart, asOfDate),
  ])

  // Trend vs baseline: current 7-day sum vs (4-week baseline mean * 7)
  const baselineWeekEstimate = baselineMean * 7

  return {
    channel,
    metric,
    scope,
    scope_id: scopeId,
    as_of_date: asOfDate,
    wow: buildDelta(wowCurrent, wowPrior, trailingMean, trailingStd),
    mom: buildDelta(momCurrent, momPrior, trailingMean, trailingStd),
    trend_vs_baseline: buildDelta(trendCurrent, baselineWeekEstimate, trailingMean, trailingStd),
    trailing_30_mean: trailingMean,
    trailing_30_std: trailingStd,
  }
}

/**
 * Z-score every metric for a channel/scope against its trailing 30-day
 * distribution. Returns anomalies with |z| > 2.0 only.
 *
 * Metrics with fewer than 14 non-zero days in the trailing 30 are returned
 * with insufficient_data: true instead of a z-score.
 */
export async function detectAnomalies(
  channel: Channel,
  scope: Scope,
  scopeId: string,
  asOfDate: string
): Promise<AnomalyResult[]> {
  const supabase = getSupabase()
  const windowStart = offsetDate(asOfDate, -29)

  // Fetch all metrics for this channel/scope in the window
  const { data: rows, error } = await supabase
    .from('marketing_channel_daily')
    .select('metric, value, date')
    .eq('channel', channel)
    .eq('scope', scope)
    .eq('scope_id', scopeId)
    .gte('date', windowStart)
    .lte('date', asOfDate)
    .order('date', { ascending: true })

  if (error) throw new Error(`detectAnomalies fetch: ${error.message}`)

  // Group by metric
  const byMetric = new Map<string, { date: string; value: number }[]>()
  for (const row of rows ?? []) {
    const list = byMetric.get(row.metric) ?? []
    list.push({ date: row.date, value: row.value as number })
    byMetric.set(row.metric, list)
  }

  const results: AnomalyResult[] = []

  for (const [metric, entries] of byMetric) {
    // Most recent value
    const current = entries[entries.length - 1].value

    // Use non-zero distribution for z-score to handle metrics that don't fire daily
    const nonZeroValues = entries.map((e) => e.value).filter((v) => v !== 0)

    if (nonZeroValues.length < MIN_NON_ZERO_DAYS) {
      results.push({
        channel,
        metric,
        scope,
        scope_id: scopeId,
        insufficient_data: true,
        non_zero_days: nonZeroValues.length,
      })
      continue
    }

    const mu = mean(nonZeroValues)
    const sigma = stddev(nonZeroValues, mu)

    if (sigma === 0) continue // no variance, skip

    const z = (current - mu) / sigma

    if (Math.abs(z) > ANOMALY_Z_THRESHOLD) {
      results.push({
        channel,
        metric,
        scope,
        scope_id: scopeId,
        z_score: Math.round(z * 100) / 100,
        current_value: current,
        baseline_mean: Math.round(mu * 100) / 100,
        baseline_std: Math.round(sigma * 100) / 100,
        insufficient_data: false,
      })
    }
  }

  return results
}

/**
 * Sum a metric per channel across a date window and return channels ordered
 * by total descending. Useful for "which channel drove the most leads this week."
 */
export async function rankChannels(
  metric: string,
  windowDays: number,
  asOfDate: string
): Promise<ChannelRank[]> {
  const supabase = getSupabase()
  const startDate = offsetDate(asOfDate, -(windowDays - 1))

  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('channel, value')
    .eq('metric', metric)
    .gte('date', startDate)
    .lte('date', asOfDate)

  if (error) throw new Error(`rankChannels: ${error.message}`)

  const totals = new Map<string, number>()
  for (const row of data ?? []) {
    totals.set(row.channel, (totals.get(row.channel) ?? 0) + (row.value as number))
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  return sorted.map(([channel, total], i) => ({
    channel: channel as Channel,
    total,
    rank: i + 1,
  }))
}

// ---------------------------------------------------------------------------
// Recommended-action vocabulary
// ---------------------------------------------------------------------------
// Tags emitted by generateInsightSummary for downstream skills to act on.
// NOT user-facing copy.
//
// increase_budget       - strong positive signal, scale spend
// reduce_budget         - poor efficiency, trim spend to limit waste
// test_new_creative     - engagement or CTR has stalled despite impressions
// audit_landing_page    - traffic arriving but not converting
// investigate_drop      - anomalous crash needing root-cause investigation
// capitalize_on_spike   - anomalous spike, capture the moment with more spend or posting
// check_tracking        - metric looks wrong (implausibly zero or implausibly high)
// review_targeting      - reach/impressions up but quality metrics down
// expand_to_similar_audience - strong conversion rate, low reach -> scale audience
// pause_underperformer  - consistent negative trend across multiple periods
// ---------------------------------------------------------------------------

function deriveActions(
  deltas: DeltaReport[],
  anomalies: AnomalyResult[]
): RecommendedAction[] {
  const actions = new Set<RecommendedAction>()

  for (const delta of deltas) {
    const { wow, mom } = delta

    // Sustained crash across both windows -> pause or investigate
    if (wow.significance === 'crash' && mom.significance === 'crash') {
      actions.add('pause_underperformer')
      actions.add('investigate_drop')
    } else if (wow.significance === 'crash' || mom.significance === 'crash') {
      actions.add('investigate_drop')
    }

    // Rising or spiking on spend-adjacent metrics -> increase budget
    if (
      (delta.metric === 'leads' ||
        delta.metric === 'lead_events' ||
        delta.metric === 'conversions') &&
      (wow.significance === 'spike' || wow.significance === 'rising')
    ) {
      actions.add('increase_budget')
    }

    // Poor conversion despite traffic -> landing page
    if (
      (delta.metric === 'sessions' || delta.metric === 'impressions') &&
      (wow.significance === 'rising' || wow.significance === 'spike')
    ) {
      // Signal only; generate-briefs will confirm pairing with a conversion metric
      actions.add('audit_landing_page')
    }

    // Spend rising but leads flat/falling -> creative fatigue
    if (
      delta.metric === 'spend' &&
      (wow.significance === 'rising' || wow.significance === 'spike')
    ) {
      actions.add('test_new_creative')
    }

    // Consistent falling trend
    if (wow.significance === 'falling' && mom.significance === 'falling') {
      actions.add('reduce_budget')
    }

    // Reach up, quality down (heuristic via high impressions, treated as review signal)
    if (delta.metric === 'reach' && wow.significance === 'rising') {
      actions.add('review_targeting')
    }
  }

  // Anomaly-driven actions
  for (const anomaly of anomalies) {
    if (anomaly.insufficient_data) continue
    const a = anomaly as Anomaly
    if (a.z_score > ANOMALY_Z_THRESHOLD) {
      actions.add('capitalize_on_spike')
    } else if (a.z_score < -ANOMALY_Z_THRESHOLD) {
      actions.add('investigate_drop')
    }
    // Implausible zeros in a metric that normally has volume -> tracking issue
    if (a.current_value === 0 && a.baseline_mean > 10) {
      actions.add('check_tracking')
    }
  }

  // Strong single-metric conversion rate but low reach -> expand audience
  const hasStrongConversion = deltas.some(
    (d) =>
      (d.metric === 'lead_event_rate' || d.metric === 'conversion_rate') &&
      (d.wow.significance === 'rising' || d.wow.significance === 'spike')
  )
  const hasLowReach = deltas.some(
    (d) => d.metric === 'reach' && (d.wow.significance === 'falling' || d.wow.significance === 'stable')
  )
  if (hasStrongConversion && hasLowReach) {
    actions.add('expand_to_similar_audience')
  }

  return [...actions]
}

/**
 * Top-level function. Pulls all account-scope metrics for a channel, computes
 * deltas and anomalies, picks the 3-5 most significant insights, and returns a
 * structured InsightSummary for downstream skills.
 */
export async function generateInsightSummary(
  channel: Channel,
  asOfDate: string
): Promise<InsightSummary> {
  const supabase = getSupabase()
  const windowStart = offsetDate(asOfDate, -6)

  // Discover metrics present in the past 7 days for account scope
  const { data: recentRows, error: metricsErr } = await supabase
    .from('marketing_channel_daily')
    .select('metric')
    .eq('channel', channel)
    .eq('scope', 'account')
    .eq('scope_id', '')
    .gte('date', windowStart)
    .lte('date', asOfDate)

  if (metricsErr) throw new Error(`generateInsightSummary metrics: ${metricsErr.message}`)

  const metrics = [...new Set((recentRows ?? []).map((r) => r.metric as string))]

  // Compute deltas and anomalies in parallel
  const [deltaResults, anomalyResults] = await Promise.all([
    Promise.all(
      metrics.map((metric) =>
        computeDelta(channel, metric, 'account', '', asOfDate).catch((e) => {
          console.error(`computeDelta ${channel}/${metric}: ${e}`)
          return null
        })
      )
    ),
    detectAnomalies(channel, 'account', '', asOfDate).catch((e) => {
      console.error(`detectAnomalies ${channel}: ${e}`)
      return [] as AnomalyResult[]
    }),
  ])

  const deltas = deltaResults.filter((d): d is DeltaReport => d !== null)

  // Rank deltas by significance: spike/crash > rising/falling > stable
  const significanceScore: Record<Significance, number> = {
    spike: 4,
    crash: 4,
    rising: 2,
    falling: 2,
    stable: 0,
  }

  const rankedDeltas = deltas.sort(
    (a, b) =>
      significanceScore[b.wow.significance] +
      significanceScore[b.mom.significance] -
      (significanceScore[a.wow.significance] + significanceScore[a.mom.significance])
  )

  // Keep 3-5 most significant
  const topDeltas = rankedDeltas.slice(0, 5)

  // Build headline from single most significant delta
  let headline = `No significant signals for ${channel} as of ${asOfDate}.`
  if (topDeltas.length > 0) {
    const top = topDeltas[0]
    const sig = top.wow.significance
    const pct =
      top.wow.percent_change !== null ? `${Math.round(top.wow.percent_change)}%` : 'from zero'
    headline = `${channel.toUpperCase()}: ${top.metric} ${sig === 'rising' || sig === 'spike' ? 'up' : 'down'} ${pct} WoW (${sig}).`
  }

  const actions = deriveActions(topDeltas, anomalyResults)

  return {
    channel,
    as_of_date: asOfDate,
    headline,
    deltas: topDeltas,
    anomalies: anomalyResults,
    recommended_actions: actions,
  }
}
