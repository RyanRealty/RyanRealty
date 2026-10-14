/**
 * WHAT PRICES THE HOUSE AFTER THE COMPARABILITY REVIEW.
 *
 * The picker already seated these sales. The review reads that same set. It
 * does not remove a sale the picker kept, and it does not price a shorter
 * keep (Matt 2026-10-09). Product walls below are the picker's own rules
 * (subtype, multi-unit, ADU, age-restricted, resale against new construction).
 * Fewer than the pricing minimum after those walls is a comp shortage.
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
 * 0.1): ONE comp floor across both ladders (five price-setting sales since
 * 2026-10-07), and "two exemptions and only two" from price-tier grading. The
 * case Falcon was compensating for, the judge
 * cutting the subject's own-plat peers on price, is now a deterministic
 * restoration inside lib/cma/judge.ts, next to the same-street one. That puts
 * the sale back as a kept comp with a reason, instead of putting every excluded
 * sale back with none.
 *
 * A different product never prices the house, whatever the review said and
 * whether or not the review ran: a structure-type exclusion, a sub-type the
 * product class rejects, a duplex or any multi-unit by its public remarks
 * (rule 23, Matt 2026-10-07, multiUnitFromRemarks; symmetric, an ADU is not
 * a unit), a sale whose remarks state an ADU against a subject whose remarks
 * state none (Matt 2026-10-08, "ADU sale skips", aduSaleRefused; not
 * symmetric), age-restricted housing the subject is not part of
 * (lib/pricing/age-restricted.ts), and a new build against an ordinary resale.
 * The multi-unit and ADU words are read only by those two readers, the same
 * ones both search ladders and the review grounding read; PRODUCT_REASON below
 * carries the attached, condo and manufactured words of a review reason only.
 * When the review did not run, the product-matched pool prices with the
 * dispersion guard and the contract's review flag as the backstop.
 */
import { aduSaleRefused, dropsResaleVersusNewBuild, multiUnitFromRemarks } from '@/lib/pricing/classes'
import { productTypeCompatible } from '@/lib/cma/market-area'
import { ageRestrictedMismatch, ownPlatAgeRestrictedShare } from '@/lib/pricing/age-restricted'

const PRODUCT_REASON =
  /\b(product type|different product|townhomes?|townhouses?|condominiums?|condos?|rowhouses?|row houses?|manufactured|lodges?|shared wall|common wall|structure type)\b/i

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
  newConstructionYn?: boolean | null
  publicRemarks?: string | null
  subdivision?: string | null
  /** The selector's own-plat decision (lib/cma/types.ts CmaComp.ownPlat). */
  ownPlat?: boolean | null
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
    // Rule 23: the remarks are read for a multi-unit on both sides. Null
    // remarks on a comp fail open (false on both sides is a match).
    if (multiUnitFromRemarks(comp.publicRemarks) !== multiUnitFromRemarks(args.subject.publicRemarks)) return true
    // The ADU wall: a sale whose remarks state an ADU never prices a subject
    // whose remarks state none. A subject with an ADU keeps both kinds.
    if (aduSaleRefused(args.subject.publicRemarks, comp.publicRemarks)) return true
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
    if (args.exclusivePocket) return false
    return dropsResaleVersusNewBuild(
      {
        yearBuilt: args.subject.yearBuilt,
        newConstructionYn: args.subject.newConstructionYn,
        remarks: args.subject.publicRemarks,
        propertySubType: args.subject.propertySubType,
      },
      {
        yearBuilt: comp.yearBuilt,
        newConstructionYn: comp.newConstructionYn,
        remarks: comp.publicRemarks,
        propertySubType: comp.propertySubType,
      },
      year,
    )
  }
  const pool = args.selected.filter((c) => !hard(c))
  const droppedProduct = args.selected.length - pool.length
  const shortage = pool.length < args.minComps
  const judged = args.verdicts.length > 0
  const base =
    droppedProduct > 0
      ? `Excluded ${droppedProduct} different-product sale(s) before pricing. ${pool.length} product-matched sale(s) remain.`
      : `Priced on the ${pool.length} product-matched sale(s) the picker kept.`
  return {
    comps: pool,
    shortage,
    droppedProduct,
    trace: judged ? `${base} The review reads the same sales and does not remove one the picker kept.` : base,
  }
}
