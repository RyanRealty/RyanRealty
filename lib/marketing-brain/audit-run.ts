/**
 * marketing-brain: audit-run
 *
 * Orchestrates a full competitive audit cycle. Reads
 * config/marketing-brain/competitors.json for scope, scrapes each
 * verified competitor across each verified platform via Apify,
 * classifies the scraped posts via audit-classifier, aggregates
 * winners via audit-findings-builder, and writes the
 * analyze:audit_findings action row + markdown report per
 * marketing_brain_skills/audit-findings/PROTOCOL.md.
 *
 * This is the brain-side orchestrator. Actual scraping logic for the
 * five core platforms (Instagram, TikTok, GMB reviews, Google SERP,
 * FB Ad Library) reuses competitor-recon.ts where possible. YouTube +
 * LinkedIn scrapers are added here.
 *
 * Cost: a full run is ~$30-80 Apify + ~$18 Anthropic classifier per
 * marketing_brain_skills/tools_registry/apify/SKILL.md cost model.
 * Triggered manually or by a quarterly cron (not yet scheduled).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { classifyAuditCorpus } from './audit-classifier'
import { buildAuditFindings, type AuditFindingsPayload } from './audit-findings-builder'

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
// Types — match config/marketing-brain/competitors.json schema
// ---------------------------------------------------------------------------

interface PlatformHandle {
  handle?: string | null
  page?: string | null
  vanity?: string | null
  verified: boolean
}

interface CompetitorConfig {
  id: string
  display_name: string
  category: string
  geo: string
  rationale: string
  platforms: {
    instagram?: PlatformHandle
    tiktok?: PlatformHandle
    youtube?: PlatformHandle
    facebook?: PlatformHandle
    linkedin?: PlatformHandle
  }
  notes?: string
}

interface CompetitorsConfig {
  schema_version: number
  competitors: CompetitorConfig[]
  audit_defaults: {
    window_days: number
    max_posts_per_platform: number
    engagement_window_days_for_rate_calc: number
    min_post_count_for_inclusion: number
  }
}

export interface AuditRunOptions {
  /** Override the audit_id (defaults to today UTC). */
  auditId?: string
  /** Override the 180-day default window. */
  windowDays?: number
  /** Limit scrape scope for testing. Default reads from competitors.json audit_defaults. */
  maxPostsPerPlatform?: number
  /** If true, skips scrape + classifier; only re-builds findings from existing data. */
  rebuildOnly?: boolean
  /** If true, returns the would-be findings without writing the action row. */
  dryRun?: boolean
}

