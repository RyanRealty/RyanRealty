/**
 * marketing-brain: audit-ads
 *
 * Audits Ryan Realty's paid Meta Ads performance against the 3-campaign
 * playbook ($30/$20/$10/day cold/lookalike/retargeting). Produces a
 * structured AdsAuditReport that the generate-briefs skill consumes to
 * decide what creative, targeting, or budget changes to propose.
 *
 * Reads ONLY from public.marketing_channel_daily (channel='meta_ads' and
 * channel='fub'). Does NOT call the Meta Ads API directly — the ingestor
 * already populated the table.
 *
 * Thresholds (locked to spec):
 *   Creative fatigue : CPM rising > 25% WoW AND CTR falling > 15% WoW
 *   Budget drift     : actual spend > 110% or < 85% of playbook target
 *   CPL under-perf   : campaign CPL > 2x account-level CPL
 *   Tracking gap     : |meta_conversions - fub_qualified_leads| > 30% of meta value
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { RecommendedAction } from './diagnose'

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

/** Playbook budget targets per campaign role. */
export type CampaignRole = 'cold' | 'lookalike' | 'retargeting' | 'unknown'

/** Per-campaign performance summary for the audit window. */
export interface CampaignPerformance {
  campaign_id: string
  campaign_name: string
  role: CampaignRole
  spend: number
  impressions: number
  clicks: number
  cpm: number // cost-per-mille (derived from data)
  cpc: number // cost-per-click (derived from data)
  ctr: number // click-through rate % (derived from data)
  conversions: number
  cpl: number // cost per conversion/lead (spend / conversions, or null if 0)
  /** CPL relative to account-level CPL. 1.0 = at average; >2.0 = flag. */
  cpl_ratio: number | null
  flags: CampaignFlag[]
}

/** An individual flag raised on a campaign. */
export interface CampaignFlag {
  type: 'underperforming_cpl' | 'budget_drift' | 'no_conversions' | 'low_spend'
  severity: 'high' | 'medium' | 'low'
  detail: string
}

/** Creative fatigue signal for the account. */
export interface FatigueSignal {
  flagged: boolean
  cpm_wow_pct: number | null // positive = CPM rose WoW
  ctr_wow_pct: number | null // negative = CTR fell WoW
  /** True when CPM rose > 25% WoW AND CTR fell > 15% WoW simultaneously. */
  threshold_met: boolean
  detail: string
}

/** Budget efficiency analysis vs. playbook targets. */
export interface BudgetEfficiency {
  window_days: number
  playbook_daily_total: number // $60
  actual_spend: number
  expected_spend: number // playbook_daily_total * window_days
  spend_pct_of_target: number // 100 = on-budget
  drift_flagged: boolean // outside 85%–110% band
  by_role: BudgetByRole[]
}

export interface BudgetByRole {
  role: CampaignRole
  playbook_daily: number | null // null for 'unknown'
  actual_spend: number
  expected_spend: number | null
  spend_pct_of_target: number | null
  drift_flagged: boolean
}

/** Attribution comparison: Meta Ads conversions vs FUB qualified_seller_leads. */
export interface ConversionPath {
  window_days: number
  meta_conversions: number
  fub_qualified_leads: number
  /** Positive = Meta over-counts; negative = FUB over-counts. */
  delta: number
  delta_pct: number | null // relative to meta_conversions
  tracking_gap_flagged: boolean // |delta_pct| > 30%
  detail: string
}

/** A ranked opportunity for generate-briefs to act on. */
export interface Opportunity {
  area: 'creative' | 'targeting' | 'budget' | 'tracking' | 'campaign_structure'
  severity: 'high' | 'medium' | 'low'
  headline: string
  evidence: string
  recommended_action: RecommendedAction
}

/** Top-level output of auditAds(). Consumed by generate-briefs. */
export interface AdsAuditReport {
  as_of_date: string
  window_days: number
  campaigns: CampaignPerformance[]
  fatigue: FatigueSignal
  budget: BudgetEfficiency
  conversion_path: ConversionPath
  opportunities: Opportunity[] // max 7, ordered by severity desc
  generated_at: string
}

