/**
 * Buyer lead capture: listing inquiry, alert signup, schedule tour.
 *
 * Routes the lead into Follow Up Boss with per-broker attribution from the
 * `rr_agent_attribution` cookie (defaults to Matt if no cookie is set).
 *
 * Side effects: POST to FUB API, optional iMessage alert to assigned broker,
 * write to `public.leads` for audit.
 *
 * @stub Wave 1.8 — see existing seller-LP wiring at
 * `app/lp/seller-home-value/page.tsx` for the FUB-routing pattern this should
 * follow.
 */

import type { BuyerLead, LeadResult } from '../types/lead'

export async function createBuyerLead(
  _input: BuyerLead,
): Promise<LeadResult> {
  throw new Error(
    '[createBuyerLead] NotImplementedError. Wave 1.8 — see docs/EXECUTION_PLAN.md §9.',
  )
}
