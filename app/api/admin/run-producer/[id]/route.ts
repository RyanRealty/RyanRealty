/**
 * POST /api/admin/run-producer/[id]
 *
 * One-shot manual trigger for a single marketing_brain_actions row.
 * Executes the producer recipe via the Anthropic Messages API and
 * transitions the row to 'ready'. Identical logic to the producer-runtime
 * cron but processes exactly one row and requires admin cookie auth.
 *
 * The row must be in 'pending' or 'in_production' status. If it is
 * 'pending', this route transitions it to 'in_production' first, then
 * executes. If it is already 'in_production', it executes directly.
 *
 * Returns:
 *   { ok: true, action_id, new_status, cost_usd, input_tokens, output_tokens }
 * on success, or { error, requires_billing_action } on failure.
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'

const MODEL = 'claude-sonnet-4-5'
const INPUT_COST_PER_TOKEN = 0.000003
const OUTPUT_COST_PER_TOKEN = 0.000015
const PER_ROW_COST_CEILING_USD = 5.00

function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Admin cookie auth.
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const adminRole = await getAdminRoleForEmail(user.email)
  if (!adminRole) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const { id } = await params
  const service = createServiceClient()

  // Fetch the row.
  const { data: row, error: fetchErr } = await service
    .from('marketing_brain_actions')
    .select('id, action_type, assigned_producer, payload, executor_response, status')
    .eq('id', id)
    .single()

  if (fetchErr || !row) {
    return NextResponse.json({ error: fetchErr?.message ?? 'Row not found' }, { status: 404 })
  }

  if (row.status !== 'pending' && row.status !== 'in_production') {
    return NextResponse.json(
      { error: `Row is in status '${row.status}'. Only pending or in_production rows can be executed manually.` },
      { status: 409 },
    )
  }

  // If pending, transition to in_production first.
  if (row.status === 'pending') {
    const queuedAt = new Date().toISOString()
    const producerPath = row.assigned_producer ?? 'unknown'
    const { error: transErr } = await service
      .from('marketing_brain_actions')
      .update({
        status: 'in_production',
        executed_at: queuedAt,
        executor_response: {
          dispatch_status: 'queued_by_admin',
          queued_at: queuedAt,
          ready_for_runtime: true,
          runtime_invocation_command: `manual via /api/admin/run-producer/${id}`,
          runtime_invocation_command_alt: `cd /Users/matthewryan/RyanRealty && claude --skill ${producerPath} --action-row-id ${id}`,
        },
      })
      .eq('id', id)
      .eq('status', 'pending')

    if (transErr) {
      return NextResponse.json({ error: transErr.message }, { status: 500 })
    }
  }

  const producerSlug = row.assigned_producer ?? 'unknown'
  const skillPath = path.join(process.cwd(), producerSlug, 'SKILL.md')

  let skillContent: string
  try {
    skillContent = fs.readFileSync(skillPath, 'utf-8')
  } catch {
    const msg = `SKILL.md not found at ${skillPath}`
    await service.from('producer_execution_failures').insert({
      action_id: id,
      producer_slug: producerSlug,
      phase: 'skill_load',
      error_message: msg,
      occurred_at: new Date().toISOString(),
      retry_count: 0,
      requires_billing_action: false,
    })
    return NextResponse.json({ error: msg }, { status: 422 })
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

  const client = new Anthropic({ apiKey: anthropicKey })
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
    const isBilling = errMsg.includes('429') || errMsg.toLowerCase().includes('credit') || errMsg.toLowerCase().includes('billing')

    await service.from('producer_execution_failures').insert({
      action_id: id,
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
        .eq('id', id)
        .eq('status', 'in_production')
    }

    return NextResponse.json({ error: errMsg, requires_billing_action: isBilling }, { status: 502 })
  }

  const costUsd = computeCostUsd(inputTokens, outputTokens)

  if (costUsd > PER_ROW_COST_CEILING_USD) {
    const msg = `Row cost $${costUsd.toFixed(4)} exceeds per-row ceiling $${PER_ROW_COST_CEILING_USD}`
    await service.from('marketing_cost_ledger').insert({
      action_id: id,
      cost_type: 'anthropic_tokens',
      amount_usd: costUsd,
      metadata: { model: MODEL, input_tokens: inputTokens, output_tokens: outputTokens, action_phase: 'manual_execute', over_ceiling: true },
      recorded_at: new Date().toISOString(),
    })
    await service.from('producer_execution_failures').insert({
      action_id: id,
      producer_slug: producerSlug,
      phase: 'cost_ceiling',
      error_message: msg,
      occurred_at: new Date().toISOString(),
      retry_count: 0,
      requires_billing_action: false,
    })
    return NextResponse.json({ error: msg }, { status: 422 })
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
      action_id: id,
      producer_slug: producerSlug,
      phase: 'output_parse',
      error_message: msg,
      occurred_at: new Date().toISOString(),
      retry_count: 0,
      requires_billing_action: false,
    })
    await service.from('marketing_cost_ledger').insert({
      action_id: id,
      cost_type: 'anthropic_tokens',
      amount_usd: costUsd,
      metadata: { model: MODEL, input_tokens: inputTokens, output_tokens: outputTokens, action_phase: 'manual_execute', parse_error: true },
      recorded_at: new Date().toISOString(),
    })
    return NextResponse.json({ error: msg, raw_preview: rawText.slice(0, 300) }, { status: 422 })
  }

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
    triggered_by: 'admin_manual',
  }

  const { error: updateErr } = await service
    .from('marketing_brain_actions')
    .update({ status: 'ready', executor_response: updatedEnvelope })
    .eq('id', id)
    .eq('status', 'in_production')

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  await service.from('marketing_cost_ledger').insert({
    action_id: id,
    cost_type: 'anthropic_tokens',
    amount_usd: costUsd,
    metadata: { model: MODEL, input_tokens: inputTokens, output_tokens: outputTokens, action_phase: 'manual_execute' },
    recorded_at: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: true,
    action_id: id,
    new_status: 'ready',
    cost_usd: costUsd,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    draft_summary: producerOutput.draft_summary ?? null,
  })
}