// ---------------------------------------------------------------------------
// Playbook constants (locked to FB_SELLER_CAMPAIGN_PLAYBOOK.md)
// ---------------------------------------------------------------------------

const PLAYBOOK_DAILY_TOTAL = 60 // USD/day

/** Budget targets keyed by role. */
const PLAYBOOK_DAILY_BY_ROLE: Record<Exclude<CampaignRole, 'unknown'>, number> = {
  cold: 30,
  lookalike: 20,
  retargeting: 10,
}

/** Keywords used to classify campaign role from campaign name. */
const ROLE_KEYWORDS: Array<{ role: Exclude<CampaignRole, 'unknown'>; keywords: string[] }> = [
  { role: 'cold', keywords: ['cold', 'acquisition', 'awareness', 'prospecting', 'broad'] },
  { role: 'lookalike', keywords: ['lookalike', 'lal', 'similar', 'past seller', 'seed'] },
  { role: 'retargeting', keywords: ['retarg', 'retarget', 'remarketing', 'site visitor', 'website'] },
]

// Thresholds (locked to spec)
const FATIGUE_CPM_WOW_THRESHOLD = 25 // % CPM must rise WoW
const FATIGUE_CTR_WOW_THRESHOLD = -15 // % CTR must fall WoW (negative)
const BUDGET_HIGH_THRESHOLD = 110 // % of target — above this is drift
const BUDGET_LOW_THRESHOLD = 85 // % of target — below this is drift
const CPL_RATIO_THRESHOLD = 2.0 // campaign CPL / account CPL
const TRACKING_GAP_THRESHOLD = 30 // % deviation between Meta and FUB conversions

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Offset a YYYY-MM-DD string by N days (negative = past). */
function offsetDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Safe percent change: null when base is zero. */
function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null
  return ((current - prior) / prior) * 100
}

/** Round to two decimal places. */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Classify campaign role from its name. Returns 'unknown' when no keywords match. */
function inferRole(campaignName: string): CampaignRole {
  const lower = campaignName.toLowerCase()
  for (const { role, keywords } of ROLE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return role
  }
  return 'unknown'
}

// ---------------------------------------------------------------------------
// Data fetchers (all from marketing_channel_daily, no external API calls)
// ---------------------------------------------------------------------------

interface DailyRow {
  date: string
  scope: string
  scope_id: string
  metric: string
  value: number
  metadata: Record<string, unknown>
}

/** Fetch all meta_ads rows for a window. Returns every scope (account + campaign). */
async function fetchMetaAdsRows(
  startDate: string,
  endDate: string
): Promise<DailyRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('date, scope, scope_id, metric, value, metadata')
    .eq('channel', 'meta_ads')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(`fetchMetaAdsRows: ${error.message}`)
  return (data ?? []) as DailyRow[]
}

/** Fetch FUB qualified_seller_leads for a window (scope='account', metric='qualified_seller_leads'). */
async function fetchFubLeads(startDate: string, endDate: string): Promise<number> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('value')
    .eq('channel', 'fub')
    .eq('scope', 'account')
    .eq('metric', 'qualified_seller_leads')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw new Error(`fetchFubLeads: ${error.message}`)
  return (data ?? []).reduce((acc, r) => acc + (r.value as number), 0)
}

/** Sum values for a given channel/scope/metric in a window. */
function sumMetric(
  rows: DailyRow[],
  scope: string,
  scopeId: string,
  metric: string
): number {
  return rows
    .filter((r) => r.scope === scope && r.scope_id === scopeId && r.metric === metric)
    .reduce((acc, r) => acc + (r.value as number), 0)
}