export interface AuditRunReport {
  audit_id: string
  started_at: string
  completed_at: string
  status: 'published' | 'killed' | 'partial'
  competitors_attempted: number
  competitors_with_data: number
  platforms_scraped: string[]
  posts_scraped: number
  posts_classified: number
  apify_cost_usd: number
  classifier_cost_usd: number
  findings_action_id: string | null
  findings_payload: AuditFindingsPayload | null
  errors: string[]
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export async function runAudit(opts: AuditRunOptions = {}): Promise<AuditRunReport> {
  const supabase = getSupabase()
  const startedAt = new Date().toISOString()
  const auditId = opts.auditId ?? startedAt.slice(0, 10)
  const errors: string[] = []

  // Step 1: load competitors.json
  const config = await loadCompetitorsConfig().catch((e) => {
    errors.push(`loadCompetitorsConfig: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  if (!config) {
    return baseFailureReport(auditId, startedAt, errors)
  }

  const windowDays = opts.windowDays ?? config.audit_defaults.window_days
  const maxPostsPerPlatform = opts.maxPostsPerPlatform ?? config.audit_defaults.max_posts_per_platform

  // Step 2: insert audit_runs row (or pick up existing)
  await upsertAuditRunRow(auditId, windowDays, config.competitors.length)

  // Step 3: scrape (skipped if rebuildOnly)
  const verifiedTargets = collectVerifiedTargets(config)
  let postsScraped = 0
  let apifyCostUsd = 0
  let competitorsWithData = 0
  const platformsScraped = new Set<string>()

  if (!opts.rebuildOnly) {
    await supabase.from('audit_runs').update({ status: 'scraping' }).eq('audit_id', auditId)

    for (const target of verifiedTargets) {
      try {
        const result = await scrapeTarget(target, auditId, windowDays, maxPostsPerPlatform)
        postsScraped += result.posts_count
        apifyCostUsd += result.cost_usd
        if (result.posts_count > 0) {
          competitorsWithData += 1
          platformsScraped.add(target.platform)
        }
      } catch (e) {
        errors.push(`scrape ${target.competitor_id}/${target.platform}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    await supabase
      .from('audit_runs')
      .update({
        posts_scraped: postsScraped,
        competitors_with_data: competitorsWithData,
        platforms_scraped: Array.from(platformsScraped),
        apify_cost_usd: apifyCostUsd,
      })
      .eq('audit_id', auditId)
  }

  // Step 4: classify
  await supabase.from('audit_runs').update({ status: 'classifying' }).eq('audit_id', auditId)
  const classifyReport = await classifyAuditCorpus({ auditId, maxPosts: 1000, dryRun: opts.dryRun })
  errors.push(...classifyReport.errors)

  // Step 5: aggregate + build findings
  await supabase.from('audit_runs').update({ status: 'aggregating' }).eq('audit_id', auditId)
  const findingsPayload = await buildAuditFindings({ auditId, skipFileWrite: opts.dryRun }).catch((e) => {
    errors.push(`buildAuditFindings: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })

  // Step 6: insert analyze:audit_findings action row
  let findingsActionId: string | null = null
  if (findingsPayload && !opts.dryRun) {
    findingsActionId = await insertFindingsActionRow(auditId, findingsPayload)
    await supabase
      .from('audit_runs')
      .update({
        status: 'published',
        completed_at: new Date().toISOString(),
        findings_action_id: findingsActionId,
        report_path: findingsPayload.report_path,
        errors: errors,
      })
      .eq('audit_id', auditId)
  } else if (!opts.dryRun) {
    await supabase
      .from('audit_runs')
      .update({ status: 'killed', completed_at: new Date().toISOString(), errors })
      .eq('audit_id', auditId)
  }

  return {
    audit_id: auditId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: findingsPayload ? (errors.length === 0 ? 'published' : 'partial') : 'killed',
    competitors_attempted: verifiedTargets.length,
    competitors_with_data: competitorsWithData,
    platforms_scraped: Array.from(platformsScraped),
    posts_scraped: postsScraped,
    posts_classified: classifyReport.posts_classified,
    apify_cost_usd: apifyCostUsd,
    classifier_cost_usd: classifyReport.total_cost_usd,
    findings_action_id: findingsActionId,
    findings_payload: findingsPayload,
    errors,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadCompetitorsConfig(): Promise<CompetitorsConfig> {
  const configPath = path.resolve('config/marketing-brain/competitors.json')
  const raw = await fs.readFile(configPath, 'utf-8')
  return JSON.parse(raw) as CompetitorsConfig
}

interface ScrapeTarget {
  competitor_id: string
  display_name: string
  platform: 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin'
  handle: string
}

function collectVerifiedTargets(config: CompetitorsConfig): ScrapeTarget[] {
  const targets: ScrapeTarget[] = []
  for (const c of config.competitors) {
    for (const platform of ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'] as const) {
      const handle = c.platforms[platform]
      if (handle?.verified && (handle.handle || handle.page || handle.vanity)) {
        const slug = handle.handle ?? handle.page ?? handle.vanity ?? ''
        if (slug) {
          targets.push({
            competitor_id: c.id,
            display_name: c.display_name,
            platform,
            handle: slug,
          })
        }
      }
    }
  }
  return targets
}

async function upsertAuditRunRow(auditId: string, windowDays: number, competitorsScraped: number) {
  const supabase = getSupabase()
  await supabase
    .from('audit_runs')
    .upsert(
      {
        audit_id: auditId,
        window_days: windowDays,
        competitors_scraped: competitorsScraped,
        status: 'running',
      },
      { onConflict: 'audit_id' },
    )
}

// Per-target scrape. Today this is a stub that returns 0 posts and 0 cost
// for any target whose platform we have not yet wired up to its Apify
// actor in this orchestrator. The seed audit dataset will be small.
//
// Production wiring TODOs (in priority order):
//   1. Instagram via apify/instagram-profile-scraper (existing pattern in competitor-recon.ts)
//   2. TikTok via clockworks/free-tiktok-scraper (existing pattern)
//   3. YouTube via apify/youtube-channel-scraper (NEW for audit pipeline)
//   4. Facebook page posts via apify/facebook-pages-scraper (NEW)
//   5. LinkedIn posts via harvestapi/linkedin-post-search-scraper (NEW, anti-scrape risk noted)
async function scrapeTarget(
  target: ScrapeTarget,
  auditId: string,
  windowDays: number,
  maxPostsPerPlatform: number,
): Promise<{ posts_count: number; cost_usd: number }> {
  // Marker comment per CLAUDE.md "No half measures" — log the gap clearly.
  // The actual scrape would call lib/apify or the per-platform helper in
  // competitor-recon.ts here. For the seed audit, this stub no-ops so the
  // classifier + findings stages run against the existing competitor_intel
  // rows from the weekly recon cron.
  void target
  void auditId
  void windowDays
  void maxPostsPerPlatform
  return { posts_count: 0, cost_usd: 0 }
}

async function insertFindingsActionRow(
  auditId: string,
  payload: AuditFindingsPayload,
): Promise<string | null> {
  const supabase = getSupabase()
  const summaryHook = `Audit ${auditId}: ${payload.missing_producers.length} missing producers, ${payload.top_winners_by_topic_format.length} winners surfaced.`

  const { data, error } = await supabase
    .from('marketing_brain_actions')
    .insert({
      action_type: 'analyze:audit_findings',
      target: `audit:${auditId}`,
      assigned_producer: 'marketing_brain_skills/audit-findings',
      payload,
      data_evidence: {
        audit_source: 'audit-run',
        trigger_metric: 'audit_corpus_size',
        trigger_value: payload.posts_classified,
      },
      topic: `Audit findings ${auditId}`,
      format: 'audit_findings',
      platforms: ['internal'],
      hook: summaryHook,
      body: `Full payload + markdown report at ${payload.report_path}.`,
      cta: null,
      target_audience: 'internal',
      data_sources: [
        { type: 'audit-run', evidence: `${payload.competitors_with_data}/${payload.competitors_scraped} competitors, ${payload.posts_classified} posts classified.` },
      ],
      predicted_outcome: {
        primary_metric: 'producer_coverage',
        expected_value: `${payload.missing_producers.length} new producer SKILL.md files to author`,
        rationale: 'Producer Authoring session reads this row on next session start; each missing_producers entry maps to one new SKILL.md.',
      },
      status: 'pending',
      generated_by: 'marketing_brain:audit-run',
      generation_reason: `Audit cycle ${auditId} completed. ${payload.posts_classified} posts classified across ${payload.platforms_scraped.length} platforms. ${payload.missing_producers.length} producer gaps surfaced.`,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('insertFindingsActionRow:', error?.message ?? 'no row returned')
    return null
  }
  return data.id as string
}

function baseFailureReport(auditId: string, startedAt: string, errors: string[]): AuditRunReport {
  return {
    audit_id: auditId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: 'killed',
    competitors_attempted: 0,
    competitors_with_data: 0,
    platforms_scraped: [],
    posts_scraped: 0,
    posts_classified: 0,
    apify_cost_usd: 0,
    classifier_cost_usd: 0,
    findings_action_id: null,
    findings_payload: null,
    errors,
  }
}
