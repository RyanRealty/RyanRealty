/**
 * marketing-brain: performance-bias
 *
 * Reads the last N days of content_performance rows and computes a bias
 * report that generate-briefs uses to float winning formats to the top of
 * each cycle's opportunity ranking.
 *
 * Algorithm:
 *   - Group (format, platform) pairs from the last windowDays days.
 *   - For each group with >= minSampleCount rows where metrics_7d is
 *     populated, compute avg save_rate, avg share_rate, and avg
 *     north_star_attributed_seller_leads.
 *   - Derive bias_score = 1.0 + (avg_north_star * 0.6) + (avg_save * 0.25)
 *     + (avg_share * 0.15). Range: 1.0 = baseline, > 1.0 = above, < 1.0 below.
 *   - Winners: bias_score > 1.2 AND sample_count >= minSampleCount.
 *   - Losers: bias_score < 0.8 AND sample_count >= minSampleCount.
 *
 * Soft-fail contract:
 *   If content_performance has no rows in the window or the query errors,
 *   gatherPerformanceBias returns an empty report with total_posts_analyzed=0.
 *   applyBiasToOpportunities becomes a no-op when format_bias_map is empty.
 *
 * No em-dashes. No en-dashes. No banned vocabulary.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface WinningPattern {
  format: string
  platform: string
  sample_count: number
  avg_save_rate: number
  avg_share_rate: number
  avg_north_star_attribution: number
  bias_score: number
}

export interface PerformanceBiasReport {
  computed_at: string
  window_days: number
  total_posts_analyzed: number
  winners: WinningPattern[]
  losers: WinningPattern[]
  /** format -> avg bias_score across all platforms for that format */
  format_bias_map: Record<string, number>
  /** platform -> avg bias_score across all formats for that platform */
  platform_bias_map: Record<string, number>
}

