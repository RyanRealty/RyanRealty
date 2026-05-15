/**
 * marketing-brain: daily-digest
 *
 * Composes a daily summary of brain activity and inserts a single
 * `comms:matt_summary` action row into `marketing_brain_actions`. The
 * comms-matt-alert producer (already authored) picks it up and routes
 * to email + dashboard_card by default. The brain may override `channel`
 * in the payload to force iMessage for urgent days.
 *
 * Scope (Brain Architecture session): this module ONLY composes the
 * summary and writes the action row. Actual delivery (email send,
 * iMessage MCP call, dashboard render) is the comms-matt-alert
 * producer's job — see marketing_brain_skills/producers/comms-matt-alert/SKILL.md.
 *
 * Triggered by /api/cron/marketing-daily-digest at 14:00 UTC daily.
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

export interface DigestStats {
  pending_total: number
  pending_by_category: Record<string, number>
  ready_total: number
  approved_in_last_24h: number
  executed_in_last_24h: number
  killed_in_last_24h: number
  voice_failures_in_last_7d: number
  top_pending_action_ids: string[]
  latest_audit: LatestAuditSummary | null
}

/**
 * Subset of the latest analyze:audit_findings payload — shown in the daily
 * digest so Matt sees producer gaps as they accumulate from each audit cycle.
 */
export interface LatestAuditSummary {
  audit_id: string
  age_days: number
  missing_producers_count: number
  top_missing_skill_names: string[]
  top_winners_count: number
}

export interface DailyDigestReport {
  digest_id: string                    // ISO date — one digest per day
  generated_at: string                 // ISO timestamp
  stats: DigestStats
  summary_markdown: string             // For dashboard render
  summary_short: string                // Under 320 chars for iMessage
  action_row_id: string | null         // ID of the inserted comms:matt_summary row
}

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export interface RunDailyDigestOptions {
  asOfDate?: string                     // YYYY-MM-DD; defaults to today UTC
  dryRun?: boolean                      // If true, returns the digest without writing
  forceImessage?: boolean               // If true, sets channel='imessage' on the action row
}

/**
 * Run the daily digest. Reads recent action-row activity, composes
 * markdown + short-form summaries, inserts one comms:matt_summary row.
 * Returns the full report.
 */
export async function runDailyDigest(opts: RunDailyDigestOptions = {}): Promise<DailyDigestReport> {
  const asOfDate = opts.asOfDate ?? new Date().toISOString().slice(0, 10)
  const generatedAt = new Date().toISOString()
  const stats = await gatherDigestStats()

  const summary_markdown = composeMarkdownDigest(asOfDate, stats)
  const summary_short = composeShortDigest(asOfDate, stats)

  let actionRowId: string | null = null
  if (!opts.dryRun) {
    actionRowId = await insertDigestActionRow(asOfDate, summary_markdown, summary_short, stats, opts.forceImessage ?? false)
  }

  return {
    digest_id: asOfDate,
    generated_at: generatedAt,
    stats,
    summary_markdown,
    summary_short,
    action_row_id: actionRowId,
  }
}

// ---------------------------------------------------------------------------
// gatherDigestStats — counts + top pending items
// ---------------------------------------------------------------------------

