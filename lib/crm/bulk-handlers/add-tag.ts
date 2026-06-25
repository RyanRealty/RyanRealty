/**
 * Bulk handler: crm:add-tag — append one tag to a chunk of contacts.
 *
 * Mirrors the single-record addCrmTagAction (app/actions/crm.ts 1100):
 *   - lower-cases the tag, appends it only if absent (no duplicates)
 *
 * COMPLIANCE REFUSAL: a protected compliance tag (anything in TAG_CHANNEL — e.g.
 * compliance:hard-stop, contact:do-not-text, do_not_email) is REFUSED for the
 * whole job. A bulk add of a hard-stop would suppress the entire selection in one
 * shot. The whole chunk is skipped + counted under `refused_protected_tag`.
 *
 * Scope: the worker resolves ids under the job's frozen broker_scope, so a
 * restricted broker's chunk only ever contains their own contacts. No re-check is
 * needed here for a plain non-compliance tag (the single-record path's only guard
 * is requirePersonInScope, already applied at resolution).
 *
 * FUB is decommissioned (2026-06-24) — CRM is the system of record; the
 * single-record path's addPersonTags FUB call is intentionally omitted.
 *
 * Every id is accounted for (processed OR skipped) so the worker offset drains.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'
import { isProtectedComplianceTag } from './protected-tags'

export const addTagHandler: BulkHandler = async (ids, params): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const tag = String(params.tag ?? '').trim().toLowerCase()
  if (!tag || tag.length > 80) {
    result.skipped = ids.length
    bump('invalid_tag', ids.length)
    return result
  }

  // Never add a suppression-driving tag in bulk.
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
    if (tags.includes(tag)) { result.skipped++; bump('already_tagged'); continue }

    const { error: upErr } = await sb
      .from('crm_people')
      .update({ tags: [...tags, tag], updated_at: new Date().toISOString() })
      .eq('id', id)
    if (upErr) { result.skipped++; bump('update_failed'); continue }
    result.processed++
    bump('tagged')
  }

  return result
}
