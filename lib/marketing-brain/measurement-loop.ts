/**
 * marketing-brain: measurement-loop
 *
 * The brain's feedback layer. Pulls per-post performance metrics from each
 * platform at 24h / 7d / 30d intervals after an action row's executed_at
 * timestamp, writes one row per (action, measurement-window) to
 * public.content_performance.
 *
 * Once populated, downstream consumers can:
 *   - audit-findings-builder weighs existing_producers_validated by ER
 *   - generate-briefs prefers formats that historically converted
 *   - the dashboard surfaces top-performing topic x format combos
 *
 * Without this loop, the brain proposes but never measures. That's the
 * single biggest structural gap noted in the 2026-05-14 session.
 *
 * Producer contract:
 *   When a producer transitions an action_row to status='executed', it
 *   MUST write its published posts to executor_response.published_posts
 *   in this shape:
 *     {
 *       published_posts: [
 *         { platform: 'instagram', platform_post_id: '17890...', url: 'https://...', published_at: '2026-05-14T...' },
 *         { platform: 'facebook', platform_post_id: '12345_67890', url: '...', published_at: '...' }
 *       ]
 *     }
 *   The measurement loop reads from there. Producers that publish to
 *   multiple platforms (list-kit, listing_launch) write one entry per
 *   destination.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

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
// Types
// ---------------------------------------------------------------------------

export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin' | 'x' | 'gbp' | 'blog'

export interface PublishedPost {
  platform: Platform
  platform_post_id: string
  url?: string
  published_at: string
}

export interface MeasurementMetrics {
  impressions: number | null
  reach: number | null
  views: number | null
  engagements: number | null
  clicks: number | null
  saves: number | null
  shares: number | null
  comments: number | null
  follows: number | null
  watch_time_seconds: number | null
  conversions: number | null
  attributed_leads: number | null
  metadata: Record<string, unknown>
}

const EMPTY_METRICS: MeasurementMetrics = {
  impressions: null,
  reach: null,
  views: null,
  engagements: null,
  clicks: null,
  saves: null,
  shares: null,
  comments: null,
  follows: null,
  watch_time_seconds: null,
  conversions: null,
  attributed_leads: null,
  metadata: {},
}

/** Hours-since-publish windows the loop measures at. */
export const MEASUREMENT_WINDOWS_HOURS = [24, 168, 720] // 1d, 7d, 30d
const WINDOW_TOLERANCE_HOURS = 24 // measure within this many hours of the target window

export interface MeasurementCandidate {
  action_id: string
  action_type: string
  topic: string | null
  published_post: PublishedPost
  hours_since_publish: number
  target_window_hours: number
}

