/**
 * content:cma build queue reads/writes against `public.marketing_brain_actions`.
 *
 * The cma-build-worker cron polls here; lib/cma/worker.ts transitions rows.
 * The LLM producer-runtime used to own these rows — it is dead (no Anthropic
 * credits), so the deterministic builder drains the same queue instead.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

export type CmaActionRow = {
  id: string
  status: string
  target: string
  payload: Record<string, unknown>
  data_evidence: Record<string, unknown> | null
  executor_response: Record<string, unknown> | null
  failure_log: unknown[]
  created_at: string
}

/** Oldest open content:cma action rows (pending or stuck in_production). */
export async function listOpenCmaActions(limit: number): Promise<CmaActionRow[]> {
  const sb = client()
  if (!sb) return []
  const { data, error } = await sb
    .from('marketing_brain_actions')
    .select('id, status, target, payload, data_evidence, executor_response, failure_log, created_at')
    .eq('action_type', 'content:cma')
    .in('status', ['pending', 'in_production'])
    .order('created_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 25))
  if (error) {
    console.error('[listOpenCmaActions]', error.message)
    return []
  }
  return (data ?? []) as unknown as CmaActionRow[]
}

/**
 * Is a build for this CMA slug already open (pending or in_production)?
 * Backs the kick-off dedupe (D8): a second "Build CMA" for the same address
 * must attach to the in-flight build, never enqueue a duplicate action row.
 */
export async function findOpenCmaActionBySlug(slug: string): Promise<{ id: string; status: string } | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb
    .from('marketing_brain_actions')
    .select('id, status')
    .eq('action_type', 'content:cma')
    .eq('target', `cma:${slug.toLowerCase()}`)
    .in('status', ['pending', 'in_production'])
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) {
    console.error('[findOpenCmaActionBySlug]', error.message)
    return null
  }
  const row = (data ?? [])[0] as { id: string; status: string } | undefined
  return row ?? null
}

/**
 * Atomically append a {person_id, broker} entry to an open build's ready-notify
 * list (payload.notify_broker_sms). Backs the kick-off attach path (D8): every
 * kicker that attaches to an in-flight build gets the "draft ready" text, not
 * just the first enqueuer. Runs server-side under a row lock
 * (cma_action_append_notify, migration 20260717130000) so concurrent attaches
 * never lose an entry to a read-modify-write race.
 *
 * Returns `appended` plus the row's status at lock time. `status` of
 * 'ready'/'killed' means the worker closed the build before the append landed —
 * the caller handles the notify itself (the worker's pass has already run).
 */
export async function appendCmaActionNotify(
  actionId: string,
  entry: { personId: number; broker: string },
): Promise<{ appended: boolean; status: string | null }> {
  const sb = client()
  if (!sb) return { appended: false, status: null }
  const { data, error } = await sb.rpc('cma_action_append_notify', {
    p_action_id: actionId,
    p_person_id: entry.personId,
    p_broker: entry.broker,
  })
  if (error) {
    console.error('[appendCmaActionNotify]', error.message)
    return { appended: false, status: null }
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { appended: boolean; status: string | null }
    | undefined
  return { appended: Boolean(row?.appended), status: row?.status ?? null }
}

/**
 * Fresh payload read for one action row. The worker re-reads the notify list at
 * text time — kickers that attached while the build was running are missing
 * from the scan-time snapshot listOpenCmaActions returned.
 */
export async function getCmaActionPayload(id: string): Promise<Record<string, unknown> | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb
    .from('marketing_brain_actions')
    .select('payload')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getCmaActionPayload]', error.message)
    return null
  }
  return ((data as { payload?: Record<string, unknown> } | null)?.payload ?? null)
}

/** Patch one marketing_brain_actions row (status transitions, executor_response). */
export async function updateCmaActionRow(
  id: string,
  updates: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb
    .from('marketing_brain_actions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}
