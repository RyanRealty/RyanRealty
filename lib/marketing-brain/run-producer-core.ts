/**
 * lib/marketing-brain/run-producer-core.ts
 *
 * R3.1 (docs/plans/BROKER_SMS_AGENT_2026-07-31.md) extraction: the "read one
 * marketing_brain_actions row, classify its producer, execute it, flip to
 * ready" logic used to live only inside
 * app/api/admin/run-producer/[id]/route.ts. The broker SMS agent's
 * run_now/revise_action tools (lib/agent/tools/produce.ts) need to run a text
 * producer IN-PROCESS — no waiting for the hourly producer-runtime cron
 * (vercel.json) — with the exact same anti-fabrication contract the admin
 * manual-run already enforces (lib/marketing-brain/producer-output-class.ts:
 * visual/unknown producers defer to the local render worker, text producers
 * get the hardened payload-only prompt). Rather than a second copy of that
 * logic, both callers share this one function.
 *
 * NO BEHAVIOR CHANGE from the pre-extraction admin route: identical cost
 * ceiling, identical failure logging, identical envelope shape, identical
 * deliverable persistence. `opts.triggeredBy` replaces the route's hardcoded
 * 'admin_manual' tag so a broker-SMS-triggered run records who actually
 * asked for it (cost ledger metadata.action_phase, executor_response.
 * triggered_by).
 *
 * Callers are responsible for their OWN precondition/auth/transition-to-
 * in_production logic before calling this — it re-fetches and re-validates
 * the row's status itself (pending or in_production only) as a second,
 * cheap safety net, never as the sole gate.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createAnthropic, PRODUCER_MODEL, modelCostUsd } from '@/lib/ai/anthropic'
import { createServiceClient } from '@/lib/supabase/service'
import { persistDeliverable, resolveBrokerSlugForAction } from '@/lib/marketing-brain/deliverable-library'
import {
  classifyProducerFromDisk,
  canCloudComplete,
  buildTextProducerSystemPrompt,
  buildVisualDeferralEnvelope,
} from '@/lib/marketing-brain/producer-output-class'

const MODEL = PRODUCER_MODEL
const PER_ROW_COST_CEILING_USD = 5.00

function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return modelCostUsd(MODEL, inputTokens, outputTokens)
}

export interface RunProducerRowOptions {
  /** Who asked for this execution — recorded in executor_response.triggered_by
   *  and the cost-ledger metadata.action_phase (e.g. 'admin_manual', 'broker_sms'). */
  triggeredBy: string
}

export interface RunProducerRowResult {
  ok: boolean
  /** Present on success: 'ready' (text, completed) or 'in_production' (visual, deferred). */
  newStatus?: string
  /** True when a visual/unknown producer was deferred to the local render worker. */
  deferred?: boolean
  error?: string
  requiresBillingAction?: boolean
  costUsd?: number
  inputTokens?: number
  outputTokens?: number
  /** Only populated on a completed TEXT run — what produce.ts's run_now texts back. */
  draftSummary?: string | null
  deliverableText?: string | null
  citations?: unknown[]
}

/**
 * Execute exactly ONE marketing_brain_actions row already in 'pending' or
 * 'in_production'. Visual/unknown producers are deferred to the local render
 * worker (executor_response.deferred_to_local_render=true, row stays
 * in_production, no Anthropic call — no fabricated draft_path/citations/
 * scorecard for a deliverable that was never rendered, CLAUDE.md §0). Text
 * producers call the Anthropic Messages API with the hardened payload-only
 * prompt (buildTextProducerSystemPrompt) and flip to 'ready'.
 */
