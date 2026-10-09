/**
 * Sale-led meta description for the market pages Search Console shows people
 * reach with "home prices" queries (SEO & AEO Desk GSC brief 2026-10-08 §6.1).
 *
 * "bend home prices", "bend house prices" and "median home price bend oregon"
 * mean what homes SOLD for, so the snippet leads with the 12-month median sale
 * and its change, then the list median and supply. Every figure is the page's
 * own: the Dataset variables buildMarketFaq publishes (#434) and the same
 * yoy_median_price the "Are home prices going up" answer reads, rounded the
 * same way. A missing figure drops its clause; no 12-month sale median means
 * no sale-led snippet at all, and the caller keeps the list-led description.
 *
 * Opt-in by path. Other market pages keep the list-led description until their
 * own Search Console read says otherwise. The title is untouched here
 * (decision "market-title-price").
 */
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'

export const SALE_LED_META_PATHS: ReadonlySet<string> = new Set(['/housing-market/bend'])

const MAX_DESC = 155

export function saleLedGeoDescription(input: {
  geoName: string
  datasetVariables: ReadonlyArray<{ name: string; value: string | number }>
  /** 12-month median sale vs the 12 months before, as a fraction (publicPace.yoyMedian). */
  yoyMedianPrice: number | null | undefined
}): string | null {
  const read = (name: string) => input.datasetVariables.find((v) => v.name === name)?.value ?? null
  const median12 = Number(read('Median sale price, last 12 months'))
  if (!Number.isFinite(median12) || median12 <= 0) return null
  const geo = input.geoName.trim()

  let head = `${geo} home prices: the median single-family home sold for ${formatPriceExact(median12)} over the last 12 months`
  const yoy = input.yoyMedianPrice
  if (yoy != null && Number.isFinite(yoy)) {
    // The FAQ's rounding, so the snippet and the answer agree.
    const pct = Math.round(yoy * 1000) / 10
    head += pct === 0 ? ', level with the 12 months before' : `, ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}%`
  }
  head += '.'

  const tail: string[] = []
  const list = Number(read('Median List Price'))
  if (Number.isFinite(list) && list > 0) tail.push(`Median list ${formatPriceExact(list)}.`)
  const supply = read('Months of Supply')
  if (supply != null) {
    const shown = typeof supply === 'number' ? formatMonthsOfSupply(supply) : String(supply).trim()
    if (shown) tail.push(`${shown} months of supply.`)
  }

  // Whole sentences only: a clause that would overflow is dropped, never cut.
  let out = head
  for (const clause of tail) {
    if (out.length + 1 + clause.length <= MAX_DESC) out = `${out} ${clause}`
  }
  return out.length <= MAX_DESC ? out : null
}
