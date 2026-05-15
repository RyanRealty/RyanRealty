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
 *   audit-crm north_star drop/spike       → fb_lead_gen_ad + market_data_short
 *   audit-crm response_time investigate_drop → ops:fub_task_create
 *   audit-crm response_time review_targeting → ops:fub_sequence_change
 *   audit-crm tagging_drift investigate_drop → ops:fub_tag_fix
 *   audit-crm pipeline_health pause_underperformer → ops:fub_routing
 *   audit-crm pipeline_health audit_landing_page → site:cta_update
 *   audit-crm source_quality expand_to_similar_audience → ops:meta_audience
 *   audit-ads creative test_new_creative   → fb_lead_gen_ad ×3 (data/question/contrarian)
 *   audit-ads * capitalize_on_spike       → market_data_short
 *   audit-ads budget reduce/increase       → ops:meta_budget (matt-explicit, ±25% band)
 *   audit-ads targeting review_targeting    → ops:meta_audience (matt-explicit)
 *   audit-ads campaign_structure pause     → ops:meta_pause (matt-explicit)
 *   audit-ads tracking check_tracking      → analyze:metric_decomposition
 *   audit-website seo investigate_drop     → blog_post (refresh losing query)
 *   audit-website seo capitalize_on_spike  → blog_post + ig_carousel (recycle winning content)
 *   audit-website seo test_new_creative    → site:meta_update (Item 1 wiring)
 *   audit-website page audit_landing_page  → site:cta_update (Item 1 wiring)
 *   audit-website funnel audit_landing_page → site:cta_update (Item 1 wiring)
 *   cadence (any channel below target)    → channel-matched default format (Item 2 wiring)
 *   listing_coverage uncovered_active     → content:list_kit (Item 2 wiring)
 *   competitor serp_gap                   → blog_post + ig_carousel
 *   competitor format_gap (video)         → market_data_short
 *   platform-trends format                → market_data_short OR meme_video by label cue
 *   platform-trends audio                 → meme_video
 *   platform-trends hashtag               → ig_carousel
 *   platform-trends algorithm             → SKIP (Item 5: comms:matt_alert)
 *   diagnose capitalize_on_spike          → channel-matched format, correct producer routing
 *
 * Silently dropped today — still in scope for later items:
 *   audit-ads budget/tracking/targeting/campaign_structure → ops:meta_* actions (next)
 *   audit-website traffic investigate_drop                 → analyze:drop_investigation (future)
 *   audit-crm response_time/source_quality/tagging_drift/pipeline_health → Item 2 (ops:fub_* + comms:*)
 *   platform-trends algorithm                             → Item 5 (comms:matt_alert)
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
  /**
   * Optional override for the `target` column on marketing_brain_actions.
   * Defaults to 'brand' for content briefs. Site/ops briefs override with
   * page paths ('/listings'), MLS ids ('mls:220189422'), campaign ids
   * ('campaign_id:abc'), etc.
   */
  target?: string
  /**
   * Optional override for the `payload` jsonb on marketing_brain_actions.
   * When present, replaces the default content payload (hook/body/cta/
   * target_audience) entirely. Used by site:* and ops:* briefs where the
   * producer needs structured edit data rather than hook+body+cta.
   */
  payload_override?: Record<string, unknown>
}

export interface GenerateOptions {
  dryRun?: boolean
  maxBriefs?: number
}

export interface PersistResult {
  inserted: number
  ids: string[]
  errors: string[]
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** An opportunity from any audit source, normalized for ranking. */
interface RankedOpportunity {
  /** Source system that surfaced this opportunity. */
  source: 'audit-crm' | 'audit-ads' | 'audit-website' | 'competitor' | 'platform-trend' | 'diagnose' | 'cadence' | 'listing_coverage'
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
  cadenceGaps: CadenceGap[]
  activeListingNeeds: ActiveListingNeed[]
  auditFindings: AuditFindingsSnapshot | null
}

/**
 * Subset of the analyze:audit_findings payload that generate-briefs needs
 * to make audit-aware format choices. Full shape lives in
 * `marketing_brain_skills/audit-findings/PROTOCOL.md`.
 */
export interface AuditFindingsSnapshot {
  audit_id: string
  audit_completed_at: string
  top_winners_by_topic_format: Array<{
    topic: string
    format: string
    median_engagement_rate: number
    p75_engagement_rate: number
    post_count: number
  }>
  missing_producers_count: number
}

/** A single channel below its target posting cadence. Item 2 — gatherCadenceGaps. */
export interface CadenceGap {
  channel: Channel
  target_per_week: number
  actual_last_7d: number
  gap: number
  days_since_last_post: number | null
}

/** An active listing with no recent content brief covering it. Item 2 — gatherActiveListingNeeds. */
export interface ActiveListingNeed {
  listing_key: string
  address: string
  city: string
  list_price: number
  photo_url: string | null
  days_since_last_coverage: number | null
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

/**
 * Target posting cadence per channel (posts per 7-day window).
 * Sourced from social_media_skills/platform-best-practices/SKILL.md.
 * Item 2 — gatherCadenceGaps surfaces channels that fell below target.
 */
const CADENCE_TARGETS: Partial<Record<Channel, number>> = {
  instagram: 5,
  tiktok: 5,
  meta_page: 4,
  youtube: 2,
  linkedin: 3,
  x: 5,
  gbp: 2,
}

/** Days of staleness before an active listing becomes a coverage opportunity. */
const LISTING_COVERAGE_THRESHOLD_DAYS = 14

/** Top N active listings the brain considers each cycle (sorted by ListPrice desc). */
const LISTING_COVERAGE_TOP_N = 3

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
// Item 2 — cadence gap detection
// ---------------------------------------------------------------------------

/**
 * Detect channels that fell below their target posting cadence in the last
 * 7 days. Reads marketing_channel_daily for scope='post' rows and counts
 * distinct scope_id per channel.
 *
 * Returns one entry per under-cadence channel. Channels at or above target
 * are omitted. Soft-fail: returns [] on any Supabase error.
 */
export async function gatherCadenceGaps(asOfDate: string): Promise<CadenceGap[]> {
  const supabase = getSupabase()
  const sevenDaysAgo = offsetDate(asOfDate, -7)

  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('channel, date, scope_id')
    .eq('scope', 'post')
    .gte('date', sevenDaysAgo)
    .lte('date', asOfDate)

  if (error) {
    console.error('gatherCadenceGaps:', error.message)
    return []
  }

  const postsByChannel = new Map<Channel, Set<string>>()
  const latestPostByChannel = new Map<Channel, string>()

  for (const row of (data ?? []) as Array<{ channel: string; date: string; scope_id: string }>) {
    const channel = row.channel as Channel
    if (!postsByChannel.has(channel)) postsByChannel.set(channel, new Set())
    postsByChannel.get(channel)!.add(row.scope_id)

    const prev = latestPostByChannel.get(channel)
    if (!prev || row.date > prev) {
      latestPostByChannel.set(channel, row.date)
    }
  }

  const gaps: CadenceGap[] = []
  for (const [channelStr, target] of Object.entries(CADENCE_TARGETS)) {
    const channel = channelStr as Channel
    const actual = postsByChannel.get(channel)?.size ?? 0
    if (actual >= (target as number)) continue

    const latestPost = latestPostByChannel.get(channel)
    const daysSince = latestPost
      ? Math.floor((Date.parse(asOfDate) - Date.parse(latestPost)) / 86400000)
      : null

    gaps.push({
      channel,
      target_per_week: target as number,
      actual_last_7d: actual,
      gap: (target as number) - actual,
      days_since_last_post: daysSince,
    })
  }

  return gaps
}

// ---------------------------------------------------------------------------
// Item 2 — active-listing coverage detection
// ---------------------------------------------------------------------------

/**
 * Find active listings the brain has not generated a content brief for in
 * the last LISTING_COVERAGE_THRESHOLD_DAYS. Returns the top-N by ListPrice.
 *
 * "Covered" means a marketing_brain_actions row exists with
 * target='mls:<ListingKey>' and created_at within the threshold window.
 *
 * Soft-fail: returns [] on Supabase error. The Spark MLS listings table
 * uses mixed-case column names (per CLAUDE.md schema notes) — Supabase
 * JS client accepts them in .select() and .eq() without explicit quoting.
 */
export async function gatherActiveListingNeeds(asOfDate: string): Promise<ActiveListingNeed[]> {
  const supabase = getSupabase()
  const thresholdDate = offsetDate(asOfDate, -LISTING_COVERAGE_THRESHOLD_DAYS)

  // Step 1: collect ListingKeys that already have a brief in the window
  const coveredRes = await supabase
    .from('marketing_brain_actions')
    .select('target, created_at')
    .like('target', 'mls:%')
    .gte('created_at', `${thresholdDate}T00:00:00Z`)

  if (coveredRes.error) {
    console.error('gatherActiveListingNeeds (covered query):', coveredRes.error.message)
    return []
  }

  const coveredKeys = new Set<string>()
  for (const row of (coveredRes.data ?? []) as Array<{ target: string }>) {
    coveredKeys.add(row.target.replace('mls:', ''))
  }

  // Step 2: pull top 20 active listings by ListPrice
  const listingsRes = await supabase
    .from('listings')
    .select('ListingKey, StreetNumber, StreetName, City, ListPrice, PhotoURL')
    .eq('StandardStatus', 'Active')
    .order('ListPrice', { ascending: false })
    .limit(20)

  if (listingsRes.error) {
    console.error('gatherActiveListingNeeds (listings query):', listingsRes.error.message)
    return []
  }

  // Step 3: filter out covered + map
  const needs: ActiveListingNeed[] = []
  for (const l of (listingsRes.data ?? []) as Array<Record<string, unknown>>) {
    const key = String(l.ListingKey ?? '')
    if (!key || coveredKeys.has(key)) continue

    const streetNum = l.StreetNumber ? String(l.StreetNumber) : ''
    const streetName = l.StreetName ? String(l.StreetName) : ''
    const city = l.City ? String(l.City) : ''
    const price = typeof l.ListPrice === 'number' ? l.ListPrice : Number(l.ListPrice ?? 0)
    const photo = l.PhotoURL ? String(l.PhotoURL) : null

    needs.push({
      listing_key: key,
      address: `${streetNum} ${streetName}`.trim(),
      city,
      list_price: price,
      photo_url: photo,
      days_since_last_coverage: null,
    })

    if (needs.length >= LISTING_COVERAGE_TOP_N) break
  }

  return needs
}

// ---------------------------------------------------------------------------
// Audit-findings reader — closes the brain's feedback loop on competitive intel
// ---------------------------------------------------------------------------

/**
 * Read the most recent analyze:audit_findings action row (pending OR approved)
 * and extract the subset generate-briefs needs for audit-aware format choices.
 * Returns null when no audit has ever run.
 *
 * Bounded query — single row lookup, fast.
 */
export async function fetchLatestAuditFindings(): Promise<AuditFindingsSnapshot | null> {
  const supabase = getSupabase()
  const res = await supabase
    .from('marketing_brain_actions')
    .select('payload, status, created_at')
    .eq('action_type', 'analyze:audit_findings')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (res.error || !res.data) return null

  const payload = res.data.payload as Record<string, unknown> | null
  if (!payload) return null

  const winners = (payload.top_winners_by_topic_format as Array<Record<string, unknown>> | undefined) ?? []
  const missing = (payload.missing_producers as Array<unknown> | undefined) ?? []

  return {
    audit_id: String(payload.audit_id ?? ''),
    audit_completed_at: String(payload.audit_completed_at ?? res.data.created_at ?? ''),
    top_winners_by_topic_format: winners.map((w) => ({
      topic: String(w.topic ?? ''),
      format: String(w.format ?? ''),
      median_engagement_rate: Number(w.median_engagement_rate ?? 0),
      p75_engagement_rate: Number(w.p75_engagement_rate ?? 0),
      post_count: Number(w.post_count ?? 0),
    })),
    missing_producers_count: missing.length,
  }
}

/**
 * Map a taxonomy (topic, audit Format) tuple to the brain's emitted format
 * string. The audit reports winners using the topic-taxonomy.ts Format enum;
 * the brain emits format strings the formatRoute table understands.
 *
 * Extend this map as new topic/format combos become winning patterns.
 */
const AUDIT_FORMAT_TO_BRAIN_FORMAT: Record<string, Record<string, string>> = {
  listing: {
    reel: 'listing_reel',
    long_video: 'listing_video',
    carousel: 'ig_carousel',
    single_image: 'just_listed_flyer',
    blog: 'blog_post',
  },
  market_data: {
    reel: 'market_data_short',
    long_video: 'market_youtube_longform',
    carousel: 'ig_carousel',
    blog: 'blog_post',
  },
  national_housing_news: {
    reel: 'news_clip',
    long_video: 'news_video',
    blog: 'blog_post',
    carousel: 'ig_carousel',
  },
  national_economy: {
    blog: 'blog_post',
    reel: 'news_clip',
    carousel: 'ig_carousel',
  },
  local_community: {
    reel: 'area_guide_short',
    blog: 'blog_post',
  },
  lifestyle_bend: {
    reel: 'neighborhood_reel',
    long_video: 'neighborhood_tour',
  },
  buyer_education: {
    blog: 'blog_post',
    carousel: 'ig_carousel',
  },
  seller_education: {
    blog: 'blog_post',
    carousel: 'ig_carousel',
  },
  recap_highlight: {
    carousel: 'ig_carousel',
    blog: 'blog_post',
  },
  agent_brand: {
    carousel: 'ig_carousel',
    single_image: 'feature_sheet',
  },
}

/**
 * Consult the latest audit findings for a winning format for the given topic.
 * Returns null when no audit data exists, when the topic has no winners with
 * sufficient sample (post_count >= 5), or when the winning format doesn't map
 * to a brain format string.
 *
 * Caller falls back to its hardcoded default when this returns null.
 */
export function pickAuditWinningFormat(
  topic: string,
  auditFindings: AuditFindingsSnapshot | null,
): { format: string; rationale: string } | null {
  if (!auditFindings) return null

  // Filter audit winners to this topic, sample size >= 5, sort by p75 desc
  const candidates = auditFindings.top_winners_by_topic_format
    .filter((w) => w.topic === topic && w.post_count >= 5)
    .sort((a, b) => b.p75_engagement_rate - a.p75_engagement_rate)

  if (candidates.length === 0) return null

  const winner = candidates[0]
  const brainFormat = AUDIT_FORMAT_TO_BRAIN_FORMAT[topic]?.[winner.format]
  if (!brainFormat) return null

  return {
    format: brainFormat,
    rationale: `Audit ${auditFindings.audit_id} shows ${topic}/${winner.format} winning with p75 ER ${winner.p75_engagement_rate.toFixed(3)} across ${winner.post_count} competitor posts.`,
  }
}

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

