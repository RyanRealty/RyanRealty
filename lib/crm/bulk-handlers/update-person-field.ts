/**
 * Bulk handlers: crm:set-source / crm:set-timeframe / crm:set-lender /
 * crm:assign-pond — the §14.3 single-column mass updates (Update Source,
 * Update Timeframe, Assign Lender, Assign Ponds) from
 * docs/fub-crm-spec/05-people-list-and-bulk-actions.md.
 *
 * One factory builds each handler: validate the submitted value, update the
 * single crm_people column for every id in the chunk, and write a per-person
 * crm_timeline audit row. Per the FUB architectural rule replicated in §14.3,
 * NO automation triggers fire from these paths (they never touch the
 * automation-rule engine — plain column updates + audit rows only).
 *
 * Scope is clamped twice before a handler runs (enqueue + clampChunkToScope),
 * same as every other bulk handler. Every id is accounted for
 * (processed + skipped === chunk.length) so the worker offset drains.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'
import { TIMEFRAME_OPTIONS } from '@/components/admin/crm/people-list/people-list-utils'

type FieldSpec = {
  /** The crm_people column the handler writes. */
  column: 'source' | 'timeframe' | 'lender_name' | 'pond_id'
  /** The params key carrying the submitted value. */
  paramKey: string
  /** Validate + normalize the submitted value; null = invalid. */
  normalize: (raw: unknown) => string | number | null
  /** Audit title for the timeline row. */
  auditTitle: (value: string | number) => string
}

function makeFieldHandler(spec: FieldSpec): BulkHandler {
  return async (ids, params, _ctx): Promise<Partial<BulkResult>> => {
    const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
    const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
    if (ids.length === 0) return result

    const value = spec.normalize(params[spec.paramKey])
    if (value === null) {
      result.skipped = ids.length
      bump('invalid_value', ids.length)
      return result
    }

    const sb = createServiceClient()
    const { data: people, error } = await sb
      .from('crm_people')
      .select(`id,${spec.column}`)
      .in('id', ids)
    if (error) {
      result.skipped = ids.length
      bump('read_failed', ids.length)
      return result
    }
    const byId = new Map<number, unknown>()
    for (const p of (people ?? []) as Array<Record<string, unknown>>) {
      byId.set(Number(p.id), p[spec.column])
    }

    for (const id of ids) {
      if (!byId.has(id)) { result.skipped++; bump('not_found'); continue }
      if (byId.get(id) === value) { result.skipped++; bump('unchanged'); continue }

      const { error: upErr } = await sb
        .from('crm_people')
        .update({ [spec.column]: value, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (upErr) { result.skipped++; bump('update_failed'); continue }

      await sb.from('crm_timeline').insert({
        person_id: id,
        kind: 'system',
        title: spec.auditTitle(value),
        source: 'app',
      })
      result.processed++
      bump('updated')
    }
    return result
  }
}

export const setSourceHandler = makeFieldHandler({
  column: 'source',
  paramKey: 'source',
  normalize: (raw) => {
    const v = String(raw ?? '').trim()
    return v.length > 0 && v.length <= 100 ? v : null
  },
  auditTitle: (v) => `Source set to ${v} (bulk)`,
})

export const setTimeframeHandler = makeFieldHandler({
  column: 'timeframe',
  paramKey: 'timeframe',
  normalize: (raw) => {
    const v = String(raw ?? '').trim()
    return (TIMEFRAME_OPTIONS as readonly string[]).includes(v) ? v : null
  },
  auditTitle: (v) => `Timeframe set to ${v} (bulk)`,
})

export const setLenderHandler = makeFieldHandler({
  column: 'lender_name',
  paramKey: 'lender',
  normalize: (raw) => {
    const v = String(raw ?? '').trim()
    return v.length > 0 && v.length <= 120 ? v : null
  },
  auditTitle: (v) => `Lender set to ${v} (bulk)`,
})

/** crm:assign-pond validates the pond exists before writing pond_id. */
export const assignPondHandler: BulkHandler = async (ids, params, ctx): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const pondId = Number(params.pondId)
  if (!Number.isInteger(pondId) || pondId <= 0) {
    result.skipped = ids.length
    bump('invalid_pond', ids.length)
    return result
  }

  const sb = createServiceClient()
  const { data: pond } = await sb.from('crm_ponds').select('id,name').eq('id', pondId).maybeSingle()
  if (!pond) {
    result.skipped = ids.length
    bump('unknown_pond', ids.length)
    return result
  }

  const inner = makeFieldHandler({
    column: 'pond_id',
    paramKey: 'pondId',
    normalize: () => pondId,
    auditTitle: () => `Assigned to pond ${(pond as { name?: string }).name ?? pondId} (bulk)`,
  })
  return inner(ids, params, ctx)
}
