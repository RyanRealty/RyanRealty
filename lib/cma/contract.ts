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
import { bathCountCompatible, productTypeCompatible } from '@/lib/cma/market-area'
import { customBathCompatible } from '@/lib/pricing/classes'
import type { CompJudgment } from '@/lib/cma/judge'
import type { CmaAudit } from '@/lib/cma/audit'
import type { CmaSiteData } from '@/lib/cma/county'
import { RANGE_REVIEW_SHARE, rangeWiderThanShare } from '@/lib/pricing/review'

// Restrictive/resource base zones where buildability is NOT automatic — a
// dwelling needs a verified current entitlement (SKILL §3.5).
const RESTRICTIVE_ZONE_RE = /\b(EFU|EFUTRB|F1|F2|SM)\b/i

export const COMP_MAX_AGE_MONTHS = 24

export interface ContractCheck {
  /** hard = fail the build; review = force needs_review; info = recorded only,
   *  never gates (the signal it carries is already surfaced elsewhere, e.g. the
   *  confidence tier). */
  id: string
  severity: 'hard' | 'review' | 'info'
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

/** The rungs whose presence means the search had to widen (lib/cma/comp-tiers.ts). */
export const WIDENED_TIER_MARK = 'widened-disclosed'

export function evaluateAccuracyContract(args: {
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
  judgment: CompJudgment | null
  audit: CmaAudit | null
  site?: CmaSiteData | null
  minComps: number
  marketContextPresent: boolean
  subjectSubType?: string | null
  subjectBaths?: number | null
  /**
   * The rungs the selection actually used. The disclosed widening
   * (`widened-disclosed-24mo`) only runs when the bounded ladder came up
   * short, so a document that carries it is by construction the marginal one:
   * it forces broker review (Matt 2026-09-09, choosing the widening AND
   * "rebuild, hold for review" for the backlog).
   */
  tiersUsed?: readonly string[] | null
  /**
   * True when the SELECTOR classified the subject custom/new. The bath cut is
   * graded with the rule selection actually applied: lib/pricing/match.ts and
   * the lib/cma/comps.ts fallback open a plus-or-minus-one whole-bath window
   * for this class (Matt: a 3-bath custom peer prices a 4-bath custom house),
   * and exact-floor everywhere else. Grading with the resale rule regardless
   * hard-failed 59 of 136 live builds on comps the engine's own ladder was
   * told to keep — every one of them off by exactly one bath.
   */
  subjectIsCustomOrNew?: boolean
  failedAsk?: number | null
}): AccuracyContract {
  const { comps, pricing, judgment, audit, site, minComps, subjectSubType, subjectBaths, subjectIsCustomOrNew } = args
  const widened = (args.tiersUsed ?? []).some((t) => t.includes(WIDENED_TIER_MARK))
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
  const failedAsk = args.failedAsk ?? pricing.failedAsk ?? null
  if (failedAsk != null && failedAsk > 0) {
    const over = pricing.recommended > failedAsk || pricing.highEnd > failedAsk
    checks.push({
      id: 'expired-list-cap',
      severity: 'hard',
      pass: !over,
      detail: over
        ? `Expired last list was $${failedAsk.toLocaleString()}. Recommended $${pricing.recommended.toLocaleString()} / high end $${pricing.highEnd.toLocaleString()} sits above the price that already failed to sell.`
        : `Expired last list $${failedAsk.toLocaleString()} caps the printed list. Recommended $${pricing.recommended.toLocaleString()} and high end $${pricing.highEnd.toLocaleString()} sit at or below it.`,
    })
  }
  if (pricing.currentAsk != null && pricing.currentAsk > 0) {
    // INFO, never gates: on a live-listed subject the ask ships BESIDE the
    // comp evidence (Matt 2026-08-27, show both never blend). The gap is a
    // finding for the broker, not a defect in the build.
    const high = Math.max(pricing.valueLow, pricing.valueHigh)
    const low = Math.min(pricing.valueLow, pricing.valueHigh)
    const gapPct =
      pricing.currentAsk > high
        ? Math.round(((pricing.currentAsk - high) / high) * 100)
        : pricing.currentAsk < low
          ? -Math.round(((low - pricing.currentAsk) / low) * 100)
          : 0
    checks.push({
      id: 'ask-vs-support',
      severity: 'info',
      pass: true,
      detail: `Subject is on the market at $${pricing.currentAsk.toLocaleString()}; comp support $${low.toLocaleString()}–$${high.toLocaleString()} (gap ${gapPct}%). Shown side by side on the document.`,
    })
  }
  const crossType = comps.find((c) => !productTypeCompatible(subjectSubType ?? null, c.propertySubType))
  checks.push({
    id: 'product-type-match',
    // Apples to apples only (Matt 2026-09-08). A cross-type sale is a hard
    // refusal. A subject whose own type was never stored cannot be checked,
    // and an unchecked type is not a pass: it forces a broker's read.
    severity: subjectSubType == null ? 'review' : 'hard',
    pass: subjectSubType != null && !crossType,
    detail:
      subjectSubType == null
        ? 'Subject property type was not stored, so the sales could not be matched to it by type.'
        : crossType
          ? `Comp ${crossType.address} is ${crossType.propertySubType ?? 'an unknown type'} and cannot price a ${subjectSubType}.`
          : `Every priced sale is the same property type as the subject (${subjectSubType}).`,
  })
  const bathRuleOk = subjectIsCustomOrNew ? customBathCompatible : bathCountCompatible
  // The selector may admit a sale ONE room apart on the subject's own ground
  // and record that it did (`roomDifference`, lib/pricing/room-counts.ts). The
  // contract grades what the selector decided; it does not re-apply a wall the
  // rule deliberately opened. A bath gap with no such record is still a hard
  // failure — that is a sale nothing signed off on.
  const crossBath = comps.find(
    (c) => !bathRuleOk(subjectBaths ?? null, c.baths) && !(c.roomDifference ?? []).includes('baths'),
  )
  const bathNoted = comps.filter((c) => (c.roomDifference ?? []).includes('baths')).length
  checks.push({
    id: 'bath-count-match',
    severity: 'hard',
    pass: subjectBaths == null || !crossBath,
    detail:
      subjectBaths == null
        ? 'Subject bathroom count was not stored. Bath-count gate skipped.'
        : crossBath
          ? subjectIsCustomOrNew
            ? `Comp ${crossBath.address} has ${crossBath.baths ?? 'an unknown'} bath, more than one whole bathroom away from this ${subjectBaths}-bath custom or new home.`
            : `Comp ${crossBath.address} has ${crossBath.baths ?? 'an unknown'} bath and cannot price a ${subjectBaths}-bath house.`
          : bathNoted > 0
            ? `Every priced sale matches the subject's ${subjectBaths} bathrooms, except ${bathNoted} on this home's own ground that sit one bathroom away and are disclosed as such.`
            : subjectIsCustomOrNew
              ? `Custom or new subject: every priced sale is within one whole bathroom of the subject (${subjectBaths}).`
              : `Every priced sale has the same whole bathroom count as the subject (${subjectBaths}).`,
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
    // INFO, not a gate: a >5% method spread already lowers the displayed
    // confidence tier (pricing.ts) and is disclosed on the pricing page. A
    // Moderate/Supportable CMA is a normal, sendable outcome — the confidence
    // field IS the signal, so this does not raise needs_review on its own.
    // (Recalibration 2026-07-12: methods-converged fired on ~48% of a real
    // expired-listing batch, drowning the flag.)
    id: 'methods-converged',
    severity: 'info',
    pass: pricing.converged,
    detail: pricing.converged
      ? `Methods within ${pricing.convergenceSpreadPct}% (≤5% tolerance).`
      : `Methods ${pricing.convergenceSpreadPct}% apart — Method 3 governs; confidence lowered to ${pricing.confidence} accordingly.`,
  })
  checks.push({
    id: 'dispersion-within-limit',
    severity: 'review',
    pass: !pricing.needsReview || !pricing.reviewReason?.includes('price-per-square-foot'),
    detail: pricing.needsReview ? (pricing.reviewReason ?? 'Dispersion flag raised.') : 'Comp set is one market tier.',
  })
  // Matt 2026-09-09: a range wider than RANGE_REVIEW_SHARE on either side of
  // the recommended list is a broker's call, like an audit finding. The detail
  // carries "wider than" so lib/pricing/review.ts prints the seller sentence.
  {
    const width = rangeWiderThanShare(pricing)
    const pct = (v: number) => `${Math.round(v * 100)}%`
    checks.push({
      id: 'range-width',
      severity: 'review',
      pass: !width.wide,
      detail: width.wide
        ? `The value range is wider than ${pct(RANGE_REVIEW_SHARE)} of the recommended list on a side: $${Math.min(pricing.valueLow, pricing.valueHigh).toLocaleString()} to $${Math.max(pricing.valueLow, pricing.valueHigh).toLocaleString()} around $${pricing.recommended.toLocaleString()} (${pct(width.lowShare)} below, ${pct(width.highShare)} above).`
        : `Value range within ${pct(RANGE_REVIEW_SHARE)} of the recommended list on both sides (${pct(width.lowShare)} below, ${pct(width.highShare)} above).`,
    })
  }
  // THE NUMBER HAS TO SIT INSIDE THE SALES THAT SUPPORT IT (Matt 2026-09-10).
  // A document can print "the sales support $577,000 to $832,000" over a
  // headline of $535,000 and nothing here caught it. The failed-ask cap
  // legitimately pulls a recommendation BELOW the band — a home that could not
  // sell at its last ask may not be re-listed above it, whatever the comps say
  // — so this forces review rather than failing the build, and the sentence
  // names the cap when the cap is the reason.
  {
    const low = Math.min(pricing.valueLow, pricing.valueHigh)
    const high = Math.max(pricing.valueLow, pricing.valueHigh)
    const rec = pricing.recommended
    const inside = rec >= low && rec <= high
    const gapPct = inside ? 0 : rec > high ? Math.round(((rec - high) / high) * 100) : Math.round(((low - rec) / low) * 100)
    const capped = pricing.clamp != null && rec < low
    checks.push({
      id: 'recommendation-in-range',
      severity: 'review',
      pass: inside,
      detail: inside
        ? `Recommended $${rec.toLocaleString()} sits inside the supported range $${low.toLocaleString()} to $${high.toLocaleString()}.`
        : rec > high
          ? `Recommended $${rec.toLocaleString()} sits ${gapPct}% ABOVE the top of the range the sales support ($${low.toLocaleString()} to $${high.toLocaleString()}). Nothing in the comp evidence carries a list that high.`
          : capped
            ? `Recommended $${rec.toLocaleString()} sits ${gapPct}% below the range the sales support ($${low.toLocaleString()} to $${high.toLocaleString()}), because the price that already failed to sell caps what this home can be listed at. Confirm the two numbers read together on the page.`
            : `Recommended $${rec.toLocaleString()} sits ${gapPct}% below the range the sales support ($${low.toLocaleString()} to $${high.toLocaleString()}) with no cap explaining the gap.`,
    })
  }
  checks.push({
    id: 'disclosed-widening',
    severity: 'review',
    pass: !widened,
    detail: widened
      ? 'The bounded search came up short, so the ladder widened one more step (older sales, a wider size band, and sales from a resort community this home is not in). The document says so, and a broker confirms the set before it goes out.'
      : 'Every sale came from the bounded ladder; no widening was needed.',
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
  // ── authoritative site-data gates (SKILL §3.5/§3.6, §0 GIS-authoritative) ──
  // Non-municipal (rural/acreage) properties MUST carry verified zoning + water
  // + septic; unresolved site facts on such a property force broker review
  // rather than shipping a guess. Municipal properties state city water/sewer.
  const nonMunicipal = site != null && !site.isMunicipal
  checks.push({
    id: 'site-data-resolved',
    severity: 'review',
    pass: site == null || site.isMunicipal || site.resolved,
    detail:
      site == null
        ? 'No site-data resolver ran.'
        : site.isMunicipal
          ? `Municipal: zone ${site.zone ?? '—'}, city water/sewer.`
          : site.resolved
            ? `Zone ${site.zone ?? '—'}, water ${site.water.source}, septic ${site.septic.status}.`
            : `Non-municipal property with unresolved site facts (zone ${site.zone ?? '?'}, water ${site.water.source}, septic ${site.septic.status}) — confirm zoning/well/septic from records or the seller before release.`,
  })
  checks.push({
    id: 'restrictive-zoning-entitlement',
    severity: 'review',
    pass: !(site?.zone && RESTRICTIVE_ZONE_RE.test(site.zone)),
    detail:
      site?.zone && RESTRICTIVE_ZONE_RE.test(site.zone)
        ? `Zone ${site.zone} is restrictive — buildability is not automatic and requires a verified current entitlement (CUP / lot-of-record / farm dwelling). Broker must confirm before any value rests on buildability.`
        : 'Zoning does not restrict buildability, or is municipal.',
  })
  void nonMunicipal
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
