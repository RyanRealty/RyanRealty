/**
 * marketing-brain: audit-findings-builder
 *
 * Aggregates classified competitor posts into the structured findings the
 * Producer Authoring session reads (per marketing_brain_skills/audit-findings/
 * PROTOCOL.md). Produces two outputs:
 *
 *   1. AuditFindingsPayload — the jsonb that lands in
 *      marketing_brain_actions(action_type='analyze:audit_findings').payload
 *   2. Markdown report — human-readable summary written to
 *      docs/marketing-brain/audit-YYYY-MM-DD.md
 *
 * Reads from:
 *   - public.audit_runs (the audit metadata row)
 *   - public.audit_winners (top-quartile combos view)
 *   - public.content_classification (joined for per-post detail)
 *   - public.competitor_intel (for post urls + competitor names)
 *   - marketing_brain_skills/producers/REGISTRY.md (existing-producer map)
 *   - lib/marketing-brain/topic-taxonomy.ts (canonical topic enum)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { Topic, Format } from './topic-taxonomy'

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
// Types — match marketing_brain_skills/audit-findings/PROTOCOL.md exactly
// ---------------------------------------------------------------------------

export interface MissingProducer {
  proposed_skill_name: string
  proposed_path: string
  proposed_action_type: string
  topic: Topic
  format: Format
  evidence: {
    median_engagement_rate_top_quartile: number
    sample_post_urls: string[]
    competitors_running_this: string[]
    post_count_in_corpus: number
  }
  priority: 'high' | 'medium' | 'low'
  rationale: string
  data_sources_needed: string[]
  similar_existing_producer: string | null
}

export interface ExistingProducerValidation {
  producer_path: string
  validated: boolean
  evidence: string
  recommendation: 'keep' | 'refresh' | 'retire'
}

export interface TopWinner {
  topic: Topic
  format: Format
  median_engagement_rate: number
  p75_engagement_rate: number
  post_count: number
  top_creators: Array<{ competitor_id: string; post_url: string; engagement_rate: number }>
  exemplar_caption: string
}

export interface OutlierFlag {
  topic: Topic
  format: Format
  flag: 'small_sample' | 'single_creator_dominance' | 'viral_anomaly' | 'recency_bias'
  detail: string
}

export interface AuditFindingsPayload {
  audit_id: string
  audit_started_at: string
  audit_completed_at: string
  window_days: number
  competitors_scraped: number
  competitors_with_data: number
  platforms_scraped: string[]
  posts_classified: number
  classifier_cost_usd: number
  apify_cost_usd: number
  missing_producers: MissingProducer[]
  existing_producers_validated: ExistingProducerValidation[]
  top_winners_by_topic_format: TopWinner[]
  outliers_flagged: OutlierFlag[]
  errors: string[]
  report_path: string
}

// ---------------------------------------------------------------------------
// Topic + format → producer mapping (derived from REGISTRY.md Sections A-F)
// ---------------------------------------------------------------------------

/**
 * The canonical map of (topic, format) → existing producer path or
 * null if no producer covers this combo. Used to detect missing_producers.
 *
 * When the audit surfaces a winning (topic, format) combo, this map
 * decides whether we already have a producer for it. If not → missing.
 *
 * Topics: listing, market_data, national_housing_news, national_economy,
 * local_community, lifestyle_bend, buyer_education, seller_education,
 * behind_scenes, recap_highlight, agent_brand, other.
 *
 * Formats: reel, carousel, single_image, long_video, live, story,
 * text_post, blog, podcast_clip, other.
 */