/** Average a rate metric (cpm, cpc, ctr) across days for a campaign/account. */
function avgMetric(
  rows: DailyRow[],
  scope: string,
  scopeId: string,
  metric: string
): number {
  const vals = rows
    .filter((r) => r.scope === scope && r.scope_id === scopeId && r.metric === metric)
    .map((r) => r.value as number)
  if (vals.length === 0) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/** Discover distinct campaign IDs + names from the data rows. */
function discoverCampaigns(rows: DailyRow[]): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>()
  for (const r of rows) {
    if (r.scope === 'campaign' && r.scope_id && !seen.has(r.scope_id)) {
      const name =
        (r.metadata as Record<string, string | undefined>)?.campaign_name ?? r.scope_id
      seen.set(r.scope_id, name)
    }
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
}

// ---------------------------------------------------------------------------
// Core analysis functions
// ---------------------------------------------------------------------------

/**
 * Compute per-campaign performance metrics for the window. Compares each
 * campaign's CPL to the account-level CPL and flags outliers.
 */
export async function analyzeCampaignPerformance(
  windowDays: number,
  asOfDate: string
): Promise<CampaignPerformance[]> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))
  const rows = await fetchMetaAdsRows(startDate, asOfDate)

  // Account-level CPL for ratio baseline
  const accountConversions = sumMetric(rows, 'account', '', 'conversions')
  const accountSpend = sumMetric(rows, 'account', '', 'spend')
  const accountCpl = accountConversions > 0 ? accountSpend / accountConversions : null

  const campaigns = discoverCampaigns(rows)
  const results: CampaignPerformance[] = []

  for (const { id, name } of campaigns) {
    const spend = sumMetric(rows, 'campaign', id, 'spend')
    const impressions = sumMetric(rows, 'campaign', id, 'impressions')
    const clicks = sumMetric(rows, 'campaign', id, 'clicks')
    const conversions = sumMetric(rows, 'campaign', id, 'conversions')

    // Use averaged rate metrics since CPM/CPC/CTR are already rates in the table
    const cpm = avgMetric(rows, 'campaign', id, 'cpm')
    const cpc = avgMetric(rows, 'campaign', id, 'cpc')
    const ctr = avgMetric(rows, 'campaign', id, 'ctr')

    const cpl = conversions > 0 ? r2(spend / conversions) : 0
    const cplRatio =
      accountCpl !== null && cpl > 0 ? r2(cpl / accountCpl) : null

    const role = inferRole(name)
    const flags: CampaignFlag[] = []

    // Flag: CPL > 2x account CPL
    if (cplRatio !== null && cplRatio > CPL_RATIO_THRESHOLD) {
      flags.push({
        type: 'underperforming_cpl',
        severity: 'high',
        detail: `CPL $${cpl} is ${r2(cplRatio)}x account average ($${r2(accountCpl ?? 0)})`,
      })
    }

    // Flag: conversions = 0 but spend > 0 (wasted spend with no result)
    if (conversions === 0 && spend > 0) {
      flags.push({
        type: 'no_conversions',
        severity: 'medium',
        detail: `$${r2(spend)} spent with zero conversions in the window`,
      })
    }

    // Flag: < $5 spend in window (likely paused or misconfigured)
    if (spend < 5) {
      flags.push({
        type: 'low_spend',
        severity: 'low',
        detail: `Only $${r2(spend)} spent — may be paused or under-delivering`,
      })
    }

    results.push({
      campaign_id: id,
      campaign_name: name,
      role,
      spend: r2(spend),
      impressions,
      clicks,
      cpm: r2(cpm),
      cpc: r2(cpc),
      ctr: r2(ctr),
      conversions,
      cpl,
      cpl_ratio: cplRatio,
      flags,
    })
  }

  return results
}

/**
 * Detect creative fatigue at the account level.
 * Fatigue = CPM rising > 25% WoW AND CTR falling > 15% WoW simultaneously.
 * Uses the 7-day current window vs the prior 7-day window.
 */
