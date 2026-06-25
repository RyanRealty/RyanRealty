/**
 * Bulk handler: crm:set-report-subscription — set the market-report subscription
 * for a chunk of contacts.
 *
 * Mirrors the single-record setReportSubscriptionAction
 * (app/actions/crm-report-subscriptions.ts 73):
 *   - sanitizes the areas against the live registry (drops unknown slugs)
 *   - normalizes the frequency (weekly / monthly / quarterly, default monthly)
 *   - refuses an ACTIVE subscription with zero valid areas (never leave a contact
 *     in a silently-empty "on" state) — counted, the WHOLE job is invalid so the
 *     whole chunk is skipped
 *   - upserts crm_report_subscriptions (one row per contact, conflict on person_id)
 *   - writes a per-person crm_timeline 'system' row
 *
 * A market-report subscription is a PREFERENCE, not a per-contact send that
 * bypasses consent — report delivery itself is suppression-gated at send time
 * (the same chokepoint isSuppressed governs). So there is no per-contact hard-stop
 * gate at this layer, exactly like the single-record action.
 *
 * Scope is applied at id-resolution (worker), matching requirePersonInScope.
 *
 * Every id is accounted for (processed OR skipped) so the worker offset drains.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  normalizeReportFrequency,
  buildMarketReportAreas,
} from '@/lib/data/crm/getContactReportSubscriptions'
import type { BulkHandler, BulkResult } from '@/lib/crm/bulk-jobs'

/**
 * Validate + de-dupe submitted areas against the registry of valid options.
 * Pure given the valid-slug set — mirrors sanitizeAreas in the single-record action.
 */
export function sanitizeReportAreas(areas: unknown, validSlugs: ReadonlySet<string>): string[] {
  const input = Array.isArray(areas) ? areas : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const slug = raw.trim()
    if (!slug || seen.has(slug) || !validSlugs.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

export const setReportSubscriptionHandler: BulkHandler = async (ids, params): Promise<Partial<BulkResult>> => {
  const result: BulkResult = { processed: 0, skipped: 0, breakdown: {} }
  const bump = (k: string, n = 1) => { result.breakdown[k] = (result.breakdown[k] ?? 0) + n }
  if (ids.length === 0) return result

  const validSlugs = new Set(buildMarketReportAreas().map((a) => a.slug))
  const areas = sanitizeReportAreas(params.areas, validSlugs)
  const frequency = normalizeReportFrequency(params.frequency)
  const isActive = params.isActive === true

  // An active subscription with no valid areas can never produce a report. The
  // whole job's params are invalid — skip every id (counted) so the broker sees
  // it never applied rather than silently flipping contacts to an empty "on".
  if (isActive && areas.length === 0) {
    result.skipped = ids.length
    bump('refused_active_no_areas', ids.length)
    return result
  }

  const sb = createServiceClient()
  const nowIso = new Date().toISOString()

  for (const id of ids) {
    const { error: upErr } = await sb
      .from('crm_report_subscriptions')
      .upsert(
        {
          person_id: id,
          areas,
          frequency,
          is_active: isActive,
          updated_at: nowIso,
        },
        { onConflict: 'person_id' },
      )
    if (upErr) { result.skipped++; bump('upsert_failed'); continue }

    await sb.from('crm_timeline').insert({
      person_id: id,
      kind: 'system',
      title: isActive
        ? `Market reports set to ${frequency} for ${areas.length} ${areas.length === 1 ? 'area' : 'areas'} (bulk)`
        : `Market reports turned off (bulk)`,
      source: 'app',
    })
    result.processed++
    bump(isActive ? 'subscribed' : 'unsubscribed')
  }

  return result
}
