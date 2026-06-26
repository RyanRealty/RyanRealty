/**
 * Bulk handler: crm:delete — soft-delete a chunk of contacts.
 *
 * Sets crm_people.deleted = true. This mirrors how the system already treats
 * deleted contacts: buildCrmPeopleQuery baselines .eq('deleted', false) on every
 * query, so soft-deleted rows disappear from every list, bulk count, and export
 * without any cascade needed.
 *
 * Owner-only (superuser). The enqueue action enforces this guard at the action
 * boundary; the handler trusts the already-clamped chunk.
 *
 * Does NOT call the FUB API to delete the person there — the parallel run is still
 * live and we do not want to trigger cascades on the FUB side. Contacts stay in FUB
 * but are invisible in the CRM UI. If full deletion is ever needed, a separate
 * hard-delete path (with FUB API call) should be added.
 *
 * Every id is accounted for (processed OR skipped) so the worker offset drains.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'

export const deleteContactsHandler: BulkHandler = async (ids): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const sb = createServiceClient()

  // Fetch current deleted state so we can skip already-deleted rows.
  const { data: people, error: readErr } = await sb
    .from('crm_people')
    .select('id,deleted')
    .in('id', ids)

  if (readErr) {
    result.skipped = ids.length
    bump('read_failed', ids.length)
    return result
  }

  const byId = new Map<number, boolean>()
  for (const p of people ?? []) byId.set(p.id as number, (p.deleted as boolean) ?? false)

  const toDelete: number[] = []
  for (const id of ids) {
    if (!byId.has(id)) { result.skipped++; bump('not_found'); continue }
    if (byId.get(id)) { result.skipped++; bump('already_deleted'); continue }
    toDelete.push(id)
  }

  if (toDelete.length === 0) return result

  const { error: updateErr } = await sb
    .from('crm_people')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .in('id', toDelete)

  if (updateErr) {
    result.skipped += toDelete.length
    bump('update_failed', toDelete.length)
    return result
  }

  result.processed = toDelete.length
  bump('deleted', toDelete.length)
  return result
}