  // Item 2 — cadence + active-listing gatherers run alongside the audits
  const cadencePromise = gatherCadenceGaps(asOfDate).catch((e) => {
    console.error('gatherSignals cadenceGaps:', e instanceof Error ? e.message : String(e))
    return [] as CadenceGap[]
  })
  const listingNeedsPromise = gatherActiveListingNeeds(asOfDate).catch((e) => {
    console.error('gatherSignals activeListingNeeds:', e instanceof Error ? e.message : String(e))
    return [] as ActiveListingNeed[]
  })

  // Audit-findings reader — pulls the latest pending/approved analyze:audit_findings
  // action row + extracts the subset generate-briefs needs to make audit-aware
  // format choices. Soft-fail on missing/empty.
  const auditFindingsPromise = fetchLatestAuditFindings().catch((e) => {
    console.error('gatherSignals auditFindings:', e instanceof Error ? e.message : String(e))
    return null
  })

  const [websiteAudit, adsAudit, crmAudit, insightResults, platformTrends, competitorRows, cadenceGaps, activeListingNeeds, auditFindings] =
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
      cadencePromise,
      listingNeedsPromise,
      auditFindingsPromise,
    ])

  const channelInsights = insightResults.filter((i): i is InsightSummary => i !== null)

  return { asOfDate, websiteAudit, adsAudit, crmAudit, channelInsights, platformTrends, competitorRows, cadenceGaps, activeListingNeeds, auditFindings }
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

  // --- Cadence gaps (Item 2) ---
  for (const gap of signals.cadenceGaps) {
    // Severity scales with staleness. Never-posted is medium (some channels
    // are intentionally inactive); >7d stale is high; <=7d stale is low.
    const sev: 'high' | 'medium' | 'low' =
      gap.days_since_last_post === null ? 'medium' :
      gap.days_since_last_post > 7 ? 'high' :
      'low'

    opps.push({
      source: 'cadence',
      area: gap.channel,
      severity: sev,
      headline: `${gap.channel} cadence gap: ${gap.actual_last_7d}/${gap.target_per_week} posts in last 7 days`,
      evidence: `Target ${gap.target_per_week}/wk, actual ${gap.actual_last_7d}. ${gap.days_since_last_post === null ? 'No post detected in window.' : `Last post ${gap.days_since_last_post}d ago.`}`,
      recommended_action: 'test_new_creative',
      north_star_weight: 1,
      rank_score: rankScore(sev, 'cadence'),
      meta: { gap },
    })
  }

  // --- Active-listing coverage gaps (Item 2) ---
  for (const need of signals.activeListingNeeds) {
    opps.push({
      source: 'listing_coverage',
      area: 'uncovered_active',
      severity: 'medium',
      headline: `Active listing without recent coverage: ${need.address}, ${need.city}`,
      evidence: `$${need.list_price.toLocaleString()} active listing. No content brief in last ${LISTING_COVERAGE_THRESHOLD_DAYS} days.`,
      recommended_action: 'test_new_creative',
      north_star_weight: 1,
      rank_score: rankScore('medium', 'listing_coverage'),
      meta: { listing: need },
    })
  }

  // Rank descending by rank_score, then severity, then source priority
  const sourcePriority: Record<RankedOpportunity['source'], number> = {
    'audit-crm': 0, 'audit-ads': 1, 'audit-website': 2, 'competitor': 3,
    'platform-trend': 4, 'diagnose': 5, 'cadence': 6, 'listing_coverage': 7,
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

  // ── audit-crm north_star drop/spike → fb_lead_gen_ad + market_data_short ─
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

    // Paid: FB lead-gen ad creative
    briefs.push(buildBrief({
      topic: `Recover qualified seller leads — WoW ${isDrop ? 'drop' : 'shift'} ${wowPctStr}`,
      format: 'fb_lead_gen_ad',
      platforms: ['facebook', 'instagram'],
      hook: isDrop
        ? `Selling in Bend this year? Here is what changed in the market last week.`
        : `Bend sellers: the data moved this week. Here's the read.`,
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

    // Organic: data-driven 30-45s vertical short by default; audit can
    // override with a higher-ER format for the market_data topic.
    const ns_auditPick = pickAuditWinningFormat('market_data', signals.auditFindings)
    const ns_organicFormat = ns_auditPick?.format ?? 'market_data_short'
    const ns_organicPlatforms = ns_organicFormat === 'ig_carousel' ? ['instagram'] :
                                 ns_organicFormat === 'market_youtube_longform' ? ['youtube'] :
                                 ['instagram', 'tiktok']
    briefs.push(buildBrief({
      topic: `Bend market data ${ns_organicFormat === 'ig_carousel' ? 'carousel' : 'short'} — seller positioning`,
      format: ns_organicFormat,
      platforms: ns_organicPlatforms,
      hook: `Bend, ${new Date(signals.asOfDate).toLocaleString('default', { month: 'long', year: 'numeric' })}. If you own a home here, read this.`,
      body: `Months of supply, median price, days on market. Three numbers. What they mean for you.`,
      cta: `Link in bio: get your home's current value, no call required.`,
      target_audience: 'out_of_state_seller',
      data_sources: [
        { type: 'audit-crm', evidence: `north_star WoW: ${wowPctStr}. Window total: ${ns.window_total} qualified_seller_leads.` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+0.5 to +1 qualified_seller_lead/week from organic-attributed leads',
        rationale: `Data-driven short backs up the FB ad with social proof. Cross-platform IG + TikTok distribution improves retargeting pool size. Based on the last 4 weeks of IG-to-lead attribution in FUB.`,
      },
      generation_reason: `audit-crm north_star companion ${ns_organicFormat}: WoW change ${wowPctStr}.${ns_auditPick ? ' ' + ns_auditPick.rationale : ''}`,
    }))
  }

  // ── audit-crm response_time + investigate_drop → ops:fub_task_create ─────
  // Compliance below 50% — SLA breaches need immediate task follow-up.
  if (
    opportunity.source === 'audit-crm' &&
    opportunity.area === 'response_time' &&
    opportunity.recommended_action === 'investigate_drop'
  ) {
    const rt = signals.crmAudit.response_time
    briefs.push(buildBrief({
      topic: `FUB SLA breach task: response-time compliance below 50%`,
      format: 'ops_fub_task_create',
      platforms: ['fub'],
      hook: `Response-time SLA compliance is ${rt.compliance_pct?.toFixed(0) ?? 'unknown'}% over the last ${rt.data_days} days. Below the 50% floor.`,
      body: `Create a FUB task on the broker responsible for the affected lead stage. Surface the count of breaches, the median response time, and the hot vs warm SLA thresholds. matt-explicit approval required before any bulk task creation.`,
      cta: undefined,
      target_audience: 'internal',
      target: `audit:fub_sla_breach:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        compliance_pct: rt.compliance_pct,
        avg_response_time_minutes: rt.avg_response_time_minutes,
        sla_hot_minutes: rt.sla_hot_minutes,
        sla_warm_minutes: rt.sla_warm_minutes,
        compliant_days: rt.compliant_days,
        noncompliant_days: rt.noncompliant_days,
        action_hint: 'Create a FUB task on Matt (or the broker on rotation) for "Review SLA breaches from the last N days." matt-explicit before bulk task creation.',
        source_audit: 'audit-crm.response_time.investigate_drop',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-crm', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: 'Recover SLA compliance to >80% within 14 days; +5-15% qualified-lead conversion',
        rationale: `SLA breaches under 50% compliance correlate directly with lost qualified leads. Tasked follow-up restores compliance, which restores the lead conversion baseline.`,
      },
      generation_reason: `audit-crm response_time investigate_drop: ${opportunity.headline}. Compliance ${rt.compliance_pct?.toFixed(0) ?? '?'}%, ${rt.noncompliant_days}/${rt.data_days} non-compliant days.`,
    }))
  }

  // ── audit-crm response_time + review_targeting → ops:fub_sequence_change ─
  // 50-80% compliance — sequence change (route slower leads to auto-followup
  // faster) is the right fix vs creating individual tasks.
  if (
    opportunity.source === 'audit-crm' &&
    opportunity.area === 'response_time' &&
    opportunity.recommended_action === 'review_targeting'
  ) {
    const rt = signals.crmAudit.response_time
    briefs.push(buildBrief({
      topic: `FUB sequence change: tighten auto-followup for slow leads`,
      format: 'ops_fub_sequence_change',
      platforms: ['fub'],
      hook: `Response-time SLA compliance is ${rt.compliance_pct?.toFixed(0) ?? 'unknown'}% — within band but not where we want it.`,
      body: `Adjust the auto-followup sequence so leads that miss the hot-stage SLA route into a tighter touch cadence. Reduces dependency on manual broker followup during high-volume windows.`,
      cta: undefined,
      target_audience: 'internal',
      target: `audit:fub_sla_sequence:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        compliance_pct: rt.compliance_pct,
        sla_hot_minutes: rt.sla_hot_minutes,
        sla_warm_minutes: rt.sla_warm_minutes,
        action_hint: 'Propose a FUB sequence update: hot-stage leads with no broker reply in N minutes auto-trigger a templated email + SMS. matt-explicit before changing the active sequence.',
        source_audit: 'audit-crm.response_time.review_targeting',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-crm', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: 'Compliance lift toward 90%+ within 21 days',
        rationale: `Auto-followup catches the gap that manual response misses during high-volume windows. Lifts compliance without adding broker workload.`,
      },
      generation_reason: `audit-crm response_time review_targeting: ${opportunity.headline}. Compliance ${rt.compliance_pct?.toFixed(0) ?? '?'}%.`,
    }))
  }

  // ── audit-crm tagging_drift + investigate_drop → ops:fub_tag_fix ─────────
  // Untagged percentage above 10% — broker-side tagging discipline issue.
  if (
    opportunity.source === 'audit-crm' &&
    opportunity.area === 'tagging_drift' &&
    opportunity.recommended_action === 'investigate_drop'
  ) {
    briefs.push(buildBrief({
      topic: `FUB tagging cleanup: untagged seller leads above threshold`,
      format: 'ops_fub_tag_fix',
      platforms: ['fub'],
      hook: `New leads landing in FUB without a seller-stage tag above the 10% drift threshold. Without tagging, attribution breaks.`,
      body: `Identify the untagged leads in the last window, propose tag assignments based on lead source + form-fill signals, and queue a bulk apply. matt-explicit on any bulk apply touching >5 leads.`,
      cta: undefined,
      target_audience: 'internal',
      target: `audit:fub_tagging_drift:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        action_hint: 'Query FUB for new leads in the window with no seller-stage tag. Inspect source + form payload, propose tag, surface for matt-explicit. If <=5 leads, matt-review-draft is sufficient.',
        source_audit: 'audit-crm.tagging_drift.investigate_drop',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-crm', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: 'Restore tagging coverage to 95%+; restore attribution accuracy',
        rationale: `Untagged leads break the brain's source-quality audit and the FB-attribution loop. Tagging cleanup restores both, which restores budget-decision accuracy downstream.`,
      },
      generation_reason: `audit-crm tagging_drift investigate_drop: ${opportunity.headline}.`,
    }))
  }

  // ── audit-crm pipeline_health + pause_underperformer → ops:fub_routing ───
  // Stalled stages — re-route leads stuck in one stage too long.
  if (
    opportunity.source === 'audit-crm' &&
    opportunity.area === 'pipeline_health' &&
    opportunity.recommended_action === 'pause_underperformer'
  ) {
    const pipe = signals.crmAudit.pipeline_health
    const stalledStage = (pipe.stages as unknown as Array<Record<string, unknown>>).find((s) => s.is_stalled === true)
    briefs.push(buildBrief({
      topic: `FUB routing change: stalled stage needs re-routing`,
      format: 'ops_fub_routing',
      platforms: ['fub'],
      hook: `Leads are accumulating in a stage without progression. Pipeline value $${pipe.total_pipeline_value.toLocaleString()} across ${pipe.total_pipeline_count} leads.`,
      body: `Identify the stalled stage and re-route the leads either to a different broker, into an auto-followup sequence, or to a "stale" stage with explicit cleanup. matt-explicit on any routing change touching >5 leads.`,
      cta: undefined,
      target_audience: 'internal',
      target: `audit:fub_pipeline_stall:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        total_pipeline_count: pipe.total_pipeline_count,
        total_pipeline_value: pipe.total_pipeline_value,
        stalled_stage: stalledStage?.stage ?? null,
        action_hint: 'Inspect the stalled stage in FUB. Propose either re-routing to a different broker, dropping into the warm-followup sequence, or moving to a "stale" stage with a 30d cleanup task. matt-explicit on bulk routing.',
        source_audit: 'audit-crm.pipeline_health.pause_underperformer',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-crm', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: 'Recover 5-15% of stalled pipeline value within 30 days',
        rationale: `Stalled stages compound: leads that sit untouched for too long become unrecoverable. Re-routing or sequencing them captures the recoverable portion before it converts to a closed-lost.`,
      },
      generation_reason: `audit-crm pipeline_health pause_underperformer: ${opportunity.headline}. ${pipe.total_pipeline_count} leads / $${pipe.total_pipeline_value.toLocaleString()} in pipeline.`,
    }))
  }

  // ── audit-crm pipeline_health + audit_landing_page → site:cta_update ─────
  // Low new-to-hot conversion — the lead-gen landing page is bringing in
  // low-quality leads. Site-edit producer handles the fix.
  if (
    opportunity.source === 'audit-crm' &&
    opportunity.area === 'pipeline_health' &&
    opportunity.recommended_action === 'audit_landing_page'
  ) {
    briefs.push(buildBrief({
      topic: `Site CTA review: low new-to-hot conversion in pipeline`,
      format: 'site_cta_update',
      platforms: ['site'],
      hook: `Leads enter the pipeline but few make it to "hot". The lead-gen landing pages are over-promising or under-qualifying.`,
      body: `Audit the seller-intent landing pages for CTA copy that filters intent (e.g. "Get a real number based on Bend MLS data — takes 24 hours" beats "Get your free instant home value"). Tighter promises filter low-intent traffic at the form, raising new-to-hot conversion.`,
      cta: undefined,
      target_audience: 'site_visitor_seller',
      target: `audit:funnel_quality:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        edit_targets: ['cta_copy', 'form_qualification_fields', 'above_fold_promise'],
        problem_type: 'low_new_to_hot_conversion',
        action_hint: 'Audit /lp/seller-home-value and /lp/seller-cma CTA copy. Propose changes that filter intent at the form. Open a PR for matt-review-PR.',
        source_audit: 'audit-crm.pipeline_health.audit_landing_page',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-crm', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+10-25% new-to-hot conversion within 30 days',
        rationale: `Pipeline quality is shaped at the form. CTA copy that promises a more specific outcome filters out drive-by submissions, raising downstream conversion without hurting raw lead count meaningfully.`,
      },
      generation_reason: `audit-crm pipeline_health audit_landing_page: ${opportunity.headline}.`,
    }))
  }

  // ── audit-crm source_quality + expand_to_similar_audience → ops:meta_audience ─
  // High-quality source has volume cap; expand via paid lookalike.
  if (
    opportunity.source === 'audit-crm' &&
    opportunity.area === 'source_quality' &&
    opportunity.recommended_action === 'expand_to_similar_audience'
  ) {
    briefs.push(buildBrief({
      topic: `Meta Ads audience expansion: scale winning lead source`,
      format: 'ops_meta_audience',
      platforms: ['meta'],
      hook: `A high-quality lead source is hitting volume ceiling. The lookalike opportunity is to scale what's working.`,
      body: `Build a lookalike audience seeded from the winning source's converted leads, layer it onto the lookalike role, and ramp spend within the playbook band. matt-explicit before applying.`,
      cta: undefined,
      target_audience: 'past_seller_lookalike',
      target: `audit:source_expansion:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        action_hint: 'Identify the winning source from audit-crm.source_quality, pull its converted leads from FUB, build a Meta lookalike from that seed (1% LAL to start), apply to the lookalike-role campaign. matt-explicit.',
        source_audit: 'audit-crm.source_quality.expand_to_similar_audience',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-crm', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+3-8 qualified_seller_leads/week if the lookalike maps the seed well',
        rationale: `When a single source is producing quality leads but capped on volume, lookalike modeling is the lowest-CAC way to scale. Same audience signal, larger reach pool.`,
      },
      generation_reason: `audit-crm source_quality expand_to_similar_audience: ${opportunity.headline}.`,
    }))
  }

  // ── audit-ads test_new_creative (fatigue) — fb_lead_gen_ad ×3 variants ───
  // Three variants is the intentional exception to the 1-2-briefs-per-opportunity
  // rule: creative-fatigue requires a deliberate A/B/C test, not a single
  // replacement creative.
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
        format: 'fb_lead_gen_ad',
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

  // ── audit-ads capitalize_on_spike → market_data_short ────────────────────
  // (Previously ig_reel routed wrongly to listing_reveal; now market-data-video.)
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

    // Audit-aware format pick: default short; audit may bump to carousel or longform.
    const ads_auditPick = pickAuditWinningFormat('market_data', signals.auditFindings)
    const ads_format = ads_auditPick?.format ?? 'market_data_short'
    const ads_platforms = ads_format === 'ig_carousel' ? ['instagram'] :
                          ads_format === 'market_youtube_longform' ? ['youtube'] :
                          ['instagram', 'tiktok']
    briefs.push(buildBrief({
      topic: `Capitalize on ads engagement spike — ${ads_format === 'ig_carousel' ? 'market data carousel' : 'market data short'}`,
      format: ads_format,
      platforms: ads_platforms,
      hook: `Bend market data shifted in the last seven days. Here's what changed.`,
      body: `Active inventory, median price, days on market. Three numbers. What the shift means for sellers thinking about pricing.`,
      cta: `Get a real number for your Bend home in 24 hours.`,
      target_audience: audience,
      data_sources: [
        { type: 'audit-ads', evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+1 qualified_seller_lead per 1,000 additional reach',
        rationale: `Engagement spike on paid channel signals warm audience receptivity. Matching organic data-driven format to the moment amplifies the reach pool for retargeting.`,
      },
      generation_reason: `audit-ads capitalize_on_spike: ${evidence}.${ads_auditPick ? ' ' + ads_auditPick.rationale : ''}`,
    }))
  }

  // ── audit-ads budget (drift) → ops:meta_budget ───────────────────────────
  // Spend below playbook → increase_budget. Spend above playbook → reduce_budget.
  // Both cap proposed delta at ±25% per FB_SELLER_CAMPAIGN_PLAYBOOK.md.
  // ops-meta-ads producer is matt-explicit: action stays pending until Matt confirms.
  if (
    opportunity.source === 'audit-ads' &&
    opportunity.area === 'budget' &&
    (opportunity.recommended_action === 'reduce_budget' || opportunity.recommended_action === 'increase_budget')
  ) {
    const budget = signals.adsAudit.budget
    const direction = opportunity.recommended_action === 'increase_budget' ? 'increase' : 'reduce'
    // Prefer the flagged role; otherwise account-level totals
    const flaggedRole = (budget.by_role as unknown as Array<Record<string, unknown>>).find((r) => r.drift_flagged === true)
    const role = flaggedRole?.role ? String(flaggedRole.role) : 'account'
    const currentSpend = (flaggedRole?.actual_spend as number) ?? budget.actual_spend
    const targetSpend = (flaggedRole?.expected_spend as number) ?? budget.expected_spend
    const rawDelta = currentSpend > 0 ? (targetSpend - currentSpend) / currentSpend : 0
    const proposedDelta = Math.max(-0.25, Math.min(0.25, rawDelta))

    briefs.push(buildBrief({
      topic: `Meta Ads budget ${direction} on ${role} role`,
      format: 'ops_meta_budget',
      platforms: ['meta'],
      hook: `Budget drift on the ${role} role: spending $${currentSpend.toLocaleString()} vs playbook target $${targetSpend.toLocaleString()}.`,
      body: `Propose a ${direction} of ${Math.abs(proposedDelta * 100).toFixed(0)}% on the ${role} daily budget. Bounded by the ±25% daily band locked in FB_SELLER_CAMPAIGN_PLAYBOOK.md.`,
      cta: undefined,
      target_audience: 'brand_default',
      target: `campaign_role:${role}`,
      payload_override: {
        campaign_role: role,
        current_daily_spend: currentSpend,
        target_daily_spend: targetSpend,
        proposed_delta_pct: proposedDelta,
        direction,
        playbook_band_pct: 0.25,
        action_hint: `Surface as matt-explicit. On approval, call Meta Ads API to ${direction} the ${role} role's daily budget by ${Math.abs(proposedDelta * 100).toFixed(0)}%. Verify post-change spend tracking for the next 48h.`,
        source_audit: 'audit-ads.budget.drift',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-ads', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: direction === 'increase'
          ? `+10-25% reach on the ${role} role within 7 days`
          : `Recover ${Math.abs(proposedDelta * 100).toFixed(0)}% of daily spend; reallocate to lower-CPL slot`,
        rationale: `Budget drift means the campaign mix is off-playbook. ${direction === 'increase' ? 'Increasing' : 'Reducing'} brings spend back in band, restoring the role mix the playbook is built around.`,
      },
      generation_reason: `audit-ads budget ${opportunity.recommended_action}: ${opportunity.headline}. ${role} role spend $${currentSpend.toLocaleString()} vs target $${targetSpend.toLocaleString()}.`,
    }))
  }

  // ── audit-ads targeting + review_targeting → ops:meta_audience ───────────
  if (
    opportunity.source === 'audit-ads' &&
    opportunity.area === 'targeting' &&
    opportunity.recommended_action === 'review_targeting'
  ) {
    const campaigns = signals.adsAudit.campaigns as unknown as Array<Record<string, unknown>>
    const flaggedCampaign = campaigns.find((c) => {
      const flags = c.flags as Array<{ type?: string }> | undefined
      return flags?.some((f) => f.type === 'underperforming_cpl')
    })
    const campaign = flaggedCampaign ?? campaigns[0]
    const validCpls = campaigns.map((c) => c.cpl).filter((v): v is number => typeof v === 'number' && v > 0)
    const accountAvgCpl = validCpls.length > 0
      ? validCpls.reduce((s, v) => s + v, 0) / validCpls.length
      : 0
    const campaignCpl = (campaign?.cpl as number | undefined) ?? 0
    const cplMultiple = accountAvgCpl > 0 ? campaignCpl / accountAvgCpl : null

    briefs.push(buildBrief({
      topic: `Meta Ads audience review on ${String(campaign?.campaign_name ?? 'underperforming campaign')}`,
      format: 'ops_meta_audience',
      platforms: ['meta'],
      hook: `CPL on ${String(campaign?.campaign_name ?? 'a campaign')} is ${cplMultiple ? `${cplMultiple.toFixed(1)}×` : 'well above'} the account average. Audience needs review.`,
      body: `Most common cause when one campaign's CPL diverges from the rest: audience is too broad, too narrow, or stale. Audit the interest layer, lookalike percentage, and geo constraints. Propose a tightened audience and surface for matt-explicit approval before applying.`,
      cta: undefined,
      target_audience: 'brand_default',
      target: `campaign_id:${String(campaign?.campaign_id ?? 'unknown')}`,
      payload_override: {
        campaign_id: campaign?.campaign_id,
        campaign_name: campaign?.campaign_name,
        campaign_role: campaign?.role,
        current_cpl: campaignCpl,
        account_avg_cpl: accountAvgCpl,
        cpl_multiple: cplMultiple,
        action_hint: 'Read the affected campaign\'s audience definition via Meta Ads API. Compare to top-performing campaign in the same role. Propose a tightened audience (smaller LAL pct, tighter geo, fewer interests) and surface as matt-explicit.',
        source_audit: 'audit-ads.targeting.cpl_multiple',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-ads', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: 'CPL recovery toward account average within 14 days',
        rationale: `Audience drift is the most common cause of CPL >2× the account average on a single campaign. Tightening the audience and re-testing typically restores CPL within two weeks.`,
      },
      generation_reason: `audit-ads targeting review_targeting: ${opportunity.headline}. ${String(campaign?.campaign_name ?? 'campaign')} CPL ${campaignCpl.toFixed(2)} vs account avg ${accountAvgCpl.toFixed(2)}.`,
    }))
  }

  // ── audit-ads campaign_structure + pause_underperformer → ops:meta_pause ─
  if (
    opportunity.source === 'audit-ads' &&
    opportunity.area === 'campaign_structure' &&
    opportunity.recommended_action === 'pause_underperformer'
  ) {
    const campaigns = signals.adsAudit.campaigns as unknown as Array<Record<string, unknown>>
    const zeroConvCampaign = campaigns.find((c) => {
      const flags = c.flags as Array<{ type?: string }> | undefined
      return flags?.some((f) => f.type === 'no_conversions')
    })
    const campaign = zeroConvCampaign ?? campaigns[0]
    const spend = (campaign?.spend as number | undefined) ?? 0

    briefs.push(buildBrief({
      topic: `Pause Meta Ads campaign with zero conversions: ${String(campaign?.campaign_name ?? 'campaign')}`,
      format: 'ops_meta_pause',
      platforms: ['meta'],
      hook: `${String(campaign?.campaign_name ?? 'A campaign')} burned $${spend.toLocaleString()} this window with zero conversions. Pause and rebuild.`,
      body: `Zero-conversion spend is wasted budget. Pause now, audit the audience and creative, and only relaunch when at least one has changed. matt-explicit approval required before executing the pause API call.`,
      cta: undefined,
      target_audience: 'brand_default',
      target: `campaign_id:${String(campaign?.campaign_id ?? 'unknown')}`,
      payload_override: {
        campaign_id: campaign?.campaign_id,
        campaign_name: campaign?.campaign_name,
        campaign_role: campaign?.role,
        spend_with_no_conversions: spend,
        action_hint: 'Surface as matt-explicit. On approval, call Meta Ads API to set this campaign to PAUSED. Log the pre-pause state for the relaunch audit.',
        source_audit: 'audit-ads.campaign_structure.no_conversions',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-ads', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: `Free $${spend.toLocaleString()} of daily budget for higher-converting slots`,
        rationale: `Zero-conversion campaigns drag the account average CPL up while contributing nothing. Pausing and reallocating is a pure win on attributable lead spend.`,
      },
      generation_reason: `audit-ads campaign_structure pause_underperformer: ${opportunity.headline}. ${String(campaign?.campaign_name ?? 'campaign')} burned $${spend.toLocaleString()} with zero conversions.`,
    }))
  }

  // ── audit-ads tracking + check_tracking → analyze:metric_decomposition ───
  if (
    opportunity.source === 'audit-ads' &&
    opportunity.area === 'tracking' &&
    opportunity.recommended_action === 'check_tracking'
  ) {
    const conv = signals.adsAudit.conversion_path
    const deltaPctStr = conv.delta_pct !== null ? `${conv.delta_pct.toFixed(1)}%` : 'unknown'

    briefs.push(buildBrief({
      topic: `Meta vs FUB conversion gap: investigate tracking`,
      format: 'analyze_metric_decomposition',
      platforms: ['internal'],
      hook: `Meta reports ${conv.meta_conversions} conversions in the last ${conv.window_days} days; FUB has ${conv.fub_qualified_leads} qualified seller leads. Delta ${deltaPctStr}.`,
      body: `Two source-of-truth systems disagree on the same conversion count. Decompose: pixel firing on the wrong event, CAPI deduplication failing, FUB lead-stage filter excluding rows, or a real funnel leak between Meta-attributed sessions and FUB lead creation.`,
      cta: undefined,
      target_audience: 'internal',
      target: `audit:tracking_gap:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        meta_conversions: conv.meta_conversions,
        fub_qualified_leads: conv.fub_qualified_leads,
        delta: conv.delta,
        delta_pct: conv.delta_pct,
        window_days: conv.window_days,
        action_hint: 'Run analyze-anomaly on the conversion path. Decompose by source/medium, by FUB lead-stage filter, by Meta event mapping (Lead vs CompleteRegistration vs Contact). Output findings to marketing_decisions for Matt review.',
        source_audit: 'audit-ads.tracking.meta_vs_fub_delta',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-ads', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: 'Identify root cause; restore reporting accuracy for budget decisions',
        rationale: `Tracking gaps between Meta and FUB usually trace to pixel-mapping or lead-stage filter, not a real conversion loss. Resolving the diagnostic prevents budget moves based on phantom numbers.`,
      },
      generation_reason: `audit-ads tracking check_tracking: ${opportunity.headline}. Meta=${conv.meta_conversions}, FUB=${conv.fub_qualified_leads}, delta=${deltaPctStr}.`,
    }))
  }

  // ── audit-website seo — branch by recommended_action ─────────────────────
  // investigate_drop    → blog_post (page refresh on losing query)
  // capitalize_on_spike → blog_post + ig_carousel (recycle winning content)
  // test_new_creative   → site:meta_update (page ranks but CTR is low —
  //                        the fix is title + meta description, not new
  //                        content; routes to site-edit producer)
  if (
    opportunity.source === 'audit-website' &&
    opportunity.area === 'seo'
  ) {
    const seo = signals.websiteAudit.seo
    const losingQuery = seo?.top_queries.find((q) => q.position_delta !== null && q.position_delta > 1)
    const gainingQuery = seo?.top_queries.find((q) => q.position_delta !== null && q.position_delta < -1)
    const lowCtrQuery = seo?.top_queries.find((q) => q.low_ctr_flag)

    // Low CTR → site:meta_update (page exists, ranks, but few clicks).
    // The fix is the SERP snippet, not new content. Short-circuit the
    // blog_post emission path that follows.
    if (opportunity.recommended_action === 'test_new_creative' && lowCtrQuery) {
      const queryStr = lowCtrQuery.query
      const impressionsStr = lowCtrQuery.impressions.toLocaleString()
      briefs.push(buildBrief({
        topic: `Site meta update: improve CTR on "${queryStr}"`,
        format: 'site_meta_update',
        platforms: ['site'],
        hook: `"${queryStr}" gets ${impressionsStr} impressions but a low click-through rate. Page ranks; SERP snippet does not convert.`,
        body: `Update the page's title tag and meta description to match the query intent. Use the exact query phrase if it reads naturally. Lift CTR by tightening the promise the snippet makes.`,
        cta: undefined,
        target_audience: 'search_intent_match',
        target: `query:${queryStr}`,
        payload_override: {
          query: queryStr,
          impressions: lowCtrQuery.impressions,
          edit_targets: ['title', 'meta_description'],
          problem_type: 'low_ctr',
          action_hint: 'Resolve the ranking page via GSC, then rewrite the title + meta description to align with searcher intent. Site-edit producer opens a PR with both changes.',
          source_audit: 'audit-website.seo.low_ctr_flag',
        },
        data_sources: [
          { type: 'audit-website', evidence: `Query "${queryStr}" — ${impressionsStr} impressions, CTR in bottom quartile of top queries.` },
        ],
        predicted_outcome: {
          primary_metric: 'qualified_seller_leads',
          expected_value: '+30% to +50% CTR on the affected page within 30 days',
          rationale: `A page that ranks but has low CTR has a title/meta mismatch, not a content gap. Rewriting the SERP snippet typically lifts CTR 30-50% on similar pages.`,
        },
        generation_reason: `audit-website seo test_new_creative (low CTR): ${opportunity.headline}. Query "${queryStr}" — ${impressionsStr} impressions.`,
      }))
      return briefs.map((brief): GeneratedBrief => ({ ...brief, voice_validation: applyBrandVoice(brief) }))
    }

    // Other seo branches use a query + blog_post emission
    let targetQuery: string
    let impressions: number
    let queryEvidence: string

    if (opportunity.recommended_action === 'capitalize_on_spike' && gainingQuery) {
      targetQuery = gainingQuery.query
      impressions = gainingQuery.impressions
      queryEvidence = `Position improved ${Math.abs(gainingQuery.position_delta ?? 0).toFixed(1)} places WoW. ${impressions.toLocaleString()} impressions.`
    } else if (opportunity.recommended_action === 'investigate_drop' && losingQuery) {
      targetQuery = losingQuery.query
      impressions = losingQuery.impressions
      queryEvidence = `Position drifted +${losingQuery.position_delta?.toFixed(1)} places WoW. ${impressions.toLocaleString()} impressions.`
    } else {
      const q = losingQuery ?? lowCtrQuery ?? gainingQuery ?? seo?.top_queries[0]
      if (!q) return []
      targetQuery = q.query
      impressions = q.impressions
      queryEvidence = `${impressions.toLocaleString()} impressions. ${opportunity.evidence}`
    }

    // Primary: blog post
    briefs.push(buildBrief({
      topic: `Blog post targeting SEO query: "${targetQuery}"`,
      format: 'blog_post',
      platforms: ['blog'],
      hook: `${targetQuery.charAt(0).toUpperCase() + targetQuery.slice(1)}: what the data says for Bend in ${new Date(signals.asOfDate).getFullYear()}.`,
      body: `Covers: current inventory, median price, days on market, and what this specific question means for buyers and sellers in Bend right now. Every claim sourced to Spark MLS or ORMLS.`,
      cta: `If you have questions about how this affects your property, use the form above.`,
      target_audience: 'search_intent_match',
      data_sources: [
        { type: 'audit-website', evidence: `Query "${targetQuery}" — ${queryEvidence}` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+50 to +200 organic sessions/month within 60 days of publish',
        rationale: `Target query has ${impressions.toLocaleString()} impressions. A well-structured 1,500-word post with the exact query as the H1 and sourced data typically recovers position within 4-8 weeks per GSC history.`,
      },
      generation_reason: `audit-website seo ${opportunity.recommended_action}: ${opportunity.headline}. Evidence: ${opportunity.evidence}`,
    }))

    // Companion: IG carousel recap if we are capitalizing on a winning query
    if (opportunity.recommended_action === 'capitalize_on_spike') {
      briefs.push(buildBrief({
        topic: `IG carousel recap — "${targetQuery}" data`,
        format: 'ig_carousel',
        platforms: ['instagram'],
        hook: `${targetQuery.charAt(0).toUpperCase() + targetQuery.slice(1)}: what the data says.`,
        body: `Five to seven slide carousel summarizing the blog post for IG audience. Same data, same sources, condensed for scroll consumption.`,
        cta: `Full breakdown on the blog. Link in bio.`,
        target_audience: 'search_intent_match',
        data_sources: [
          { type: 'audit-website', evidence: `Recycle winning SEO content into IG carousel. Query "${targetQuery}" — ${queryEvidence}` },
        ],
        predicted_outcome: {
          primary_metric: 'qualified_seller_leads',
          expected_value: '+200 to +800 organic IG impressions; +0.2 to +0.5 qualified_seller_leads/week',
          rationale: `Recycling winning SEO content as a carousel extends reach beyond search to social. IG carousels have higher dwell time than reels for data-heavy content.`,
        },
        generation_reason: `audit-website seo capitalize_on_spike companion carousel: amplify winning query "${targetQuery}".`,
      }))
    }
  }

  // ── audit-website page leak → site:cta_update ────────────────────────────
  // Top-30% sessions, bottom-30% conversion: the page draws traffic but
  // does not convert. Default fix is CTA placement + copy clarity. Routes
  // to site-edit producer; the persistBriefs page-leak marketing_decision
  // log still fires as supplementary audit trail.
  if (
    opportunity.source === 'audit-website' &&
    opportunity.area === 'page' &&
    opportunity.recommended_action === 'audit_landing_page'
  ) {
    briefs.push(buildBrief({
      topic: `Site CTA update: high-traffic page is not converting`,
      format: 'site_cta_update',
      platforms: ['site'],
      hook: `One page draws top-quartile traffic but bottom-quartile leads. Read the CTA, the placement, and the friction below it.`,
      body: `Audit the affected page for CTA visibility above the fold, form length, and copy that promises the reader something they can verify in 5 seconds. Default change: pull the lead form higher, restate the value above it, trim any field that is not required.`,
      cta: undefined,
      target_audience: 'site_visitor_seller',
      target: `audit:page_leak:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        edit_targets: ['cta_placement', 'form_length', 'above_fold_value_prop'],
        problem_type: 'page_leak',
        action_hint: 'Resolve the leaky page via GA4 (top-30% sessions, bottom-30% conversion), inspect current CTA + form, then open a PR adjusting placement + copy. If the page is a landing page tied to an active campaign, prefer A/B testing the change.',
        source_audit: 'audit-website.page.is_leak',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-website', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+1 to +3 qualified_seller_leads/week if the page is a seller-intent landing page; +0.3/week otherwise',
        rationale: `High-traffic + low-conversion pages have either a CTA visibility problem, a friction problem at the form, or a trust problem above the fold. The fix is usually one of those three; CTA placement is the highest-leverage starting point.`,
      },
      generation_reason: `audit-website page audit_landing_page: ${opportunity.headline}. Evidence: ${opportunity.evidence}`,
    }))
  }

  // ── audit-website funnel drop-off → site:cta_update ──────────────────────
  // A funnel step has >=50% drop-off. The previous step's page needs the
  // fix. Same producer as page-leak; different framing in the payload.
  if (
    opportunity.source === 'audit-website' &&
    opportunity.area === 'funnel' &&
    opportunity.recommended_action === 'audit_landing_page'
  ) {
    briefs.push(buildBrief({
      topic: `Site CTA update: funnel drop-off above 50%`,
      format: 'site_cta_update',
      platforms: ['site'],
      hook: `A funnel step is losing more than half its traffic. The fix is on the page before the drop, not after.`,
      body: `The drop-off step indicates the prior page is not selling the next action. Audit the upstream page for a clear next-step CTA, a verifiable promise, and friction-free entry to the next step. Default change: rewrite the CTA copy + make it the single dominant call to action on the page.`,
      cta: undefined,
      target_audience: 'site_visitor_seller',
      target: `audit:funnel_drop:${new Date(signals.asOfDate).toISOString().slice(0, 10)}`,
      payload_override: {
        edit_targets: ['cta_copy', 'cta_placement', 'next_step_clarity'],
        problem_type: 'funnel_drop_off',
        action_hint: 'Resolve the upstream page via GA4 funnel report, audit current CTA copy, then open a PR with rewritten CTA + clearer next-step preview.',
        source_audit: 'audit-website.funnel.dropoff_50pct',
        headline: opportunity.headline,
        evidence: opportunity.evidence,
      },
      data_sources: [
        { type: 'audit-website', evidence: opportunity.evidence },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+10% to +30% step-conversion on the affected funnel step within 30 days',
        rationale: `Funnel drop-offs above 50% almost always trace to a CTA that does not preview the next step clearly. Tightening the copy lifts step-conversion in line with industry benchmarks.`,
      },
      generation_reason: `audit-website funnel audit_landing_page: ${opportunity.headline}. Evidence: ${opportunity.evidence}`,
    }))
  }

  // audit-website traffic → silently dropped today (declining-source
  // analysis is more like an investigation than a site edit; will route
  // to analyze:drop_investigation in a future item).

  // ── competitor SERP gap → blog_post + ig_carousel ────────────────────────
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

    // Companion: IG carousel recycling the blog data
    briefs.push(buildBrief({
      topic: `IG carousel: "${query}" data recap`,
      format: 'ig_carousel',
      platforms: ['instagram'],
      hook: `${query.charAt(0).toUpperCase() + query.slice(1)}: five slides on the Bend data.`,
      body: `Same data as the blog post, recut for IG scroll. Five to seven slides. Plain English, sourced numbers.`,
      cta: `Full post on the blog. Link in bio.`,
      target_audience: 'search_intent_match',
      data_sources: [
        { type: 'competitor', evidence: `Recycle SERP-gap blog content into IG carousel. Competitor ${competitor} ranks for "${query}".` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+150 to +600 IG impressions; cross-platform discovery boost',
        rationale: `IG carousel companion to blog post extends reach. Recycling winning content patterns reduces marginal content cost.`,
      },
      generation_reason: `competitor serp_gap companion carousel: extend "${query}" content reach to IG.`,
    }))
  }

  // ── competitor format_gap (video) → market_data_short (audit may upgrade) ──
  if (opportunity.source === 'competitor' && opportunity.area === 'format_gap') {
    const competitor = (opportunity.meta.competitor as string) ?? 'a competitor'

    // If the audit identified a winning market_data format with strong sample,
    // prefer that over the hardcoded short.
    const fg_auditPick = pickAuditWinningFormat('market_data', signals.auditFindings)
    const fg_format = fg_auditPick?.format ?? 'market_data_short'
    const fg_platforms = fg_format === 'ig_carousel' ? ['instagram'] :
                         fg_format === 'market_youtube_longform' ? ['youtube'] :
                         ['instagram', 'tiktok']
    briefs.push(buildBrief({
      topic: `Replicate competitor video format — ${fg_format === 'ig_carousel' ? 'market data carousel' : 'market data short'}`,
      format: fg_format,
      platforms: fg_platforms,
      hook: `Bend market, ${new Date(signals.asOfDate).toLocaleString('default', { month: 'long' })}. Three numbers you need to know.`,
      body: `Fast-format market data breakdown in the style that performed for a Bend competitor. Adapted to our voice: no hype, sourced numbers, client-first angle.`,
      target_audience: 'brand_default',
      data_sources: [
        { type: 'competitor', evidence: `${competitor} posted ${opportunity.evidence}` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+500 to +2,000 organic reach; +0.3 qualified_seller_leads/week',
        rationale: `Competitor format signals audience receptivity on this platform in this category. Replicating the format with our data-driven voice captures the same audience intent without matching their voice or breaking brand rules.`,
      },
      generation_reason: `competitor format_gap: ${competitor} running video format we have not replicated. ${opportunity.evidence}${fg_auditPick ? ' ' + fg_auditPick.rationale : ''}`,
    }))
  }

  // ── platform-trends act_on — route by trend_type ─────────────────────────
  // format → market_data_short (default) OR meme_video (label cue)
  // audio  → meme_video
  // hashtag → ig_carousel
  // algorithm → SKIP (Item 5 will route to comms:matt_alert)
  if (opportunity.source === 'platform-trend') {
    const trendItem = opportunity.meta.trend_item as {
      trend_type: 'algorithm' | 'format' | 'audio' | 'hashtag'
      label: string
      platforms: string[]
      reason: string
    }

    if (trendItem.trend_type === 'algorithm') {
      // Algorithm shifts are operational comms, not content. Drop silently.
      return []
    }

    const labelLower = trendItem.label.toLowerCase()
    const humorCue = /\b(meme|reaction|pov|relatable|when you|how it feels)\b/i.test(labelLower)
    let format: string
    let platforms: string[]
    if (trendItem.trend_type === 'audio') {
      format = 'meme_video'
      platforms = trendItem.platforms.length ? trendItem.platforms : ['tiktok', 'instagram']
    } else if (trendItem.trend_type === 'hashtag') {
      format = 'ig_carousel'
      platforms = ['instagram']
    } else if (trendItem.trend_type === 'format' && humorCue) {
      format = 'meme_video'
      platforms = trendItem.platforms.length ? trendItem.platforms : ['tiktok', 'instagram']
    } else {
      // Default: data-driven short (per Item 3 decision — market_data_short
      // is the brand's strongest format when the trend_type is ambiguous)
      format = 'market_data_short'
      platforms = trendItem.platforms.length ? trendItem.platforms : ['instagram', 'tiktok']
    }

    briefs.push(buildBrief({
      topic: `Act on platform trend: ${trendItem.label}`,
      format,
      platforms,
      hook: `Bend market. This format is working right now.`,
      body: `Adapt the trending format (${trendItem.label}) to Bend real estate market data. Voice stays the same: honest, specific, no hype. Format adapts to the platform moment.`,
      target_audience: 'brand_default',
      data_sources: [
        { type: 'platform-trend', evidence: trendItem.reason },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+1,000 to +5,000 organic reach from format-algorithm match',
        rationale: `Platform trends data shows this format outperforming on ${platforms.join(', ')} right now. Early adoption before saturation captures algorithmic advantage. No voice violations detected.`,
      },
      generation_reason: `platform-trend ${trendItem.trend_type} act_on: "${trendItem.label}" on ${trendItem.platforms.join(', ')}. ${trendItem.reason}`,
    }))
  }

  // ── diagnose capitalize_on_spike → channel-matched, correct producer ─────
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

    // Channel → format mapping. Default is market_data_short (the brand's
    // strongest format per Item 3 decision). YouTube high-severity spikes
    // earn a long-form lift; non-social channels (ga4/gsc/fub/meta_ads)
    // are dropped here because they belong to site:* and ops:* producers
    // in Items 1 and 2.
    // Audit-aware format pick — when audit data exists, prefer the winning
    // market_data format for the channel-matched slot.
    const diag_auditPick = pickAuditWinningFormat('market_data', signals.auditFindings)
    let format: string
    let platforms: string[]
    if (channel === 'youtube') {
      if (opportunity.severity === 'high') {
        format = diag_auditPick?.format === 'market_youtube_longform'
          ? 'market_youtube_longform'
          : (diag_auditPick?.format ?? 'market_youtube_longform')
        platforms = format === 'market_youtube_longform' ? ['youtube'] : ['youtube', 'instagram', 'tiktok']
      } else {
        format = diag_auditPick?.format ?? 'market_data_short'
        platforms = ['youtube', 'instagram', 'tiktok']
      }
    } else if (channel === 'tiktok' || channel === 'instagram' || channel === 'meta_page') {
      // Channel-matched single platform; audit may upgrade to ig_carousel
      // when the channel is IG, otherwise fall back to short.
      const auditFormat = diag_auditPick?.format
      if (auditFormat === 'ig_carousel' && channel === 'instagram') {
        format = 'ig_carousel'
      } else {
        format = 'market_data_short'
      }
      platforms = [channel]
    } else {
      // ga4 / gsc / fub / meta_ads → not a content channel. Silently drop.
      return []
    }

    briefs.push(buildBrief({
      topic: `Repeat-the-format brief — ${channel} engagement spike`,
      format,
      platforms,
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

  // ── cadence gap → channel-matched default content (Item 2) ───────────────
  // Brain's strongest format on each platform; producer chooses fresh angle.
  if (opportunity.source === 'cadence') {
    const gap = opportunity.meta.gap as CadenceGap
    const channel = gap.channel

    // Audit-aware default: if audit data exists and identifies a winning
    // market_data format, use it on IG (where ig_carousel is feasible) or
    // YouTube (where market_youtube_longform is feasible). Other channels
    // stay on market_data_short / gbp_post since they have no carousel-
    // equivalent in the current formatRoute.
    const cad_auditPick = pickAuditWinningFormat('market_data', signals.auditFindings)
    let format: string
    let platforms: string[]
    if (channel === 'instagram') {
      format = cad_auditPick?.format === 'ig_carousel' ? 'ig_carousel' : 'market_data_short'
      platforms = ['instagram']
    } else if (channel === 'tiktok') { format = 'market_data_short'; platforms = ['tiktok'] }
    else if (channel === 'meta_page') { format = 'market_data_short'; platforms = ['facebook'] }
    else if (channel === 'youtube') {
      format = cad_auditPick?.format === 'market_youtube_longform' ? 'market_youtube_longform' : 'market_data_short'
      platforms = ['youtube']
    }
    else if (channel === 'linkedin') { format = 'ig_carousel'; platforms = ['linkedin'] }
    else if (channel === 'x') { format = 'market_data_short'; platforms = ['x'] }
    else if (channel === 'gbp') { format = 'gbp_post'; platforms = ['gbp'] }
    else {
      return [] // unknown channel — drop silently
    }

    const staleness = gap.days_since_last_post === null
      ? 'no recent post detected'
      : `${gap.days_since_last_post} days since last post`

    briefs.push(buildBrief({
      topic: `Fill ${channel} cadence gap (${gap.actual_last_7d}/${gap.target_per_week} posts in last 7d)`,
      format,
      platforms,
      hook: `Bend market data. Three numbers worth knowing this week.`,
      body: `Default content for an under-cadence slot. Producer picks a fresh angle: months of supply, median price shift, or active inventory movement.`,
      cta: `Address in bio for a real number on your Bend home.`,
      target_audience: 'brand_default',
      data_sources: [
        { type: 'cadence', evidence: `${channel}: ${gap.actual_last_7d} posts vs target ${gap.target_per_week}/wk. ${staleness}.` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: 'Maintain platform reach baseline; prevent algorithmic decay',
        rationale: `Cadence gaps cost algorithmic trust. Filling the gap with brand-default content prevents reach decay on a platform we have already invested in.`,
      },
      generation_reason: `cadence ${channel}: ${gap.actual_last_7d}/${gap.target_per_week} posts in last 7d. ${staleness}.${cad_auditPick && (channel === 'instagram' || channel === 'youtube') ? ' ' + cad_auditPick.rationale : ''}`,
    }))
  }

  // ── listing_coverage uncovered_active → content:list_kit (Item 2) ────────
  // List-kit is an orchestrator producer; one row fans out to flyer + IG
  // carousel + listing reel + blog post + GBP post.
  if (opportunity.source === 'listing_coverage') {
    const listing = opportunity.meta.listing as ActiveListingNeed
    const priceStr = `$${listing.list_price.toLocaleString()}`

    briefs.push(buildBrief({
      topic: `List kit for ${listing.address}, ${listing.city}`,
      format: 'list_kit',
      platforms: ['instagram', 'facebook', 'blog', 'gbp'],
      hook: `${listing.address}, ${listing.city}. ${priceStr} active and waiting for a marketing kit.`,
      body: `Run the list-kit orchestrator on this MLS id. Produces flyer, IG carousel, listing reel, blog post, and GBP post in one pass.`,
      cta: undefined,
      target_audience: 'brand_default',
      target: `mls:${listing.listing_key}`,
      payload_override: {
        listing_key: listing.listing_key,
        address: listing.address,
        city: listing.city,
        list_price: listing.list_price,
        photo_url: listing.photo_url,
        coverage_state: 'never_covered_in_window',
        threshold_days: LISTING_COVERAGE_THRESHOLD_DAYS,
      },
      data_sources: [
        { type: 'listing_coverage', evidence: `Active listing ${priceStr} in ${listing.city} has no content brief in the last ${LISTING_COVERAGE_THRESHOLD_DAYS} days.` },
      ],
      predicted_outcome: {
        primary_metric: 'qualified_seller_leads',
        expected_value: '+1 to +3 buyer-side inquiries per kit; cross-platform impression lift',
        rationale: `Active listings without recent coverage are the cheapest content slot — data and photos already exist; the listing agent expects marketing support. List-kit produces 5 deliverables from one MLS input.`,
      },
      generation_reason: `listing_coverage uncovered_active: ${listing.listing_key} (${priceStr}, ${listing.city}). No brief in last ${LISTING_COVERAGE_THRESHOLD_DAYS} days.`,
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
    return { inserted: 0, ids: [], errors: [] }
  }

  const supabase = getSupabase()
  const ids: string[] = []
  const persistErrors: string[] = []

  for (const brief of briefs) {
    // Determine generation_reason — append VOICE_FAIL if validation failed
    let finalReason = brief.generation_reason
    if (!brief.voice_validation.passed) {
      finalReason += ` | VOICE_FAIL: ${brief.voice_validation.violations.join('; ')}`
    }

    // Map format → action_type + assigned_producer. Source of truth is
    // marketing_brain_skills/producers/REGISTRY.md. Falls back to
    // content_engine for unknown formats so the brain doesn't drop work.
    const formatRoute: Record<string, { action_type: string; producer: string }> = {
      // Paid social — FB lead-gen ad creative
      fb_lead_gen_ad: { action_type: 'content:fb_lead_gen_ad', producer: 'social_media_skills/facebook-lead-gen-ad' },
      fb_ad: { action_type: 'content:fb_ad', producer: 'social_media_skills/facebook-lead-gen-ad' },
      // Legacy alias — kept for manual produces / pre-Item-3 backfilled rows
      fb_ad_creative: { action_type: 'content:fb_lead_gen_ad', producer: 'social_media_skills/facebook-lead-gen-ad' },

      // Organic short-form video (30-45s vertical) — routed by content angle
      market_data_short: { action_type: 'content:market_data_short', producer: 'video_production_skills/market-data-video' },
      market_data_video: { action_type: 'content:market_data_short', producer: 'video_production_skills/market-data-video' },
      market_video: { action_type: 'content:market_video', producer: 'video_production_skills/market-data-video' },
      market_data_viz: { action_type: 'content:market_data_viz', producer: 'video_production_skills/data_viz_video' },
      stats_clip: { action_type: 'content:stats_clip', producer: 'video_production_skills/data_viz_video' },
      meme_video: { action_type: 'content:meme_video', producer: 'video_production_skills/meme_content' },
      neighborhood_reel: { action_type: 'content:neighborhood_reel', producer: 'video_production_skills/area_guides' },
      area_guide_short: { action_type: 'content:area_guide_short', producer: 'video_production_skills/area_guides' },
      news_clip: { action_type: 'content:news_clip', producer: 'video_production_skills/news-video' },
      news_video: { action_type: 'content:news_video', producer: 'video_production_skills/news-video' },
      avatar_market_update: { action_type: 'content:avatar_market_update', producer: 'video_production_skills/avatar_market_update' },

      // Listing-specific (valid only when target is a specific MLS#)
      listing_reel: { action_type: 'content:listing_reel', producer: 'video_production_skills/listing_reveal' },
      listing_video: { action_type: 'content:listing_video', producer: 'video_production_skills/listing-tour-video' },

      // Long-form video
      market_youtube_longform: { action_type: 'content:market_youtube_longform', producer: 'video_production_skills/youtube-long-form-market-report' },
      neighborhood_tour: { action_type: 'content:neighborhood_tour', producer: 'video_production_skills/neighborhood_tour' },
      area_guide_long: { action_type: 'content:area_guide_long', producer: 'video_production_skills/neighborhood_tour' },

      // Static + carousels
      ig_carousel: { action_type: 'content:ig_carousel', producer: 'social_media_skills/instagram-carousel' },
      blog_post: { action_type: 'content:blog_post', producer: 'social_media_skills/blog-post' },
      seo_blog: { action_type: 'content:seo_blog', producer: 'social_media_skills/blog-post' },

      // Flyers
      flyer: { action_type: 'content:flyer', producer: 'social_media_skills/flyer-design' },
      just_listed_flyer: { action_type: 'content:just_listed_flyer', producer: 'social_media_skills/flyer-design' },
      open_house_flyer: { action_type: 'content:open_house_flyer', producer: 'social_media_skills/flyer-design' },
      feature_sheet: { action_type: 'content:feature_sheet', producer: 'social_media_skills/flyer-design' },

      // Orchestrators (compound producers that fan out to multiple deliverables)
      list_kit: { action_type: 'content:list_kit', producer: 'social_media_skills/list-kit' },
      monthly_market_report: { action_type: 'content:monthly_market_report', producer: 'video_production_skills/monthly-market-report-orchestrator' },
      listing_launch: { action_type: 'content:listing_launch', producer: 'video_production_skills/listing_launch' },

      // GBP (ops:* — but emitted as a content-flow format; route still resolves)
      gbp_post: { action_type: 'ops:gbp_post', producer: 'marketing_brain_skills/producers/ops-reputation' },

      // Site edits — emitted by audit-website handlers in Item 1.
      // Route to site-edit / site-page-create / site-performance producers
      // per producers/REGISTRY.md Section C. Briefs use payload_override
      // to carry structured edit data; target is a page path or audit-id.
      site_meta_update: { action_type: 'site:meta_update', producer: 'marketing_brain_skills/producers/site-edit' },
      site_copy_update: { action_type: 'site:copy_update', producer: 'marketing_brain_skills/producers/site-edit' },
      site_cta_update: { action_type: 'site:cta_update', producer: 'marketing_brain_skills/producers/site-edit' },
      site_page_create: { action_type: 'site:page_create', producer: 'marketing_brain_skills/producers/site-page-create' },
      site_landing_page_create: { action_type: 'site:landing_page_create', producer: 'marketing_brain_skills/producers/site-page-create' },
      site_perf_fix: { action_type: 'site:perf_fix', producer: 'marketing_brain_skills/producers/site-performance' },
      site_redirect_add: { action_type: 'site:redirect_add', producer: 'marketing_brain_skills/producers/site-performance' },
      site_schema_add: { action_type: 'site:schema_add', producer: 'marketing_brain_skills/producers/site-performance' },

      // Ops — Meta Ads. All ops:meta_* are matt-explicit per CLAUDE.md
      // Marketing Brain Architecture and producers/REGISTRY.md Section D.
      ops_meta_budget: { action_type: 'ops:meta_budget', producer: 'marketing_brain_skills/producers/ops-meta-ads' },
      ops_meta_pause: { action_type: 'ops:meta_pause', producer: 'marketing_brain_skills/producers/ops-meta-ads' },
      ops_meta_resume: { action_type: 'ops:meta_resume', producer: 'marketing_brain_skills/producers/ops-meta-ads' },
      ops_meta_audience: { action_type: 'ops:meta_audience', producer: 'marketing_brain_skills/producers/ops-meta-ads' },
      ops_meta_creative_swap: { action_type: 'ops:meta_creative_swap', producer: 'marketing_brain_skills/producers/ops-meta-ads' },

      // Ops — FUB CRM. Tier-based approval (>5 leads = matt-explicit;
      // <=5 = matt-review-draft) per producers/REGISTRY.md Section D.
      ops_fub_tag_fix: { action_type: 'ops:fub_tag_fix', producer: 'marketing_brain_skills/producers/ops-fub-crm' },
      ops_fub_sequence_change: { action_type: 'ops:fub_sequence_change', producer: 'marketing_brain_skills/producers/ops-fub-crm' },
      ops_fub_task_create: { action_type: 'ops:fub_task_create', producer: 'marketing_brain_skills/producers/ops-fub-crm' },
      ops_fub_routing: { action_type: 'ops:fub_routing', producer: 'marketing_brain_skills/producers/ops-fub-crm' },

      // Analyze — drill into anomalies; findings land in marketing_decisions
      // and generate-briefs reads them on the next cycle.
      analyze_metric_decomposition: { action_type: 'analyze:metric_decomposition', producer: 'marketing_brain_skills/analyze-anomaly' },
      analyze_drop_investigation: { action_type: 'analyze:drop_investigation', producer: 'marketing_brain_skills/analyze-anomaly' },
      analyze_spike_investigation: { action_type: 'analyze:spike_investigation', producer: 'marketing_brain_skills/analyze-anomaly' },

      // Comms — matt-alert; tier-based delivery (critical/high = iMessage,
      // medium/low = email + dashboard card) handled by the producer.
      comms_matt_alert: { action_type: 'comms:matt_alert', producer: 'marketing_brain_skills/producers/comms-matt-alert' },
      comms_matt_summary: { action_type: 'comms:matt_summary', producer: 'marketing_brain_skills/producers/comms-matt-alert' },
      comms_team_update: { action_type: 'comms:team_update', producer: 'marketing_brain_skills/producers/comms-matt-alert' },
      comms_stakeholder_summary: { action_type: 'comms:stakeholder_summary', producer: 'marketing_brain_skills/producers/comms-matt-alert' },

      // Legacy aliases — pre-Item-3 these routed to listing_reveal which
      // fails when target='brand' because listing_reveal requires an MLS#.
      // Re-routed to market-data-video which accepts brand-level targets.
      ig_reel: { action_type: 'content:market_data_short', producer: 'video_production_skills/market-data-video' },
      tiktok_reel: { action_type: 'content:market_data_short', producer: 'video_production_skills/market-data-video' },
    }
    const route = formatRoute[brief.format] ?? {
      action_type: `content:${brief.format}`,
      producer: 'automation_skills/content_engine',
    }

    // INSERT marketing_brain_actions row. The content_briefs view is read-
    // only post-migration; INSERTs must go to the underlying table.
    // Site/ops briefs may override target + payload (page paths, structured
    // edit data); content briefs use the default 'brand' target + content
    // payload built from hook/body/cta.
    const resolvedTarget = brief.target ?? 'brand'
    const resolvedPayload = brief.payload_override ?? {
      hook: brief.hook,
      body: brief.body ?? null,
      cta: brief.cta ?? null,
      target_audience: brief.target_audience,
    }
    const { data: briefRow, error: briefErr } = await supabase
      .from('marketing_brain_actions')
      .insert({
        action_type: route.action_type,
        target: resolvedTarget,
        assigned_producer: route.producer,
        payload: resolvedPayload,
        data_evidence: { sources: brief.data_sources },
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
      const msg = briefErr?.message ?? briefErr?.code ?? 'no row returned'
      const details = briefErr?.details ?? briefErr?.hint ?? ''
      const fullMsg = `INSERT marketing_brain_actions failed: ${msg}${details ? ' :: ' + details : ''}`
      console.error('persistBriefs:', fullMsg, JSON.stringify(briefErr ?? {}, null, 2))
      persistErrors.push(fullMsg)
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

  // (Item 1: the legacy page-leak marketing_decisions log was removed —
  // page-leak opportunities now generate a site:cta_update brief, which
  // creates its own per-brief marketing_decisions row above.)

  return { inserted: ids.length, ids, errors: persistErrors }
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

  // Step 5: persist. If any insert errors, stamp them onto the briefs'
  // generation_reason so the caller (weekly-cycle) can surface them in
  // the report's errors array without changing the return type.
  const persist = await persistBriefs(allBriefs, usedOpportunities, opts)
  if (persist.errors.length > 0) {
    const errorBlob = persist.errors.join(' || ')
    for (const b of allBriefs) {
      if (!b.generation_reason.includes('PERSIST_ERR')) {
        b.generation_reason = `${b.generation_reason} | PERSIST_ERR: ${errorBlob.slice(0, 300)}`
      }
    }
  }

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
    target: params.target,
    payload_override: params.payload_override,
    predicted_outcome: {
      primary_metric: params.predicted_outcome.primary_metric || 'qualified_seller_leads',
      expected_value: params.predicted_outcome.expected_value,
      rationale: params.predicted_outcome.rationale,
    },
    generation_reason: params.generation_reason,
  }
}
