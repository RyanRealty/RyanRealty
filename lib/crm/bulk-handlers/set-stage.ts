/**
 * Bulk handler: crm:set-stage — move a chunk of contacts to one stage.
 *
 * Mirrors the single-record updateCrmStageAction (app/actions/crm.ts 1064):
 *   - validates the stage exists, updates crm_people.stage
 *   - writes a per-person crm_timeline 'stage_change' row
 *
 * The single-record action validates the stage string against the CRM_STAGES
 * constant. This bulk handler additionally validates against the LIVE crm_stages
 * table (read once per chunk, active rows only) per the wave-3 spec — so a stage
 * deactivated in the table is refused even if it lingers in the constant. A param
 * matching either a stage `key` or `label` is accepted; the stored value is the
 * canonical `label` (crm_people.stage holds the label string).
 *
 * Scope is clamped TWICE before this handler runs — at enqueue (an ids selection
 * is pre-clamped via resolveAudienceIds; an ast/view selection resolves under
 * broker_scope) AND defensively in the worker (clampChunkToScope drops any foreign
 * id from the chunk) — so a restricted broker's chunk only contains their own
 * contacts, matching the single-record requirePersonInScope.
 *
 * The single-record path also fires a Meta CAPI qualified-lead event when a lead
 * crosses INTO a qualifying stage. That is intentionally omitted from the bulk
 * path: firing thousands of CAPI events from a bulk reclassification would poison
 * Meta's optimization signal (it is meant for organic, one-at-a-time progression).
 *
 * Every id is accounted for (processed OR skipped) so the worker offset drains.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'

type StageRow = { key: string; label: string }

/**
 * Resolve a submitted stage value (key OR label) against the active crm_stages
 * rows to the canonical label, or null if it is not a valid active stage. Pure
 * given the rows — unit-testable without Supabase.
 */
export function resolveStageLabel(stages: StageRow[], submitted: string): string | null {
  const v = submitted.trim()
  if (!v) return null
  for (const s of stages) {
    if (s.label === v || s.key === v) return s.label
  }
  return null
}

export const setStageHandler: BulkHandler = async (ids, params): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const submitted = String(params.stage ?? '').trim()
  if (!submitted) {
    result.skipped = ids.length
    bump('invalid_stage', ids.length)
    return result
  }

  const sb = createServiceClient()

  // Validate against the live stage table (active rows only), once per chunk.
  const { data: stageRows, error: stageErr } = await sb
    .from('crm_stages')
    .select('key,label')
    .eq('is_active', true)
  if (stageErr) {
    result.skipped = ids.length
    bump('stage_lookup_failed', ids.length)
    return result
  }
  const stageLabel = resolveStageLabel((stageRows ?? []) as StageRow[], submitted)
  if (!stageLabel) {
    result.skipped = ids.length
    bump('unknown_stage', ids.length)
    return result
  }

  const { data: people, error } = await sb
    .from('crm_people')
    .select('id,stage')
    .in('id', ids)
  if (error) {
    result.skipped = ids.length
    bump('read_failed', ids.length)
    return result
  }

  const byId = new Map<number, string>()
  for (const p of people ?? []) byId.set(p.id as number, (p.stage as string | null) ?? '')

  for (const id of ids) {
    if (!byId.has(id)) { result.skipped++; bump('not_found'); continue }
    const prev = byId.get(id) as string
    if (prev === stageLabel) { result.skipped++; bump('already_in_stage'); continue }

    const { error: upErr } = await sb
      .from('crm_people')
      .update({ stage: stageLabel, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (upErr) { result.skipped++; bump('update_failed'); continue }

    await sb.from('crm_timeline').insert({
      person_id: id,
      kind: 'stage_change',
      title: `Stage: ${prev || '(none)'} → ${stageLabel} (bulk)`,
      source: 'app',
    })
    result.processed++
    bump('staged')
  }

  return result
}