const EXISTING_PRODUCER_MAP: Partial<Record<Topic, Partial<Record<Format, string>>>> = {
  listing: {
    reel: 'video_production_skills/listing_reveal',
    long_video: 'video_production_skills/listing-tour-video',
    carousel: 'social_media_skills/instagram-carousel',
    single_image: 'social_media_skills/flyer-design',
    blog: 'social_media_skills/blog-post',
  },
  market_data: {
    reel: 'video_production_skills/market-data-video',
    long_video: 'video_production_skills/youtube-long-form-market-report',
    carousel: 'social_media_skills/instagram-carousel',
    blog: 'social_media_skills/blog-post',
  },
  national_housing_news: {
    reel: 'video_production_skills/news-video',
    long_video: 'video_production_skills/news-video',
    blog: 'social_media_skills/blog-post',
  },
  national_economy: {
    blog: 'social_media_skills/blog-post',
    reel: 'video_production_skills/news-video',
  },
  local_community: {
    reel: 'video_production_skills/weekend-events-video',
    blog: 'social_media_skills/blog-post',
  },
  lifestyle_bend: {
    reel: 'video_production_skills/area_guides',
    long_video: 'video_production_skills/neighborhood_tour',
  },
  buyer_education: {
    blog: 'social_media_skills/blog-post',
  },
  seller_education: {
    blog: 'social_media_skills/blog-post',
  },
  behind_scenes: {
    reel: 'video_production_skills/listing_reveal',
  },
  recap_highlight: {
    carousel: 'social_media_skills/instagram-carousel',
    blog: 'social_media_skills/blog-post',
  },
  agent_brand: {
    carousel: 'social_media_skills/instagram-carousel',
    single_image: 'social_media_skills/flyer-design',
  },
}

function findExistingProducer(topic: Topic, format: Format): string | null {
  return EXISTING_PRODUCER_MAP[topic]?.[format] ?? null
}

/**
 * Derive a proposed skill name + path + action_type from a (topic, format) tuple.
 * Used to fill the MissingProducer fields when no existing producer covers a combo.
 */
