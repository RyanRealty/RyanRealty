/**
 * THE OPINION OF VALUE ON A HOME THAT IS ON THE MARKET (Matt 2026-10-08,
 * "$716,000, the likely sale"; SKILL.md §0.3 rule 27).
 *
 * 3062 NW Kelly Hill is listed with another brokerage at $699,999. Its cover
 * read "Our opinion of value $733,000" and the next page said the three sales
 * that set it "point to a sale near $716,000 once each is weighted by how
 * closely it matches your home" (reader review 2026-10-08). $733,000 was the
 * list recommendation: $736,000 held to the top of the band ($733,116) and
 * rounded. A list figure is a listing strategy, and a home under another
 * broker's listing gets no listing strategy from us, only an opinion of what
 * it is worth. That opinion is the likely sale, the weighted sales' $715,517,
 * to the thousand.
 *
 * So on an on-market letter `pricing.recommended` (stored as
 * cmas.recommended_list) IS that figure, and every place that reads the
 * recommendation reads it: the cover, the price per square foot under it, the
 * competition band's center, the equity line, the admin view. The range
 * (`valueLow` / `valueHigh`) does not move. A letter whose subject is not on
 * the market is returned unchanged, byte for byte.
 *
 * The figure is read off the grid the letter prints (`onMarketOpinionFor`),
 * by the same tests as the price chapter's expected sale, so the cover and
 * the chapter cannot print two numbers. When the grid cannot produce it the
 * pricing is returned unchanged and the caller records why.
 *
 * A broker override is a person choosing the number, and it stands.
 */

import { onMarketOpinionFor, type OnMarketOpinion } from '@/lib/cma/expected-sale'
import { reanchorSellerNet } from '@/lib/pricing/seller-net'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

export type OnMarketOpinionResult<T extends CmaPricing> = {
  pricing: T
  /** The opinion the cover now carries, or null when nothing changed. */
  opinion: OnMarketOpinion | null
  /** Why the pricing was returned unchanged, for the build trace. Null when applied or off the market. */
  skipped: 'off-market' | 'broker-override' | 'grid-cannot-produce' | null
}

/**
 * Put the on-market opinion of value on the pricing. Pure: the input is not
 * mutated. Idempotent: run again on its own output, it returns the same
 * figure (the build runs it once when it settles the price and again after
 * the band is pinned to the printed sales).
 *
 * `comps` is the grid the letter prints (render_args.comps).
 */
export function applyOnMarketOpinion<T extends CmaPricing>(
  pricing: T,
  comps: readonly CmaAdjustedComp[] | null | undefined,
  opts: { onMarket: boolean },
): OnMarketOpinionResult<T> {
  if (!opts.onMarket) return { pricing, opinion: null, skipped: 'off-market' }
  if (pricing.priceOverride != null && pricing.priceOverride > 0) {
    return { pricing, opinion: null, skipped: 'broker-override' }
  }
  const opinion = onMarketOpinionFor({ pricing, comps })
  if (!opinion) return { pricing, opinion: null, skipped: 'grid-cannot-produce' }
  const value = opinion.value
  const listRecommended = pricing.onMarketOpinion?.listRecommended ?? pricing.recommended
  const next: T = {
    ...pricing,
    recommended: value,
    // The list tiers bracket the cover figure (range-consistency). The value
    // range is the sales and does not move.
    conservative: Math.min(pricing.conservative, value),
    highEnd: Math.max(pricing.highEnd, value),
    notes: [...pricing.notes],
    onMarketOpinion: {
      value,
      weightedPrice: opinion.price,
      field: opinion.field,
      sales: opinion.sales,
      listRecommended,
    },
  }
  // The net block is anchored to `recommended` (the net page is omitted on an
  // on-market letter, but the stored block never quotes a second price).
  if (next.recommended !== pricing.recommended) reanchorSellerNet(next)
  return { pricing: next, opinion, skipped: null }
}

/** The build trace line for one application, plain words, no em dash. */
export function onMarketOpinionTrace(result: OnMarketOpinionResult<CmaPricing>): string | null {
  if (result.skipped === 'off-market') return null
  if (result.skipped === 'broker-override') {
    return 'On the market (rule 27): a broker override sets the cover figure, so the weighted sale does not replace it.'
  }
  if (result.skipped === 'grid-cannot-produce' || !result.opinion) {
    return 'On the market (rule 27): the printed grid does not reproduce the stored weighted sale, so the cover keeps the list figure. A broker should look before this goes out.'
  }
  const o = result.opinion
  const list = result.pricing.onMarketOpinion?.listRecommended
  return `On the market (rule 27, Matt 2026-10-08): the opinion of value on the cover is the likely sale, $${o.value.toLocaleString('en-US')}, the weighted price of the ${
    o.sales ?? 'priced'
  } sales that set it ($${o.price.toLocaleString('en-US')}, ${o.field})${
    list != null && list !== o.value ? `, in place of the list figure $${list.toLocaleString('en-US')}` : ''
  }.`
}
