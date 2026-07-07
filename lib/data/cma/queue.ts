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