export async function detectCreativeFatigue(
  windowDays: number,
  asOfDate: string
): Promise<FatigueSignal> {
  // Current 7 days
  const cur7Start = offsetDate(asOfDate, -6)
  const cur7End = asOfDate

  // Prior 7 days
  const pri7Start = offsetDate(asOfDate, -13)
  const pri7End = offsetDate(asOfDate, -7)

  const [curRows, priRows] = await Promise.all([
    fetchMetaAdsRows(cur7Start, cur7End),
    fetchMetaAdsRows(pri7Start, pri7End),
  ])

  const curCpm = avgMetric(curRows, 'account', '', 'cpm')
  const priCpm = avgMetric(priRows, 'account', '', 'cpm')
  const curCtr = avgMetric(curRows, 'account', '', 'ctr')
  const priCtr = avgMetric(priRows, 'account', '', 'ctr')

  const cpmWowPct = pctChange(curCpm, priCpm)
  const ctrWowPct = pctChange(curCtr, priCtr)

  const cpmRising =
    cpmWowPct !== null && cpmWowPct > FATIGUE_CPM_WOW_THRESHOLD
  const ctrFalling =
    ctrWowPct !== null && ctrWowPct < FATIGUE_CTR_WOW_THRESHOLD

  const thresholdMet = cpmRising && ctrFalling
  const flagged = thresholdMet

  let detail: string
  if (thresholdMet) {
    detail =
      `CPM rose ${r2(cpmWowPct!)}% WoW (>${FATIGUE_CPM_WOW_THRESHOLD}% threshold) ` +
      `and CTR fell ${r2(ctrWowPct!)}% WoW (<${FATIGUE_CTR_WOW_THRESHOLD}% threshold). ` +
      `Audience has seen this creative too many times — swap assets.`
  } else if (cpmRising) {
    detail = `CPM rising ${r2(cpmWowPct!)}% WoW but CTR not yet in decline — monitor closely.`
  } else if (ctrFalling) {
    detail = `CTR falling ${r2(ctrWowPct ?? 0)}% WoW but CPM not yet rising — early engagement erosion.`
  } else {
    detail = 'No fatigue signal detected — CPM and CTR within normal week-over-week range.'
  }

  return {
    flagged,
    cpm_wow_pct: cpmWowPct !== null ? r2(cpmWowPct) : null,
    ctr_wow_pct: ctrWowPct !== null ? r2(ctrWowPct) : null,
    threshold_met: thresholdMet,
    detail,
  }
}

/**
 * Compare actual spend vs the playbook budget ($60/day total, per-role split).
 * Flags drift when actual is outside the 85%–110% band of expected spend.
 */
export async function analyzeBudgetEfficiency(
  windowDays: number,
  asOfDate: string
): Promise<BudgetEfficiency> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))
  const rows = await fetchMetaAdsRows(startDate, asOfDate)

  const expectedTotal = PLAYBOOK_DAILY_TOTAL * windowDays
  const actualTotal = sumMetric(rows, 'account', '', 'spend')
  const spendPct = r2((actualTotal / expectedTotal) * 100)
  const driftFlagged =
    spendPct > BUDGET_HIGH_THRESHOLD || spendPct < BUDGET_LOW_THRESHOLD

  // Discover campaigns and group by role
  const campaigns = discoverCampaigns(rows)
  const spendByRole = new Map<CampaignRole, number>()

  for (const { id, name } of campaigns) {
    const spend = sumMetric(rows, 'campaign', id, 'spend')
    const role = inferRole(name)
    spendByRole.set(role, (spendByRole.get(role) ?? 0) + spend)
  }

  const byRole: BudgetByRole[] = (
    ['cold', 'lookalike', 'retargeting', 'unknown'] as CampaignRole[]
  ).map((role) => {
    const actualSpend = spendByRole.get(role) ?? 0
    const daily =
      role !== 'unknown' ? PLAYBOOK_DAILY_BY_ROLE[role as Exclude<CampaignRole, 'unknown'>] : null
    const expected = daily !== null ? daily * windowDays : null
    const pct = expected !== null && expected > 0 ? r2((actualSpend / expected) * 100) : null
    const roleDrift =
      pct !== null && (pct > BUDGET_HIGH_THRESHOLD || pct < BUDGET_LOW_THRESHOLD)

    return {
      role,
      playbook_daily: daily,
      actual_spend: r2(actualSpend),
      expected_spend: expected,
      spend_pct_of_target: pct,
      drift_flagged: roleDrift,
    }
  })

  return {
    window_days: windowDays,
    playbook_daily_total: PLAYBOOK_DAILY_TOTAL,
    actual_spend: r2(actualTotal),
    expected_spend: expectedTotal,
    spend_pct_of_target: spendPct,
    drift_flagged: driftFlagged,
    by_role: byRole,
  }
}