function deriveProposedProducer(topic: Topic, format: Format): {
  skill_name: string
  path: string
  action_type: string
} {
  const skill_name = `${topic.replace(/_/g, '-')}-${format}`
  const isVideo = format === 'reel' || format === 'long_video' || format === 'live'
  const path = isVideo
    ? `video_production_skills/${skill_name}/`
    : `social_media_skills/${skill_name}/`
  const action_type = `content:${topic}_${format}`
  return { skill_name, path, action_type }
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export interface BuildFindingsOptions {
  auditId: string
  /** Override the docs/ path if writing to a different location. */
  reportBaseDir?: string
  /**
   * If true, only build the payload and skip writing the markdown file.
   * Useful for tests + dryRun cycles.
   */
  skipFileWrite?: boolean
}

export async function buildAuditFindings(opts: BuildFindingsOptions): Promise<AuditFindingsPayload> {
  const supabase = getSupabase()
  const auditId = opts.auditId
  const baseDir = opts.reportBaseDir ?? 'docs/marketing-brain'

  // Pull audit-run metadata
  const runRes = await supabase
    .from('audit_runs')
    .select('*')
    .eq('audit_id', auditId)
    .single()
  if (runRes.error || !runRes.data) {
    throw new Error(`buildAuditFindings: audit_runs row not found for ${auditId} — ${runRes.error?.message ?? 'no data'}`)
  }
  const run = runRes.data as Record<string, unknown>

  // Pull winners view
  const winnersRes = await supabase
    .from('audit_winners')
    .select('*')
    .eq('audit_id', auditId)
    .order('p75_engagement', { ascending: false })
    .limit(50)
  const winners = (winnersRes.data ?? []) as Array<{
    audit_id: string
    topic: string
    format: string
    post_count: number
    median_engagement: number
    p75_engagement: number
    competitors: string[]
    sample_post_urls: string[]
  }>

  // Compose missing_producers, existing_producers_validated, top_winners
  const missing_producers: MissingProducer[] = []
  const existing_validated: ExistingProducerValidation[] = []
  const top_winners: TopWinner[] = []
  const outliers: OutlierFlag[] = []

  for (const w of winners) {
    const topic = w.topic as Topic
    const format = w.format as Format
    const existing = findExistingProducer(topic, format)

    // Always record as a top_winner
    top_winners.push({
      topic,
      format,
      median_engagement_rate: Number(w.median_engagement ?? 0),
      p75_engagement_rate: Number(w.p75_engagement ?? 0),
      post_count: Number(w.post_count ?? 0),
      top_creators: (w.sample_post_urls ?? []).map((url, idx) => ({
        competitor_id: w.competitors[idx] ?? 'unknown',
        post_url: url,
        engagement_rate: Number(w.p75_engagement ?? 0),
      })),
      exemplar_caption: w.sample_post_urls?.[0] ?? '',
    })

    // Outlier flag if sample is small
    if (w.post_count < 8) {
      outliers.push({
        topic,
        format,
        flag: 'small_sample',
        detail: `Only ${w.post_count} posts in corpus for this combo — treat with caution.`,
      })
    }

    // Single-creator dominance check
    if (w.competitors && w.competitors.length === 1 && w.post_count >= 3) {
      outliers.push({
        topic,
        format,
        flag: 'single_creator_dominance',
        detail: `All ${w.post_count} posts come from ${w.competitors[0]} — winning combo may be creator-specific.`,
      })
    }

    if (existing) {
      existing_validated.push({
        producer_path: existing,
        validated: true,
        evidence: `${topic}/${format} has ${w.post_count} winning posts across ${w.competitors.length} competitors. Median ER ${Number(w.median_engagement).toFixed(3)}.`,
        recommendation: 'keep',
      })
    } else {
      // Missing producer — derive proposed shape
      const proposed = deriveProposedProducer(topic, format)
      const priority: 'high' | 'medium' | 'low' =
        w.post_count >= 20 && w.competitors.length >= 3 ? 'high' :
        w.post_count >= 10 ? 'medium' : 'low'

      missing_producers.push({
        proposed_skill_name: proposed.skill_name,
        proposed_path: proposed.path,
        proposed_action_type: proposed.action_type,
        topic,
        format,
        evidence: {
          median_engagement_rate_top_quartile: Number(w.p75_engagement ?? 0),
          sample_post_urls: (w.sample_post_urls ?? []).slice(0, 5),
          competitors_running_this: w.competitors ?? [],
          post_count_in_corpus: w.post_count,
        },
        priority,
        rationale: `${w.post_count} winning posts at p75 ER ${Number(w.p75_engagement).toFixed(3)} from ${w.competitors.length} competitors. No producer covers ${topic}/${format} in REGISTRY.md.`,
        data_sources_needed: dataSourcesForTopic(topic),
        similar_existing_producer: findClosestExisting(topic, format),
      })
    }
  }

  const reportPath = `${baseDir}/audit-${auditId}.md`
  const payload: AuditFindingsPayload = {
    audit_id: auditId,
    audit_started_at: String(run.started_at ?? ''),
    audit_completed_at: String(run.completed_at ?? new Date().toISOString()),
    window_days: Number(run.window_days ?? 180),
    competitors_scraped: Number(run.competitors_scraped ?? 0),
    competitors_with_data: Number(run.competitors_with_data ?? 0),
    platforms_scraped: (run.platforms_scraped as string[]) ?? [],
    posts_classified: Number(run.posts_classified ?? 0),
    classifier_cost_usd: Number(run.classifier_cost_usd ?? 0),
    apify_cost_usd: Number(run.apify_cost_usd ?? 0),
    missing_producers,
    existing_producers_validated: existing_validated,
    top_winners_by_topic_format: top_winners,
    outliers_flagged: outliers,
    errors: ((run.errors as unknown as unknown[]) ?? []) as string[],
    report_path: reportPath,
  }

  if (!opts.skipFileWrite) {
    await writeMarkdownReport(reportPath, payload)
  }

  return payload
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dataSourcesForTopic(topic: Topic): string[] {
  switch (topic) {
    case 'listing': return ['listings table (MLS)', 'listing photos']
    case 'market_data': return ['market_stats_cache', 'market_pulse_live', 'Spark MLS']
    case 'national_housing_news': return ['WebSearch', 'Fed press releases', 'NAR reports']
    case 'national_economy': return ['BLS', 'BEA', 'FRED', 'WebSearch']
    case 'local_community': return ['Source Weekly', 'Cascade Business News', 'Visit Bend']
    case 'lifestyle_bend': return ['original photography', 'place_attractions table']
    case 'buyer_education':
    case 'seller_education': return ['broker expertise', 'OREF forms']
    case 'behind_scenes': return ['broker journals', 'FUB pipeline (anonymized)']
    case 'recap_highlight': return ['market_stats_cache aggregations', 'team activity logs']
    case 'agent_brand': return ['press mentions', 'internal team data']
    default: return []
  }
}

function findClosestExisting(topic: Topic, format: Format): string | null {
  // First try the same topic with a different format
  const topicMap = EXISTING_PRODUCER_MAP[topic]
  if (topicMap) {
    const otherFormats = Object.values(topicMap)
    if (otherFormats.length > 0) return otherFormats[0] ?? null
  }
  // Then try the same format with market_data (broadest topic with most coverage)
  const marketDataMap = EXISTING_PRODUCER_MAP.market_data
  if (marketDataMap?.[format]) return marketDataMap[format] ?? null
  return null
}

async function writeMarkdownReport(reportPath: string, payload: AuditFindingsPayload): Promise<void> {
  const lines: string[] = []
  lines.push(`# Marketing brain — competitive audit ${payload.audit_id}`)
  lines.push(``)
  lines.push(`Generated: ${payload.audit_completed_at}`)
  lines.push(`Window: ${payload.window_days} days`)
  lines.push(`Scope: ${payload.competitors_with_data} of ${payload.competitors_scraped} competitors with data; ${payload.platforms_scraped.join(', ')}`)
  lines.push(`Posts classified: ${payload.posts_classified.toLocaleString()}`)
  lines.push(`Cost: Apify $${payload.apify_cost_usd.toFixed(2)} + Classifier $${payload.classifier_cost_usd.toFixed(2)}`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)
  lines.push(`## Top winners by topic × format`)
  lines.push(``)
  lines.push(`| Topic | Format | Posts | p75 ER | Median ER | Competitors |`)
  lines.push(`|---|---|---|---|---|---|`)
  for (const w of payload.top_winners_by_topic_format.slice(0, 25)) {
    lines.push(`| ${w.topic} | ${w.format} | ${w.post_count} | ${w.p75_engagement_rate.toFixed(3)} | ${w.median_engagement_rate.toFixed(3)} | ${w.top_creators.map((c) => c.competitor_id).slice(0, 3).join(', ')} |`)
  }
  lines.push(``)
  lines.push(`## Missing producers (priority order)`)
  lines.push(``)
  const sorted = [...payload.missing_producers].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })
  for (const m of sorted) {
    lines.push(`### \`${m.proposed_skill_name}\` — ${m.priority.toUpperCase()}`)
    lines.push(``)
    lines.push(`- **Proposed path:** \`${m.proposed_path}\``)
    lines.push(`- **Proposed action_type:** \`${m.proposed_action_type}\``)
    lines.push(`- **Topic × Format:** ${m.topic} × ${m.format}`)
    lines.push(`- **Evidence:** ${m.evidence.post_count_in_corpus} posts at p75 ER ${m.evidence.median_engagement_rate_top_quartile.toFixed(3)}; competitors: ${m.evidence.competitors_running_this.slice(0, 5).join(', ')}`)
    lines.push(`- **Data sources needed:** ${m.data_sources_needed.join(', ') || '(none specified)'}`)
    if (m.similar_existing_producer) {
      lines.push(`- **Closest existing producer:** \`${m.similar_existing_producer}\` (use as template)`)
    }
    lines.push(`- **Sample posts:**`)
    for (const url of m.evidence.sample_post_urls.slice(0, 3)) {
      lines.push(`  - ${url}`)
    }
    lines.push(``)
  }
  if (payload.existing_producers_validated.length > 0) {
    lines.push(`## Existing producers validated`)
    lines.push(``)
    lines.push(`| Producer | Recommendation | Evidence |`)
    lines.push(`|---|---|---|`)
    for (const v of payload.existing_producers_validated) {
      lines.push(`| \`${v.producer_path}\` | ${v.recommendation} | ${v.evidence} |`)
    }
    lines.push(``)
  }
  if (payload.outliers_flagged.length > 0) {
    lines.push(`## Outliers flagged`)
    lines.push(``)
    for (const o of payload.outliers_flagged) {
      lines.push(`- **${o.topic}/${o.format}** [${o.flag}]: ${o.detail}`)
    }
    lines.push(``)
  }
  if (payload.errors.length > 0) {
    lines.push(`## Errors during run`)
    lines.push(``)
    for (const e of payload.errors) {
      lines.push(`- ${e}`)
    }
    lines.push(``)
  }
  lines.push(`---`)
  lines.push(``)
  lines.push(`Per [PROTOCOL.md](../../marketing_brain_skills/audit-findings/PROTOCOL.md), Producer Authoring session queries marketing_brain_actions for action_type='analyze:audit_findings' status='approved' ORDER BY created_at DESC LIMIT 1 to pick its next work.`)

  const absPath = path.resolve(reportPath)
  await fs.mkdir(path.dirname(absPath), { recursive: true })
  await fs.writeFile(absPath, lines.join('\n'), 'utf-8')

  // Also write/refresh the audit-LATEST.md pointer
  const latestPath = path.resolve(path.dirname(reportPath), 'audit-LATEST.md')
  await fs.writeFile(latestPath, lines.join('\n'), 'utf-8')
}