export interface MeasurementLoopReport {
  scanned_actions: number
  candidates_found: number
  measurements_attempted: number
  measurements_succeeded: number
  measurements_skipped: number
  measurements_failed: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export interface RunMeasurementLoopOptions {
  /** Limit how many candidates to attempt in one run. Default 200. */
  maxCandidates?: number
  /** If true, returns the report without writing to content_performance. */
  dryRun?: boolean
}

export async function runMeasurementLoop(opts: RunMeasurementLoopOptions = {}): Promise<MeasurementLoopReport> {
  const maxCandidates = opts.maxCandidates ?? 200
  const report: MeasurementLoopReport = {
    scanned_actions: 0,
    candidates_found: 0,
    measurements_attempted: 0,
    measurements_succeeded: 0,
    measurements_skipped: 0,
    measurements_failed: 0,
    errors: [],
  }

  const candidates = await findUnmeasuredCandidates(maxCandidates)
  report.scanned_actions = candidates.scanned
  report.candidates_found = candidates.list.length

  for (const candidate of candidates.list) {
    report.measurements_attempted += 1
    try {
      const metrics = await measurePlatformPost(candidate.published_post.platform, candidate.published_post.platform_post_id)
      if (metrics === null) {
        report.measurements_skipped += 1
        continue
      }
      if (!opts.dryRun) {
        const inserted = await persistMeasurement(candidate, metrics)
        if (inserted) {
          report.measurements_succeeded += 1
        } else {
          report.measurements_failed += 1
        }
      } else {
        report.measurements_succeeded += 1
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      report.errors.push(`action=${candidate.action_id} platform=${candidate.published_post.platform}: ${msg}`)
      report.measurements_failed += 1
    }
  }

  return report
}

// ---------------------------------------------------------------------------
// Candidate discovery
// ---------------------------------------------------------------------------

interface CandidateScanResult {
  scanned: number
  list: MeasurementCandidate[]
}

async function findUnmeasuredCandidates(maxCandidates: number): Promise<CandidateScanResult> {
  const supabase = getSupabase()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()

  // Pull executed action rows from last 90 days with non-null executor_response
  const { data: rows, error } = await supabase
    .from('marketing_brain_actions')
    .select('id, action_type, topic, executed_at, executor_response')
    .eq('status', 'executed')
    .gte('executed_at', ninetyDaysAgo)
    .order('executed_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('findUnmeasuredCandidates: marketing_brain_actions query failed:', error.message)
    return { scanned: 0, list: [] }
  }

  const scanned = rows?.length ?? 0
  const candidates: MeasurementCandidate[] = []

  for (const row of (rows ?? []) as Array<{ id: string; action_type: string; topic: string | null; executed_at: string; executor_response: Record<string, unknown> | null }>) {
    if (!row.executor_response) continue
    const publishedPosts = (row.executor_response.published_posts as PublishedPost[] | undefined) ?? []
    if (publishedPosts.length === 0) continue

    for (const post of publishedPosts) {
      if (!post.platform || !post.platform_post_id || !post.published_at) continue

      const hoursSince = (Date.now() - Date.parse(post.published_at)) / 3_600_000
      // Pick the highest target window we have not yet measured for this post
      const targetWindow = pickTargetWindow(hoursSince)
      if (targetWindow === null) continue

      const alreadyMeasured = await isAlreadyMeasured(post.platform_post_id, targetWindow)
      if (alreadyMeasured) continue

      candidates.push({
        action_id: row.id,
        action_type: row.action_type,
        topic: row.topic,
        published_post: post,
        hours_since_publish: hoursSince,
        target_window_hours: targetWindow,
      })

      if (candidates.length >= maxCandidates) break
    }
    if (candidates.length >= maxCandidates) break
  }

  return { scanned, list: candidates }
}

/** Return the highest MEASUREMENT_WINDOWS_HOURS bucket that hoursSince is past. */
function pickTargetWindow(hoursSince: number): number | null {
  for (const w of [...MEASUREMENT_WINDOWS_HOURS].reverse()) {
    if (hoursSince >= w - WINDOW_TOLERANCE_HOURS && hoursSince <= w + WINDOW_TOLERANCE_HOURS * 30) {
      return w
    }
  }
  return null
}

async function isAlreadyMeasured(platformPostId: string, targetWindowHours: number): Promise<boolean> {
  const supabase = getSupabase()
  const lowerBound = targetWindowHours - WINDOW_TOLERANCE_HOURS
  const upperBound = targetWindowHours + WINDOW_TOLERANCE_HOURS
  const { count } = await supabase
    .from('content_performance')
    .select('id', { count: 'planned', head: true })
    .eq('platform_post_id', platformPostId)
    .gte('hours_since_publish', lowerBound)
    .lte('hours_since_publish', upperBound)
  return (count ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Per-platform measurement
// ---------------------------------------------------------------------------

/**
 * Pull metrics for a single platform post. Returns null when the platform
 * integration is not yet implemented; the loop logs and skips. Returns
 * EMPTY_METRICS-shaped object on success.
 */
async function measurePlatformPost(platform: Platform, platformPostId: string): Promise<MeasurementMetrics | null> {
  switch (platform) {
    case 'instagram':
    case 'facebook':
      return measureMetaPost(platform, platformPostId)
    case 'tiktok':
    case 'youtube':
    case 'linkedin':
    case 'x':
    case 'gbp':
    case 'blog':
      // Stubs — return null to signal "skip; integration not yet wired"
      return null
    default:
      return null
  }
}

/**
 * Meta Graph metric fetch for an IG media or FB post id.
 * Reuses the long-lived page access token per CLAUDE.md
 * "Marketing Brain Architecture" -> Meta Graph tool skill.
 */
async function measureMetaPost(platform: 'instagram' | 'facebook', postId: string): Promise<MeasurementMetrics | null> {
  const token = process.env.NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN
  if (!token) {
    return null
  }

  const fields = platform === 'instagram'
    ? 'reach,impressions,saved,likes,comments,shares,plays,total_interactions'
    : 'post_impressions,post_engaged_users,post_clicks,post_reactions_by_type_total'

  const url = `https://graph.facebook.com/v25.0/${postId}/insights?metric=${fields}&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Meta Graph ${platform} insights ${res.status}: ${text.slice(0, 200)}`)
  }
  const raw = (await res.json()) as { data?: Array<{ name: string; values?: Array<{ value: unknown }> }> }
  const map = new Map<string, number>()
  for (const item of raw.data ?? []) {
    const v = item.values?.[0]?.value
    const n = typeof v === 'number' ? v : 0
    map.set(item.name, n)
  }

  if (platform === 'instagram') {
    return {
      ...EMPTY_METRICS,
      impressions: map.get('impressions') ?? null,
      reach: map.get('reach') ?? null,
      views: map.get('plays') ?? null,
      saves: map.get('saved') ?? null,
      shares: map.get('shares') ?? null,
      comments: map.get('comments') ?? null,
      engagements: map.get('total_interactions') ?? null,
      metadata: { raw: Object.fromEntries(map) },
    }
  }
  // facebook
  return {
    ...EMPTY_METRICS,
    impressions: map.get('post_impressions') ?? null,
    reach: map.get('post_engaged_users') ?? null,
    clicks: map.get('post_clicks') ?? null,
    engagements: (map.get('post_reactions_by_type_total') ?? 0) + (map.get('post_clicks') ?? 0),
    metadata: { raw: Object.fromEntries(map) },
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persistMeasurement(candidate: MeasurementCandidate, metrics: MeasurementMetrics): Promise<boolean> {
  const supabase = getSupabase()
  const { error } = await supabase.from('content_performance').insert({
    brief_id: candidate.action_id,
    platform: candidate.published_post.platform,
    platform_post_id: candidate.published_post.platform_post_id,
    published_at: candidate.published_post.published_at,
    hours_since_publish: candidate.hours_since_publish,
    impressions: metrics.impressions,
    reach: metrics.reach,
    views: metrics.views,
    engagements: metrics.engagements,
    clicks: metrics.clicks,
    saves: metrics.saves,
    shares: metrics.shares,
    comments: metrics.comments,
    follows: metrics.follows,
    watch_time_seconds: metrics.watch_time_seconds,
    conversions: metrics.conversions,
    attributed_leads: metrics.attributed_leads,
    metadata: { ...metrics.metadata, target_window_hours: candidate.target_window_hours, action_type: candidate.action_type, topic: candidate.topic },
    source: 'measurement-loop',
  })
  if (error) {
    console.error('persistMeasurement:', error.message)
    return false
  }
  return true
}
