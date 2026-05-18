/**
 * Strategy revision check cron.
 *
 * Monthly (1st of month at 14:00 UTC). Reads the active marketing_strategy
 * row and computes actuals for the prior calendar month against
 * channel_targets. If the north-star gap is >= 20%, inserts a
 * marketing_brain_actions row of type 'strategy:revision_proposal'.
 *
 * Always returns a JSON gap report regardless of whether a proposal was
 * emitted. Matt can curl this anytime:
 *   GET /api/cron/strategy-revision-check
 *
 * Idempotency: the revision_proposal INSERT uses a WHERE NOT EXISTS guard
 * keyed on (action_type, target, status IN ('pending','ready')) so
 * re-running on the same month does not create duplicate proposals.
 *
 * Schedule: monthly, 1st at 14:00 UTC (see vercel.json).
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Manual invocation:
 *   GET /api/cron/strategy-revision-check
 *     ?asOfDate=YYYY-MM-DD   (compute for the month containing this date)
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 60

interface GapMetric {
  name: string
  target: number | null
  actual: number | null
  gap_pct: number | null
  status: 'on_track' | 'at_risk' | 'below_target' | 'no_data' | 'no_target'
}

function computeGapPct(target: number | null, actual: number | null): number | null {
  if (target === null || actual === null || target === 0) return null
  return ((actual - target) / target) * 100
}

function gapStatus(gap: number | null, isInverted = false): GapMetric['status'] {
  if (gap === null) return 'no_data'
  // isInverted = true means lower is better (e.g. CPL).
  const effective = isInverted ? -gap : gap
  if (effective >= 0) return 'on_track'
  if (effective >= -10) return 'at_risk'
  return 'below_target'
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const asOfDateParam = url.searchParams.get('asOfDate')?.trim()

  let asOf: Date
  if (asOfDateParam && /^\d{4}-\d{2}-\d{2}$/.test(asOfDateParam)) {
    asOf = new Date(asOfDateParam + 'T00:00:00Z')
  } else {
    asOf = new Date()
  }

  // Compute the prior calendar month window.
  const monthStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, 1))
  const monthEnd = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1))
  const monthLabel = monthStart.toISOString().slice(0, 7) // YYYY-MM

  const startedAt = new Date().toISOString()
  const supabase = createServiceClient()

  // Load active strategy.
  const { data: strategyRows, error: stratErr } = await supabase
    .from('marketing_strategy')
    .select('id, quarter, channel_targets, north_star_target')
    .eq('status', 'active')
    .order('generated_at', { ascending: false })
    .limit(1)

  if (stratErr) {
    return NextResponse.json({ error: stratErr.message }, { status: 500 })
  }

  const strategy = strategyRows?.[0] ?? null
  const channelTargets = (strategy?.channel_targets ?? {}) as Record<string, unknown>

  // Helper: pull a metric sum from marketing_channel_daily for the month.
  async function monthSum(channel: string, metric: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('marketing_channel_daily')
      .select('value')
      .eq('channel', channel)
      .eq('metric', metric)
      .gte('date', monthStart.toISOString().slice(0, 10))
      .lt('date', monthEnd.toISOString().slice(0, 10))

    if (error || !data) return null
    if (data.length === 0) return null
    return data.reduce((sum, r) => sum + (typeof r.value === 'number' ? r.value : 0), 0)
  }

  // Helper: pull a metric avg from marketing_channel_daily for the month.
  async function monthAvg(channel: string, metric: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('marketing_channel_daily')
      .select('value')
      .eq('channel', channel)
      .eq('metric', metric)
      .gte('date', monthStart.toISOString().slice(0, 10))
      .lt('date', monthEnd.toISOString().slice(0, 10))

    if (error || !data || data.length === 0) return null
    const total = data.reduce((sum, r) => sum + (typeof r.value === 'number' ? r.value : 0), 0)
    return total / data.length
  }

  // 1. North star: qualified seller leads.
  const northStarTarget = typeof strategy?.north_star_target === 'number'
    ? strategy.north_star_target
    : typeof (channelTargets.north_star as Record<string, unknown> | undefined)?.monthly_seller_leads_target === 'number'
      ? (channelTargets.north_star as Record<string, unknown>).monthly_seller_leads_target as number
      : null

  const northStarActual = await monthSum('fub', 'qualified_seller_leads')
  const northStarGap = computeGapPct(northStarTarget, northStarActual)

  const northStarMetric: GapMetric = {
    name: 'qualified_seller_leads',
    target: northStarTarget,
    actual: northStarActual,
    gap_pct: northStarGap,
    status: gapStatus(northStarGap),
  }

  // 2. Brand position: Instagram follower count (latest in month).
  const igFollowersTarget = typeof (channelTargets.instagram as Record<string, unknown> | undefined)?.followers_target === 'number'
    ? (channelTargets.instagram as Record<string, unknown>).followers_target as number
    : 5000
  const igFollowersActual = await monthAvg('instagram', 'followers')
  const igFollowersGap = computeGapPct(igFollowersTarget, igFollowersActual)

  // 3. Channel growth: IG save rate.
  const igSaveTarget = typeof (channelTargets.instagram as Record<string, unknown> | undefined)?.save_rate_floor === 'number'
    ? (channelTargets.instagram as Record<string, unknown>).save_rate_floor as number
    : 0.02
  const igSaveActual = await monthAvg('instagram', 'save_rate')
  const igSaveGap = computeGapPct(igSaveTarget, igSaveActual)

  // 4. Ad health: CPL (lower is better, inverted).
  const cplCeiling = typeof (channelTargets.meta_ads as Record<string, unknown> | undefined)?.cpl_ceiling === 'number'
    ? (channelTargets.meta_ads as Record<string, unknown>).cpl_ceiling as number
    : 65
  const cplActual = await monthAvg('meta_ads', 'cost_per_lead')
  // For CPL: gap_pct > 0 means CPL exceeded ceiling (bad). Invert so negative = good.
  const cplGap = computeGapPct(cplActual, cplCeiling) // gap = (ceiling-actual)/actual*100 -- inverted logic below
  // Actually: we want to flag when actual > ceiling. Compute as (actual - ceiling)/ceiling * 100.
  const cplGapActual = computeGapPct(cplCeiling, cplActual)

  // 5. Site health: GA4 valuation form conversion rate.
  const convTarget = typeof (channelTargets.ga4 as Record<string, unknown> | undefined)?.valuation_form_conversion_rate_target === 'number'
    ? (channelTargets.ga4 as Record<string, unknown>).valuation_form_conversion_rate_target as number
    : 0.03
  const convActual = await monthAvg('ga4', 'valuation_form_conversion_rate')
  const convGap = computeGapPct(convTarget, convActual)

  const gapReport: GapMetric[] = [
    northStarMetric,
    {
      name: 'instagram_followers',
      target: igFollowersTarget,
      actual: igFollowersActual,
      gap_pct: igFollowersGap,
      status: gapStatus(igFollowersGap),
    },
    {
      name: 'instagram_save_rate',
      target: igSaveTarget,
      actual: igSaveActual,
      gap_pct: igSaveGap,
      status: gapStatus(igSaveGap),
    },
    {
      name: 'meta_ads_cpl',
      target: cplCeiling,
      actual: cplActual,
      gap_pct: cplGapActual,
      status: gapStatus(cplGapActual, true), // inverted: lower is better
    },
    {
      name: 'ga4_valuation_form_conversion_rate',
      target: convTarget,
      actual: convActual,
      gap_pct: convGap,
      status: gapStatus(convGap),
    },
  ]

  // Emit a revision proposal if north-star gap <= -20% (missed by 20% or more).
  let proposalEmitted = false
  let proposalId: string | null = null

  const PROPOSAL_THRESHOLD_PCT = -20

  if (
    northStarGap !== null &&
    northStarGap <= PROPOSAL_THRESHOLD_PCT &&
    strategy
  ) {
    const proposalTarget = `quarter:${strategy.quarter ?? 'unknown'},month:${monthLabel}`

    // Idempotency guard: skip if an open proposal for this month already exists.
    const { data: existing } = await supabase
      .from('marketing_brain_actions')
      .select('id')
      .eq('action_type', 'strategy:revision_proposal')
      .eq('target', proposalTarget)
      .in('status', ['pending', 'ready', 'in_production'])
      .limit(1)

    if (!existing?.length) {
      const { data: inserted, error: insertErr } = await supabase
        .from('marketing_brain_actions')
        .insert({
          action_type: 'strategy:revision_proposal',
          target: proposalTarget,
          assigned_producer: 'marketing_brain_skills/strategy/revision-proposer',
          status: 'ready',
          generation_reason: `North-star gap ${northStarGap.toFixed(1)}% for ${monthLabel} (target ${northStarTarget}, actual ${northStarActual}). Threshold: ${PROPOSAL_THRESHOLD_PCT}%.`,
          payload: {
            month: monthLabel,
            quarter: strategy.quarter,
            strategy_id: strategy.id,
            gap_report: gapReport,
          },
          priority_score: 90,
        })
        .select('id')

      if (!insertErr && inserted?.length) {
        proposalEmitted = true
        proposalId = inserted[0].id
      } else if (insertErr) {
        console.error('[strategy-revision-check] insert error:', insertErr.message)
      }
    }
  }

  return NextResponse.json({
    startedAt,
    month_analyzed: monthLabel,
    month_start: monthStart.toISOString().slice(0, 10),
    month_end: monthEnd.toISOString().slice(0, 10),
    strategy_quarter: strategy?.quarter ?? null,
    strategy_id: strategy?.id ?? null,
    north_star_gap_pct: northStarGap,
    revision_proposal_emitted: proposalEmitted,
    revision_proposal_id: proposalId,
    gap_report: gapReport,
  })
}