/** Minimum viable Opportunity shape (subset used for bias application). */
export interface Opportunity {
  format?: string
  platforms?: string[]
  rank_score: number
  bias_multiplier?: number
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WINDOW_DAYS = 30
const DEFAULT_MIN_SAMPLE_COUNT = 3
const WINNER_THRESHOLD = 1.2
const LOSER_THRESHOLD = 0.8

// ---------------------------------------------------------------------------
// Bias computation
// ---------------------------------------------------------------------------

/**
 * gatherPerformanceBias
 *
 * Pulls the last windowDays days of content_performance rows (where
 * metrics_7d is populated) and returns a PerformanceBiasReport.
 *
 * Soft-fail: on any error, returns an empty report so the brain keeps
 * running without historical data.
 */
export async function gatherPerformanceBias(
  supabase: SupabaseClient,
  opts: { windowDays?: number; minSampleCount?: number } = {}
): Promise<PerformanceBiasReport> {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS
  const minSampleCount = opts.minSampleCount ?? DEFAULT_MIN_SAMPLE_COUNT
  const empty: PerformanceBiasReport = {
    computed_at: new Date().toISOString(),
    window_days: windowDays,
    total_posts_analyzed: 0,
    winners: [],
    losers: [],
    format_bias_map: {},
    platform_bias_map: {},
  }

  try {
    const cutoff = new Date(Date.now() - windowDays * 24 * 3600 * 1000).toISOString()

    const { data, error } = await supabase
      .from('content_performance')
      .select(
        'platform, metrics_7d, north_star_attributed_seller_leads, action_id, marketing_brain_actions!inner(format, action_type)'
      )
      .gte('posted_at', cutoff)
      .not('metrics_7d', 'is', null)

    if (error) {
      console.error('gatherPerformanceBias: query error:', error.message)
      return empty
    }

    // Supabase join returns marketing_brain_actions as an array (even with !inner).
    // Cast via unknown to avoid the "no overlap" TS error.
    const rows = ((data ?? []) as unknown) as Array<{
      platform: string
      metrics_7d: Record<string, unknown> | null
      north_star_attributed_seller_leads: number | null
      action_id: string
      marketing_brain_actions: { format: string | null; action_type: string | null } | Array<{ format: string | null; action_type: string | null }>
    }>

    if (rows.length === 0) return empty

    // Group by (format, platform)
    const groups = new Map<string, {
      format: string
      platform: string
      save_rates: number[]
      share_rates: number[]
      north_star_counts: number[]
    }>()

    for (const row of rows) {
      // Supabase may return the join as an array or a single object depending on cardinality.
      const mba = Array.isArray(row.marketing_brain_actions)
        ? row.marketing_brain_actions[0]
        : row.marketing_brain_actions
      const format = mba?.format ?? extractFormatFromActionType(mba?.action_type ?? '')
      if (!format) continue

      const platform = row.platform
      const key = `${format}::${platform}`

      if (!groups.has(key)) {
        groups.set(key, { format, platform, save_rates: [], share_rates: [], north_star_counts: [] })
      }

      const group = groups.get(key)!
      const m7 = row.metrics_7d as Record<string, unknown> | null

      // Compute save_rate = saves / impressions. Use 0 when unavailable.
      const saves = typeof m7?.saves === 'number' ? m7.saves : 0
      const impressions = typeof m7?.impressions === 'number' && m7.impressions > 0 ? m7.impressions : null
      const saveRate = impressions !== null ? saves / impressions : 0

      // share_rate = shares / impressions
      const shares = typeof m7?.shares === 'number' ? m7.shares : 0
      const shareRate = impressions !== null ? shares / impressions : 0

      const northStar = typeof row.north_star_attributed_seller_leads === 'number'
        ? row.north_star_attributed_seller_leads
        : 0

      group.save_rates.push(saveRate)
      group.share_rates.push(shareRate)
      group.north_star_counts.push(northStar)
    }

    const patterns: WinningPattern[] = []

    for (const group of groups.values()) {
      const n = group.save_rates.length
      if (n < minSampleCount) continue

      const avg_save_rate = group.save_rates.reduce((a, b) => a + b, 0) / n
      const avg_share_rate = group.share_rates.reduce((a, b) => a + b, 0) / n
      const avg_north_star = group.north_star_counts.reduce((a, b) => a + b, 0) / n

      // bias_score formula per spec
      const bias_score =
        1.0 +
        avg_north_star * 0.6 +
        avg_save_rate * 0.25 +
        avg_share_rate * 0.15

      patterns.push({
        format: group.format,
        platform: group.platform,
        sample_count: n,
        avg_save_rate,
        avg_share_rate,
        avg_north_star_attribution: avg_north_star,
        bias_score,
      })
    }

    const winners = patterns.filter((p) => p.bias_score > WINNER_THRESHOLD)
    const losers = patterns.filter((p) => p.bias_score < LOSER_THRESHOLD)

    // format_bias_map: avg bias_score across all platforms per format
    const formatGroups = new Map<string, number[]>()
    for (const p of patterns) {
      if (!formatGroups.has(p.format)) formatGroups.set(p.format, [])
      formatGroups.get(p.format)!.push(p.bias_score)
    }
    const format_bias_map: Record<string, number> = {}
    for (const [fmt, scores] of formatGroups) {
      format_bias_map[fmt] = scores.reduce((a, b) => a + b, 0) / scores.length
    }

    // platform_bias_map: avg bias_score across all formats per platform
    const platformGroups = new Map<string, number[]>()
    for (const p of patterns) {
      if (!platformGroups.has(p.platform)) platformGroups.set(p.platform, [])
      platformGroups.get(p.platform)!.push(p.bias_score)
    }
    const platform_bias_map: Record<string, number> = {}
    for (const [plat, scores] of platformGroups) {
      platform_bias_map[plat] = scores.reduce((a, b) => a + b, 0) / scores.length
    }

    return {
      computed_at: new Date().toISOString(),
      window_days: windowDays,
      total_posts_analyzed: rows.length,
      winners,
      losers,
      format_bias_map,
      platform_bias_map,
    }
  } catch (err) {
    console.error('gatherPerformanceBias: unexpected error:', err instanceof Error ? err.message : String(err))
    return empty
  }
}

// ---------------------------------------------------------------------------
// Bias application
// ---------------------------------------------------------------------------

/**
 * applyBiasToOpportunities
 *
 * Multiplies each opportunity's rank_score by the format-level bias from the
 * report, then re-sorts by rank_score descending. Opportunities for formats
 * with no historical data are left at bias_multiplier=1.0 (no change).
 */
export function applyBiasToOpportunities<T extends Opportunity>(
  opportunities: T[],
  report: PerformanceBiasReport
): T[] {
  if (Object.keys(report.format_bias_map).length === 0) {
    // No historical data. Return as-is so the brain is unaffected.
    return opportunities
  }

  for (const opp of opportunities) {
    const format = opp.format ?? ''
    const biasMultiplier = report.format_bias_map[format] ?? 1.0
    opp.bias_multiplier = biasMultiplier
    opp.rank_score = opp.rank_score * biasMultiplier
  }

  // Re-sort descending by rank_score
  opportunities.sort((a, b) => b.rank_score - a.rank_score)
  return opportunities
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Extract a format string from an action_type string as a fallback when the
 * marketing_brain_actions.format column is null. For example,
 * 'content:market_data_short' -> 'market_data_short'.
 */
function extractFormatFromActionType(actionType: string): string {
  if (!actionType) return ''
  const colonIdx = actionType.indexOf(':')
  if (colonIdx === -1) return actionType
  return actionType.slice(colonIdx + 1)
}
