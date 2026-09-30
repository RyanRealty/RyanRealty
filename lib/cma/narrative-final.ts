/**
 * THE ONE GATE A COMPARABILITY NARRATIVE PASSES BEFORE IT PRINTS
 * (review of da8dce6, 2026-09-30).
 *
 * The CMA and the BPO both print the judge's narrative beside the sales that
 * priced, and the CMA's narrative repair swaps in a rewritten one. Each of the
 * three used to run its own version of the check. The CMA took out refuted
 * sentences and then gated on the full integrity check. The BPO only took out
 * refuted sentences, and fell back to the honest line only when nothing was
 * left, so a narrative carrying a finding the strip does not remove (a named
 * sale that is not in the report, an over-stated "All N comps") still printed.
 * The repair acceptance compared the model's raw rewrite against a narrative
 * the first pass had already cleaned, so a rewrite lost to sentences the same
 * pass would have taken out of it. One function now does it, in one order:
 *
 *   1. take out every sentence the final priced set refutes
 *      (alignNarrativeToFinalSet, lib/cma/judge-consistency.ts);
 *   2. run the full integrity check the audit gates on over what is left
 *      (checkNarrativeIntegrity, lib/cma/audit-narrative-integrity.ts);
 *   3. print the honest count line, split by reason, when nothing is left or
 *      a finding remains.
 *
 * Pure and synchronous. No I/O, no model call.
 */

