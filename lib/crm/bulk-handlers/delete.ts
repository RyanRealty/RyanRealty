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
 * Does NOT call the CRM API to delete the person there — the parallel run is still
 * live and we do not want to trigger cascades on the CRM side. Contacts stay in CRM
 * but are invisible in the CRM UI. If full deletion is ever needed, a separate
 * hard-delete path (with CRM API call) should be added.
 *
 * A deleted contact's market report stops with her (review 2026-09-30): the
 * cadence cron otherwise kept mailing records nobody could see. A contact's
 * own stop stays hers (stopReportSubscriptionsForDeletedPeople only touches
 * rows that are not already stopped). Counted as `report_stopped`, or
 * `report_stop_failed` when that write fails (the cron skips deleted people
 * either way).
 *
 * Every id is accounted for (processed OR skipped) so the worker offset drains.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'
import { stopReportSubscriptionsForDeletedPeople } from '@/lib/data/crm/marketReportSubscription'

export const deleteContactsHandler: BulkHandler = async (ids, _params, ctx): Promise<Partial<BulkResult>> => {
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

  const reports = await stopReportSubscriptionsForDeletedPeople(toDelete, { email: ctx.actorEmail || 'a bulk delete' })
  if (reports.ok) {
    if (reports.stopped.length > 0) bump('report_stopped', reports.stopped.length)
  } else {
    bump('report_stop_failed', toDelete.length)
  }
  return result
}