export async function gatherDigestStats(): Promise<DigestStats> {
  const supabase = getSupabase()
  const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  // Pull all pending action rows
  const pendingRes = await supabase
    .from('marketing_brain_actions')
    .select('id, action_type, target, created_at, generation_reason')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200)

  const pending = (pendingRes.data ?? []) as Array<{ id: string; action_type: string; target: string; created_at: string; generation_reason: string | null }>

  const pendingByCategory: Record<string, number> = {}
  for (const row of pending) {
    const prefix = row.action_type.split(':')[0] || 'unknown'
    pendingByCategory[prefix] = (pendingByCategory[prefix] ?? 0) + 1
  }

  // Pull ready / approved / executed / killed counts
  const [readyRes, approvedRes, executedRes, killedRes, voiceFailRes] = await Promise.all([
    supabase.from('marketing_brain_actions').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
    supabase.from('marketing_brain_actions').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('approved_at', oneDayAgo),
    supabase.from('marketing_brain_actions').select('id', { count: 'exact', head: true }).eq('status', 'executed').gte('executed_at', oneDayAgo),
    supabase.from('marketing_brain_actions').select('id', { count: 'exact', head: true }).eq('status', 'killed').gte('updated_at', oneDayAgo),
    supabase.from('marketing_decisions').select('id', { count: 'exact', head: true }).eq('decision_type', 'voice_violation').gte('created_at', sevenDaysAgo),
  ])

  // Pull the latest audit-findings payload (if any audit has run)
  const auditRes = await supabase
    .from('marketing_brain_actions')
    .select('payload, created_at')
    .eq('action_type', 'analyze:audit_findings')
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let latestAudit: LatestAuditSummary | null = null
  if (auditRes.data?.payload) {
    const payload = auditRes.data.payload as Record<string, unknown>
    const missing = (payload.missing_producers as Array<Record<string, unknown>> | undefined) ?? []
    const winners = (payload.top_winners_by_topic_format as unknown[] | undefined) ?? []
    const ageMs = Date.now() - Date.parse(String(auditRes.data.created_at ?? ''))
    latestAudit = {
      audit_id: String(payload.audit_id ?? ''),
      age_days: Math.floor(ageMs / 86_400_000),
      missing_producers_count: missing.length,
      top_missing_skill_names: missing
        .slice()
        .sort((a, b) => {
          const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
          return (order[String(a.priority ?? 'low')] ?? 3) - (order[String(b.priority ?? 'low')] ?? 3)
        })
        .slice(0, 5)
        .map((m) => String(m.proposed_skill_name ?? '(unnamed)')),
      top_winners_count: winners.length,
    }
  }

  return {
    pending_total: pending.length,
    pending_by_category: pendingByCategory,
    ready_total: readyRes.count ?? 0,
    approved_in_last_24h: approvedRes.count ?? 0,
    executed_in_last_24h: executedRes.count ?? 0,
    killed_in_last_24h: killedRes.count ?? 0,
    voice_failures_in_last_7d: voiceFailRes.count ?? 0,
    top_pending_action_ids: pending.slice(0, 5).map((r) => r.id),
    latest_audit: latestAudit,
  }
}

// ---------------------------------------------------------------------------
// composeMarkdownDigest — full body for dashboard / email
// ---------------------------------------------------------------------------

