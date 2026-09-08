/**
 * The review flag, on the document.
 *
 * tasteReview round three, §2 item 1: two of the four exemplars carried
 * `needsReview: true` and rendered as clean opinions. cma-19968's own
 * `reviewReason` read "the recommendation ... makes the recommendation
 * indefensible", and `grep -iE 'needs review|confidence|indefensible'` over the
 * rendered document returned nothing. A document whose own audit calls it
 * indefensible was indistinguishable, to a reader and to Matt, from one that is
 * clean.
 *
 * This module writes `pricing.review`, which `render_args` carries, so a
 * renderer can show the broker a banner without deciding anything.
 *
 * WHY THE REASONS ARE REWRITTEN, NEVER PASSED THROUGH. `reviewReason` is
 * engine prose: it says "comp", it quotes $/sqft dispersion, it names backtest
 * quantiles, and the adversarial audit writes whatever it likes into it —
 * "indefensible" among them. render_args is read by the SELLER document as
 * well as the admin view, so nothing on it may be a string only a broker
 * should see. Each recognized cause maps to one plain sentence here, and
 * anything unrecognized maps to the generic one. A cause that cannot be
 * classified still raises the banner; it just does not leak the wording.
 */

import type {
  CmaPricingClamp,
  CmaPricingReview,
  CmaPricingAuditVerdict,
  CmaPricingReviewSeverity,
} from '@/lib/cma/types'

/**
 * One sentence per cause. Seller-safe: no engine vocabulary, nothing that
 * reads as an accusation, and every one of them true whenever it is written.
 */
export const REVIEW_REASONS = {
  dispersion:
    'The sales behind this price are spread widely per square foot, so a broker confirms the selection before this goes out.',
  failedAskCeiling:
    'The sales support more than the price that already failed to sell, so a broker confirms the asking price before this goes out.',
  auditFindings:
    'An independent review pass recorded findings on this analysis, and a broker answers them before this goes out.',
  auditMissing:
    'The independent review pass did not run on this build, so a broker reads it before this goes out.',
  other: 'A broker reviews this document before it is sent.',
} as const

/**
 * THE ONE SENTENCE A LETTER OR A PDF PRINTS.
 *
 * Round four, class C: `pricing.review` reached only the served admin route,
 * because using it meant reading four fields and knowing which combinations
 * mattered. The letter and the PDF a broker actually sends carried no trace at
 * all. These are seller-safe, already through the voice canon, and a renderer
 * prints one verbatim rather than composing its own.
 */
export const RENDERER_NOTICE = {
  blocked:
    'This report is under broker review and is not final. Do not rely on the price in it until a broker has signed off.',
  review: 'This report is under broker review and is not final.',
} as const

/**
 * How loud the surface has to be, in one word.
 *
 * 'blocked' is reserved for an audit verdict of `fail`: the independent pass
 * whose only job is to refute the analysis says it does not stand. Everything
 * else that needs a person is 'review'. The engine's own flag can raise the
 * severity and can never lower it.
 */
function severityFor(needsReview: boolean, verdict: CmaPricingAuditVerdict | null): CmaPricingReviewSeverity {
  if (verdict === 'fail') return 'blocked'
  return needsReview ? 'review' : 'none'
}

/**
 * CONFIDENCE DERIVES FROM THE VERDICT (round four, class C).
 *
 * cma-19968 stamped confidence "High" in the same object that carried
 * `verdict: 'fail'`, `needsReview: true` and three critical findings, because
 * confidence is computed from the comparable set's price-per-square-foot
 * dispersion and nothing downstream of the adversarial audit ever touched it.
 * A tight set of sales the refuter rejects is still a tight set of sales; it
 * is not a reason for a reader to lean on the number.
 *
 * The mapping only ever moves DOWN, and it names what moved it so the change
 * is never silent.
 */
export function confidenceForVerdict(
  confidence: 'High' | 'Moderate' | 'Supportable',
  verdict: CmaPricingAuditVerdict | null | undefined,
): { confidence: 'High' | 'Moderate' | 'Supportable'; reason: string | null } {
  const rank = { High: 2, Moderate: 1, Supportable: 0 } as const
  const ceiling: 'High' | 'Moderate' | 'Supportable' =
    verdict === 'fail' ? 'Supportable' : verdict === 'review' || verdict === 'did-not-run' ? 'Moderate' : 'High'
  if (rank[confidence] <= rank[ceiling]) return { confidence, reason: null }
  return {
    confidence: ceiling,
    reason:
      verdict === 'fail'
        ? 'An independent review pass could not stand behind this price, so the confidence stated here is held at the lowest of the three.'
        : 'An independent review pass left questions on this analysis, so the confidence stated here is held below the top of the three.',
  }
}

/**
 * The banner block. `needsReview` is the engine's own flag, never re-derived:
 * anything that set it — the dispersion guard, the failed-ask ceiling, the
 * accuracy contract, the adversarial audit — keeps it set here.
 */
export function buildPricingReview(args: {
  needsReview: boolean
  reviewReason: string | null | undefined
  clamp?: CmaPricingClamp | null
  auditVerdict?: CmaPricingAuditVerdict | null
}): CmaPricingReview {
  const verdict = args.auditVerdict ?? null
  // THE DOCUMENT MAY NEVER BE QUIETER THAN THE QUEUE. `resolveCmaQueueState`
  // sends a fail, a review and a did-not-run to `audit-failed`, `flagged` and
  // `unvetted` whatever the engine flag says, so the banner has to raise on
  // them too. The accuracy contract's forceReview normally sets the engine
  // flag first; this is the case where it did not.
  const needsReview =
    args.needsReview || verdict === 'fail' || verdict === 'review' || verdict === 'did-not-run'
  if (!needsReview) {
    return { needsReview: false, reasons: [], auditVerdict: verdict, severity: 'none', rendererNotice: null }
  }
  const severity = severityFor(true, verdict)

  const raw = (args.reviewReason ?? '').toLowerCase()
  const reasons: string[] = []
  const add = (r: string) => {
    if (!reasons.includes(r)) reasons.push(r)
  }

  if (/price-per-square-foot|per-square-foot range|variation|dispers/.test(raw)) {
    add(REVIEW_REASONS.dispersion)
  }
  if (args.clamp != null || /asking that (just )?failed|failed-ask/.test(raw)) {
    add(REVIEW_REASONS.failedAskCeiling)
  }
  if (verdict === 'fail' || verdict === 'review' || /audit/.test(raw)) {
    add(REVIEW_REASONS.auditFindings)
  }
  if (verdict === 'did-not-run') add(REVIEW_REASONS.auditMissing)
  if (reasons.length === 0) add(REVIEW_REASONS.other)

  return {
    needsReview: true,
    reasons,
    auditVerdict: verdict,
    severity,
    rendererNotice: severity === 'blocked' ? RENDERER_NOTICE.blocked : RENDERER_NOTICE.review,
  }
}
