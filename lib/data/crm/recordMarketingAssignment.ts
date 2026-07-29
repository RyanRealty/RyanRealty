/**
 * recordMarketingAssignment — the ONE write into public.marketing_assignments.
 *
 * Why this module exists (finding F8, 2026-07-29): the ledger was written with a
 * plain `.insert()` from six different call sites, so it accumulated one row PER
 * EVENT instead of one row per assignment. A single active lead that saves a
 * search twelve times produced twelve identical
 * `buyer / matt / idx-registration / warm` rows, and every "assignments" count
 * over-reported by roughly an order of magnitude. Routing all six writers
 * through one upsert makes the churn structurally impossible instead of relying
 * on each caller to remember.
 *
 * GRAIN: (fub_person_id, audience, source)
 * ----------------------------------------
 * One row = "this person entered this audience through this door." That grain
 * is the smallest one that keeps every distinction the business actually needs:
 *
 *   - audience is IN the key, so the same person being both a buyer and a
 *     seller stays two rows. Collapsing to person-only would erase the
 *     seller/buyer split the dashboards segment on.
 *   - source is IN the key, so a person who arrives via `contact-form` and
 *     later via `idx-registration` keeps both acquisition paths. Production
 *     already holds exactly that case (crm person 13168), and it is a real
 *     second touch, not churn.
 *   - broker is NOT in the key. A broker re-assignment is a state change to an
 *     existing assignment, not a new assignment — it UPDATES broker +
 *     fub_user_id in place. Keying on broker would re-introduce the churn every
 *     time lead-routing flipped, and would leave two rows both claiming to own
 *     the same lead.
 *   - tier is NOT in the key, for the same reason: a lead warming from nurture
 *     to hot is the same assignment at a new temperature.
 *
 * `assigned_at` is deliberately NOT in the upsert payload. On the insert path
 * the column default (now()) stamps it; on the conflict path PostgREST only
 * SETs the columns present in the payload, so the original timestamp survives.
 * That makes assigned_at a stable first-touch anchor — the field any date-window
 * report would bucket a lead by. Refreshing it on every repeat event would drag
 * an old lead forward into whatever window it last clicked in.
 *
 * NULL keys: Postgres treats NULLs as distinct in a unique index, so a row with
 * a NULL fub_person_id or NULL source cannot dedupe and will always insert.
 * That matches the pre-existing behavior for those degenerate rows (production
 * has zero of them), and the index is intentionally NOT partial — PostgREST
 * cannot supply the index predicate that ON CONFLICT inference would need for a
 * partial arbiter index.
 *
 * NON-BLOCKING by contract: never throws. A ledger write must never fail a lead
 * capture; callers get a result flag and log it.
 *
 * Unique index: supabase/migrations/20260729183000_marketing_assignments_dedupe.sql
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type MarketingAssignmentAudience = 'seller' | 'buyer'
export type MarketingAssignmentTier = 'hot' | 'warm' | 'nurture'

export type MarketingAssignmentInput = {
  audience: MarketingAssignmentAudience
  /** Broker slug — 'matt' | 'rebecca' | 'paul' (CHECK-constrained in the table). */
  broker: string
  /** Numeric broker user id (1=Matt, 2=Rebecca, 3=Paul). */
  fubUserId: number
  /** crm_people.id for the lead. Null only when intake could not resolve one. */
  fubPersonId: number | null
  /** Acquisition path — part of the dedupe grain, so it must be stable per door. */
  source: string
  tier: MarketingAssignmentTier
  /** Free-form debug text. Omitted from the payload when undefined so a repeat
   *  write never blanks a note written by an earlier one. */
  notes?: string | null
}

export type RecordMarketingAssignmentResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * The ON CONFLICT arbiter, matching the unique index created in
 * 20260729183000_marketing_assignments_dedupe.sql. Exported so the unit test
 * asserts against the same constant the writer uses.
 */
export const MARKETING_ASSIGNMENT_CONFLICT_TARGET = 'fub_person_id,audience,source'

/**
 * Pure row builder — the payload half of the write, split out so the grain and
 * the "assigned_at is never in the payload" rule are testable without Supabase.
 */
export function buildMarketingAssignmentRow(
  input: MarketingAssignmentInput,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    audience: input.audience,
    broker: input.broker,
    fub_user_id: input.fubUserId,
    fub_person_id: input.fubPersonId,
    source: input.source,
    tier: input.tier,
  }
  if (input.notes !== undefined) row.notes = input.notes
  return row
}

/**
 * Idempotent write of one assignment ledger row. A repeat call for the same
 * (fub_person_id, audience, source) refreshes broker / fub_user_id / tier on the
 * existing row instead of adding a second one. Never throws.
 */
export async function recordMarketingAssignment(
  input: MarketingAssignmentInput,
): Promise<RecordMarketingAssignmentResult> {
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('marketing_assignments')
      .upsert(buildMarketingAssignmentRow(input), {
        onConflict: MARKETING_ASSIGNMENT_CONFLICT_TARGET,
      })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
