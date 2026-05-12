/**
 * marketing-brain platform-trends helpers.
 *
 * Scrapes industry sources for platform algorithm changes, high-engagement
 * format trends, trending audio, and trending hashtags. Synthesizes the
 * signal into a PlatformTrendsReport that the generate-briefs skill reads to
 * adapt content strategy without requiring manual research.
 *
 * Env vars required:
 *   APIFY_API_TOKEN — same token as competitor-recon. See competitor-recon.ts.
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { getApifyToken, runApifyActor } from './competitor-recon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrendPlatform =
  | 'tiktok'
  | 'instagram'
  | 'meta'
  | 'youtube'
  | 'linkedin'
  | 'x'
  | 'google'
  | 'all'

export type AlgorithmSeverity = 'major' | 'minor' | 'rumor'

/**
 * A signal about a platform algorithm change, policy update, or ranking
 * factor shift sourced from an industry publication or platform blog.
 */
export interface AlgorithmSignal {
  platform: TrendPlatform
  /** ISO date string of the source article, or the scrape date if unknown. */
  date: string
  /** One-sentence description of the change and its likely effect. */
  summary: string
  source_url: string
  severity: AlgorithmSeverity
  /** Raw article title from the scrape, for audit. */
  source_title?: string
}

/**
 * A format or creative pattern observed to perform above average on a given
 * platform. Sourced from industry blogs and creator intelligence sources.
 */
export interface FormatTrend {
  platform: TrendPlatform
  /** Short label, e.g. "raw iPhone vertical + on-screen text". */
  format_label: string
  /** Why this format is outperforming right now. */
  description: string
  /** Engagement metric signal (e.g. "3.8x avg completion rate vs polished edits"). */
  performance_signal?: string
  source_url: string
  date: string
}

/**
 * A piece of audio (track name + artist or sound description) trending on
 * TikTok or Reels. Low-saturation = few creators have used it yet; high
 * relevance = fits Bend / real estate / lifestyle content.
 */
export interface AudioTrend {
  platform: 'tiktok' | 'instagram'
  sound_name: string
  artist?: string
  /** Approximate use count at time of scrape. */
  use_count?: number
  /** Low = not yet saturated (ideal for early adoption). */
  saturation: 'low' | 'medium' | 'high'
  /** Whether this audio plausibly fits real estate / Central Oregon lifestyle. */
  relevance_to_category: boolean
  source_url: string
  date: string
}

/**
 * A hashtag trending within the Bend / Central Oregon / real estate niche.
 */
export interface HashtagTrend {
  platform: TrendPlatform
  hashtag: string
  /** Post count or view count at time of scrape, null if not available. */
  volume?: number
  relevance_to_category: boolean
  source_url: string
  date: string
}

/**
 * One trend item with its voice-fit evaluation and relevant platforms.
 */
export interface AdaptationItem {
  trend_type: 'algorithm' | 'format' | 'audio' | 'hashtag'
  /** Human-readable label identifying the trend. */
  label: string
  platforms: TrendPlatform[]
  /** Whether this trend is applicable to Ryan Realty. */
  applicable: boolean
  /**
   * When applicable is true: brief recommendation for how to act on it.
   * When applicable is false: the specific voice rule it violates.
   */
  reason: string
  /**
   * The voice attribute rule section from voice_guidelines.md that was the
   * decisive factor, e.g. "§4.4 Professional" or "§6.4 Banned tropes:
   * market-doom take". Only set when applicable is false.
   */
  voice_rule_violated?: string
}

/**
 * Synthesis of all scraped trends filtered through the Ryan Realty voice
 * and brand rules. Machine-readable for generate-briefs consumption.
 */
export interface RyanRealtyAdaptations {
  /** Trends we should act on immediately (applicable: true). */
  act_on: AdaptationItem[]
  /** Trends we should monitor but not act on yet. */
  monitor: AdaptationItem[]
  /** Trends explicitly incompatible with our voice or brand. */
  skip: AdaptationItem[]
}

/**
 * Top-level output of gatherPlatformTrends.
 * Consumed by generate-briefs to adjust content format, audio selection,
 * hashtag strategy, and platform posting cadence.
 */
