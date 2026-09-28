/**
 * Judgment may thin a priced set only when Matt's document floor still holds.
 *
 * Falcon 15991: the ladder reached 8 closed sales; judgeComps kept 3 because
 * near-acre same-plat peers had already been cut. buildCma then accepted that
 * prune because the floor was MIN_COMPS (3). FACTS_STANDALONE_MIN /
 * BOUNDARY_EXIT_BELOW is the document floor (≥5). Grok cannot starve a filled
 * ladder below that.
 *
 * A different product is not that case. Structure-type exclusions, and a new
 * build priced against an ordinary resale, are dropped even when the keep
 * list is shorter than the floor. If that leaves fewer than the pricing
 * minimum, the build is a comp shortage, not a price off the mismatches.
 */
import { FACTS_STANDALONE_MIN } from '@/lib/pricing/ladder'
import { isCustomOrNewSubject, isNewBuild, newConstructionCompatible } from '@/lib/pricing/classes'
import { productTypeCompatible } from '@/lib/cma/market-area'

export const JUDGMENT_PRUNE_FLOOR = FACTS_STANDALONE_MIN

const PRODUCT_REASON =
  /\b(product type|different product|townhomes?|townhouses?|condominiums?|condos?|rowhouses?|row houses?|manufactured|duplex|triplex|quadruplex|lodges?|shared wall|common wall|structure type)\b/i

export function pricedSetAfterJudgment<T>(selected: readonly T[], vetted: readonly T[]): T[] {
  return vetted.length >= JUDGMENT_PRUNE_FLOOR ? [...vetted] : [...selected]
}

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
}

type ProductSubject = {
  propertySubType: string | null
  yearBuilt?: number | null
  newConstructionYn?: boolean | null
}

export function pricingCompsAfterJudgment<T extends ProductComp>(args: {
  selected: readonly T[]
  vetted: readonly T[]
  verdicts: readonly ProductVerdict[]
  subject: ProductSubject
  minComps: number
  exclusivePocket?: boolean
  asOfYear?: number
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
  const hard = (comp: T): boolean => {
    if (!productTypeCompatible(args.subject.propertySubType, comp.propertySubType ?? null)) return true
    const verdict = byVerdict.get(comp.listingKey)
    if (verdict && isHardProductExclusion(verdict)) return true
    if (args.exclusivePocket || subjectNew) return false
    return !newConstructionCompatible(
      isNewBuild(args.subject.yearBuilt, year, args.subject.newConstructionYn),
      isNewBuild(comp.yearBuilt, year, null),
    )
  }
  const pool = args.selected.filter((c) => !hard(c))
  const droppedProduct = args.selected.length - pool.length
  const poolKeys = new Set(pool.map((c) => c.listingKey))
  const vettedPool = args.vetted.filter((c) => poolKeys.has(c.listingKey))
  const judged = args.verdicts.length > 0
  // A keep under the pricing minimum is not a thin price-tier cut of a
  // filled ladder. The excluded sales do not come back. Zero kept is the
  // case a widened search prices after the judge has already rejected it.
  if (judged && vettedPool.length < args.minComps) {
    return {
      comps: vettedPool,
      shortage: true,
      droppedProduct,
      trace: `Comparability judgment kept ${vettedPool.length} sale(s), under the ${args.minComps}-sale minimum. The excluded sales are not priced.`,
    }
  }
  const comps = vettedPool.length >= JUDGMENT_PRUNE_FLOOR ? vettedPool : pool
  const shortage = comps.length < args.minComps
  const trace =
    droppedProduct > 0
      ? `Excluded ${droppedProduct} different-product sale(s) before pricing. ${comps.length} product-matched sale(s) remain.`
      : vettedPool.length >= JUDGMENT_PRUNE_FLOOR
        ? `Priced on the ${vettedPool.length}-comp vetted set.`
        : `Comparability judgment would keep only ${vettedPool.length} comps, below the ${JUDGMENT_PRUNE_FLOOR}-comp floor, so the ${pool.length}-comp product-matched set was priced instead.`
  return { comps, shortage, droppedProduct, trace }
}
