/**
 * Producer runtime executor cron.
 *
 * Picks up marketing_brain_actions rows in status='in_production', reads the
 * producer's SKILL.md from disk, calls the Anthropic Messages API with the
 * skill as the system prompt and the action payload as the user message,
 * captures the JSON output, and transitions the row to 'ready'.
 *
 * Safety rails:
 *   - Requires PRODUCER_RUNTIME_ENABLED=true in env or dryRun=true.
 *   - Per-row cost ceiling: $5.00 USD. Rows that would exceed it are skipped.
 *   - Per-run cost ceiling: $15.00 USD. Run halts when cumulative spend exceeds it.
 *   - Max 3 rows per run (configurable up to 5 via ?maxRows).
 *   - On 429 or billing error: flips row back to 'pending', sets
 *     requires_billing_action=true in producer_execution_failures.
 *   - On other errors: logs failure, leaves row in 'in_production' for retry.
 *
 * Idempotency: optimistic lock — UPDATE row only where status='in_production'.
 * A row claimed by a concurrent run is skipped cleanly.
 *
 * Schedule: every 30 minutes (see vercel.json).
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Manual invocation:
 *   GET /api/cron/producer-runtime
 *     ?maxRows=3   (default 3, max 5)
 *     &dryRun=true (returns candidates without executing)
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { createServiceClient } from '@/lib/supabase/service'

export const maxDuration = 300

const MODEL = 'claude-sonnet-4-5'
const INPUT_COST_PER_TOKEN = 0.000003   // $3.00 / 1M
const OUTPUT_COST_PER_TOKEN = 0.000015  // $15.00 / 1M
const PER_ROW_COST_CEILING_USD = 5.00
const PER_RUN_COST_CEILING_USD = 15.00
const DEFAULT_MAX_ROWS = 3
const HARD_MAX_ROWS = 5

interface RuntimeResult {
  action_id: string
  action_type: string
  producer_slug: string
  cost_usd: number
  input_tokens: number
  output_tokens: number
  new_status: string
}

interface RuntimeError {
  action_id: string
  phase: string
  error: string
  requires_billing_action: boolean
}

function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

async function logCost(
  supabase: ReturnType<typeof createServiceClient>,
  actionId: string,
  costUsd: number,
  meta: Record<string, unknown>,
) {
  await supabase.from('marketing_cost_ledger').insert({
    action_id: actionId,
    cost_type: 'anthropic_tokens',
    amount_usd: costUsd,
    metadata: meta,
    recorded_at: new Date().toISOString(),
  })
}

async function logFailure(
  supabase: ReturnType<typeof createServiceClient>,
  actionId: string,
  producerSlug: string,
  phase: string,
  errorMessage: string,
  requiresBillingAction: boolean,
  retryCount: number,
) {
  await supabase.from('producer_execution_failures').insert({
    action_id: actionId,
    producer_slug: producerSlug,
    phase,
    error_message: errorMessage,
    occurred_at: new Date().toISOString(),
    retry_count: retryCount,
    requires_billing_action: requiresBillingAction,
  })
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const maxRowsParam = url.searchParams.get('maxRows')
  const maxRows = maxRowsParam
    ? Math.min(HARD_MAX_ROWS, Math.max(1, parseInt(maxRowsParam, 10) || DEFAULT_MAX_ROWS))
    : DEFAULT_MAX_ROWS

  const enabled = process.env.PRODUCER_RUNTIME_ENABLED === 'true'
  if (!enabled && !dryRun) {
    return NextResponse.json({
      skipped: true,
      reason: 'PRODUCER_RUNTIME_ENABLED is not set to true. Pass ?dryRun=true to preview candidates.',
    })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey && !dryRun) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const startedAt = new Date().toISOString()
  const supabase = createServiceClient()

  const { data: candidates, error: fetchErr } = await supabase
    .from('marketing_brain_actions')
    .select('id, action_type, assigned_producer, payload, executor_response')
    .eq('status', 'in_production')
    .order('executed_at', { ascending: true, nullsFirst: false })
    .limit(maxRows)

  if (fetchErr) {
    console.error('[producer-runtime] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const rows = candidates ?? []

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      candidates: rows.map((r) => ({
        id: r.id,
        action_type: r.action_type,
        assigned_producer: r.assigned_producer,
      })),
      startedAt,
    })
  }

  const client = new Anthropic({ apiKey: anthropicKey })
  const executed: RuntimeResult[] = []
  const errors: RuntimeError[] = []
  let runCumulativeCostUsd = 0

  for (const row of rows) {
    if (runCumulativeCostUsd >= PER_RUN_COST_CEILING_USD) {
      console.warn(`[producer-runtime] run cost ceiling $${PER_RUN_COST_CEILING_USD} reached, halting`)
      break
    }

    const producerSlug = row.assigned_producer ?? 'unknown'
    const skillPath = path.join(process.cwd(), producerSlug, 'SKILL.md')

    let skillContent: string
    try {
      skillContent = fs.readFileSync(skillPath, 'utf-8')
    } catch {
      const msg = `SKILL.md not found at ${skillPath}`
      console.error(`[producer-runtime] ${msg}`)
      await logFailure(supabase, row.id, producerSlug, 'skill_load', msg, false, 0)
      errors.push({ action_id: row.id, phase: 'skill_load', error: msg, requires_billing_action: false })
      continue
    }

    const systemPrompt = `${skillContent}

---

You are executing this producer recipe for a specific action row. Read the recipe above carefully, then produce the required output as a valid JSON object with no markdown fences or surrounding text. The object must include:
- draft_summary: string (1-3 sentences describing what was produced)
- draft_path: string (where to find the draft, e.g. out/<action_id>/draft.html or "inline")
- citations: array of objects each with {figure, source, table_or_endpoint, filter, value, fetched_at}
- scorecard: object with keys matching the viral scorecard categories and numeric scores 1-10
- publish_payload: object with at minimum {action_type, caption, platforms: string[]} and any platform-specific fields the producer recipe requires
- contact_sheet_path: string (path to HTML contact sheet or "inline")

If you cannot complete a step, write your best attempt and note the gap in draft_summary. Never return raw markdown outside the JSON structure.`

    const userMessage = JSON.stringify({
      action_id: row.id,
      action_type: row.action_type,
      payload: row.payload ?? {},
    })

    let response: Anthropic.Message
    let inputTokens = 0
    let outputTokens = 0
    let costUsd = 0

    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      })

      inputTokens = response.usage.input_tokens
      outputTokens = response.usage.output_tokens
      costUsd = computeCostUsd(inputTokens, outputTokens)

      if (costUsd > PER_ROW_COST_CEILING_USD) {
        const msg = `Row cost $${costUsd.toFixed(4)} exceeds per-row ceiling $${PER_ROW_COST_CEILING_USD}`
        console.warn(`[producer-runtime] ${row.id}: ${msg}`)
        await logFailure(supabase, row.id, producerSlug, 'cost_ceiling', msg, false, 0)
        await logCost(supabase, row.id, costUsd, { model: MODEL, input_tokens: inputTokens, output_tokens: outputTokens, action_phase: 'execute', over_ceiling: true })
        runCumulativeCostUsd += costUsd
        errors.push({ action_id: row.id, phase: 'cost_ceiling', error: msg, requires_billing_action: false })
        continue
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const isBilling = errMsg.includes('429') || errMsg.toLowerCase().includes('credit') || errMsg.toLowerCase().includes('billing')
      console.error(`[producer-runtime] anthropic error for ${row.id}:`, errMsg)

      await logFailure(supabase, row.id, producerSlug, 'anthropic_call', errMsg, isBilling, 0)

      if (isBilling) {
        // Flip back to pending so the dispatcher can re-queue after billing is resolved.
        await supabase
          .from('marketing_brain_actions')
          .update({ status: 'pending', executor_response: null })
          .eq('id', row.id)
          .eq('status', 'in_production')
      }

      errors.push({ action_id: row.id, phase: 'anthropic_call', error: errMsg, requires_billing_action: isBilling })
      continue
    }

    // Parse the JSON output from the model.
    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('')

    let producerOutput: Record<string, unknown>
    try {
      const stripped = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      producerOutput = JSON.parse(stripped)
    } catch {
      const msg = 'Producer output is not valid JSON'
      console.error(`[producer-runtime] parse error for ${row.id}: ${rawText.slice(0, 200)}`)
      await logCost(supabase, row.id, costUsd, { model: MODEL, input_tokens: inputTokens, output_tokens: outputTokens, action_phase: 'execute', parse_error: true })
      await logFailure(supabase, row.id, producerSlug, 'output_parse', msg, false, 0)
      runCumulativeCostUsd += costUsd
      errors.push({ action_id: row.id, phase: 'output_parse', error: msg, requires_billing_action: false })
      continue
    }

    // Merge executor_response: preserve existing envelope from dispatcher.
    const existingEnvelope = (row.executor_response ?? {}) as Record<string, unknown>
    const updatedEnvelope: Record<string, unknown> = {
      ...existingEnvelope,
      producer_output: producerOutput,
      publish_payload: producerOutput.publish_payload ?? null,
      draft_path: producerOutput.draft_path ?? null,
      draft_summary: producerOutput.draft_summary ?? null,
      citations: producerOutput.citations ?? [],
      scorecard: producerOutput.scorecard ?? {},
      contact_sheet_path: producerOutput.contact_sheet_path ?? null,
      completed_at: new Date().toISOString(),
      model: MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    }

    // Optimistic lock: only flip rows still in 'in_production'.
    const { data: updated, error: updateErr } = await supabase
      .from('marketing_brain_actions')
      .update({
        status: 'ready',
        executor_response: updatedEnvelope,
      })
      .eq('id', row.id)
      .eq('status', 'in_production')
      .select('id')

    if (updateErr) {
      console.error(`[producer-runtime] update error for ${row.id}:`, updateErr.message)
      await logCost(supabase, row.id, costUsd, { model: MODEL, input_tokens: inputTokens, output_tokens: outputTokens, action_phase: 'execute', update_error: updateErr.message })
      runCumulativeCostUsd += costUsd
      errors.push({ action_id: row.id, phase: 'status_update', error: updateErr.message, requires_billing_action: false })
      continue
    }

    if (!updated || updated.length === 0) {
      // Row was claimed concurrently between our SELECT and UPDATE.
      runCumulativeCostUsd += costUsd
      errors.push({ action_id: row.id, phase: 'status_update', error: 'already_claimed_by_concurrent_run', requires_billing_action: false })
      continue
    }

    await logCost(supabase, row.id, costUsd, {
      model: MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      action_phase: 'execute',
    })

    runCumulativeCostUsd += costUsd
    executed.push({
      action_id: row.id,
      action_type: row.action_type,
      producer_slug: producerSlug,
      cost_usd: costUsd,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      new_status: 'ready',
    })
  }

  return NextResponse.json({
    startedAt,
    candidates_found: rows.length,
    executed_count: executed.length,
    error_count: errors.length,
    run_cost_usd: runCumulativeCostUsd,
    executed,
    errors,
    note: "Rows transitioned to 'ready'. Matt must approve before publisher-sweep will publish.",
  })
}
