/**
 * THE REVIEW'S WEIGHT ON A PRICED SALE in the Method 3 reconciliation: weak at
 * half (bracketing only), everything else at full weight. An automatic set
 * never prices a sale the review excluded (pricingCompsAfterJudgment in
 * lib/cma/judgment-prune.ts), so this never meets an exclude there. A
 * broker-picked set prices as chosen (SKILL.md 0.1), and an exclude verdict on
 * one of its sales carries full weight, as it always has: halving it would
 * change the price on curated CMAs the 2026-09-29 defect never touched, and no
 * ruling asks for that (review of da8dce6, 2026-09-30).
 *
 * The ONE copy of the rule. The CMA and the BPO weight their priced sales with
 * it, and the narrative claim checks read a sale's weight class from it
 * (claimCompOf in lib/cma/narrative-claims.ts), so a weight sentence is checked
 * against the weight the sale actually carried and never against a second copy
 * of the rule that could drift from it.
 *
 * Pure. Its own module so the claim checks can read it without loading the
 * product walls.
 */
export function reviewWeightFactor(tier: string | null | undefined): number {
  return tier === 'weak' ? 0.5 : 1
}
