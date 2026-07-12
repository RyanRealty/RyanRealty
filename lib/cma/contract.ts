/**
 * CMA accuracy contract — the mechanical enforcement of the build process.
 *
 * Every buildCma run evaluates this checklist and records the result in
 * build_summary.accuracy_contract. Two severities:
 *
 *  - hard checks: a violation means the numbers cannot be trusted at all
 *    (missing pricing method, comp with no price/sqft, recommendation outside
 *    its own range, stale comp window). The build FAILS — no draft persists
 *    as clean.
 *  - review checks: the build proceeds but MUST carry needs_review=true so a
 *    broker confirms before anything reaches a client (LLM judgment
 *    unavailable, wide dispersion, methods not converged).
 *
 * Gates-not-prose: this is code on the only path every CMA build takes
 * (lib/cma/build.ts), not a guideline in a skill file.
 */

import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CmaAudit } from '@/lib/cma/audit'

export const COMP_MAX_AGE_MONTHS = 24

export interface ContractCheck {
  id: string
  severity: 'hard' | 'review'
  pass: boolean
  detail: string
}

export interface AccuracyContract {
  version: 'cma-accuracy-v1 (2026-07-11)'
  pass: boolean
  /** True when any review-severity check failed — the CMA must carry needs_review. */
  forceReview: boolean
  checks: ContractCheck[]
}

export function evaluateAccuracyContract(args: {
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
  judgment: CompJudgment | null
  audit: CmaAudit | null
  minComps: number
  marketContextPresent: boolean
}): AccuracyContract {
  const { comps, pricing, judgment, audit, minComps } = args
  const checks: ContractCheck[] = []
  const now = Date.now()
  const maxAgeMs = COMP_MAX_AGE_MONTHS * 30.44 * 86_400_000

  // ── hard checks ──────────────────────────────────────────────────────────
  checks.push({
    id: 'comp-floor',
    severity: 'hard',
    pass: comps.length >= minComps,
    detail: `${comps.length} comps priced (floor ${minComps}).`,
  })
  const badComp = comps.find(
    (c) => !(c.closePrice > 0) || !(c.sqft > 0) || !c.closeDate || now - new Date(c.closeDate).getTime() > maxAgeMs,
  )
  checks.push({
    id: 'comp-data-sanity',
    severity: 'hard',
    pass: !badComp,
    detail: badComp
      ? `Comp ${badComp.listingKey} fails sanity (price/sqft/date missing or older than ${COMP_MAX_AGE_MONTHS} months).`
      : `All comps carry close price, sqft, and a close date within ${COMP_MAX_AGE_MONTHS} months.`,
  })
  checks.push({
    id: 'three-methods',
    severity: 'hard',
    pass: pricing.method1Mid > 0 && pricing.method2 != null && pricing.method3 > 0,
    detail:
      pricing.method2 != null
        ? 'Methods 1, 2, and 3 all computed.'
        : 'Method 2 missing — fewer than 3 comps reached the baseline.',
  })
  checks.push({
    id: 'range-consistency',
    severity: 'hard',
    pass: pricing.conservative <= pricing.recommended && pricing.recommended <= pricing.highEnd,
    detail: `Conservative $${pricing.conservative.toLocaleString()} ≤ recommended $${pricing.recommended.toLocaleString()} ≤ high end $${pricing.highEnd.toLocaleString()}.`,
  })
  checks.push({
    id: 'dispersion-computed',
    severity: 'hard',
    pass: Number.isFinite(pricing.compPpsfCv),
    detail: `Comp $/sqft dispersion CV = ${pricing.compPpsfCv}.`,
  })

  // ── review checks (build proceeds, broker review forced) ─────────────────
  checks.push({
    id: 'llm-judgment-ran',
    severity: 'review',
    pass: judgment != null,
    detail: judgment
      ? `Comparability judgment ran (${judgment.model}, $${judgment.costUsd}): ${judgment.keptKeys.length} kept, ${judgment.verdicts.filter((v) => v.tier === 'exclude').length} excluded.`
      : 'LLM comparability judge did NOT run (no key or call failed) — comps are unvetted; broker review required.',
  })
  checks.push({
    id: 'judgment-verdict-coverage',
    severity: 'review',
    pass: judgment == null || judgment.verdicts.length > 0,
    detail: judgment ? `${judgment.verdicts.length} per-comp verdicts recorded.` : 'n/a (no judgment).',
  })
  checks.push({
    id: 'methods-converged',
    severity: 'review',
    pass: pricing.converged,
    detail: pricing.converged
      ? `Methods within ${pricing.convergenceSpreadPct}% (≤5% tolerance).`
      : `Methods ${pricing.convergenceSpreadPct}% apart — Method 3 governs; broker review required.`,
  })
  checks.push({
    id: 'dispersion-within-limit',
    severity: 'review',
    pass: !pricing.needsReview || !pricing.reviewReason?.includes('price-per-square-foot'),
    detail: pricing.needsReview ? (pricing.reviewReason ?? 'Dispersion flag raised.') : 'Comp set is one market tier.',
  })
  checks.push({
    id: 'adversarial-audit-ran',
    severity: 'review',
    pass: audit != null,
    detail: audit
      ? `Adversarial accuracy audit ran (${audit.model}, $${audit.costUsd}): verdict ${audit.verdict}, ${audit.findings.length} finding(s).`
      : 'Adversarial accuracy audit did NOT run (no key or call failed) — the analysis is unaudited; broker review required.',
  })
  checks.push({
    id: 'adversarial-audit-clean',
    severity: 'review',
    pass: audit == null || audit.verdict === 'pass',
    detail:
      audit == null
        ? 'n/a (no audit).'
        : audit.verdict === 'pass'
          ? `Audit verdict: pass. ${audit.summary}`
          : `Audit verdict: ${audit.verdict}. ${audit.summary} Findings: ${audit.findings
              .map((f) => `[${f.severity}] ${f.claim}`)
              .join(' · ')}`,
  })
  checks.push({
    id: 'market-context-present',
    severity: 'review',
    pass: args.marketContextPresent,
    detail: args.marketContextPresent
      ? 'Verified market context (cache) applied to time adjustments.'
      : 'No market cache row — no time adjustment; broker should sanity-check trend.',
  })

  const hardFail = checks.some((c) => c.severity === 'hard' && !c.pass)
  const reviewFail = checks.some((c) => c.severity === 'review' && !c.pass)
  return {
    version: 'cma-accuracy-v1 (2026-07-11)',
    pass: !hardFail,
    forceReview: reviewFail,
    checks,
  }
}
