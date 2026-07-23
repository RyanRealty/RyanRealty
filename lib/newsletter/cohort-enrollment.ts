/**
 * Consent-respecting bulk newsletter enrollment — ORCHESTRATION CORE.
 *
 * The decided audience is the UNION of
 *   (a) crm_people tagged 'past-client' — via the consent-gated audience read
 *       (getAudienceEligiblePeople), which already excludes suppressed people
 *       and realtors,
 *   (b) engaged leads — an email_events open/click within the last 180 days,
 *   (c) westside_parcels-linked people (westside_parcels.person_id),
 * INTERSECTED with the four filters proven in computeEnrollmentPlan
 * (lib/data/newsletter/perLead, unit-tested):
 *   1. has an email address,
 *   2. realtor-excluded (same tag patterns as the Meta audience read),
 *   3. not suppressed — isSuppressedByEmail per address, which FAILS CLOSED,
 *   4. not already subscribed AND never resurrecting a prior opt-out (S-10).
 *
 * A real run ONLY writes newsletter_subscribers rows (via the same activation
 * RPC BulkEnrollForm uses). It NEVER sends an issue — issues go out solely
 * through the approve-then-drain send queue.
 *
 * This module is the DEPENDENCY-INJECTED, auth-free core. The 'use server'
 * wrapper (app/actions/newsletter-enrollment.ts) adds superuser auth + Next
 * cache revalidation; the test and any headless runner call executeCohortEnrollment
 * directly with injected deps. Extracting the core is what lets the
 * compliance-critical S-10 two-phase suppression logic be exercised end-to-end
 * without a session — every caller runs the identical path.
 */

import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { getAudienceEligiblePeople } from '@/lib/data/crm/getAudienceEligiblePeople'
import { getSubscribersByEmails, bulkActivateSubscribers } from '@/lib/data/newsletter/queue'
import {
  computeEnrollmentPlan,
  dedupeCandidatesByEmail,
  getEngagedLeadEmailsSince,
  getPeopleForEnrollment,
  getWestsideLinkedPersonIds,
  type EnrollmentCandidate,
  type EnrollmentPlanCounts,
} from '@/lib/data/newsletter/perLead'

export const ENGAGED_LOOKBACK_DAYS = 180
export const CANDIDATE_CAP = 20000
export const SUPPRESSION_CONCURRENCY = 15
export const CONFIRM_TEXT = 'ENROLL'

export type CohortSizes = { pastClient: number; engaged: number; westside: number }

export type CohortEnrollmentCounts = EnrollmentPlanCounts & { droppedOverCap: number }

export type CohortSample = { email: string; name: string | null; personId: number | null; cohorts: string[] }

export type CohortEnrollmentResult =
  | {
      ok: true
      dryRun: true
      counts: CohortEnrollmentCounts
      cohortSizes: CohortSizes
      sample: CohortSample[]
    }
  | {
      ok: true
      dryRun: false
      enrolled: number
      counts: CohortEnrollmentCounts
      cohortSizes: CohortSizes
    }
  | { ok: false; error: string }

/** The IO surface the orchestration needs — injected so the core stays pure of
 *  wiring and the test/runner can substitute fakes. */
export interface CohortEnrollmentDeps {
  getAudienceEligiblePeople: typeof getAudienceEligiblePeople
  getEngagedLeadEmailsSince: typeof getEngagedLeadEmailsSince
  getWestsideLinkedPersonIds: typeof getWestsideLinkedPersonIds
  getPeopleForEnrollment: typeof getPeopleForEnrollment
  getSubscribersByEmails: typeof getSubscribersByEmails
  isSuppressedByEmail: typeof isSuppressedByEmail
  bulkActivateSubscribers: typeof bulkActivateSubscribers
}

/** The real dependency set — the same functions the pre-refactor action called
 *  inline. The wrapper, a headless runner, and production all pass this. */
export const cohortEnrollmentDeps: CohortEnrollmentDeps = {
  getAudienceEligiblePeople,
  getEngagedLeadEmailsSince,
  getWestsideLinkedPersonIds,
  getPeopleForEnrollment,
  getSubscribersByEmails,
  isSuppressedByEmail,
  bulkActivateSubscribers,
}

/** Run an async mapper over items with bounded concurrency (order-preserving). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    for (;;) {
      const i = next
      next += 1
      if (i >= items.length) return
      results[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => worker()))
  return results
}

/**
 * Build the audience, apply the consent/targeting plan, and (real run only)
 * write subscriber rows. dryRun (the caller's default) returns counts + a
 * 25-person sample and writes NOTHING. A real run additionally requires the
 * typed confirmation string 'ENROLL'. NEVER sends an issue.
 */
