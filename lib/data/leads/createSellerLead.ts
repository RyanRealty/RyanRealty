/**
 * Seller lead capture: home valuation request from `/lp/seller-home-value`.
 *
 * Routes into FUB with the locked seller workflow (see
 * `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`):
 *  - Tags: source:seller-lp, contact:do-not-call (initial), workflow:seller-v2
 *  - Stage: Inquiry
 *  - Action plan: "Seller LP v2 master"
 *  - Round-robin assignment among the 3 brokers unless cookie pins one
 *
 * @stub Wave 1.8 — the FUB-routing logic already exists at
 * `app/lp/seller-home-value/page.tsx`; this stub will absorb that logic
 * when the LP migrates to the DAL.
 */

import type { SellerLead, LeadResult } from '../types/lead'

export async function createSellerLead(
  _input: SellerLead,
): Promise<LeadResult> {
  throw new Error(
    '[createSellerLead] NotImplementedError. Wave 1.8 — see docs/EXECUTION_PLAN.md §9.',
  )
}
