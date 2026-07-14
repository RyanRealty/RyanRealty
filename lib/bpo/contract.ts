/**
 * BPO accuracy contract — the CMA contract plus the BPO's own invariants
 * (Matt directive 2026-07-11: BPOs carry the same enforced accuracy process
 * as CMAs — judgment, adversarial audit, mechanical contract).
 *
 * Reuses evaluateAccuracyContract (comp floor / data sanity / three methods /
 * dispersion / judgment / audit checks) and appends opinion-level checks:
 *  - hard: the opinion sits inside its own stated range;
 *  - hard: the active-listing ceiling held (an active listing caps the
 *    opinion at the current ask — opinion.ts owns the rule, this verifies it);
 *  - review: the opinion confidence was downgraded below the comp-pricing
 *    confidence (the >5% anchor-divergence rule in opinion.ts fired — a
 *    broker should read why before the document goes out).
 */

import { evaluateAccuracyContract, type AccuracyContract, type ContractCheck } from '@/lib/cma/contract'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CmaAudit } from '@/lib/cma/audit'
import type { CmaSiteData } from '@/lib/cma/county'
import type { BpoListingHistory, BpoOpinion } from '@/lib/bpo/types'

export function evaluateBpoAccuracyContract(args: {
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
  judgment: CompJudgment | null
  audit: CmaAudit | null
  opinion: BpoOpinion
  history: BpoListingHistory
  site?: CmaSiteData | null
  minComps: number
  marketContextPresent: boolean
}): AccuracyContract {
  const base = evaluateAccuracyContract(args)
  const { opinion, history } = args
  const checks: ContractCheck[] = [...base.checks]

  checks.push({
    id: 'opinion-range-consistency',
    severity: 'hard',
    pass: opinion.valueLow <= opinion.opinionValue && opinion.opinionValue <= opinion.valueHigh,
    detail: `Opinion $${opinion.opinionValue.toLocaleString()} within its stated range $${opinion.valueLow.toLocaleString()}–$${opinion.valueHigh.toLocaleString()}.`,
  })

  const activeList = history.currentIsActive ? history.currentListPrice : null
  checks.push({
    id: 'active-ceiling-consistency',
    severity: 'hard',
    pass: activeList == null || opinion.opinionValue <= activeList,
    detail:
      activeList == null
        ? 'No active listing — ceiling rule not applicable.'
        : `Active listing at $${activeList.toLocaleString()} caps the opinion; opinion is $${opinion.opinionValue.toLocaleString()}.`,
  })

  checks.push({
    id: 'opinion-confidence-downgrade',
    severity: 'review',
    pass: opinion.confidence === args.pricing.confidence,
    detail:
      opinion.confidence === args.pricing.confidence
        ? `Opinion confidence matches comp-pricing confidence (${opinion.confidence}).`
        : `Opinion confidence (${opinion.confidence}) diverges from comp-pricing confidence (${args.pricing.confidence}) — the listing-history/ceiling reconciliation moved it; broker should read the reconciliation before release.`,
  })

  const hardFail = checks.some((c) => c.severity === 'hard' && !c.pass)
  const reviewFail = checks.some((c) => c.severity === 'review' && !c.pass)
  return { version: base.version, pass: !hardFail, forceReview: reviewFail, checks }
}