/**
 * Compare Meta Ads conversions to FUB qualified_seller_leads for the same
 * window. Flags a tracking gap when the delta exceeds 30%.
 */
export async function analyzeConversionPath(
  windowDays: number,
  asOfDate: string
): Promise<ConversionPath> {
  const startDate = offsetDate(asOfDate, -(windowDays - 1))

  const [rows, fubLeads] = await Promise.all([
    fetchMetaAdsRows(startDate, asOfDate),
    fetchFubLeads(startDate, asOfDate),
  ])

  const metaConversions = sumMetric(rows, 'account', '', 'conversions')
  const delta = metaConversions - fubLeads
  const deltaPct = pctChange(Math.abs(delta), metaConversions)

  const trackingGapFlagged =
    metaConversions > 0 &&
    deltaPct !== null &&
    Math.abs(deltaPct) > TRACKING_GAP_THRESHOLD

  let detail: string
  if (metaConversions === 0 && fubLeads === 0) {
    detail = 'No conversions on either side in this window.'
  } else if (trackingGapFlagged) {
    const dir = delta > 0 ? 'over-counting' : 'under-counting'
    detail =
      `Meta Ads is ${dir} relative to FUB by ${r2(Math.abs(deltaPct!))}% ` +
      `(Meta: ${metaConversions}, FUB: ${fubLeads}). ` +
      `Check Pixel events and FUB webhook integration.`
  } else {
    detail = `Meta Ads (${metaConversions}) and FUB (${fubLeads}) are within the acceptable 30% band.`
  }

  return {
    window_days: windowDays,
    meta_conversions: metaConversions,
    fub_qualified_leads: fubLeads,
    delta,
    delta_pct: deltaPct !== null ? r2(deltaPct) : null,
    tracking_gap_flagged: trackingGapFlagged,
    detail,
  }
}

/**
 * Derive ranked opportunity list (max 7) from the sub-analyses.
 * Each opportunity maps to a RecommendedAction from the diagnose vocabulary.
 */
