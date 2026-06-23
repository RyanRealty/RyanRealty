/**
 * getAudienceEligiblePeople -- the consent-gated read that feeds the Meta Custom
 * Audience uploader (CONTACT360 Phase 5.1).
 *
 * Returns every crm_people row that:
 *   1. has at least one email OR phone (a name-only row can never match a Meta
 *      customer file), AND
 *   2. is NOT deleted, AND
 *   3. carries NO crm_suppressions row, AND
 *   4. carries NO realtor/agent tag (a TARGETING exclusion -- we never advertise
 *      to competitors -- enforced here independently of consent suppression).
 *
 * Why #4 is its own gate, not a suppression: realtor-exclusion is a targeting
 * rule, not a consent rule. A realtor in Matt's sphere of influence can still get
 * CRM email/referral touches (they are not "do-not-contact"); they simply must
 * never enter a Meta prospecting audience. Baking the exclusion into THIS read
 * means a contact tagged a realtor tomorrow is auto-excluded even if no one ever
 * suppresses them -- a leak the suppression-only gate allowed (Matt directive
 * 2026-06-23: 54 realtor-tagged contacts were not in the hard-stop list and would
 * otherwise have been uploaded).
 *
 * The suppression filter is the load-bearing compliance rule: a contact with ANY
 * suppression (compliance:hard-stop / do-not-call / do-not-text / do-not-email /
 * unsubscribed / bounced / a GPC opt-out -- whatever reason, whatever channel)
 * is EXCLUDED from the audience. We mirror the SAME crm_suppressions table the
 * send path (lib/crm/suppressions.ts isSuppressed) reads, so audience membership
 * can never drift from the send-time consent surface. We read the suppressed
 * person-id SET once and filter against it, rather than inventing a second
 * consent source.
 *
 * Note: crm_suppressions.person_id is nullable (value-keyed suppressions exist).
 * A null-person suppression row blocks by raw email/phone value at SEND time but
 * cannot be joined to a person id here. Those are a tiny minority; the uploader
 * additionally honors them at the value level is out of scope for this read --
 * the person-id set is the primary gate, matching how the audience scripts and
 * the health board (getSuppressionCounts) already reason about the population.
 *
 * DAL boundary (G1): the raw .from() reads of crm_people + crm_suppressions live
 * here, inside lib/data/. Service-role read (no user session in the cron/CLI).
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { AudiencePerson } from '@/lib/meta/audienceHash'

/** One eligible person plus the id, so the uploader can log/segment by id. */
export type AudienceEligiblePerson = AudiencePerson & {
  personId: number
}

/** Pull the set of person ids that carry ANY suppression row. */
async function getSuppressedPersonIds(
  sb: ReturnType<typeof createServiceClient>,
): Promise<Set<number>> {
  const suppressed = new Set<number>()
  // person_id paginated read: a single value, every channel/reason. ANY row =
  // suppressed (we never narrow by channel -- an opt-out on one channel still
  // pulls the contact from the audience entirely, the conservative posture).
  const PAGE = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await sb
      .from('crm_suppressions')
      .select('person_id')
      .not('person_id', 'is', null)
      .range(offset, offset + PAGE - 1)
    if (error || !data) break
    for (const row of data) {
      const id = row.person_id
      if (typeof id === 'number' && Number.isFinite(id)) suppressed.add(id)
    }
    if (data.length < PAGE) break
    offset += PAGE
  }
  return suppressed
}

/**
 * Tag patterns that bar a person from the Meta ad audience regardless of consent
 * state. A targeting exclusion (never advertise to competitors), NOT a consent
 * suppression. Matched case-insensitively against every crm_people tag, so
 * 'industry:realtor', 'Realtor', and 'realtor' all hit. Extensible: add a pattern
 * here (e.g. test accounts, other industry pros) and the audience auto-honors it.
 */
export const AUDIENCE_EXCLUDED_TAG_PATTERNS: readonly RegExp[] = [/realtor/i]

/**
 * Pure (unit-tested): true when ANY of a person's tags matches an audience
 * exclusion pattern. Non-array / non-string-element input is treated as no match.
 */
export function isAudienceExcludedByTag(tags: unknown): boolean {
  if (!Array.isArray(tags)) return false
  for (const t of tags) {
    if (typeof t !== 'string') continue
    if (AUDIENCE_EXCLUDED_TAG_PATTERNS.some((re) => re.test(t))) return true
  }
  return false
}

/** First string value out of a crm_people JSONB contact array (emails/phones). */
function valuesFromJsonbArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      out.push(item)
    } else if (item && typeof item === 'object') {
      const v = (item as { value?: unknown }).value
      if (typeof v === 'string') out.push(v)
    }
  }
  return out
}

export type GetAudienceEligibleOptions = {
  /**
   * Hard cap on rows returned (safety bound on the in-memory hash + upload).
   * The full book is ~18k people, so the default comfortably covers it.
   */
  limit?: number
}

/**
 * Read the consent-gated, audience-eligible population from crm_people.
 *
 * Returns the eligible people PLUS the count of how many otherwise-eligible
 * people were dropped purely because they carry a suppression, so the uploader
 * can report "would upload N, excluded M suppressed" without a second query.
 */
export async function getAudienceEligiblePeople(
  options: GetAudienceEligibleOptions = {},
): Promise<{ people: AudienceEligiblePerson[]; excludedSuppressed: number; excludedRealtors: number }> {
  const sb = createServiceClient()
  const suppressedIds = await getSuppressedPersonIds(sb)

  const limit = options.limit ?? 50000
  const people: AudienceEligiblePerson[] = []
  let excludedSuppressed = 0
  let excludedRealtors = 0

  const PAGE = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id,first_name,last_name,emails,phones,deleted,tags')
      .eq('deleted', false)
      .range(offset, offset + PAGE - 1)
    if (error || !data) break

    for (const row of data) {
      const id = row.id
      if (typeof id !== 'number' || !Number.isFinite(id)) continue

      const emails = valuesFromJsonbArray(row.emails)
      const phones = valuesFromJsonbArray(row.phones)
      // Must have a contactable key, else it can never match a Meta file.
      if (emails.length === 0 && phones.length === 0) continue

      // Consent gate: ANY suppression -> excluded, counted for the report.
      if (suppressedIds.has(id)) {
        excludedSuppressed += 1
        continue
      }

      // Targeting gate: realtors/agents are never advertised to, independent of
      // consent. Counted separately so the dry-run can report "0 realtors".
      if (isAudienceExcludedByTag(row.tags)) {
        excludedRealtors += 1
        continue
      }

      people.push({
        personId: id,
        firstName: (row.first_name as string | null) ?? null,
        lastName: (row.last_name as string | null) ?? null,
        emails,
        phones,
      })
      if (people.length >= limit) {
        return { people, excludedSuppressed, excludedRealtors }
      }
    }

    if (data.length < PAGE) break
    offset += PAGE
  }

  return { people, excludedSuppressed, excludedRealtors }
}