export async function runProducerRow(
  actionId: string,
  opts: RunProducerRowOptions = { triggeredBy: 'unknown' },
): Promise<RunProducerRowResult> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return { ok: false, error: 'ANTHROPIC_API_KEY is not configured' }

  const service = createServiceClient()

  const { data: row, error: fetchErr } = await service
    .from('marketing_brain_actions')
    .select('id, action_type, assigned_producer, payload, executor_response, status')
    .eq('id', actionId)
    .single()

  if (fetchErr || !row) {
    return { ok: false, error: fetchErr?.message ?? 'Row not found' }
  }

  if (row.status !== 'pending' && row.status !== 'in_production') {
    return {
      ok: false,
      error: `Row is in status '${row.status}'. Only pending or in_production rows can be executed.`,
    }
  }

  const producerSlug = row.assigned_producer ?? 'unknown'

  // Classify from output_type. Visual producers cannot be rendered in this
  // runtime — refuse rather than let the model fabricate a draft_path +
  // citations + scorecard for a deliverable that was never created
  // (CLAUDE.md §0). They are deferred to the local render worker.
  let cls: ReturnType<typeof classifyProducerFromDisk>['cls']
  let skillContent: string
  try {
    const res = classifyProducerFromDisk(producerSlug, process.cwd())
    cls = res.cls
    skillContent = res.skillContent
  } catch {
    const msg = `SKILL.md not found for producer ${producerSlug}`
    await service.from('producer_execution_failures').insert({
      action_id: actionId,
      producer_slug: producerSlug,
      phase: 'skill_load',
      error_message: msg,
      occurred_at: new Date().toISOString(),
      retry_count: 0,
      requires_billing_action: false,
    })
    return { ok: false, error: msg }
  }

  if (!canCloudComplete(cls)) {
    const deferEnvelope = buildVisualDeferralEnvelope(
      (row.executor_response ?? {}) as Record<string, unknown>,
      cls,
      producerSlug,
    )
    await service
      .from('marketing_brain_actions')
      .update({ executor_response: deferEnvelope })
      .eq('id', actionId)
      .eq('status', 'in_production')
    return { ok: true, deferred: true, newStatus: 'in_production' }
  }

  // Text producer: hardened prompt — figures come from the (already verified)
  // payload, never invented; citations trace to payload provenance.
  const systemPrompt = buildTextProducerSystemPrompt(skillContent)

  const userMessage = JSON.stringify({
    action_id: row.id,
    action_type: row.action_type,
    payload: row.payload ?? {},
  })

  const client = createAnthropic(anthropicKey)
  let response: Anthropic.Message
  let inputTokens = 0
  let outputTokens = 0

  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    inputTokens = response.usage.input_tokens
    outputTokens = response.usage.output_tokens
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const isBilling =
      errMsg.includes('429') ||
      errMsg.toLowerCase().includes('credit') ||
      errMsg.toLowerCase().includes('billing')

    await service.from('producer_execution_failures').insert({
      action_id: actionId,
      producer_slug: producerSlug,
      phase: 'anthropic_call',
      error_message: errMsg,
      occurred_at: new Date().toISOString(),
      retry_count: 0,
      requires_billing_action: isBilling,
    })

    if (isBilling) {
      await service
        .from('marketing_brain_actions')
        .update({ status: 'pending', executor_response: null })
        .eq('id', actionId)
        .eq('status', 'in_production')
    }

    return { ok: false, error: errMsg, requiresBillingAction: isBilling }
  }

  const costUsd = computeCostUsd(inputTokens, outputTokens)

  if (costUsd > PER_ROW_COST_CEILING_USD) {
    const msg = `Row cost $${costUsd.toFixed(4)} exceeds per-row ceiling $${PER_ROW_COST_CEILING_USD}`
    await service.from('marketing_cost_ledger').insert({
      action_id: actionId,
      cost_type: 'anthropic_tokens',
      amount_usd: costUsd,
      metadata: {
        model: MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        action_phase: opts.triggeredBy,
        over_ceiling: true,
      },
      recorded_at: new Date().toISOString(),
    })
    await service.from('producer_execution_failures').insert({
      action_id: actionId,
      producer_slug: producerSlug,
      phase: 'cost_ceiling',
      error_message: msg,
      occurred_at: new Date().toISOString(),
      retry_count: 0,
      requires_billing_action: false,
    })
    return { ok: false, error: msg, costUsd, inputTokens, outputTokens }
  }

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
    await service.from('producer_execution_failures').insert({
      action_id: actionId,
      producer_slug: producerSlug,
      phase: 'output_parse',
      error_message: msg,
      occurred_at: new Date().toISOString(),
      retry_count: 0,
      requires_billing_action: false,
    })
    await service.from('marketing_cost_ledger').insert({
      action_id: actionId,
      cost_type: 'anthropic_tokens',
      amount_usd: costUsd,
      metadata: {
        model: MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        action_phase: opts.triggeredBy,
        parse_error: true,
      },
      recorded_at: new Date().toISOString(),
    })
    return { ok: false, error: msg, costUsd, inputTokens, outputTokens }
  }

  // Only TEXT producers reach here (visual deferred above). The deliverable is
  // the inline text — no rendered file, so no draft_path / scorecard.
  const existingEnvelope = (row.executor_response ?? {}) as Record<string, unknown>
  const updatedEnvelope: Record<string, unknown> = {
    ...existingEnvelope,
    producer_output: producerOutput,
    output_class: 'text',
    deliverable_text: producerOutput.deliverable_text ?? null,
    publish_payload: producerOutput.publish_payload ?? null,
    draft_summary: producerOutput.draft_summary ?? null,
    citations: producerOutput.citations ?? [],
    needs_render: false,
    completed_at: new Date().toISOString(),
    model: MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    triggered_by: opts.triggeredBy,
  }

  const { error: updateErr } = await service
    .from('marketing_brain_actions')
    .update({ status: 'ready', executor_response: updatedEnvelope })
    .eq('id', actionId)
    .eq('status', 'in_production')

  if (updateErr) return { ok: false, error: updateErr.message, costUsd, inputTokens, outputTokens }

  // W10.2 — persist the finished deliverable into the requesting broker's
  // library so it outlives this run. Advisory: the producer run already
  // succeeded, so a storage failure is logged, never surfaced as a failure.
  try {
    const brokerSlug = await resolveBrokerSlugForAction(actionId)
    const persisted = await persistDeliverable({
      actionId,
      brokerSlug,
      filename: `${String(row.action_type).replace(/[^a-z0-9]+/gi, '-')}.json`,
      // Whole envelope — a fixed key list dropped content:cma output before.
      body: JSON.stringify({ action_type: row.action_type, ...updatedEnvelope }, null, 2),
      contentType: 'application/json',
    })
    if (!persisted.ok) console.error('[run-producer-core] deliverable persist failed:', persisted.error)
  } catch (err) {
    console.error('[run-producer-core] deliverable persist threw:', err)
  }

  await service.from('marketing_cost_ledger').insert({
    action_id: actionId,
    cost_type: 'anthropic_tokens',
    amount_usd: costUsd,
    metadata: {
      model: MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      action_phase: opts.triggeredBy,
    },
    recorded_at: new Date().toISOString(),
  })

  return {
    ok: true,
    newStatus: 'ready',
    costUsd,
    inputTokens,
    outputTokens,
    draftSummary: (producerOutput.draft_summary as string | null | undefined) ?? null,
    deliverableText: (producerOutput.deliverable_text as string | null | undefined) ?? null,
    citations: Array.isArray(producerOutput.citations) ? (producerOutput.citations as unknown[]) : [],
  }
}
