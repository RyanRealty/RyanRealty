/**
 * The audience bus — resolve a bulk-action SELECTION to a scoped, deduped set of
 * crm_people ids, and (for sends) drop suppressed contacts fail-closed.
 *
 * Wave 4 lets a SAVED VIEW (the smart-list filter) be the audience for a bulk
 * action without re-specifying the filter. A selection is one of three shapes:
 *
 *   { ids:    number[]     }  an explicit checkbox set
 *   { ast:    CrmSegment   }  a filter ("select all matching <segment>")
 *   { viewId: number       }  a saved view (its stored segment IS the filter)
 *
 * All three resolve through the ONE compiler (buildCrmPeopleQuery) under the
 * caller's broker scope, so:
 *   - a restricted broker NEVER sees or acts past their own book — even via an
 *     explicit id list (the ids are AND-ed with the scope, so a stray id from
 *     another broker's book is silently dropped) or a SHARED saved view, and
 *   - the audience can never drift from what the people list shows for the same
 *     filter, because it is the same compiler + the same scope clamp.
 *
 * For send kinds (email / sms / call) resolveSendableAudience additionally drops
 * every isSuppressed(channel) contact through the suppression chokepoint
 * (lib/crm/suppressions.ts), which fails CLOSED: an unreadable compliance table
 * marks a contact suppressed rather than risk an unconsented send.
 *
 * DAL boundary (G1): no raw .from() here. The saved-view read goes through
 * getSavedViewSegment (lib/data/crm), person reads through buildCrmPeopleQuery
 * (the DAL resolver). Service-role client (no user session in the worker / cron).
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  validateSegment,
  EMPTY_SEGMENT,
  type CrmSegment,
} from '@/lib/crm/segment-ast'
import { buildCrmPeopleQuery } from '@/lib/data/crm/buildCrmPeopleQuery'
import { getSavedViewSegment, savedViewToSegment } from '@/lib/data/crm/getSavedViewSegment'
import { isSuppressed, type SendChannel } from '@/lib/crm/suppressions'

// Re-export so callers that already import the segment recovery from the audience
// bus keep working; the canonical home is lib/data/crm/getSavedViewSegment.
export { savedViewToSegment }

// ── Selection contract ───────────────────────────────────────────────────────

/**
 * The audience selection a bulk action / preflight resolves. The three shapes
 * are mutually exclusive (discriminated by the present key).
 */
export type AudienceSelection =
  | { ids: number[] }
  | { ast: CrmSegment }
  | { viewId: number }

export function isIdsSelection(s: AudienceSelection): s is { ids: number[] } {
  return 'ids' in s && Array.isArray((s as { ids?: unknown }).ids)
}
export function isAstSelection(s: AudienceSelection): s is { ast: CrmSegment } {
  return 'ast' in s && !!(s as { ast?: unknown }).ast
}
export function isViewSelection(s: AudienceSelection): s is { viewId: number } {
  return 'viewId' in s && Number.isFinite((s as { viewId?: unknown }).viewId)
}

/** Pull a clean, deduped, positive-integer id list out of a raw input. PURE. */
export function cleanIds(ids: readonly unknown[] | null | undefined): number[] {
  return Array.from(
    new Set(
      (ids ?? []).filter((n): n is number => Number.isInteger(n) && (n as number) > 0),
    ),
  ) as number[]
}

// ── Id resolution ────────────────────────────────────────────────────────────

/** Page size for draining an id-set out of the compiled query. */
const ID_PAGE = 1000

/**
 * Resolve a compiled segment to its full id set under scope, paged so an audience
 * of any size comes back complete (no implicit 1000-row PostgREST cap). When
 * `restrictToIds` is given (the ids-mode path), the query is additionally
 * constrained to that explicit set BEFORE scope — so the result is the
 * INTERSECTION of (the explicit ids) ∩ (the caller's book). That is the rule that
 * stops a restricted broker acting on ids outside their scope via a hand-passed list.
 */
