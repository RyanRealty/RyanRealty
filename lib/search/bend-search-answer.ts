/**
 * Intro answer for /homes-for-sale/bend.
 *
 * Same sentences as the /cities/bend takeaways (placeTakeaways, address-scope),
 * worded from the search page's own leftover HUD + pace figures so the intro
 * cannot invent a count the page does not already publish (§0).
 */
import { formatDate } from '@/lib/format/date'
import { placeTakeaways } from '@/lib/site/place-takeaways'
import type { MarketFaqInput } from '@/lib/site/market-faq'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'

export const BEND_SEARCH_ANSWER_CITY = 'Bend'

export type CitySearchAnswer = {
  items: string[]
  source: string | null
}

export function publishBendSearchAnswer(input: {
  faq: MarketFaqInput | null | undefined
  pace: Pick<PublicPaceRow, 'yoyMedian' | 'medianClose'> | null | undefined
}): CitySearchAnswer | null {
  const faq = input.faq
  if (!faq) return null
  const asOfLabel = faq.refreshedAt ? formatDate(faq.refreshedAt) : null
  const sale =
    faq.medianSalePrice != null &&
    faq.medianSalePrice > 0 &&
    faq.medianSaleMonthLabel?.trim()
      ? { value: faq.medianSalePrice, when: `in ${faq.medianSaleMonthLabel.trim()}` }
      : input.pace?.medianClose != null && input.pace.medianClose > 0
        ? { value: input.pace.medianClose, when: 'over the last 12 months' }
        : null
  const items = placeTakeaways({
    place: BEND_SEARCH_ANSWER_CITY,
    addressScope: true,
    asOfLabel,
    active: faq.activeCount,
    medianList: faq.medianListPrice,
    monthsOfSupply: faq.monthsOfSupply,
    saleMedian: sale,
    yoyMedian: faq.yoyMedianPrice ?? input.pace?.yoyMedian ?? null,
  })
  if (items.length < 2) return null
  return {
    items,
    source: asOfLabel
      ? `Single-family homes, Oregon Data Share MLS, as of ${asOfLabel}.`
      : 'Single-family homes, Oregon Data Share MLS.',
  }
}
