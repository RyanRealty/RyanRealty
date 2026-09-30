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
 * Consent (Matt's decisions 2026-09-29): a contact who stopped her own reports
 * (one-click, her email link, her account page) is SKIPPED when the job turns
 * reports on, and counted (`skipped_contact_stopped`): restarting one needs her
 * new consent on record, one contact at a time, on the market report card. An
 * admin-stopped or paused one turns on and its stop stamp is cleared. A new
 * row starts NOT approved, like every subscription: nothing sends until a
 * broker previews and approves the first send. Its last_sent_at starts at the
 * last report the contact actually received. A contact already exactly as the
 * job asks is left alone (counted `unchanged`, no timeline row), and turning
 * reports off with no areas picked keeps the areas already on the row.
 *
 * The write is CONDITIONAL (review 2026-09-30): an existing row is updated
 * only while it is still as the job read it (same on/off, same stop stamp),
 * and a new row is inserted only while none exists. A stop (hers or a
 * broker's), a pause, or a new row made between the read and the write is
 * never overwritten; the contact is counted `changed_during_job` instead.
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
import { getLatestDeliveredReportAt } from '@/lib/data/crm/marketReportSends'
import { CONTACT_STOP_VIAS, isContactStopVia } from '@/lib/crm/market-report-subscription-control'

/** Order-insensitive area comparison. */
function sameAreaSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

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
    const { data: existing, error: readErr } = await sb
      .from('crm_report_subscriptions')
      .select('is_active, stopped_at, stopped_via, areas, frequency')
      .eq('person_id', id)
      .maybeSingle()
    if (readErr) { result.skipped++; bump('read_failed'); continue }
    const prev = existing as {
      is_active: boolean | null
      stopped_at: string | null
      stopped_via: string | null
      areas: string[] | null
      frequency: string | null
    } | null
    if (isActive && prev && !prev.is_active && isContactStopVia(prev.stopped_via)) {
      result.skipped++
      bump('skipped_contact_stopped')
      continue
    }
    // Turning off with no areas picked keeps the row's areas (a paused report
    // with areas is harmless, and a later turn-on needs them).
    const keepAreas = !isActive && areas.length === 0 && prev !== null
    if (
      prev &&
      (prev.is_active === true) === isActive &&
      prev.frequency === frequency &&
      (keepAreas || sameAreaSet(Array.isArray(prev.areas) ? prev.areas : [], areas)) &&
      (!isActive || !prev.stopped_at)
    ) {
      result.processed++
      bump('unchanged')
      continue
    }

    const row: Record<string, unknown> = {
      person_id: id,
      frequency,
      is_active: isActive,
      updated_at: nowIso,
    }
    if (!keepAreas) row.areas = areas
    if (isActive) {
      row.stopped_at = null
      row.stopped_via = null
    }
    if (!prev) {
      // A first setup: say where it came from, and start the cadence from the
      // last report the contact actually received (never a same-day repeat).
      row.source = 'broker'
      row.last_sent_at = await getLatestDeliveredReportAt(id)
      // Insert only while no row exists: one that appeared since the read
      // (her one-click on a one-off report records a stopped row) is hers.
      const { count, error: insErr } = await sb
        .from('crm_report_subscriptions')
        .upsert(row, { onConflict: 'person_id', ignoreDuplicates: true, count: 'exact' })
      if (insErr) { result.skipped++; bump('upsert_failed'); continue }
      if (!count) { result.skipped++; bump('changed_during_job'); continue }
    } else {
      // Update only while the row is as read: same on/off and same stop stamp.
      // A stop or a pause made since the read keeps its place.
      let update = sb
        .from('crm_report_subscriptions')
        .update(row)
        .eq('person_id', id)
        .eq('is_active', prev.is_active === true)
      update = prev.stopped_at ? update.eq('stopped_at', prev.stopped_at) : update.is('stopped_at', null)
      if (isActive) update = update.or(`stopped_via.is.null,stopped_via.not.in.(${CONTACT_STOP_VIAS.join(',')})`)
      const { data: written, error: upErr } = await update.select('person_id')
      if (upErr) { result.skipped++; bump('upsert_failed'); continue }
      if (!written || written.length === 0) { result.skipped++; bump('changed_during_job'); continue }
    }

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