async function resolveSegmentIds(
  sb: SupabaseClient,
  segment: CrmSegment,
  brokerScope: string | null,
  restrictToIds: number[] | null,
): Promise<number[]> {
  // An empty explicit set can never match anything — short-circuit (and never
  // fall through to an "everyone" scan).
  if (restrictToIds && restrictToIds.length === 0) return []

  const out: number[] = []
  let offset = 0
  for (;;) {
    // buildCrmPeopleQuery selects only `id` when countOnly is set; for a row read
    // we override the select to id-only to keep the payload tiny.
    let query = buildCrmPeopleQuery(sb, segment, brokerScope, {
      limit: ID_PAGE,
      offset,
    }).query.select('id')
    if (restrictToIds) query = query.in('id', restrictToIds)

    const { data, error } = await query
    if (error) throw new Error(`resolveAudience: id read failed: ${error.message}`)
    const rows = (data ?? []) as Array<{ id: number }>
    for (const r of rows) out.push(r.id)
    if (rows.length < ID_PAGE) break
    offset += ID_PAGE
  }
  // Dedupe defensively (paging + ordering can never duplicate, but the contract
  // is a SET).
  return Array.from(new Set(out))
}

/**
 * Resolve any selection shape to a scoped, deduped id set.
 *
 *   { ids }    → the explicit set ∩ the caller's book (scope-clamped).
 *   { ast }    → every contact matching the segment within scope.
 *   { viewId } → the saved view's segment, resolved exactly like { ast }.
 *
 * Every path runs through buildCrmPeopleQuery, so the scope clamp + deleted=false
 * baseline are applied INSIDE the resolver and no caller can forget them.
 */
export async function resolveAudienceIds(
  sb: SupabaseClient,
  selection: AudienceSelection,
  brokerScope: string | null,
): Promise<number[]> {
  if (isIdsSelection(selection)) {
    const ids = cleanIds(selection.ids)
    // Scope-clamp the explicit set: compile an "everyone" segment under scope and
    // intersect with the ids. A superuser (null scope) gets the ids straight back
    // (still validated against deleted=false by the resolver).
    return resolveSegmentIds(sb, EMPTY_SEGMENT, brokerScope, ids)
  }

  if (isViewSelection(selection)) {
    const segment = await getSavedViewSegment(selection.viewId)
    if (!segment) {
      throw new Error(`resolveAudience: saved view ${selection.viewId} not found`)
    }
    return resolveSegmentIds(sb, segment, brokerScope, null)
  }

  if (isAstSelection(selection)) {
    const segment = validateSegment(selection.ast)
    return resolveSegmentIds(sb, segment, brokerScope, null)
  }

  throw new Error('resolveAudience: selection must be one of { ids } | { ast } | { viewId }')
}

// ── Sendable resolution (suppression-filtered, fail-closed) ──────────────────

export type SendableAudience = {
  /** The ids that may be sent on `channel` (suppressed ones removed). */
  ids: number[]
  /** How many resolved ids were dropped as suppressed. */
  skipped: number
  /** person-id → the reasons it was suppressed (for an audit / preview row). */
  skippedReasons: Record<number, string[]>
}

/**
 * Resolve a selection to the SENDABLE id set for a channel: the scoped audience
 * minus every contact isSuppressed(channel) drops. Fail-closed — the suppression
 * chokepoint marks a contact suppressed on an unreadable compliance table, so a
 * compliance outage shrinks the audience rather than leaking an unconsented send.
 *
 * Suppression checks run with a bounded concurrency so a large cohort does not
 * open one DB round-trip per contact in a single burst.
 */
export async function resolveSendableAudience(
  sb: SupabaseClient,
  selection: AudienceSelection,
  brokerScope: string | null,
  channel: SendChannel,
): Promise<SendableAudience> {
  const ids = await resolveAudienceIds(sb, selection, brokerScope)

  const sendable: number[] = []
  const skippedReasons: Record<number, string[]> = {}

  const CONCURRENCY = 25
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY)
    const checks = await Promise.all(
      batch.map(async (id) => {
        // isSuppressed fails CLOSED on its own (a thrown/erroring read returns
        // suppressed=true); guard once more so a single bad row can never abort
        // the whole audience resolution.
        try {
          const { suppressed, reasons } = await isSuppressed(id, channel)
          return { id, suppressed, reasons }
        } catch (e) {
          return {
            id,
            suppressed: true,
            reasons: ['suppression-check-threw: ' + (e instanceof Error ? e.message : String(e))],
          }
        }
      }),
    )
    for (const c of checks) {
      if (c.suppressed) skippedReasons[c.id] = c.reasons
      else sendable.push(c.id)
    }
  }

  return {
    ids: sendable,
    skipped: ids.length - sendable.length,
    skippedReasons,
  }
}