export interface PlatformTrendsReport {
  as_of_date: string
  /** Algorithm change signals from platform and industry sources. */
  algorithm_signals: AlgorithmSignal[]
  /** Format / creative pattern trends. */
  format_trends: FormatTrend[]
  /** Trending audio tracks on TikTok and Reels. */
  audio_trends: AudioTrend[]
  /** Trending hashtags in the Bend / real estate niche. */
  hashtag_trends: HashtagTrend[]
  /** Ryan Realty-specific synthesis with voice-fit gate applied. */
  ryan_realty_adaptations: RyanRealtyAdaptations
  /** ISO timestamp of the scrape run. */
  fetched_at: string
  /** Non-fatal errors during scraping (empty arrays are nominal). */
  errors: string[]
}

// ---------------------------------------------------------------------------
// Industry source URLs (locked — update here if a URL changes)
// ---------------------------------------------------------------------------

/**
 * Industry sources to scrape for algorithm and format signal.
 *
 * These are the canonical URLs for each platform/industry publication.
 * The RAG web browser actor crawls these pages and extracts recent posts.
 */
const ALGORITHM_INTEL_SOURCES = [
  // Platform official blogs
  { url: 'https://www.facebook.com/business/news', platform: 'meta' as TrendPlatform },
  { url: 'https://newsroom.tiktok.com/en-us', platform: 'tiktok' as TrendPlatform },
  { url: 'https://blog.youtube/news-and-events/creator-insider/', platform: 'youtube' as TrendPlatform },
  { url: 'https://business.linkedin.com/marketing-solutions/blog', platform: 'linkedin' as TrendPlatform },
  // Industry intelligence
  { url: 'https://www.socialmediatoday.com/news/', platform: 'all' as TrendPlatform },
  { url: 'https://buffer.com/resources/', platform: 'all' as TrendPlatform },
]

const FORMAT_TREND_SOURCES = [
  { url: 'https://www.socialmediatoday.com/news/', platform: 'all' as TrendPlatform },
  { url: 'https://buffer.com/resources/', platform: 'all' as TrendPlatform },
  { url: 'https://later.com/blog/', platform: 'all' as TrendPlatform },
  { url: 'https://creatoriq.com/blog/', platform: 'all' as TrendPlatform },
]

const AUDIO_HASHTAG_SOURCES = [
  // TikTok Creative Center (trending sounds / hashtags)
  { url: 'https://ads.tiktok.com/business/creativecenter/trending-hashtags/pc/en', platform: 'tiktok' as TrendPlatform },
  { url: 'https://ads.tiktok.com/business/creativecenter/music/pc/en', platform: 'tiktok' as TrendPlatform },
  // Industry aggregators for real estate / local niche hashtags
  { url: 'https://www.socialmediatoday.com/tag/tiktok/', platform: 'tiktok' as TrendPlatform },
  { url: 'https://www.socialmediatoday.com/tag/instagram/', platform: 'instagram' as TrendPlatform },
]

// ---------------------------------------------------------------------------
// Voice-fit evaluation constants
// ---------------------------------------------------------------------------

/**
 * Patterns in format or trend descriptions that conflict with Ryan Realty's
 * voice rules. Each entry maps to the specific guideline section violated.
 *
 * The applyToRyanRealty function iterates these to produce AdaptationItem
 * entries with applicable: false and the specific rule cited.
 */
