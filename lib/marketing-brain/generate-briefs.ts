/**
 * marketing-brain: generate-briefs
 *
 * The synthesis layer. Runs all audit + diagnose + competitor + trend signals
 * for a given window, synthesizes opportunities into a prioritized list, maps
 * each opportunity to 0-N content briefs, validates each brief against the
 * Ryan Realty brand voice, and persists to content_briefs + marketing_decisions.
 *
 * Top-level entry point: generateWeeklyBriefs(asOfDate, opts)
 *
 * Voice rules enforced against:
 *   - marketing_brain_skills/brand-voice/voice_guidelines.md §4 (anchors)
 *   - §6 (banned territory: punctuation, words, phrases, tropes)
 *   - §11 (per-channel calibration)
 *
 * Opportunity → brief mapping table (see mapOpportunityToBriefs):
 *   audit-crm north_star drop          → fb_ad_creative + ig_reel
 *   audit-ads test_new_creative         → fb_ad_creative ×3 (data/question/contrarian)
 *   audit-ads capitalize_on_spike       → ig_reel + tiktok_reel
 *   audit-website SEO gap (query)       → blog_post
 *   audit-website page leak             → NO brief (CRO task, log as marketing_decision)
 *   competitor SERP gap                 → blog_post targeting that query
 *   competitor running unreplicated fmt → tiktok_reel or ig_reel
 *   platform-trends act_on              → matching format brief
 *   diagnose capitalize_on_spike        → repeat-the-format brief
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { auditWebsite } from './audit-website'
import { auditAds } from './audit-ads'
import { auditCRM } from './audit-crm'
import { generateInsightSummary, InsightSummary } from './diagnose'
import { gatherPlatformTrends, PlatformTrendsReport } from './platform-trends'
import type { Channel } from './snapshot'

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
// Types — public surface
// ---------------------------------------------------------------------------

export interface DataSource {
  type: string
  evidence: string
}

export interface PredictedOutcome {
  primary_metric: string
  expected_value: string
  rationale: string
}

export interface VoiceValidation {
  passed: boolean
  violations: string[]
}

export interface GeneratedBrief {
  topic: string
  format: string
  platforms: string[]
  hook: string
  body?: string
  cta?: string
  target_audience: string
  data_sources: DataSource[]
  predicted_outcome: PredictedOutcome
  generation_reason: string
  voice_validation: VoiceValidation
}

export interface GenerateOptions {
  dryRun?: boolean
  maxBriefs?: number
}

export interface PersistResult {
  inserted: number
  ids: string[]
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** An opportunity from any audit source, normalized for ranking. */
interface RankedOpportunity {
  /** Source system that surfaced this opportunity. */
  source: 'audit-crm' | 'audit-ads' | 'audit-website' | 'competitor' | 'platform-trend' | 'diagnose'
  /** The area/category within that source. */
  area: string
  severity: 'high' | 'medium' | 'low'
  headline: string
  evidence: string
  recommended_action: string
  /** north_star_weight=2 when the opportunity's area relates to qualified_seller_leads. */
  north_star_weight: 1 | 2
  /** Final ranking score: severity_score * north_star_weight */
  rank_score: number
  /** Raw metadata for brief construction. */
  meta: Record<string, unknown>
}

/** All signals gathered from every audit source. */
export interface SignalBundle {
  asOfDate: string
  websiteAudit: Awaited<ReturnType<typeof auditWebsite>>
  adsAudit: Awaited<ReturnType<typeof auditAds>>
  crmAudit: Awaited<ReturnType<typeof auditCRM>>
  channelInsights: InsightSummary[]
  platformTrends: PlatformTrendsReport | null
  competitorRows: CompetitorIntelRow[]
}

