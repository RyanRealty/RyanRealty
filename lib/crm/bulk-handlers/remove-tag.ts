/**
 * Bulk handler: crm:remove-tag — remove one tag from a chunk of contacts.
 *
 * Mirrors the single-record removeCrmTagAction (app/actions/crm.ts 1122):
 *   - removes the tag if present (no-op if absent)
 *
 * COMPLIANCE REFUSAL (the critical one): a protected compliance tag (anything in
 * TAG_CHANNEL — compliance:hard-stop, contact:do-not-text, contact:do-not-call,
 * do_not_email, unsubscribed, bounced, complained) is REFUSED for the whole job.
 * Removing one of these in bulk would silently UN-SUPPRESS the entire selection —
 * exactly the TCPA / CAN-SPAM incident class this rail exists to prevent. The whole
 * chunk is skipped + counted under `refused_protected_tag`. A suppression is NEVER
 * lifted in bulk.
 *
 * NOTE on case: the single-record path matches the tag exactly; this handler also
 * matches exactly (case-sensitive) for the actual removal, but the protected check
 * is case-insensitive so a differently-cased compliance tag can never slip past.
 *
 * FUB is decommissioned (2026-06-24) — CRM is the system of record; the
 * single-record path's replacePersonTags FUB call is intentionally omitted.
 *
 * Every id is accounted for (processed OR skipped) so the worker offset drains.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'
import { isProtectedComplianceTag } from './protected-tags'

export const removeTagHandler: BulkHandler = async (ids, params): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const tag = String(params.tag ?? '').trim()
  if (!tag) {
    result.skipped = ids.length
    bump('invalid_tag', ids.length)
    return result
  }

  // NEVER lift a suppression in bulk. Refuse to remove any protected compliance
  // tag (case-insensitive) for the entire job.
  if (isProtectedComplianceTag(tag)) {
    result.skipped = ids.length
    bump('refused_protected_tag', ids.length)
    return result
  }

  const sb = createServiceClient()
  const { data: people, error } = await sb
    .from('crm_people')
    .select('id,tags')
    .in('id', ids)
  if (error) {
    result.skipped = ids.length
    bump('read_failed', ids.length)
    return result
  }

  const byId = new Map<number, string[]>()
  for (const p of people ?? []) byId.set(p.id as number, ((p.tags as string[] | null) ?? []))

  for (const id of ids) {
    const tags = byId.get(id)
    if (!tags) { result.skipped++; bump('not_found'); continue }
    const next = tags.filter((t) => t !== tag)
    if (next.length === tags.length) { result.skipped++; bump('not_present'); continue }

    const { error: upErr } = await sb
      .from('crm_people')
      .update({ tags: next, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (upErr) { result.skipped++; bump('update_failed'); continue }
    result.processed++
    bump('untagged')
  }

  return result
}
