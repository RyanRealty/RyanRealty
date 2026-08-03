/**
 * POST /api/admin/run-producer/[id]
 *
 * One-shot manual trigger for a single marketing_brain_actions row.
 *
 * R3.1 (docs/plans/BROKER_SMS_AGENT_2026-07-31.md): the actual "classify ->
 * execute via the Anthropic Messages API -> transition to 'ready'" logic
 * moved to lib/marketing-brain/run-producer-core.ts (runProducerRow), shared
 * with the broker SMS agent's run_now/revise_action tools. This route is now
 * just admin auth + the pending/in_production status precondition + the
 * one-shot dispatch envelope + the runProducerRow call. NO behavior change
 * from the pre-extraction version.
 *
 * The row must be in 'pending' or 'in_production' status. If it is
 * 'pending', this route transitions it to 'in_production' first, then
 * executes.
 *
 * Returns:
 *   { ok: true, action_id, new_status, cost_usd, input_tokens, output_tokens, draft_summary }
 * on success, or { error, requires_billing_action } on failure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { runProducerRow } from '@/lib/marketing-brain/run-producer-core'

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
  }

  const { id } = await params
  const service = createServiceClient()

  // Fetch the row.
  const { data: row, error: fetchErr } = await service
    .from('marketing_brain_actions')
    .select('id, status, assigned_producer')
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
          // repoRoot, not a hardcoded /Users path — this string is written into the
          // DB and may be read by an operator working on the Linux VM.
          runtime_invocation_command_alt: `cd ${process.cwd()} && claude --skill ${producerPath} --action-row-id ${id}`,
        },
      })
      .eq('id', id)
      .eq('status', 'pending')

    if (transErr) {
      return NextResponse.json({ error: transErr.message }, { status: 500 })
    }
  }

  const result = await runProducerRow(id, { triggeredBy: 'admin_manual' })

  if (!result.ok) {
    if (result.error === 'ANTHROPIC_API_KEY is not configured' || result.error === 'Row not found') {
      return NextResponse.json({ error: result.error }, { status: result.error === 'Row not found' ? 404 : 500 })
    }
    if (result.error?.startsWith('SKILL.md not found')) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }
    const status = result.requiresBillingAction ? 502 : 422
    return NextResponse.json(
      { error: result.error, requires_billing_action: result.requiresBillingAction },
      { status },
    )
  }

  if (result.deferred) {
    return NextResponse.json({
      ok: true,
      action_id: id,
      deferred: true,
      output_class: 'visual',
      new_status: 'in_production',
      reason:
        'Visual producer deferred to the local render worker (scripts/render-worker.mjs). The serverless runtime cannot render video/image/PDF/web-page deliverables; running it here would fabricate citations + scorecard for a file that was never created.',
    })
  }

  return NextResponse.json({
    ok: true,
    action_id: id,
    new_status: 'ready',
    cost_usd: result.costUsd,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    draft_summary: result.draftSummary ?? null,
  })
}
