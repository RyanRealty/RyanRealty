/**
 * Bulk handler: crm:assign-saved-search — create (or refresh) a saved search
 * for a chunk of CRM contacts, with REAL filters.
 *
 * Writes listing_alerts rows (origin='broker') through the canonical DAL —
 * the same table + engine the alert cron drains, so an assigned search emails
 * exactly like a search the lead built themselves. Every row carries
 * crm_person_id so the alert email's open/click tracking attributes to the
 * right person (Matt directive 2026-07-06: all CRM email is tracked).
 *
 * Params:
 *   filters   object — raw filter map; normalized via normalizeSavedSearchFilters.
 *             Empty after normalization = the WHOLE job is refused (a saved
 *             search with no filters would email the entire MLS feed).
 *   name      string — optional; falls back to a summary derived from filters.
 *   frequency 'daily' | 'weekly' — default daily.
 *
 * Per-contact skips: deleted contact, no email on file. The DAL upserts on
 * (email, filters_hash) so re-running the same assignment re-activates rather
 * than duplicating. Every id is accounted for (processed OR skipped).
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { createListingAlertForLead } from '@/lib/data/leads/listingAlerts'
import {
  normalizeSavedSearchFilters,
  getSavedSearchHash,
  getFilterNameFallback,
  getFiltersSummary,
} from '@/lib/search-filters'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'

type PersonRow = {
  id: number
  fub_legacy_id: number | null
  deleted: boolean
  emails: Array<{ value?: string; isPrimary?: number | boolean }> | null
}

/** Primary email first, else the first email with a value. */
export function pickPersonEmail(emails: PersonRow['emails']): string | null {
  const list = Array.isArray(emails) ? emails : []
  const primary = list.find((e) => e?.isPrimary === 1 || e?.isPrimary === true)
  const candidate = (primary?.value ?? list.find((e) => typeof e?.value === 'string' && e.value.trim())?.value ?? '').trim().toLowerCase()
  return candidate.includes('@') ? candidate : null
}

export const assignSavedSearchHandler: BulkHandler = async (ids, params, ctx): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const rawFilters = (params.filters && typeof params.filters === 'object' && !Array.isArray(params.filters))
    ? (params.filters as Record<string, unknown>)
    : {}
  const filters = normalizeSavedSearchFilters(rawFilters)

  // A saved search with zero real filters matches everything — refuse the whole
  // job (counted) so the broker sees it never applied.
  if (Object.keys(filters).length === 0) {
    result.skipped = ids.length
    bump('refused_empty_filters', ids.length)
    return result
  }

  const filtersHash = getSavedSearchHash(filters)
  const name = (typeof params.name === 'string' && params.name.trim())
    ? params.name.trim().slice(0, 120)
    : getFilterNameFallback(filters)
  const frequency = params.frequency === 'weekly' ? 'weekly' : 'daily'

  const sb = createServiceClient()

  const { data: peopleRows, error: peopleErr } = await sb
    .from('crm_people')
    .select('id, fub_legacy_id, deleted, emails')
    .in('id', ids)
  if (peopleErr) {
    result.skipped = ids.length
    bump('people_fetch_failed', ids.length)
    return result
  }
  const byId = new Map<number, PersonRow>((peopleRows ?? []).map((p) => [p.id as number, p as PersonRow]))

  for (const id of ids) {
    const person = byId.get(id)
    if (!person || person.deleted) { result.skipped++; bump('missing_or_deleted'); continue }
    const email = pickPersonEmail(person.emails)
    if (!email) { result.skipped++; bump('no_email'); continue }

    const created = await createListingAlertForLead({
      email,
      crmPersonId: id,
      fubPersonId: person.fub_legacy_id ?? null,
      name,
      filters,
      filtersHash,
      origin: 'broker',
      assignedBy: ctx.actorEmail,
      frequency,
    })
    if (!created.ok) { result.skipped++; bump('upsert_failed'); continue }

    await sb.from('crm_timeline').insert({
      person_id: id,
      kind: 'system',
      title: `Saved search "${name}" assigned (${frequency}, bulk): ${getFiltersSummary(filters)}`,
      source: 'app',
    })
    result.processed++
    bump('assigned')
  }

  return result
}
