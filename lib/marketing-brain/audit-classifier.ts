/**
 * marketing-brain: audit-classifier
 *
 * LLM tagging pass over scraped competitor_intel rows. Writes one
 * content_classification row per (post, audit_id) tuple per
 * marketing_brain_skills/tools_registry/classifier/SKILL.md.
 *
 * Model selection:
 *   - claude-haiku-4-5-20251001 for bulk tagging (~$0.0008/post)
 *   - claude-sonnet-4-6 escalation if Haiku returns topic_confidence < 0.6
 *
 * Approach: synchronous Messages API with serial calls + retry. The
 * full Anthropic Batches API integration is a TODO once the audit
 * corpus exceeds ~1,000 posts/run (today's seed audits will be smaller).
 *
 * Auth: ANTHROPIC_API_KEY env var.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  CLASSIFIER_CONFIDENCE_THRESHOLD,
  ClassificationResult,
  getClassifierSystemPrompt,
  isTopic,
} from './topic-taxonomy'

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
// Constants
// ---------------------------------------------------------------------------

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
const SONNET_MODEL = 'claude-sonnet-4-6'

// Approximate per-million-token rates as of 2026-05 — used for cost tracking.
// Source: marketing_brain_skills/tools_registry/classifier/SKILL.md.
const RATES = {
  [HAIKU_MODEL]: { input: 1, output: 5 },
  [SONNET_MODEL]: { input: 3, output: 15 },
} as const

// Soft rate-limit: this many ms between calls to avoid burst on Anthropic.
// Anthropic enforces RPM limits per org; this stays under typical tier-2 ceiling.
const INTER_CALL_DELAY_MS = 200

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ClassifyAuditOptions {
  auditId: string
  /** Max posts to classify in one invocation. Default 500 — prevents runaway cost. */
  maxPosts?: number
  /** If true, returns classifications without writing to Supabase. */
  dryRun?: boolean
}

export interface ClassifyAuditReport {
  audit_id: string
  posts_attempted: number
  posts_classified: number
  posts_escalated_to_sonnet: number
  posts_failed: number
  total_cost_usd: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export async function classifyAuditCorpus(opts: ClassifyAuditOptions): Promise<ClassifyAuditReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      audit_id: opts.auditId,
      posts_attempted: 0,
      posts_classified: 0,
      posts_escalated_to_sonnet: 0,
      posts_failed: 0,
      total_cost_usd: 0,
      errors: ['ANTHROPIC_API_KEY is not set; classifier cannot run'],
    }
  }

  const supabase = getSupabase()
  const maxPosts = opts.maxPosts ?? 500

  // Pull unclassified competitor_intel rows associated with this audit.
  // We classify only post-type rows; profile_metric / serp_position / ad rows
  // are not subject to content classification.
  const unclassifiedRes = await supabase
    .from('competitor_intel')
    .select('id, competitor, source, data_type, data, url')
    .in('data_type', ['post'])
    .order('observation_date', { ascending: false })
    .limit(maxPosts)
  if (unclassifiedRes.error) {
    return {
      audit_id: opts.auditId,
      posts_attempted: 0,
      posts_classified: 0,
      posts_escalated_to_sonnet: 0,
      posts_failed: 0,
      total_cost_usd: 0,
      errors: [`competitor_intel query failed: ${unclassifiedRes.error.message}`],
    }
  }
  const posts = (unclassifiedRes.data ?? []) as Array<{
    id: string
    competitor: string
    source: string
    data_type: string
    data: Record<string, unknown>
    url: string | null
  }>

  // Filter out posts already classified for this audit
  const alreadyClassifiedRes = await supabase
    .from('content_classification')
    .select('post_id')
    .eq('audit_id', opts.auditId)
  const alreadyClassified = new Set<string>(
    ((alreadyClassifiedRes.data ?? []) as Array<{ post_id: string }>).map((r) => r.post_id),
  )
  const toClassify = posts.filter((p) => !alreadyClassified.has(p.id))

  const report: ClassifyAuditReport = {
    audit_id: opts.auditId,
    posts_attempted: toClassify.length,
    posts_classified: 0,
    posts_escalated_to_sonnet: 0,
    posts_failed: 0,
    total_cost_usd: 0,
    errors: [],
  }

  const systemPrompt = getClassifierSystemPrompt()

  for (const post of toClassify) {
    try {
      const userPrompt = buildUserPrompt(post)
      const haiku = await callAnthropic(apiKey, HAIKU_MODEL, systemPrompt, userPrompt)
      let modelUsed = HAIKU_MODEL
      let classification = haiku.classification
      let cost = haiku.cost_usd
      let rawResponse = haiku.raw

      // Escalate if confidence below threshold
      if (classification.topic_confidence < CLASSIFIER_CONFIDENCE_THRESHOLD) {
        const sonnet = await callAnthropic(apiKey, SONNET_MODEL, systemPrompt, userPrompt)
        modelUsed = SONNET_MODEL
        classification = sonnet.classification
        cost += sonnet.cost_usd
        rawResponse = sonnet.raw
        report.posts_escalated_to_sonnet += 1
      }

      if (!opts.dryRun) {
        const insertRes = await supabase.from('content_classification').upsert({
          post_id: post.id,
          audit_id: opts.auditId,
          model_used: modelUsed,
          classification,
          rationale: classification.rationale,
          cost_usd: cost,
          raw_response: rawResponse,
        }, { onConflict: 'post_id,audit_id' })
        if (insertRes.error) {
          report.errors.push(`upsert post_id=${post.id}: ${insertRes.error.message}`)
          report.posts_failed += 1
          continue
        }
      }

      report.posts_classified += 1
      report.total_cost_usd += cost

      // Soft rate-limit between calls
      await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      report.errors.push(`post_id=${post.id}: ${msg}`)
      report.posts_failed += 1
    }
  }

  // Update audit_runs row with cumulative stats
  if (!opts.dryRun) {
    await supabase
      .from('audit_runs')
      .update({
        posts_classified: report.posts_classified,
        classifier_cost_usd: report.total_cost_usd,
        status: 'aggregating',
      })
      .eq('audit_id', opts.auditId)
  }

  return report
}