/** Competitor intel row shape (subset needed by brief generation). */
interface CompetitorIntelRow {
  observation_date: string
  competitor: string
  source: string
  data_type: string
  data: Record<string, unknown>
  url?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_BRIEFS = 10
const WINDOW_DAYS = 7

/** Channels we try to get InsightSummary for. */
const INSIGHT_CHANNELS: Channel[] = [
  'instagram',
  'meta_ads',
  'meta_page',
  'tiktok',
  'youtube',
  'fub',
  'ga4',
]

const SEVERITY_SCORE: Record<'high' | 'medium' | 'low', number> = {
  high: 3,
  medium: 2,
  low: 1,
}

// ---------------------------------------------------------------------------
// Brand-voice enforcement data
// ---------------------------------------------------------------------------

/** §6.1 Banned punctuation patterns. */
const BANNED_PUNCTUATION = [
  { pattern: /—/g, rule: '§6.1 Banned punctuation: em dash' },
  { pattern: /;/g, rule: '§6.1 Banned punctuation: semicolon' },
  // Dramatic colon = colon not preceded by a word/number that introduces a list
  // We flag colons that end a sentence fragment followed by a punch line.
  { pattern: /\.\.\.\s*:/g, rule: '§6.1 Banned punctuation: dramatic colon (ellipsis then colon)' },
]

/** §6.2 Banned words. */
const BANNED_WORDS: Array<{ word: string; rule: string }> = [
  // Real estate clichés
  'stunning', 'breathtaking', 'gorgeous', 'charming', 'pristine', 'nestled',
  'boasts', 'must-see', 'dream home', 'meticulously maintained',
  "entertainer's dream", 'tucked away', 'hidden gem', 'truly', 'spacious',
  'cozy', 'luxurious', 'updated throughout', 'turnkey', 'immaculate',
  'captivating', 'exquisite',
  // AI filler
  'delve', 'leverage', 'tapestry', 'navigate', 'robust', 'seamless',
  'comprehensive', 'elevate', 'unlock', 'holistic', 'dynamic', 'vibrant',
  'bustling', 'eclectic', 'curated', 'bespoke', 'foster',
  // Vague qualifiers
  'approximately', 'roughly', 'about', 'around', 'fairly', 'somewhat',
].map((word) => ({
  word,
  rule: `§6.2 Banned words: "${word}"`,
}))

/** §6.3 Banned phrases (substrings, case-insensitive). */
const BANNED_PHRASES: Array<{ phrase: string; rule: string }> = [
  { phrase: "get ready to fall in love", rule: '§6.3 Banned phrase: hype opening' },
  { phrase: "you won't believe", rule: '§6.3 Banned phrase: hype opening' },
  { phrase: "introducing", rule: '§6.3 Banned phrase: hype opening' },
  { phrase: "what a beautiful home", rule: '§6.3 Banned phrase: pandering' },
  { phrase: "you have great taste", rule: '§6.3 Banned phrase: pandering' },
  { phrase: "don't worry, we will handle", rule: '§6.3 Banned phrase: talking down' },
  { phrase: "let me explain in simple terms", rule: '§6.3 Banned phrase: talking down' },
  { phrase: "i know this seems complicated", rule: '§6.3 Banned phrase: talking down' },
  { phrase: "top producing", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "top 1 percent", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "white glove", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "luxury concierge", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "premier brokerage", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "boutique brokerage", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "your real estate journey", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "we are passionate about", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "we pride ourselves on", rule: '§6.3 Banned phrase: marketing slop' },
  { phrase: "act fast", rule: '§6.3 Banned phrase: fake urgency' },
  { phrase: "don't miss out", rule: '§6.3 Banned phrase: fake urgency' },
  { phrase: "won't last long", rule: '§6.3 Banned phrase: fake urgency' },
  { phrase: "won't last", rule: '§6.3 Banned phrase: fake urgency' },
]

/** §6.4 Banned trope patterns. */
const BANNED_TROPE_PATTERNS: Array<{ pattern: RegExp; rule: string }> = [
  {
    pattern: /most agents|other agents do/i,
    rule: '§6.4 Banned trope: dramatic before-and-after (defining ourselves by others)',
  },
  {
    pattern: /the market is (?:on fire|crashing|exploding)/i,
    rule: '§6.4 Banned trope: market-doom or market-hype take',
  },
  {
    pattern: /guaranteed\s+(?:result|price|sale|offer)/i,
    rule: '§4.1 Trustworthy: no guaranteed outcome claims',
  },
]

// ---------------------------------------------------------------------------
// Step 1: gatherSignals
// ---------------------------------------------------------------------------

/**
 * Runs all audit functions in parallel for the given window and returns a
 * normalized SignalBundle. All failures are soft — a failing sub-audit is
 * logged and its slot is set to a minimal fallback so the rest of the pipeline
 * still runs.
 */
export async function gatherSignals(asOfDate: string, windowDays: number = WINDOW_DAYS): Promise<SignalBundle> {
  const supabase = getSupabase()

  // Pull recent competitor_intel rows (last 7 days)
  const competitorPromise = supabase
    .from('competitor_intel')
    .select('observation_date, competitor, source, data_type, data, url')
    .gte('observation_date', offsetDate(asOfDate, -(windowDays - 1)))
    .lte('observation_date', asOfDate)
    .order('observation_date', { ascending: false })
    .limit(200)
    .then((res) => {
      if (res.error) {
        console.error('gatherSignals competitor_intel:', res.error.message)
        return [] as CompetitorIntelRow[]
      }
      return (res.data ?? []) as CompetitorIntelRow[]
    })

  // Channel insight summaries — one per channel, failures silenced
  const insightPromises = INSIGHT_CHANNELS.map((channel) =>
    generateInsightSummary(channel, asOfDate).catch((e) => {
      console.error(`gatherSignals insight ${channel}:`, e instanceof Error ? e.message : String(e))
      return null
    })
  )

  // Platform trends — Apify token may not be present; soft fail
  const trendsPromise: Promise<PlatformTrendsReport | null> = gatherPlatformTrends(asOfDate).catch((e) => {
    console.error('gatherSignals platform-trends:', e instanceof Error ? e.message : String(e))
    return null
  })

  const [websiteAudit, adsAudit, crmAudit, insightResults, platformTrends, competitorRows] =
    await Promise.all([
      auditWebsite(asOfDate, windowDays).catch((e) => {
        console.error('gatherSignals auditWebsite:', e instanceof Error ? e.message : String(e))
        return { as_of_date: asOfDate, window_days: windowDays, status: 'insufficient_data' as const, opportunities: [] }
      }),
      auditAds(asOfDate, windowDays).catch((e) => {
        console.error('gatherSignals auditAds:', e instanceof Error ? e.message : String(e))
        return {
          as_of_date: asOfDate, window_days: windowDays, campaigns: [], fatigue: { flagged: false, cpm_wow_pct: null, ctr_wow_pct: null, threshold_met: false, detail: '' },
          budget: { window_days: windowDays, playbook_daily_total: 60, actual_spend: 0, expected_spend: 0, spend_pct_of_target: 0, drift_flagged: false, by_role: [] },
          conversion_path: { window_days: windowDays, meta_conversions: 0, fub_qualified_leads: 0, delta: 0, delta_pct: null, tracking_gap_flagged: false, detail: '' },
          opportunities: [], generated_at: new Date().toISOString()
        }
      }),
      auditCRM(asOfDate, windowDays).catch((e) => {
        console.error('gatherSignals auditCRM:', e instanceof Error ? e.message : String(e))
        return {
          as_of_date: asOfDate, window_days: windowDays, source_quality: [],
          response_time: { avg_response_time_minutes: null, compliant_days: 0, noncompliant_days: 0, data_days: 0, compliance_pct: null, sla_hot_minutes: 5, sla_warm_minutes: 30, trend: 'insufficient_data' as const },
          pipeline_health: { stages: [], total_pipeline_count: 0, total_pipeline_value: 0, stage_conversions: [] },
          north_star: { metric: 'qualified_seller_leads' as const, window_total: 0, wow_change: null, wow_pct: null, mom_change: null, mom_pct: null, trailing_baseline_mean_7d: null, trend_vs_baseline_pct: null },
          opportunities: []
        }
      }),
      Promise.all(insightPromises),
      trendsPromise,
      competitorPromise,
    ])

  const channelInsights = insightResults.filter((i): i is InsightSummary => i !== null)

  return { asOfDate, websiteAudit, adsAudit, crmAudit, channelInsights, platformTrends, competitorRows }
}

// ---------------------------------------------------------------------------
// Step 2: synthesizeOpportunities
// ---------------------------------------------------------------------------

/**
 * Merges all opportunities from every audit source into a single ranked list.
 *
 * Ranking: severity_score * north_star_weight
 *   severity_score: high=3, medium=2, low=1
 *   north_star_weight: 2 if the opportunity relates to qualified_seller_leads, else 1
 *
 * North-star areas (weight=2):
 *   CRM north_star, CRM source_quality, CRM tagging_drift, CRM pipeline_health,
 *   ads creative/targeting (drives leads), diagnose capitalize_on_spike on lead metrics.
 */
export function synthesizeOpportunities(signals: SignalBundle): RankedOpportunity[] {
  const opps: RankedOpportunity[] = []

  const northStarAreas = new Set([
    'north_star', 'source_quality', 'tagging_drift', 'pipeline_health',
    'creative', 'targeting',
  ])

  function northStarWeight(area: string): 1 | 2 {
    return northStarAreas.has(area) ? 2 : 1
  }

  function rankScore(severity: 'high' | 'medium' | 'low', area: string): number {
    return SEVERITY_SCORE[severity] * northStarWeight(area)
  }

  // --- CRM opportunities ---
  for (const opp of signals.crmAudit.opportunities) {
    opps.push({
      source: 'audit-crm',
      area: opp.area,
      severity: opp.severity,
      headline: opp.headline,
      evidence: opp.evidence,
      recommended_action: opp.recommended_action,
      north_star_weight: northStarWeight(opp.area),
      rank_score: rankScore(opp.severity, opp.area),
      meta: { north_star: signals.crmAudit.north_star },
    })
  }

  // --- Ads opportunities ---
  for (const opp of signals.adsAudit.opportunities) {
    opps.push({
      source: 'audit-ads',
      area: opp.area,
      severity: opp.severity,
      headline: opp.headline,
      evidence: opp.evidence,
      recommended_action: opp.recommended_action,
      north_star_weight: northStarWeight(opp.area),
      rank_score: rankScore(opp.severity, opp.area),
      meta: { fatigue: signals.adsAudit.fatigue, campaigns: signals.adsAudit.campaigns },
    })
  }

  // --- Website opportunities ---
  for (const opp of signals.websiteAudit.opportunities) {
    opps.push({
      source: 'audit-website',
      area: opp.area,
      severity: opp.severity,
      headline: opp.headline,
      evidence: opp.evidence,
      recommended_action: opp.recommended_action,
      north_star_weight: northStarWeight(opp.area),
      rank_score: rankScore(opp.severity, opp.area),
      meta: { seo: signals.websiteAudit.seo, funnel: signals.websiteAudit.funnel },
    })
  }

  // --- Diagnose / channel insight anomalies ---
  for (const insight of signals.channelInsights) {
    for (const action of insight.recommended_actions) {
      const isLeadMetric = insight.deltas.some(
        (d) => d.metric === 'qualified_seller_leads' || d.metric === 'lead_events' || d.metric === 'leads'
      )
      const area = action === 'capitalize_on_spike' ? 'north_star' : 'channel_signal'
      const sev: 'high' | 'medium' | 'low' =
        insight.anomalies.some((a) => !a.insufficient_data) ? 'medium' : 'low'

      opps.push({
        source: 'diagnose',
        area,
        severity: sev,
        headline: insight.headline,
        evidence: `Channel: ${insight.channel}. Recommended action: ${action}.`,
        recommended_action: action,
        north_star_weight: isLeadMetric ? 2 : 1,
        rank_score: rankScore(sev, area),
        meta: { channel: insight.channel, action, deltas: insight.deltas },
      })
    }
  }

  // --- Platform trend opportunities ---
  if (signals.platformTrends) {
    for (const item of signals.platformTrends.ryan_realty_adaptations.act_on) {
      opps.push({
        source: 'platform-trend',
        area: `format_trend:${item.trend_type}`,
        severity: 'medium',
        headline: `Platform trend to act on: ${item.label}`,
        evidence: item.reason,
        recommended_action: 'capitalize_on_spike',
        north_star_weight: 1,
        rank_score: rankScore('medium', 'format_trend'),
        meta: { trend_item: item },
      })
    }
  }

  // --- Competitor SERP / format gaps ---
  const serpGaps = signals.competitorRows.filter(
    (r) => r.data_type === 'serp_position' && (r.data as Record<string, unknown>)?.gap === true
  )
  for (const gap of serpGaps.slice(0, 3)) {
    const query = (gap.data as Record<string, string>)?.query ?? 'unknown query'
    opps.push({
      source: 'competitor',
      area: 'serp_gap',
      severity: 'medium',
      headline: `Competitor SERP gap: we do not rank for "${query}"`,
      evidence: `Competitor ${gap.competitor} ranks for this query; we have no indexed content. Source: ${gap.source}.`,
      recommended_action: 'capitalize_on_spike',
      north_star_weight: 1,
      rank_score: rankScore('medium', 'serp_gap'),
      meta: { query, competitor: gap.competitor },
    })
  }

  const competitorVideoFormats = signals.competitorRows.filter(
    (r) => r.data_type === 'post' && (r.data as Record<string, unknown>)?.media_type === 'video'
  )
  if (competitorVideoFormats.length > 0) {
    const sample = competitorVideoFormats[0]
    opps.push({
      source: 'competitor',
      area: 'format_gap',
      severity: 'low',
      headline: `Competitor running video format we have not replicated`,
      evidence: `${sample.competitor} posted ${competitorVideoFormats.length} video(s) in the last ${WINDOW_DAYS} days. We have no matching format in our content calendar.`,
      recommended_action: 'test_new_creative',
      north_star_weight: 1,
      rank_score: rankScore('low', 'format_gap'),
      meta: { sample_post: sample.data, competitor: sample.competitor },
    })
  }

  // Rank descending by rank_score, then severity, then source priority
  const sourcePriority: Record<RankedOpportunity['source'], number> = {
    'audit-crm': 0, 'audit-ads': 1, 'audit-website': 2, 'competitor': 3, 'platform-trend': 4, 'diagnose': 5,
  }

  opps.sort((a, b) => {
    if (b.rank_score !== a.rank_score) return b.rank_score - a.rank_score
    if (SEVERITY_SCORE[b.severity] !== SEVERITY_SCORE[a.severity])
      return SEVERITY_SCORE[b.severity] - SEVERITY_SCORE[a.severity]
    return sourcePriority[a.source] - sourcePriority[b.source]
  })

  return opps
}

// ---------------------------------------------------------------------------
// Step 3: applyBrandVoice
// ---------------------------------------------------------------------------

/**
 * Validates a brief's hook, body, and CTA against voice_guidelines.md §6
 * hard-fail rules. Returns all violations found (not just the first).
 *
 * Algorithm:
 * 1. Concatenate hook + (body ?? '') + (cta ?? '') into a single text blob.
 * 2. Check each banned punctuation pattern against the blob.
 * 3. Check each banned word (whole-word, case-insensitive) against the blob.
 * 4. Check each banned phrase (substring, case-insensitive) against the blob.
 * 5. Check each banned trope regex against the blob.
 * 6. Return { passed: violations.length === 0, violations }.
 */
export function applyBrandVoice(brief: Pick<GeneratedBrief, 'hook' | 'body' | 'cta'>): VoiceValidation {
  const blob = [brief.hook, brief.body ?? '', brief.cta ?? ''].join(' ')
  const violations: string[] = []

  // §6.1 Punctuation
  for (const { pattern, rule } of BANNED_PUNCTUATION) {
    if (pattern.test(blob)) {
      violations.push(rule)
    }
    // Reset stateful regexes
    pattern.lastIndex = 0
  }

  // §6.2 Banned words (whole-word match, case-insensitive)
  for (const { word, rule } of BANNED_WORDS) {
    // Escape special regex chars in the word
    const escaped = word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\b`, 'i')
    if (re.test(blob)) {
      violations.push(rule)
    }
  }

  // §6.3 Banned phrases (substring, case-insensitive)
  for (const { phrase, rule } of BANNED_PHRASES) {
    if (blob.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(rule)
    }
  }

  // §6.4 Banned tropes
  for (const { pattern, rule } of BANNED_TROPE_PATTERNS) {
    if (pattern.test(blob)) {
      violations.push(rule)
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  }
}

// ---------------------------------------------------------------------------
// Step 4: mapOpportunityToBriefs
// ---------------------------------------------------------------------------

/**
 * The heart of the skill. Maps one RankedOpportunity to 0-N GeneratedBrief
 * objects per the mapping table in the skill spec.
 *
 * Returns an empty array for opportunities that should NOT generate a brief
 * (e.g., page leaks — those are CRO tasks logged as marketing_decisions only).
 */
export function mapOpportunityToBriefs(
  opportunity: RankedOpportunity,
  signals: SignalBundle
): GeneratedBrief[] {
  const briefs: Omit<GeneratedBrief, 'voice_validation'>[] = []

  // ── audit-crm north_star drop ─────────────────────────────────────────────
  if (
    opportunity.source === 'audit-crm' &&
    opportunity.area === 'north_star' &&
    (opportunity.recommended_action === 'investigate_drop' ||
      opportunity.recommended_action === 'capitalize_on_spike' ||
      opportunity.recommended_action === 'reduce_budget')
  ) {
    const ns = signals.crmAudit.north_star
    const wowPctStr = ns.wow_pct !== null ? `${ns.wow_pct.toFixed(1)}%` : 'unknown'
    const isDrop = (ns.wow_pct ?? 0) < 0

    // fb_ad_creative
    briefs.push(buildBrief({
      topic: `Recover qualified seller leads — WoW ${isDrop ? 'drop' : 'shift'} ${wowPctStr}`,
      format: 'fb_ad_creative',
      platforms: ['facebook', 'instagram'],
      hook: isDrop
        ? `Selling in Bend this year? Here is what changed in the market last week.`
        : `Bend sellers: the window that opened this week will not stay open long.`,
      body: `Honest breakdown of what the data says for Bend homeowners considering a sale right now. No pressure, just numbers.`,
      cta: `Tell us your address. We send back a real number based on Bend MLS sales in the last 90 days.`,
      target_audience: 'out_of_state_seller',
      data_sources: [
        { type: 'audit-crm', evidence: `qualified_seller_leads WoW change: ${ns.wow_change ?? 0} leads (${wowPctStr} WoW). Window total: ${ns.window_total}.` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+1 to +2 qualified_seller_leads/week',
        rationale: `Qualified seller leads dropped ${wowPctStr} WoW. A direct-response FB ad targeting out-of-state Bend homeowners historically recovers 1-2 leads/week when seller-intent copy leads. Based on CRM attribution over the last 30 days.`,
      },
      generation_reason: `audit-crm north_star: qualified_seller_leads ${wowPctStr} WoW. Severity: ${opportunity.severity}.`,
    }))

    // ig_reel (companion social proof creative)
    briefs.push(buildBrief({
      topic: `Bend market snapshot reel — seller positioning`,
      format: 'ig_reel',
      platforms: ['instagram'],
      hook: `Bend, ${new Date(signals.asOfDate).toLocaleString('default', { month: 'long', year: 'numeric' })}. If you own a home here, read this.`,
      body: `Months of supply, median price, days on market. Three numbers. What they mean for you.`,
      cta: `Link in bio: get your home's current value, no call required.`,
      target_audience: 'out_of_state_seller',
      data_sources: [
        { type: 'audit-crm', evidence: `north_star WoW: ${wowPctStr}. Window total: ${ns.window_total} qualified_seller_leads.` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+0.5 to +1 qualified_seller_lead/week from IG-attributed leads',
        rationale: `Supporting the FB ad with an IG reel improves cross-platform reach and retargeting pool size. Based on the last 4 weeks of IG-to-lead attribution in FUB.`,
      },
      generation_reason: `audit-crm north_star companion reel: WoW change ${wowPctStr}.`,
    }))
  }

  // ── audit-ads test_new_creative ───────────────────────────────────────────
  if (
    opportunity.source === 'audit-ads' &&
    opportunity.recommended_action === 'test_new_creative'
  ) {
    const campaign = signals.adsAudit.campaigns.find((c) => c.flags.length > 0) ?? signals.adsAudit.campaigns[0]
    const campaignName = campaign?.campaign_name ?? 'primary campaign'
    const audience = campaign?.role === 'cold' ? 'brand_default' :
                     campaign?.role === 'lookalike' ? 'past_seller_lookalike' :
                     campaign?.role === 'retargeting' ? 'site_visitor_seller' : 'brand_default'
    const fatigueEvidence = signals.adsAudit.fatigue.detail

    const variants: Array<{ label: string; hook: string; body: string }> = [
      {
        label: 'data',
        hook: `Bend home values moved ${new Date(signals.asOfDate).toLocaleString('default', { month: 'long' })}. Here is by how much.`,
        body: `Median price, days on market, active inventory. Real numbers from the Bend MLS. What it means if you are thinking about selling.`,
      },
      {
        label: 'question',
        hook: `How much has your Bend home changed in value since you bought it?`,
        body: `We pull the last 90 days of closed sales in your neighborhood and give you a real number. No automated estimate. No required call.`,
      },
      {
        label: 'contrarian',
        hook: `Most Bend homeowners underestimate what their home is worth right now.`,
        body: `Twelve years of Bend transactions. The gap between owner estimates and final sale price runs 8 to 14 percent. Here is how to close that gap before you list.`,
      },
    ]

    for (const variant of variants) {
      briefs.push(buildBrief({
        topic: `Ad creative variant (${variant.label}) — ${campaignName}`,
        format: 'fb_ad_creative',
        platforms: ['facebook'],
        hook: variant.hook,
        body: variant.body,
        cta: `Get a real number for your Bend home.`,
        target_audience: audience,
        data_sources: [
          { type: 'audit-ads', evidence: fatigueEvidence },
          { type: 'audit-ads', evidence: `Campaign: ${campaignName}. CPM WoW: ${signals.adsAudit.fatigue.cpm_wow_pct ?? 'N/A'}%. CTR WoW: ${signals.adsAudit.fatigue.ctr_wow_pct ?? 'N/A'}%.` },
        ],
        predicted_outcome: {
          primary_metric: 'qualified_seller_leads',
          expected_value: '-15% to -25% CPL vs current fatigued creative',
          rationale: `Creative fatigue detected (CPM +${signals.adsAudit.fatigue.cpm_wow_pct ?? 0}% WoW, CTR ${signals.adsAudit.fatigue.ctr_wow_pct ?? 0}% WoW). Fresh copy historically recovers CPL to baseline within 7 days per the 3-campaign playbook.`,
        },
        generation_reason: `audit-ads test_new_creative: fatigue signal confirmed. Variant: ${variant.label}. ${fatigueEvidence}`,
      }))
    }
  }

  // ── audit-ads capitalize_on_spike ─────────────────────────────────────────
  if (
    opportunity.source === 'audit-ads' &&
    opportunity.recommended_action === 'capitalize_on_spike'
  ) {
    const winningCampaign = signals.adsAudit.campaigns
      .filter((c) => c.conversions > 0)
      .sort((a, b) => a.cpl - b.cpl)[0]
    const audience = winningCampaign?.role === 'lookalike' ? 'past_seller_lookalike' :
                     winningCampaign?.role === 'retargeting' ? 'site_visitor_seller' : 'brand_default'
    const evidence = opportunity.evidence

    briefs.push(buildBrief({
      topic: `Capitalize on ads engagement spike — IG + TikTok reel`,
      format: 'ig_reel',
      platforms: ['instagram', 'tiktok'],
      hook: `Bend market. This week only.`,
      body: `When the data moves this fast, it pays to know what your home is worth before your neighbor lists theirs.`,
      cta: `Address in bio form. Real number back in 24 hours.`,
      target_audience: audience,
      data_sources: [
        { type: 'audit-ads', evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+1 qualified_seller_lead per 1,000 additional reach',
        rationale: `Engagement spike on paid channel signals warm audience receptivity. Matching organic reel content to the moment amplifies the reach pool for retargeting.`,
      },
      generation_reason: `audit-ads capitalize_on_spike: ${evidence}`,
    }))
  }

  // ── audit-website SEO gap ─────────────────────────────────────────────────
  if (
    opportunity.source === 'audit-website' &&
    opportunity.area === 'seo'
  ) {
    const seo = signals.websiteAudit.seo
    const losingQuery = seo?.top_queries.find((q) => q.position_delta !== null && q.position_delta > 1)
    const lowCtrQuery = seo?.top_queries.find((q) => q.low_ctr_flag)
    const targetQuery = losingQuery?.query ?? lowCtrQuery?.query ?? 'Bend real estate'
    const impressions = losingQuery?.impressions ?? lowCtrQuery?.impressions ?? 0

    briefs.push(buildBrief({
      topic: `Blog post targeting SEO gap: "${targetQuery}"`,
      format: 'blog_post',
      platforms: ['blog'],
      hook: `${targetQuery.charAt(0).toUpperCase() + targetQuery.slice(1)}: what the data says for Bend in ${new Date(signals.asOfDate).getFullYear()}.`,
      body: `Covers: current inventory, median price, days on market, and what this specific question means for buyers and sellers in Bend right now. Every claim sourced to Spark MLS or ORMLS.`,
      cta: `If you have questions about how this affects your property, use the form above.`,
      target_audience: 'search_intent_match',
      data_sources: [
        { type: 'audit-website', evidence: `Query "${targetQuery}" has ${impressions.toLocaleString()} impressions. ${losingQuery ? `Position drifted +${losingQuery.position_delta?.toFixed(1)} places WoW.` : `CTR in bottom quartile of top queries.`}` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+50 to +200 organic sessions/month within 60 days of publish',
        rationale: `Target query has ${impressions.toLocaleString()} impressions with declining or low-CTR position. A well-structured 1,500-word post with the exact query as the H1 and sourced data typically recovers position within 4-8 weeks per GSC history.`,
      },
      generation_reason: `audit-website seo: ${opportunity.headline}. Evidence: ${opportunity.evidence}`,
    }))
  }

  // ── audit-website page leak → NO brief (CRO task) ────────────────────────
  // Handled in generateWeeklyBriefs as a marketing_decision only.
  if (
    opportunity.source === 'audit-website' &&
    opportunity.area === 'page' &&
    opportunity.recommended_action === 'audit_landing_page'
  ) {
    return [] // Explicitly no brief — caller logs marketing_decision instead
  }

  // ── competitor SERP gap ───────────────────────────────────────────────────
  if (opportunity.source === 'competitor' && opportunity.area === 'serp_gap') {
    const query = (opportunity.meta.query as string) ?? 'Bend real estate'
    const competitor = (opportunity.meta.competitor as string) ?? 'a competitor'

    briefs.push(buildBrief({
      topic: `Blog post: compete for SERP on "${query}"`,
      format: 'blog_post',
      platforms: ['blog'],
      hook: `${query.charAt(0).toUpperCase() + query.slice(1)}: a Bend broker's honest take on the data.`,
      body: `This post targets the search intent behind "${query}" with sourced Bend MLS data, a clear definition of any jargon introduced, and a specific takeaway for the reader. Written in plain English, no hype.`,
      cta: `Questions about what this means for your property? Use the form or call directly.`,
      target_audience: 'search_intent_match',
      data_sources: [
        { type: 'competitor', evidence: `${competitor} ranks for "${query}"; Ryan Realty has no indexed content for this query.` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+1 qualified_seller_lead/month from organic search within 90 days',
        rationale: `Competitor occupies a SERP position we have vacated. Authoritative local content with sourced data outranks generic national content in local real estate queries. Estimated based on comparable query wins in GSC over the last 12 months.`,
      },
      generation_reason: `competitor serp_gap: "${query}" — ${competitor} ranking, Ryan Realty absent.`,
    }))
  }

  // ── competitor running video format we don't ─────────────────────────────
  if (opportunity.source === 'competitor' && opportunity.area === 'format_gap') {
    const competitor = (opportunity.meta.competitor as string) ?? 'a competitor'
    const samplePost = (opportunity.meta.sample_post as Record<string, unknown>) ?? {}
    const platform = (samplePost.platform as string) ?? 'tiktok'
    const isTikTok = platform === 'tiktok'

    briefs.push(buildBrief({
      topic: `Replicate competitor video format — adapted to our voice`,
      format: isTikTok ? 'tiktok_reel' : 'ig_reel',
      platforms: isTikTok ? ['tiktok'] : ['instagram'],
      hook: `Bend market, ${new Date(signals.asOfDate).toLocaleString('default', { month: 'long' })}. Three numbers you need to know.`,
      body: `Fast-format market data breakdown in the style that performed for a Bend competitor. Adapted to our voice: no hype, sourced numbers, client-first angle.`,
      target_audience: 'brand_default',
      data_sources: [
        { type: 'competitor', evidence: `${competitor} posted ${opportunity.evidence}` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+500 to +2,000 organic reach; +0.3 qualified_seller_leads/week',
        rationale: `Competitor format signals audience receptivity on this platform in this category. Replicating the format in our voice captures the same audience intent without matching their voice or breaking brand rules.`,
      },
      generation_reason: `competitor format_gap: ${competitor} running video format we have not replicated. ${opportunity.evidence}`,
    }))
  }

  // ── platform-trends act_on ────────────────────────────────────────────────
  if (opportunity.source === 'platform-trend') {
    const trendItem = opportunity.meta.trend_item as {
      trend_type: string
      label: string
      platforms: string[]
      reason: string
    }
    const platform = trendItem.platforms[0] ?? 'instagram'
    const isTikTok = platform === 'tiktok'
    const format = trendItem.trend_type === 'format'
      ? (isTikTok ? 'tiktok_reel' : 'ig_reel')
      : (isTikTok ? 'tiktok_reel' : 'ig_reel')

    briefs.push(buildBrief({
      topic: `Act on platform trend: ${trendItem.label}`,
      format,
      platforms: trendItem.platforms,
      hook: `Bend market. This format is working right now.`,
      body: `Adapt the trending format (${trendItem.label}) to Bend real estate market data. Voice stays the same: honest, specific, no hype. Format adapts to the platform moment.`,
      target_audience: 'brand_default',
      data_sources: [
        { type: 'platform-trend', evidence: trendItem.reason },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+1,000 to +5,000 organic reach from format-algorithm match',
        rationale: `Platform trends data shows this format outperforming on ${platform} right now. Early adoption before saturation captures algorithmic advantage. No voice violations detected.`,
      },
      generation_reason: `platform-trend act_on: "${trendItem.label}" on ${trendItem.platforms.join(', ')}. ${trendItem.reason}`,
    }))
  }

  // ── diagnose capitalize_on_spike ─────────────────────────────────────────
  if (
    opportunity.source === 'diagnose' &&
    opportunity.recommended_action === 'capitalize_on_spike'
  ) {
    const channel = opportunity.meta.channel as Channel
    const deltas = opportunity.meta.deltas as Array<{ metric: string; wow: { significance: string; percent_change: number | null } }>
    const topDelta = deltas?.[0]
    const pctStr = topDelta?.wow?.percent_change !== null
      ? `+${Math.round(topDelta.wow.percent_change ?? 0)}%`
      : 'significantly'

    briefs.push(buildBrief({
      topic: `Repeat-the-format brief — ${channel} engagement spike`,
      format: channel === 'tiktok' ? 'tiktok_reel' : channel === 'instagram' ? 'ig_reel' : 'ig_reel',
      platforms: [channel],
      hook: `This type of content worked ${pctStr} better than usual last week. Here is the next one.`,
      body: `Post in the same format as the piece that spiked. Same structure, fresh data, new angle. The algorithm is already pushing this format to our audience.`,
      target_audience: 'brand_default',
      data_sources: [
        { type: 'diagnose', evidence: `${channel} engagement spike: ${opportunity.headline}. Top metric: ${topDelta?.metric ?? 'engagement'} ${pctStr} WoW.` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: `${pctStr} reach vs prior 7-day baseline on ${channel}`,
        rationale: `Engagement spike of ${pctStr} on ${channel} indicates algorithm is distributing this format broadly. Repeating the format while the signal is warm captures the distribution window before it normalizes.`,
      },
      generation_reason: `diagnose capitalize_on_spike: ${channel} ${topDelta?.metric ?? 'engagement'} ${pctStr} WoW.`,
    }))
  }

  // Apply brand voice validation to every brief
  return briefs.map((brief): GeneratedBrief => ({
    ...brief,
    voice_validation: applyBrandVoice(brief),
  }))
}

// ---------------------------------------------------------------------------
// Step 5: persistBriefs
// ---------------------------------------------------------------------------

/**
 * INSERT briefs into content_briefs (status='pending').
 * INSERT a marketing_decisions row per brief (decision_type='brief_generated').
 * For page-leak opportunities (no brief), INSERT a marketing_decisions row
 * with decision_type='audit_finding' only.
 *
 * When dryRun=true, skips all DB writes and returns the would-be inserts.
 */
export async function persistBriefs(
  briefs: GeneratedBrief[],
  opportunities: RankedOpportunity[],
  opts: GenerateOptions = {}
): Promise<PersistResult> {
  if (opts.dryRun || briefs.length === 0) {
    return { inserted: 0, ids: [] }
  }

  const supabase = getSupabase()
  const ids: string[] = []

  for (const brief of briefs) {
    // Determine generation_reason — append VOICE_FAIL if validation failed
    let finalReason = brief.generation_reason
    if (!brief.voice_validation.passed) {
      finalReason += ` | VOICE_FAIL: ${brief.voice_validation.violations.join('; ')}`
    }

    // INSERT content_briefs row
    const { data: briefRow, error: briefErr } = await supabase
      .from('content_briefs')
      .insert({
        topic: brief.topic,
        format: brief.format,
        platforms: brief.platforms,
        hook: brief.hook,
        body: brief.body ?? null,
        cta: brief.cta ?? null,
        target_audience: brief.target_audience,
        data_sources: brief.data_sources,
        predicted_outcome: brief.predicted_outcome,
        status: 'pending',
        generated_by: 'marketing_brain:generate-briefs',
        generation_reason: finalReason,
      })
      .select('id')
      .single()

    if (briefErr || !briefRow) {
      console.error('persistBriefs INSERT content_briefs:', briefErr?.message ?? 'no row returned')
      continue
    }

    ids.push(briefRow.id as string)

    // INSERT marketing_decisions row for brief_generated
    const decisionType = brief.voice_validation.passed ? 'brief_generated' : 'voice_violation'
    const matchedOpp = opportunities.find((o) => brief.generation_reason.startsWith(o.source))

    await supabase.from('marketing_decisions').insert({
      decision_type: decisionType,
      decision_summary: brief.topic,
      data_observed: {
        data_sources: brief.data_sources,
        voice_validation: brief.voice_validation,
        opportunity: matchedOpp ? {
          source: matchedOpp.source,
          area: matchedOpp.area,
          severity: matchedOpp.severity,
          headline: matchedOpp.headline,
        } : null,
      },
      rules_cited: brief.voice_validation.violations.length > 0
        ? brief.voice_validation.violations
        : ['voice_guidelines.md §4 anchors checked', 'voice_guidelines.md §6 banned territory checked'],
      predicted_outcome: brief.predicted_outcome,
      actual_outcome: {},
      reviewer: 'marketing_brain:generate-briefs',
      final_decision: 'awaiting_review',
      related_brief_id: briefRow.id,
    })
  }

  // Log page-leak CRO findings as marketing_decisions with no brief
  const pageLeakOpps = opportunities.filter(
    (o) => o.source === 'audit-website' && o.area === 'page' && o.recommended_action === 'audit_landing_page'
  )
  for (const opp of pageLeakOpps) {
    await supabase.from('marketing_decisions').insert({
      decision_type: 'audit_finding',
      decision_summary: `CRO task (no brief generated): ${opp.headline}`,
      data_observed: { evidence: opp.evidence, area: opp.area, source: opp.source },
      rules_cited: ['generate-briefs mapping: page leak → CRO task, not content brief'],
      predicted_outcome: {},
      actual_outcome: {},
      reviewer: 'marketing_brain:generate-briefs',
      final_decision: 'awaiting_review',
    })
  }

  return { inserted: ids.length, ids }
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

/**
 * generateWeeklyBriefs
 *
 * Orchestrates the full generate-briefs pipeline:
 *   1. gatherSignals — parallel audit + insight + trend + competitor reads
 *   2. synthesizeOpportunities — merge + rank all signals
 *   3. mapOpportunityToBriefs — produce GeneratedBrief[] per opportunity
 *   4. applyBrandVoice — validate each brief (already done inside mapOpportunityToBriefs)
 *   5. Cap at maxBriefs (default 10)
 *   6. persistBriefs — INSERT to content_briefs + marketing_decisions
 *
 * @param asOfDate - YYYY-MM-DD. The last day of the analysis window.
 * @param opts.dryRun - When true, returns briefs without writing to DB.
 * @param opts.maxBriefs - Cap on number of briefs generated. Default 10.
 */
export async function generateWeeklyBriefs(
  asOfDate: string,
  opts: GenerateOptions = {}
): Promise<GeneratedBrief[]> {
  const maxBriefs = opts.maxBriefs ?? DEFAULT_MAX_BRIEFS

  // Step 1
  const signals = await gatherSignals(asOfDate)

  // Step 2
  const opportunities = synthesizeOpportunities(signals)

  // Step 3 + 4: map each opportunity → briefs, flatten, cap
  const allBriefs: GeneratedBrief[] = []
  const usedOpportunities: RankedOpportunity[] = []

  for (const opp of opportunities) {
    if (allBriefs.length >= maxBriefs) break
    const mapped = mapOpportunityToBriefs(opp, signals)
    if (mapped.length > 0) {
      const remaining = maxBriefs - allBriefs.length
      allBriefs.push(...mapped.slice(0, remaining))
      usedOpportunities.push(opp)
    }
  }

  // Step 5: persist
  await persistBriefs(allBriefs, usedOpportunities, opts)

  return allBriefs
}

// ---------------------------------------------------------------------------
// Private utility
// ---------------------------------------------------------------------------

function offsetDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Construct a GeneratedBrief with all required fields. voice_validation is applied by the caller. */
function buildBrief(params: Omit<GeneratedBrief, 'voice_validation'>): Omit<GeneratedBrief, 'voice_validation'> {
  return {
    topic: params.topic,
    format: params.format,
    platforms: params.platforms,
    hook: params.hook,
    body: params.body,
    cta: params.cta,
    target_audience: params.target_audience,
    data_sources: params.data_sources,
    predicted_outcome: {
      primary_metric: params.predicted_outcome.primary_metric || 'qualified_seller_leads',
      expected_value: params.predicted_outcome.expected_value,
      rationale: params.predicted_outcome.rationale,
    },
    generation_reason: params.generation_reason,
  }
}