const VOICE_VIOLATION_PATTERNS: Array<{
  pattern: RegExp
  voice_rule: string
  reason: string
}> = [
  // §6.4 Banned tropes: agent-as-hero
  {
    pattern: /prank|challenge|skit|comedian|viral gag|stunt|trick|hidden camera/i,
    voice_rule: '§4.4 Professional',
    reason:
      'Prank / skit formats undermine professional credibility and conflict with the trustworthy, professional voice anchors.',
  },
  // §6.4 Banned tropes: market-doom or market-hype take
  {
    pattern: /doom scroll|fear.?mongering|market.?crash bait|hype.?reel|fomo.?hook/i,
    voice_rule: '§6.4 Banned tropes: market-doom or market-hype take',
    reason:
      'Fear-based or FOMO-driven formats conflict with our honest, data-first voice. We describe what the data says, not what will get a reaction.',
  },
  // §6.3 Banned phrases: fake urgency
  {
    pattern: /act fast|urgency bait|won.?t last|countdown hook/i,
    voice_rule: '§6.3 Banned phrases: fake urgency',
    reason: "Fake urgency hooks conflict with the dependable anchor. We never write a CTA we can't honor.",
  },
  // §6.3 Banned phrases: engagement bait
  {
    pattern: /comment.?yes|engagement bait|like if you|follow for|drop a .{1,10} if/i,
    voice_rule: '§11 Per-channel calibration: no engagement bait',
    reason:
      'Engagement-bait mechanics conflict with the authentic relationship principle. We earn engagement through usefulness, not manipulation.',
  },
  // §6.4 Banned tropes: dramatic before-and-after
  {
    pattern: /most agents|other agents|what.?agents.?won.?t tell|secret.?agents.?hide/i,
    voice_rule: '§6.4 Banned tropes: dramatic before-and-after',
    reason:
      'Defining Ryan Realty by what other agents do wrong violates the brand rule against negative positioning.',
  },
  // §6.2 AI filler / marketing slop tone
  {
    pattern: /luxury lifestyle|white glove|boutique|premier|exclusive brand|top.?1.?percent/i,
    voice_rule: '§6.3 Banned phrases: marketing slop',
    reason:
      'Luxury-positioning language conflicts with the "real estate is for everyone" worldview and the banned marketing slop list.',
  },
  // §4.1 Trustworthy — guaranteed outcomes
  {
    pattern: /guaranteed.?result|promise.?sale|guaranteed.?price|sure.?fire/i,
    voice_rule: '§4.1 Trustworthy: no guaranteed outcome claims',
    reason: 'Guaranteed-outcome promises violate the trustworthy voice rule. We never promise outcomes we cannot deliver.',
  },
]

/**
 * Keywords that signal a trend is relevant to Bend / Central Oregon / real
 * estate. Used for relevance scoring in audio and hashtag trends.
 */
const RELEVANCE_KEYWORDS = [
  'real estate', 'realty', 'home', 'house', 'listing', 'mortgage', 'bend',
  'oregon', 'central oregon', 'pnw', 'pacific northwest', 'outdoor', 'nature',
  'mountain', 'ski', 'lifestyle', 'neighborhood', 'community', 'seller',
  'buyer', 'market', 'property',
]

// ---------------------------------------------------------------------------
// Scraper functions
// ---------------------------------------------------------------------------

/**
 * Scrape industry blogs and platform newsrooms for recent algorithm change
 * posts. Returns structured AlgorithmSignal items.
 *
 * Actor: apify/rag-web-browser
 * https://apify.com/apify/rag-web-browser
 *
 * The RAG web browser performs a targeted crawl of each source URL and
 * returns structured text content that can be parsed for signals.
 *
 * TODO: After first live run, inspect the actor's output schema at apify.com
 * and confirm the field names for `title`, `text`, `url`, `date`. The
 * current mapping assumes fields common to web-scraper actors; adjust
 * the extraction logic in the item-mapping block if the actor returns
 * a different structure (e.g. `metadata.title` vs `title`).
 */