// ---------------------------------------------------------------------------
// Anthropic API call
// ---------------------------------------------------------------------------

interface AnthropicCallResult {
  classification: ClassificationResult
  cost_usd: number
  raw: Record<string, unknown>
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<AnthropicCallResult> {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic ${model} returned ${res.status}: ${text.slice(0, 200)}`)
  }

  const raw = (await res.json()) as Record<string, unknown>
  const content = raw.content as Array<{ type: string; text?: string }>
  const text = content.find((c) => c.type === 'text')?.text ?? ''
  const usage = (raw.usage as { input_tokens: number; output_tokens: number }) ?? { input_tokens: 0, output_tokens: 0 }

  const classification = parseClassificationJson(text)
  const rate = RATES[model as keyof typeof RATES] ?? { input: 0, output: 0 }
  const cost_usd =
    (usage.input_tokens / 1_000_000) * rate.input +
    (usage.output_tokens / 1_000_000) * rate.output

  return { classification, cost_usd, raw }
}

function parseClassificationJson(text: string): ClassificationResult {
  // Strip any code fences the model might have added
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned) as Record<string, unknown>

  // Normalize topic against the canonical enum; fall back to 'other'
  const rawTopic = String(parsed.topic ?? 'other')
  const topic = isTopic(rawTopic) ? rawTopic : 'other'

  return {
    topic,
    topic_confidence: clamp01(Number(parsed.topic_confidence ?? 0)),
    format: (parsed.format as ClassificationResult['format']) ?? 'other',
    headless_or_face: (parsed.headless_or_face as ClassificationResult['headless_or_face']) ?? 'unknown',
    hook_style: (parsed.hook_style as ClassificationResult['hook_style']) ?? 'other',
    audio_used: (parsed.audio_used as ClassificationResult['audio_used']) ?? 'unknown',
    cta_pattern: (parsed.cta_pattern as ClassificationResult['cta_pattern']) ?? 'none',
    engagement_rate: Number(parsed.engagement_rate ?? 0),
    rationale: String(parsed.rationale ?? ''),
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function buildUserPrompt(post: {
  competitor: string
  source: string
  url: string | null
  data: Record<string, unknown>
}): string {
  const caption = String(post.data.caption ?? post.data.text ?? post.data.title ?? '').slice(0, 1200)
  const followers = Number(post.data.follower_count ?? post.data.followers ?? 0)
  const likes = Number(post.data.likes ?? post.data.like_count ?? 0)
  const comments = Number(post.data.comments ?? post.data.comment_count ?? 0)
  const shares = Number(post.data.shares ?? post.data.share_count ?? 0)
  const saves = Number(post.data.saves ?? post.data.save_count ?? 0)
  const engagement_rate = followers > 0 ? (likes + comments + shares + saves) / followers : 0

  return `Post by: ${post.competitor}
Platform/source: ${post.source}
URL: ${post.url ?? '(none)'}

Caption:
"""
${caption}
"""

Metrics:
- followers (account level): ${followers}
- likes: ${likes}
- comments: ${comments}
- shares: ${shares}
- saves: ${saves}
- computed engagement_rate: ${engagement_rate.toFixed(4)}

Classify this post per the system prompt. Output JSON only.`
}