import type { AuditFinding } from '@/lib/cma/audit'
import { checkNarrativeIntegrity } from '@/lib/cma/audit-narrative-integrity'
import { alignNarrativeToFinalSet, honestComparabilityLine, type ComparabilityBreakdown } from '@/lib/cma/judge-consistency'
import { claimCompOf, type ClaimFinding } from '@/lib/cma/narrative-claims'
import type { CmaAdjustedComp, CmaComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

export type FinalNarrative = {
  /** What prints: the narrative's true sentences, or the honest count line. */
  narrative: string
  /** The sentences the final priced set refutes, taken out in step 1. */
  removed: ClaimFinding[]
  /** Integrity findings on what step 1 left. Non-empty means the honest line printed. */
  integrity: AuditFinding[]
  /** True when the honest count line replaced the narrative. */
  fellBack: boolean
}

export function finalComparabilityNarrative(args: {
  /** The model's narrative (or an accepted rewrite), never an earlier pass's output. */
  narrative: string | null | undefined
  /** The sales that price, adjusted. */
  priced: readonly CmaAdjustedComp[]
  /** Every candidate the comparability review saw, priced or not. */
  candidates: readonly CmaComp[]
  /** The review's exclusions, with their reasons (the integrity check learns names from them). */
  excluded: ReadonlyArray<{ listingKey: string; reason: string }>
  subject: Pick<CmaSubject, 'streetAddress' | 'city' | 'subdivision'> & { lotAcres?: number | null }
  market: Pick<CmaMarketContext, 'geoLabel'> | null
  /** The review's tier per listing key. */
  tierByKey: ReadonlyMap<string, string>
  /** Why each candidate that does not price is out, for the honest line. */
  breakdown: Omit<ComparabilityBreakdown, 'keptCount'>
}): FinalNarrative {
  const claim = (c: CmaComp) => claimCompOf(c, args.tierByKey.get(c.listingKey))
  const aligned = alignNarrativeToFinalSet({
    narrative: args.narrative ?? '',
    priced: args.priced.map(claim),
    candidates: args.candidates.map(claim),
    subject: { streetAddress: args.subject.streetAddress, lotAcres: args.subject.lotAcres ?? null },
  })
  const text = aligned.narrative.trim()
  const integrity = text
    ? checkNarrativeIntegrity({
        narrative: text,
        comps: [...args.priced],
        excluded: [...args.excluded],
        subject: args.subject,
        market: args.market,
        candidates: args.candidates,
        tierByKey: args.tierByKey,
      })
    : []
  if (text && integrity.length === 0) {
    return { narrative: text, removed: aligned.removed, integrity, fellBack: false }
  }
  return {
    narrative: honestComparabilityLine({ keptCount: args.priced.length, ...args.breakdown }),
    removed: aligned.removed,
    integrity,
    fellBack: true,
  }
}

/**
 * THE MODEL'S NARRATIVE, GATED AGAIN ON EVERY SET THE BUILD PRICES (second
 * review of da8dce6, 2026-09-30).
 *
 * A build can price more than once: the audit repair drops comps and prices
 * again, and an accepted narrative repair prices again. Each pass used to gate
 * `judgment.narrative`, which the pass before had already overwritten with its
 * own output. So the second pass read the first pass's count line as prose:
 * "Five closed sales were retained. Three candidate sales were excluded as a
 * different market segment." over a repaired set of four lost its count
 * sentence and its exclusion sentence, and shipped with no exclusion
 * disclosure; and a sentence of the judge's that the first set refuted but the
 * repaired set bears out could never come back.
 *
 * The gate keeps the text every pass reads (the judge's narrative, or a
 * rewrite once one is adopted) apart from the text any pass printed, and
 * splits the candidates that do not price by reason against the set the review
 * and the product wall let through (`gatedKeys`), so a sale the audit removed
 * later is counted as the audit's.
 */
export function comparabilityNarrativeGate(
  judgeNarrative: string | null | undefined,
  ctx: {
    candidates: readonly CmaComp[]
    excluded: ReadonlyArray<{ listingKey: string; reason: string }>
    subject: Pick<CmaSubject, 'streetAddress' | 'city' | 'subdivision'> & { lotAcres?: number | null }
    market: Pick<CmaMarketContext, 'geoLabel'> | null
    tierByKey: ReadonlyMap<string, string>
    /** The sales the review and the product wall let through, before any audit repair. */
    gatedKeys: ReadonlySet<string>
    /** Candidates the product wall kept out before pricing. */
    differentProduct: number
  },
) {
  let source = judgeNarrative ?? ''
  let replaced: string | null = null
  const breakdown = (priced: ReadonlyArray<{ listingKey: string }>): Omit<ComparabilityBreakdown, 'keptCount'> => {
    const keys = new Set(priced.map((c) => c.listingKey))
    return {
      reviewExcluded: Math.max(0, ctx.candidates.length - ctx.gatedKeys.size - ctx.differentProduct),
      differentProduct: ctx.differentProduct,
      auditRemoved: [...ctx.gatedKeys].filter((k) => !keys.has(k)).length,
    }
  }
  const run = (narrative: string, priced: readonly CmaAdjustedComp[]): FinalNarrative =>
    finalComparabilityNarrative({
      narrative,
      priced,
      candidates: ctx.candidates,
      excluded: ctx.excluded,
      subject: ctx.subject,
      market: ctx.market,
      tierByKey: ctx.tierByKey,
      breakdown: breakdown(priced),
    })
  return {
    /** The text every pass is gated from: the judge's narrative, or an adopted rewrite. */
    get source(): string {
      return source
    },
    /** Why each candidate that does not price is out, for this priced set. */
    breakdown,
    /** The source, gated against this priced set. */
    gate: (priced: readonly CmaAdjustedComp[]): FinalNarrative => run(source, priced),
    /**
     * A rewrite gated against this priced set. When true prose survives it
     * becomes the source every later pass is gated from; a rewrite the gate
     * reduces to the count line is not adopted.
     */
    adopt(rewrite: string, priced: readonly CmaAdjustedComp[]): FinalNarrative & { adopted: boolean } {
      const out = run(rewrite, priced)
      if (out.fellBack) return { ...out, adopted: false }
      replaced = source
      source = rewrite
      return { ...out, adopted: true }
    },
    /** Put back the source the last adoption replaced. */
    revert(): void {
      if (replaced == null) return
      source = replaced
      replaced = null
    },
  }
}