export async function executeCohortEnrollment(
  deps: CohortEnrollmentDeps,
  opts: { dryRun: boolean; confirmText?: string; actorEmail: string },
): Promise<CohortEnrollmentResult> {
  const { dryRun } = opts
  if (!dryRun && (opts.confirmText ?? '').trim() !== CONFIRM_TEXT) {
    return { ok: false, error: 'confirmation_required' }
  }

  // ── Build the three cohorts (each read FAILS CLOSED by throwing) ──────────
  let candidates: EnrollmentCandidate[]
  let cohortSizes: CohortSizes
  try {
    const [pastClients, engaged, westsideIds] = await Promise.all([
      deps.getAudienceEligiblePeople({ tag: 'past-client' }),
      deps.getEngagedLeadEmailsSince(ENGAGED_LOOKBACK_DAYS),
      deps.getWestsideLinkedPersonIds(),
    ])

    // Resolve names/tags/emails for person-keyed cohort members in one read.
    const engagedPersonIds = engaged.map((e) => e.personId).filter((n): n is number => Number.isFinite(n as number))
    const personDetails = await deps.getPeopleForEnrollment([...new Set([...engagedPersonIds, ...westsideIds])])
    const detailByPersonId = new Map(personDetails.map((p) => [p.personId, p]))

    const list: EnrollmentCandidate[] = []
    for (const p of pastClients.people) {
      const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || null
      list.push({
        email: p.emails?.[0] ?? null,
        personId: p.personId,
        name,
        // Carries the tag by construction; the audience read already dropped realtors.
        tags: ['past-client'],
        cohorts: ['past-client'],
      })
    }
    for (const e of engaged) {
      const detail = e.personId !== null ? detailByPersonId.get(e.personId) : undefined
      list.push({
        email: e.email,
        personId: e.personId,
        name: detail?.name ?? null,
        tags: detail?.tags ?? [],
        cohorts: ['engaged'],
      })
    }
    for (const id of westsideIds) {
      const detail = detailByPersonId.get(id)
      if (!detail) continue // soft-deleted person
      list.push({
        email: detail.email,
        personId: id,
        name: detail.name,
        tags: detail.tags,
        cohorts: ['westside'],
      })
    }
    candidates = list
    cohortSizes = { pastClient: pastClients.people.length, engaged: engaged.length, westside: westsideIds.length }
  } catch (e) {
    console.error('[cohort-enroll] audience build failed:', e instanceof Error ? e.message : String(e))
    return { ok: false, error: 'audience_build_failed' }
  }

  // ── Dedupe + cap ──────────────────────────────────────────────────────────
  const { deduped: dedupedAll, noEmail } = dedupeCandidatesByEmail(candidates)
  const deduped = dedupedAll.slice(0, CANDIDATE_CAP)
  const droppedOverCap = dedupedAll.length - deduped.length

  // ── Existing subscriber rows (S-10 guard). getSubscribersByEmails THROWS on
  // a read error so a lookup failure aborts instead of resurrecting opt-outs. ──
  let existingSubscriberStatusByEmail: Map<string, string>
  try {
    const existing = await deps.getSubscribersByEmails(deduped.map((c) => c.email!).filter(Boolean))
    existingSubscriberStatusByEmail = new Map(existing.map((s) => [s.email, s.status]))
  } catch (e) {
    console.error('[cohort-enroll] subscriber lookup failed:', e instanceof Error ? e.message : String(e))
    return { ok: false, error: 'lookup_failed' }
  }

  // ── Two-phase plan: pre-filter without suppression IO, then run the
  // fail-closed isSuppressedByEmail check ONLY on the survivors, then finalize. ──
  const prePlan = computeEnrollmentPlan(deduped, {
    noEmail,
    suppressedEmails: new Set<string>(),
    existingSubscriberStatusByEmail,
  })
  const suppressedEmails = new Set<string>()
  const checks = await mapWithConcurrency(prePlan.eligible, SUPPRESSION_CONCURRENCY, async (c) => {
    // isSuppressedByEmail fails closed (any read error reports suppressed).
    const res = await deps.isSuppressedByEmail(c.email!, 'email')
    return { email: c.email!, suppressed: res.suppressed }
  })
  for (const r of checks) if (r.suppressed) suppressedEmails.add(r.email)

  const plan = computeEnrollmentPlan(deduped, {
    noEmail,
    suppressedEmails,
    existingSubscriberStatusByEmail,
  })
  const counts: CohortEnrollmentCounts = { ...plan.counts, droppedOverCap }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      counts,
      cohortSizes,
      sample: plan.eligible.slice(0, 25).map((c) => ({
        email: c.email!,
        name: c.name,
        personId: c.personId,
        cohorts: c.cohorts,
      })),
    }
  }

  // ── Real run: write subscriber rows via the SAME activation RPC path the
  // BulkEnrollForm uses. Past clients land in the 'past-client' segment, the
  // rest in 'general'. NO issue is sent here. ───────────────────────────────
  const pastClientEmails = plan.eligible.filter((c) => c.cohorts.includes('past-client')).map((c) => c.email!)
  const generalEmails = plan.eligible.filter((c) => c.cohorts.includes('past-client') === false).map((c) => c.email!)
  let enrolled = 0
  try {
    if (pastClientEmails.length > 0) {
      enrolled += await deps.bulkActivateSubscribers(pastClientEmails, `cohort-enroll:${opts.actorEmail}`, 'past-client')
    }
    if (generalEmails.length > 0) {
      enrolled += await deps.bulkActivateSubscribers(generalEmails, `cohort-enroll:${opts.actorEmail}`, 'general')
    }
  } catch (e) {
    console.error('[cohort-enroll] activation failed:', e instanceof Error ? e.message : String(e))
    return { ok: false, error: 'persist_failed' }
  }

  return { ok: true, dryRun: false, enrolled, counts, cohortSizes }
}