export function findOpportunities(
  campaigns: CampaignPerformance[],
  fatigue: FatigueSignal,
  budget: BudgetEfficiency,
  conversionPath: ConversionPath
): Opportunity[] {
  const opps: Opportunity[] = []

  // --- Creative fatigue ---
  if (fatigue.flagged) {
    opps.push({
      area: 'creative',
      severity: 'high',
      headline: 'Creative fatigue detected — replace ad assets',
      evidence: fatigue.detail,
      recommended_action: 'test_new_creative',
    })
  }

  // --- Tracking gap ---
  if (conversionPath.tracking_gap_flagged) {
    opps.push({
      area: 'tracking',
      severity: 'high',
      headline: 'Meta Pixel and FUB conversion counts diverge by > 30%',
      evidence: conversionPath.detail,
      recommended_action: 'check_tracking',
    })
  }

  // --- Account-level budget drift ---
  if (budget.drift_flagged) {
    const over = budget.spend_pct_of_target > BUDGET_HIGH_THRESHOLD
    opps.push({
      area: 'budget',
      severity: 'medium',
      headline: over
        ? `Overall spend ${budget.spend_pct_of_target}% of playbook target — over-pacing`
        : `Overall spend ${budget.spend_pct_of_target}% of playbook target — under-pacing`,
      evidence:
        `Actual: $${budget.actual_spend} vs expected $${budget.expected_spend} ` +
        `over ${budget.window_days} days at $${budget.playbook_daily_total}/day.`,
      recommended_action: over ? 'reduce_budget' : 'increase_budget',
    })
  }

  // --- Per-role budget drift ---
  for (const role of budget.by_role) {
    if (!role.drift_flagged || role.role === 'unknown' || role.expected_spend === null) continue
    const over = (role.spend_pct_of_target ?? 0) > BUDGET_HIGH_THRESHOLD
    opps.push({
      area: 'budget',
      severity: 'low',
      headline: `${role.role} campaign ${over ? 'over' : 'under'}-spending vs playbook`,
      evidence:
        `Actual: $${role.actual_spend} vs expected $${role.expected_spend} ` +
        `($${role.playbook_daily}/day × ${budget.window_days} days).`,
      recommended_action: over ? 'reduce_budget' : 'increase_budget',
    })
  }

  // --- Per-campaign CPL issues ---
  for (const campaign of campaigns) {
    const cplFlag = campaign.flags.find((f) => f.type === 'underperforming_cpl')
    if (cplFlag) {
      opps.push({
        area: 'targeting',
        severity: 'high',
        headline: `"${campaign.campaign_name}" CPL ${campaign.cpl_ratio}x account average`,
        evidence: cplFlag.detail,
        recommended_action: 'review_targeting',
      })
    }

    const noConvFlag = campaign.flags.find((f) => f.type === 'no_conversions')
    if (noConvFlag) {
      opps.push({
        area: 'campaign_structure',
        severity: 'medium',
        headline: `"${campaign.campaign_name}" spent $${campaign.spend} with zero conversions`,
        evidence: noConvFlag.detail,
        recommended_action: 'pause_underperformer',
      })
    }
  }

  // --- Missing playbook campaign roles ---
  const presentRoles = new Set(campaigns.map((c) => c.role))
  const missingRoles = (
    ['cold', 'lookalike', 'retargeting'] as Exclude<CampaignRole, 'unknown'>[]
  ).filter((r) => !presentRoles.has(r))

  for (const role of missingRoles) {
    opps.push({
      area: 'campaign_structure',
      severity: 'medium',
      headline: `No "${role}" campaign detected in data — playbook gap`,
      evidence:
        `The 3-campaign playbook requires a ${role} campaign ($${PLAYBOOK_DAILY_BY_ROLE[role]}/day). ` +
        `Either it is not running or its name does not match known keywords.`,
      recommended_action: 'investigate_drop',
    })
  }

  // Dedupe same recommended_action × area, sort by severity, cap at 7
  const severityScore: Record<'high' | 'medium' | 'low', number> = {
    high: 3,
    medium: 2,
    low: 1,
  }

  return opps
    .sort((a, b) => severityScore[b.severity] - severityScore[a.severity])
    .slice(0, 7)
}

// ---------------------------------------------------------------------------
// Top-level audit function
// ---------------------------------------------------------------------------

/**
 * Run the full paid Meta Ads audit for the given window.
 *
 * @param asOfDate  YYYY-MM-DD — the last day of the audit window.
 * @param windowDays  Number of days to include (default 30).
 * @returns AdsAuditReport — structured output for generate-briefs.
 */
export async function auditAds(
  asOfDate: string,
  windowDays: number = 30
): Promise<AdsAuditReport> {
  const [campaigns, fatigue, budget, conversionPath] = await Promise.all([
    analyzeCampaignPerformance(windowDays, asOfDate),
    detectCreativeFatigue(windowDays, asOfDate),
    analyzeBudgetEfficiency(windowDays, asOfDate),
    analyzeConversionPath(windowDays, asOfDate),
  ])

  const opportunities = findOpportunities(campaigns, fatigue, budget, conversionPath)

  return {
    as_of_date: asOfDate,
    window_days: windowDays,
    campaigns,
    fatigue,
    budget,
    conversion_path: conversionPath,
    opportunities,
    generated_at: new Date().toISOString(),
  }
}