export function composeMarkdownDigest(asOfDate: string, stats: DigestStats): string {
  const lines: string[] = []
  lines.push(`# Ryan Realty marketing brain — daily digest`)
  lines.push(`${asOfDate}`)
  lines.push(``)
  lines.push(`## Queue state`)
  lines.push(``)
  lines.push(`- Pending action rows: **${stats.pending_total}**`)

  const order = ['content', 'site', 'ops', 'analyze', 'comms']
  for (const prefix of order) {
    const count = stats.pending_by_category[prefix] ?? 0
    if (count > 0) {
      lines.push(`  - ${prefix}: ${count}`)
    }
  }
  // Surface any prefixes not in the standard order
  for (const [prefix, count] of Object.entries(stats.pending_by_category)) {
    if (!order.includes(prefix) && count > 0) {
      lines.push(`  - ${prefix}: ${count}`)
    }
  }

  lines.push(``)
  lines.push(`- Ready for review: **${stats.ready_total}**`)
  lines.push(`- Approved (last 24h): ${stats.approved_in_last_24h}`)
  lines.push(`- Executed (last 24h): ${stats.executed_in_last_24h}`)
  lines.push(`- Killed (last 24h): ${stats.killed_in_last_24h}`)
  lines.push(``)

  if (stats.voice_failures_in_last_7d > 0) {
    lines.push(`## Voice failures (last 7 days)`)
    lines.push(``)
    lines.push(`${stats.voice_failures_in_last_7d} brief(s) flagged for voice violations. Review in marketing_decisions.`)
    lines.push(``)
  }

  if (stats.top_pending_action_ids.length > 0) {
    lines.push(`## Top pending action ids`)
    lines.push(``)
    for (const id of stats.top_pending_action_ids) {
      lines.push(`- ${id}`)
    }
    lines.push(``)
  }

  if (stats.latest_audit) {
    const a = stats.latest_audit
    lines.push(`## Latest competitive audit (${a.audit_id}, ${a.age_days}d ago)`)
    lines.push(``)
    lines.push(`- **Producer gaps surfaced:** ${a.missing_producers_count}`)
    lines.push(`- **Winning topic × format combos:** ${a.top_winners_count}`)
    if (a.top_missing_skill_names.length > 0) {
      lines.push(`- **Top missing skills to author** (Producer Authoring queue):`)
      for (const name of a.top_missing_skill_names) {
        lines.push(`  - \`${name}\``)
      }
    }
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(``)
  lines.push(`Generated by /api/cron/marketing-daily-digest. Full queue at the marketing dashboard.`)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// composeShortDigest — under 320 chars for iMessage
// ---------------------------------------------------------------------------

export function composeShortDigest(asOfDate: string, stats: DigestStats): string {
  const counts = ['content', 'site', 'ops']
    .map((p) => stats.pending_by_category[p] ?? 0)
    .reduce((sum, n) => sum + n, 0)

  const parts = [
    `Brain ${asOfDate}:`,
    `${stats.pending_total} pending (${counts} actionable)`,
    stats.ready_total > 0 ? `${stats.ready_total} ready` : null,
    stats.approved_in_last_24h > 0 ? `${stats.approved_in_last_24h} approved 24h` : null,
    stats.voice_failures_in_last_7d > 0 ? `${stats.voice_failures_in_last_7d} voice fails 7d` : null,
    stats.latest_audit && stats.latest_audit.missing_producers_count > 0
      ? `Audit ${stats.latest_audit.audit_id}: ${stats.latest_audit.missing_producers_count} producer gaps`
      : null,
  ].filter((p): p is string => p !== null)

  const short = parts.join(' · ')
  return short.length > 320 ? short.slice(0, 317) + '...' : short
}

// ---------------------------------------------------------------------------
// insertDigestActionRow
// ---------------------------------------------------------------------------

async function insertDigestActionRow(
  asOfDate: string,
  summaryMarkdown: string,
  summaryShort: string,
  stats: DigestStats,
  forceImessage: boolean,
): Promise<string | null> {
  const supabase = getSupabase()
  // Per comms-matt-alert SKILL.md: subject <60 chars, body holds full text.
  // Default channel for summary urgency is email + dashboard_card; brain
  // forces iMessage only when forceImessage is set (e.g. major signal day).
  const channel = forceImessage ? 'imessage' : 'email'

  const { data, error } = await supabase
    .from('marketing_brain_actions')
    .insert({
      action_type: 'comms:matt_summary',
      target: `recipient:matt:daily_digest:${asOfDate}`,
      assigned_producer: 'marketing_brain_skills/producers/comms-matt-alert',
      payload: {
        urgency: 'summary',
        channel,
        subject: `Brain digest ${asOfDate}`,
        body: summaryMarkdown,
        body_short: summaryShort,
        related_action_ids: stats.top_pending_action_ids,
      },
      data_evidence: {
        audit_source: 'daily-digest',
        trigger_metric: 'pending_action_rows',
        trigger_value: stats.pending_total,
      },
      topic: `Daily digest ${asOfDate}`,
      format: 'comms_matt_summary',
      platforms: [channel],
      hook: summaryShort,
      body: summaryMarkdown,
      cta: null,
      target_audience: 'matt',
      data_sources: [
        { type: 'daily-digest', evidence: `${stats.pending_total} pending action rows; ${stats.ready_total} ready; ${stats.approved_in_last_24h} approved in last 24h.` },
      ],
      predicted_outcome: {
        primary_metric: 'queue_review_latency',
        expected_value: 'Matt sees current queue state every morning',
        rationale: 'Daily summary keeps queue review on-cadence; without it the queue grows silently.',
      },
      status: 'pending',
      generated_by: 'marketing_brain:daily-digest',
      generation_reason: `Daily digest for ${asOfDate}. ${stats.pending_total} pending rows summarized.`,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('insertDigestActionRow:', error?.message ?? 'no row returned')
    return null
  }

  return data.id as string
}
