/**
 * Expired-listing lead capture from `/lp/expired-listing`.
 *
 * Specific routing for expired listings (see
 * `marketing_brain_skills/producers/expired-listing-lp/SKILL.md`):
 *  - Carries the prior listingKey for context
 *  - Tags: source:expired-lp, listing:expired
 *  - The detect-expired-listings cron may have already created a FUB person
 *    for this property — dedupe on email+phone+listingKey
 *
 * @stub Wave 1.8 — see existing detect-expired-listings cron at
 * `app/api/cron/detect-expired-listings/route.ts` for the dedupe pattern.
 */

import type { ExpiredLead, LeadResult } from '../types/lead'

export async function createExpiredLead(
  _input: ExpiredLead,
): Promise<LeadResult> {
  throw new Error(
    '[createExpiredLead] NotImplementedError. Wave 1.8 — see docs/EXECUTION_PLAN.md §9.',
  )
}
