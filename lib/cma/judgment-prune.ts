/**
 * WHAT PRICES THE HOUSE AFTER THE COMPARABILITY REVIEW.
 *
 * When the judge ran and the broker did not curate the set, the priced set is
 * the product-matched comps the judge KEPT, strong and weak. A comp it
 * excluded is never priced. Fewer than the pricing minimum is a comp shortage,
 * and the build fails with the existing shortage message rather than printing
 * a number off sales the review threw out.
 *
 * THE FALCON RE-ADMISSION IS RETIRED (2026-09-30). On Falcon 15991 the judge
 * kept 3 of 8 closed sales because it had cut near-acre peers in the subject's
 * own plat on price. The answer then was a second floor, FACTS_STANDALONE_MIN
 * (5): a keep under five priced the WHOLE product-matched pool instead. That
 * re-admitted every sale the judge excluded, at full weight (only `weak` is
 * halved), under a narrative that still described the judge's own cut. On the
 * 2026-09-29 expired batch it put the excluded sale in the priced set with the
 * largest or second-largest reconciliation weight (557 Tyee at 0.54 on
 * cma-714-wrangler-sisters, the 2020 Arena Acres sale at 0.35 on
 * cma-3153-cromwell) beside prose saying four sales were kept. It also broke
 * two of Matt's recorded rulings (marketing_brain_skills/producers/cma/SKILL.md
 * 0.1): ONE comp floor of 3 across both ladders, and "two exemptions and only
 * two" from price-tier grading. The case Falcon was compensating for, the judge
 * cutting the subject's own-plat peers on price, is now a deterministic
 * restoration inside lib/cma/judge.ts, next to the same-street one. That puts
 * the sale back as a kept comp with a reason, instead of putting every excluded
 * sale back with none.
 *
 * A different product never prices the house, whatever the review said and
 * whether or not the review ran: a structure-type exclusion, a sub-type the
 * product class rejects, age-restricted housing the subject is not part of
 * (lib/pricing/age-restricted.ts), and a new build against an ordinary resale.
 * When the review did not run, the product-matched pool prices with the
 * dispersion guard and the contract's review flag as the backstop.
 */
import { isCustomOrNewSubject, isNewBuild, newConstructionCompatible } from '@/lib/pricing/classes'
import { productTypeCompatible } from '@/lib/cma/market-area'
import { ageRestrictedMismatch, ownPlatAgeRestrictedShare } from '@/lib/pricing/age-restricted'
import { dropPocketClosingUnderEveryKept } from '@/lib/pricing/match'

const PRODUCT_REASON =
  /\b(product type|different product|townhomes?|townhouses?|condominiums?|condos?|rowhouses?|row houses?|manufactured|duplex|triplex|quadruplex|lodges?|shared wall|common wall|structure type)\b/i

export type ProductVerdict = {
  listingKey: string
  tier: string
  basis?: string | null
  reason?: string | null
}

export function isHardProductExclusion(v: ProductVerdict): boolean {
  if (v.tier !== 'exclude') return false
  if (v.basis === 'price-tier') return false
  if (v.basis === 'structure-type') return true
  return PRODUCT_REASON.test(v.reason ?? '')
}

type ProductComp = {
  listingKey: string
  propertySubType?: string | null
  yearBuilt?: number | null
  publicRemarks?: string | null
  subdivision?: string | null
  /** The selector's own-plat decision (lib/cma/types.ts CmaComp.ownPlat). */
  ownPlat?: boolean | null
  /** House close only. The cheap-pocket check after bath and size rejection reads it. */
  closePrice?: number | null
  /** Ladder rung. A different-plat pocket sale is `pocket-*`. */
  selectionTier?: string | null
  /** MLS SeniorCommunityYN (lib/cma/types.ts CmaComp.seniorCommunityYn). */
  seniorCommunityYn?: boolean | null
}

type ProductSubject = {
  propertySubType: string | null
  yearBuilt?: number | null
  newConstructionYn?: boolean | null
  publicRemarks?: string | null
  subdivision?: string | null
  seniorCommunityYn?: boolean | null
}