export async function scrapeAlgorithmIntel(
  asOfDate: string,
): Promise<{ signals: AlgorithmSignal[]; errors: string[] }> {
  const signals: AlgorithmSignal[] = []
  const errors: string[] = []

  for (const source of ALGORITHM_INTEL_SOURCES) {
    try {
      const result = await runApifyActor('apify/rag-web-browser', {
        // TODO: verify exact input key names against live actor schema on apify.com
        startUrls: [{ url: source.url }],
        maxCrawledPagesPerCrawl: 5,
        // Scope to recent posts only
        maxScrollHeight: 2000,
        outputFormats: ['text'],
      })

      for (const item of result.items as Record<string, unknown>[]) {
        const title = (item.title as string | undefined) ?? ''
        const text = (item.text as string | undefined) ?? ''
        const itemUrl = (item.url as string | undefined) ?? source.url
        const rawDate = (item.date as string | undefined) ?? asOfDate

        // Skip items that don't mention algorithm-relevant topics
        const isAlgorithmPost =
          /algorithm|ranking|reach|feed|distribution|update|change|policy|monetiz/i.test(
            title + ' ' + text,
          )
        if (!isAlgorithmPost) continue

        // Determine severity from language in the article
        const isMajor = /major update|significant change|rolling out|full rollout|new algorithm/i.test(
          title + ' ' + text,
        )
        const isRumor = /rumor|leak|reportedly|sources say|unconfirmed|may be testing/i.test(
          title + ' ' + text,
        )
        const severity: AlgorithmSeverity = isMajor ? 'major' : isRumor ? 'rumor' : 'minor'

        // Extract a one-sentence summary from the first meaningful paragraph
        const sentences = (text.match(/[^.!?]+[.!?]/g) ?? []).filter((s) => s.trim().length > 30)
        const summary = sentences[0]?.trim() ?? title

        signals.push({
          platform: source.platform,
          date: rawDate.slice(0, 10),
          summary,
          source_url: itemUrl,
          severity,
          source_title: title,
        })
      }
    } catch (e) {
      errors.push(
        `scrapeAlgorithmIntel(${source.url}): ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return { signals, errors }
}

/**
 * Scrape industry blogs for current high-engagement format patterns.
 * Returns FormatTrend items.
 *
 * Actor: apify/rag-web-browser
 * https://apify.com/apify/rag-web-browser
 *
 * TODO: After first live run, refine the keyword-matching heuristics below
 * against actual article content returned by the actor. The current
 * patterns are broad; tighten them once we have a representative sample.
 */
export async function scrapeFormatTrends(
  asOfDate: string,
): Promise<{ trends: FormatTrend[]; errors: string[] }> {
  const trends: FormatTrend[] = []
  const errors: string[] = []

  for (const source of FORMAT_TREND_SOURCES) {
    try {
      const result = await runApifyActor('apify/rag-web-browser', {
        // TODO: verify exact input key names against live actor schema on apify.com
        startUrls: [{ url: source.url }],
        maxCrawledPagesPerCrawl: 5,
        maxScrollHeight: 2000,
        outputFormats: ['text'],
      })

      for (const item of result.items as Record<string, unknown>[]) {
        const title = (item.title as string | undefined) ?? ''
        const text = (item.text as string | undefined) ?? ''
        const itemUrl = (item.url as string | undefined) ?? source.url
        const rawDate = (item.date as string | undefined) ?? asOfDate

        // Only process format/creative articles
        const isFormatPost =
          /format|creative|reel|short.?form|video style|talking head|b.?roll|vertical|hook|caption|trending content/i.test(
            title + ' ' + text,
          )
        if (!isFormatPost) continue

        // Determine platform from content
        let platform: TrendPlatform = source.platform
        if (/tiktok/i.test(title + ' ' + text)) platform = 'tiktok'
        else if (/instagram|reels/i.test(title + ' ' + text)) platform = 'instagram'
        else if (/youtube/i.test(title + ' ' + text)) platform = 'youtube'
        else if (/linkedin/i.test(title + ' ' + text)) platform = 'linkedin'

        // Extract performance signal if mentioned
        const perfMatch = text.match(
          /(\d[\d.,x%]+\s*(?:x|times|percent|%)\s*(?:more|higher|better|views|reach|completion)[^.]{0,80})/i,
        )
        const performance_signal = perfMatch?.[1]?.trim()

        // Use the title as the format label, first paragraph as description
        const sentences = (text.match(/[^.!?]+[.!?]/g) ?? []).filter((s) => s.trim().length > 30)
        const description = sentences[0]?.trim() ?? title

        trends.push({
          platform,
          format_label: title.slice(0, 120),
          description: description.slice(0, 500),
          performance_signal,
          source_url: itemUrl,
          date: rawDate.slice(0, 10),
        })
      }
    } catch (e) {
      errors.push(
        `scrapeFormatTrends(${source.url}): ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return { trends, errors }
}

/**
 * Scrape for trending audio and hashtags on TikTok and Reels.
 * Returns AudioTrend and HashtagTrend arrays.
 *
 * Actor: apify/rag-web-browser
 * https://apify.com/apify/rag-web-browser
 *
 * TODO: After first live run, evaluate whether the TikTok Creative Center
 * URLs return usable structured data from the RAG browser. The Creative
 * Center is a JavaScript-heavy SPA; if the actor cannot extract audio/hashtag
 * tables, replace with a dedicated actor such as:
 *   clockworks/free-tiktok-scraper (hashtags mode)
 *   or apify/tiktok-hashtag-search
 * and update this comment block accordingly.
 */
export async function scrapeAudioAndHashtagTrends(asOfDate: string): Promise<{
  audioTrends: AudioTrend[]
  hashtagTrends: HashtagTrend[]
  errors: string[]
}> {
  const audioTrends: AudioTrend[] = []
  const hashtagTrends: HashtagTrend[] = []
  const errors: string[] = []

  for (const source of AUDIO_HASHTAG_SOURCES) {
    try {
      const result = await runApifyActor('apify/rag-web-browser', {
        // TODO: verify exact input key names against live actor schema on apify.com
        startUrls: [{ url: source.url }],
        maxCrawledPagesPerCrawl: 3,
        maxScrollHeight: 3000,
        outputFormats: ['text'],
      })

      for (const item of result.items as Record<string, unknown>[]) {
        const text = (item.text as string | undefined) ?? ''
        const itemUrl = (item.url as string | undefined) ?? source.url
        const rawDate = (item.date as string | undefined) ?? asOfDate
        const dateStr = rawDate.slice(0, 10)

        // --- Audio extraction ---
        // Match lines that look like "Song Title - Artist (XXX uses)"
        const audioMatches = text.matchAll(
          /([A-Z][^-\n]{2,60})\s*[-–]\s*([A-Za-z][^(\n]{2,40})\s*\(?([\d,.]+[kKmM]?)\s*uses?\)?/g,
        )
        for (const match of audioMatches) {
          const sound_name = match[1].trim()
          const artist = match[2].trim()
          const useStr = match[3].replace(/,/g, '')
          const use_count = parseUseCount(useStr)
          const saturation = deriveSaturation(use_count)
          const relevance = isRelevantToCategory(sound_name + ' ' + artist)

          audioTrends.push({
            platform: source.platform as 'tiktok' | 'instagram',
            sound_name,
            artist,
            use_count,
            saturation,
            relevance_to_category: relevance,
            source_url: itemUrl,
            date: dateStr,
          })
        }

        // --- Hashtag extraction ---
        const hashtagMatches = text.matchAll(/#([A-Za-z][A-Za-z0-9_]{1,49})\s*\(?([\d,.]+[kKmMbB]?)?\s*(?:views?|posts?|uses?)?\)?/g)
        for (const match of hashtagMatches) {
          const hashtag = '#' + match[1]
          const volumeStr = (match[2] ?? '').replace(/,/g, '')
          const volume = volumeStr ? parseUseCount(volumeStr) : undefined
          const relevance = isRelevantToCategory(hashtag)

          hashtagTrends.push({
            platform: source.platform,
            hashtag,
            volume,
            relevance_to_category: relevance,
            source_url: itemUrl,
            date: dateStr,
          })
        }
      }
    } catch (e) {
      errors.push(
        `scrapeAudioAndHashtagTrends(${source.url}): ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return { audioTrends, hashtagTrends, errors }
}

// ---------------------------------------------------------------------------
// Voice-fit synthesis
// ---------------------------------------------------------------------------

/**
 * Apply Ryan Realty's voice guidelines to all scraped trends and produce
 * a RyanRealtyAdaptations block that generate-briefs can consume directly.
 *
 * Evaluation algorithm:
 *
 * 1. For each trend (algorithm signal, format trend, audio trend, hashtag
 *    trend), build a text blob from its label + description fields.
 *
 * 2. Run the text blob against VOICE_VIOLATION_PATTERNS. The first pattern
 *    that matches marks the trend applicable: false with the specific rule
 *    citation. If no pattern matches, the trend is applicable: true.
 *
 * 3. Applicable trends are placed in `act_on` if they relate to a platform
 *    we actively publish on (TikTok, Instagram, Meta, YouTube), or `monitor`
 *    if the signal is early-stage (severity === 'rumor' or saturation ===
 *    'high' for audio). Non-applicable trends go into `skip`.
 *
 * 4. The function returns all three buckets sorted by platform priority:
 *    tiktok > instagram > meta > youtube > linkedin > x > google > all.
 */
export function applyToRyanRealty(report: Omit<PlatformTrendsReport, 'ryan_realty_adaptations' | 'fetched_at' | 'errors'>): RyanRealtyAdaptations {
  const act_on: AdaptationItem[] = []
  const monitor: AdaptationItem[] = []
  const skip: AdaptationItem[] = []

  const activePlatforms: TrendPlatform[] = ['tiktok', 'instagram', 'meta', 'youtube']

  function evaluateTrend(
    trend_type: AdaptationItem['trend_type'],
    label: string,
    description: string,
    platforms: TrendPlatform[],
    isEarlyStage: boolean,
  ): void {
    const blob = (label + ' ' + description).toLowerCase()

    // Check every voice violation pattern
    for (const vp of VOICE_VIOLATION_PATTERNS) {
      if (vp.pattern.test(blob)) {
        skip.push({
          trend_type,
          label,
          platforms,
          applicable: false,
          reason: vp.reason,
          voice_rule_violated: vp.voice_rule,
        })
        return
      }
    }

    // No violation — trend is applicable
    const onActivePlatform = platforms.some((p) => activePlatforms.includes(p) || p === 'all')
    const item: AdaptationItem = {
      trend_type,
      label,
      platforms,
      applicable: true,
      reason: isEarlyStage
        ? 'Signal is early-stage (rumor or unsaturated). Monitor for one week before adapting content strategy.'
        : 'Consistent with the trustworthy, honest, knowledgeable, professional, and dependable voice anchors. No banned patterns detected.',
    }

    if (isEarlyStage || !onActivePlatform) {
      monitor.push(item)
    } else {
      act_on.push(item)
    }
  }

  // Evaluate algorithm signals
  for (const signal of report.algorithm_signals) {
    evaluateTrend(
      'algorithm',
      signal.summary.slice(0, 120),
      signal.source_title ?? '',
      [signal.platform],
      signal.severity === 'rumor',
    )
  }

  // Evaluate format trends
  for (const trend of report.format_trends) {
    evaluateTrend(
      'format',
      trend.format_label,
      trend.description,
      [trend.platform],
      false,
    )
  }

  // Evaluate audio trends
  for (const audio of report.audio_trends) {
    evaluateTrend(
      'audio',
      audio.sound_name + (audio.artist ? ` - ${audio.artist}` : ''),
      '',
      [audio.platform],
      audio.saturation === 'low', // low saturation = early stage opportunity
    )
  }

  // Evaluate hashtag trends
  for (const ht of report.hashtag_trends) {
    if (!ht.relevance_to_category) {
      skip.push({
        trend_type: 'hashtag',
        label: ht.hashtag,
        platforms: [ht.platform],
        applicable: false,
        reason: 'Hashtag is not relevant to Bend / Central Oregon / real estate category.',
      })
      continue
    }
    evaluateTrend(
      'hashtag',
      ht.hashtag,
      '',
      [ht.platform],
      false,
    )
  }

  // Sort by platform priority within each bucket
  const platformPriority: Record<TrendPlatform, number> = {
    tiktok: 0, instagram: 1, meta: 2, youtube: 3, linkedin: 4, x: 5, google: 6, all: 7,
  }
  const sortItems = (items: AdaptationItem[]) =>
    items.sort((a, b) => {
      const ap = Math.min(...a.platforms.map((p) => platformPriority[p]))
      const bp = Math.min(...b.platforms.map((p) => platformPriority[p]))
      return ap - bp
    })

  return {
    act_on: sortItems(act_on),
    monitor: sortItems(monitor),
    skip: sortItems(skip),
  }
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

/**
 * Gather all platform trend signal and return a PlatformTrendsReport.
 *
 * Calls scrapeAlgorithmIntel, scrapeFormatTrends, and
 * scrapeAudioAndHashtagTrends in parallel (they use independent Apify
 * actor runs and Supabase writes), then synthesizes the results through
 * applyToRyanRealty.
 *
 * @param asOfDate - YYYY-MM-DD. Used as observation_date on all rows.
 */
export async function gatherPlatformTrends(asOfDate: string): Promise<PlatformTrendsReport> {
  // Verify Apify token early so all scrapers fail fast with a clear message
  getApifyToken()

  const [algorithmResult, formatResult, audioHashtagResult] = await Promise.all([
    scrapeAlgorithmIntel(asOfDate),
    scrapeFormatTrends(asOfDate),
    scrapeAudioAndHashtagTrends(asOfDate),
  ])

  const allErrors = [
    ...algorithmResult.errors,
    ...formatResult.errors,
    ...audioHashtagResult.errors,
  ]

  const partial: Omit<PlatformTrendsReport, 'ryan_realty_adaptations' | 'fetched_at' | 'errors'> = {
    as_of_date: asOfDate,
    algorithm_signals: algorithmResult.signals,
    format_trends: formatResult.trends,
    audio_trends: audioHashtagResult.audioTrends,
    hashtag_trends: audioHashtagResult.hashtagTrends,
  }

  const ryan_realty_adaptations = applyToRyanRealty(partial)

  return {
    ...partial,
    ryan_realty_adaptations,
    fetched_at: new Date().toISOString(),
    errors: allErrors,
  }
}

// ---------------------------------------------------------------------------
// Supabase write helpers
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  return createClient(url, key)
}

/**
 * Write a skipped-run record to marketing_decisions when APIFY_API_TOKEN is
 * absent. This keeps the decision log consistent and surfaces the gap in the
 * dashboard.
 */
export async function recordTrendCheckSkipped(asOfDate: string, reason: string): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('marketing_decisions').insert({
    decided_at: new Date().toISOString(),
    decision_type: 'trend_check_skipped',
    decision_summary: `Platform trend check skipped on ${asOfDate}: ${reason}`,
    reviewer: 'marketing_brain_cron',
    final_decision: 'skipped',
  })
}

/**
 * Persist a PlatformTrendsReport to competitor_intel, one row per signal.
 *
 * Row taxonomy for platform-trends rows:
 *   source: 'algorithm_intel' | 'industry_signal'
 *   competitor: platform name (e.g. 'tiktok', 'instagram', 'meta')
 *   data_type: 'algorithm_signal' | 'format_trend' | 'audio_trend' | 'hashtag_trend'
 *   data: the full typed object
 */
export async function persistTrendsReport(
  report: PlatformTrendsReport,
  asOfDate: string,
): Promise<number> {
  const supabase = getSupabase()

  type IntelRow = {
    observation_date: string
    competitor: string
    source: string
    data_type: string
    data: Record<string, unknown>
    url?: string
    apify_run_id?: string
  }

  const rows: IntelRow[] = []

  for (const signal of report.algorithm_signals) {
    rows.push({
      observation_date: asOfDate,
      competitor: signal.platform,
      source: 'algorithm_intel',
      data_type: 'algorithm_signal',
      data: signal as unknown as Record<string, unknown>,
      url: signal.source_url,
    })
  }

  for (const trend of report.format_trends) {
    rows.push({
      observation_date: asOfDate,
      competitor: trend.platform,
      source: 'industry_signal',
      data_type: 'format_trend',
      data: trend as unknown as Record<string, unknown>,
      url: trend.source_url,
    })
  }

  for (const audio of report.audio_trends) {
    rows.push({
      observation_date: asOfDate,
      competitor: audio.platform,
      source: 'industry_signal',
      data_type: 'audio_trend',
      data: audio as unknown as Record<string, unknown>,
      url: audio.source_url,
    })
  }

  for (const ht of report.hashtag_trends) {
    rows.push({
      observation_date: asOfDate,
      competitor: ht.platform,
      source: 'industry_signal',
      data_type: 'hashtag_trend',
      data: ht as unknown as Record<string, unknown>,
      url: ht.source_url,
    })
  }

  if (rows.length === 0) return 0

  const BATCH = 500
  let total = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('competitor_intel').insert(chunk)
    if (error) {
      throw new Error(`persistTrendsReport batch ${i}: ${error.message}`)
    }
    total += chunk.length
  }
  return total
}

// ---------------------------------------------------------------------------
// Private utilities
// ---------------------------------------------------------------------------

/** Parse "12.3k", "4.5M", "200" etc into a number. */
function parseUseCount(raw: string): number | undefined {
  if (!raw) return undefined
  const n = parseFloat(raw)
  if (isNaN(n)) return undefined
  if (/k/i.test(raw)) return Math.round(n * 1_000)
  if (/m/i.test(raw)) return Math.round(n * 1_000_000)
  if (/b/i.test(raw)) return Math.round(n * 1_000_000_000)
  return Math.round(n)
}

/** Classify audio saturation from use count. */
function deriveSaturation(useCount: number | undefined): AudioTrend['saturation'] {
  if (useCount === undefined) return 'medium'
  if (useCount < 50_000) return 'low'
  if (useCount < 500_000) return 'medium'
  return 'high'
}

/** Return true if the text contains at least one relevance keyword. */
function isRelevantToCategory(text: string): boolean {
  const lower = text.toLowerCase()
  return RELEVANCE_KEYWORDS.some((kw) => lower.includes(kw))
}