export function pricingCompsAfterJudgment<T extends ProductComp>(args: {
  /** Every candidate the review saw. */
  selected: readonly T[]
  /** The candidates the review kept (strong and weak). Ignored when it did not run. */
  vetted: readonly T[]
  verdicts: readonly ProductVerdict[]
  subject: ProductSubject
  minComps: number
  exclusivePocket?: boolean
  asOfYear?: number
  /**
   * Share of the subject's own-plat sales that are age-restricted, measured by
   * the facts ladder over its whole pool. Absent on the listings ladder, where
   * it is measured over the candidates' own-plat sales instead.
   */
  ownPlatAgeRestrictedShare?: number | null
}): { comps: T[]; shortage: boolean; droppedProduct: number; trace: string } {
  const year = args.asOfYear ?? new Date().getFullYear()
  const byVerdict = new Map(args.verdicts.map((v) => [v.listingKey, v]))
  const subjectNew = isCustomOrNewSubject(
    {
      yearBuilt: args.subject.yearBuilt,
      newConstructionYn: args.subject.newConstructionYn,
      propertySubType: args.subject.propertySubType,
    },
    year,
  )
  const platShare =
    args.ownPlatAgeRestrictedShare !== undefined
      ? args.ownPlatAgeRestrictedShare
      : ownPlatAgeRestrictedShare(args.selected.filter((c) => c.ownPlat === true))
  // Built once, so the subject is read once for the whole set (isAgeRestricted's memo).
  const subjectEvidence = {
    publicRemarks: args.subject.publicRemarks,
    subdivision: args.subject.subdivision,
    seniorCommunityYn: args.subject.seniorCommunityYn,
  }
  const hard = (comp: T): boolean => {
    if (!productTypeCompatible(args.subject.propertySubType, comp.propertySubType ?? null)) return true
    const verdict = byVerdict.get(comp.listingKey)
    if (verdict && isHardProductExclusion(verdict)) return true
    if (
      ageRestrictedMismatch({
        subject: subjectEvidence,
        sale: comp,
        saleInOwnPlat: comp.ownPlat === true,
        ownPlatShare: platShare,
      })
    ) {
      return true
    }
    if (args.exclusivePocket || subjectNew) return false
    return !newConstructionCompatible(
      isNewBuild(args.subject.yearBuilt, year, args.subject.newConstructionYn),
      isNewBuild(comp.yearBuilt, year, null),
    )
  }
  const pool = args.selected.filter((c) => !hard(c))
  const droppedProduct = args.selected.length - pool.length
  const judged = args.verdicts.length > 0
  if (!judged) {
    // No review to hold to: the product-matched pool prices, and the contract's
    // llm-judgment-ran check forces broker review.
    const shortage = pool.length < args.minComps
    return {
      comps: pool,
      shortage,
      droppedProduct,
      trace:
        droppedProduct > 0
          ? `Excluded ${droppedProduct} different-product sale(s) before pricing. ${pool.length} product-matched sale(s) remain.`
          : `Priced on the ${pool.length} product-matched sale(s).`,
    }
  }
  const poolKeys = new Set(pool.map((c) => c.listingKey))
  const reviewKept = args.vetted.filter((c) => poolKeys.has(c.listingKey))
  // Bath and size cuts are already in reviewKept. The cheap-pocket check
  // reads this set, not the ranked set from before those cuts. An own-plat
  // sale that is still here keeps the ladder's 1.3 median. None left: a
  // different-plat pocket close under every remaining comp drops. Under the
  // minimum is the same shortage. Rejected sales are not pulled back.
  const kept = dropPocketClosingUnderEveryKept(reviewKept, subjectNew)
  const pocketDropped = reviewKept.length - kept.length
  // Review exclusions among the product-matched sales, so a structure-type
  // exclusion is counted once, as a different product.
  const excluded = args.verdicts.filter((v) => v.tier === 'exclude' && poolKeys.has(v.listingKey)).length
  if (kept.length < args.minComps) {
    return {
      comps: kept,
      shortage: true,
      droppedProduct,
      trace: `Comparability judgment kept ${kept.length} product-matched sale(s), under the ${args.minComps}-sale minimum. The excluded sales are not priced.`,
    }
  }
  const dropped = [
    excluded > 0 ? `${excluded} excluded by the comparability review` : null,
    droppedProduct > 0 ? `${droppedProduct} different-product sale(s)` : null,
    pocketDropped > 0 ? `${pocketDropped} pocket sale(s) under every remaining kept comp` : null,
  ].filter(Boolean)
  return {
    comps: kept,
    shortage: false,
    droppedProduct,
    trace: `Priced on the ${kept.length} sale(s) the comparability review kept${dropped.length ? `. Not priced: ${dropped.join(', ')}` : ''}.`,
  }
}
