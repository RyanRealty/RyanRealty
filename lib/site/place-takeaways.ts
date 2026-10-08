/**
 * Key takeaways for a place or market page (AEO review, Matt 2026-10-04).
 *
 * WHY. Answer engines lift their answer from the top of a page, a sentence at a
 * time. Our city, community and market pages opened on method fine print
 * ("Months of supply = active listings divided by...") or a door caption, so
 * the first citable text after the H1 answered nothing. These are up to four
 * plain sentences that answer "what is the {place} market like right now"
 * (inventory and asking price, the supply verdict, the sale price, the
 * 12-month change), each naming the place so it stands alone when lifted out.
 * Days to contract and sale-to-list stay in the figures and the FAQ.
 *
 * Every figure is one the page already prints from the same read (§0): the
 * caller passes the page's own values, this module only words them, and a null
 * figure drops its sentence rather than being estimated. Prices print exact
 * (formatPriceExact, as the FAQ and the Dataset do) and percentages round the
 * way the page's pace tiles do (formatPaceDelta: Math.round(x * 1000) / 10), so
 * no figure here can read differently from the same figure elsewhere. Months of supply goes
 * through formatMonthsOfSupply and its verdict through marketVerdict
 * (ci:market-formula), so the sentence and the page's verdict cannot disagree.
 */
import { marketVerdict } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'

export type PlaceTakeawaysInput = {
  /** "Bend", "Sunriver", "Tetherow". */
  place: string
  /** The page's own as-of label ("Oct 3, 2026"), or null. */
  asOfLabel?: string | null
  /** Single-family homes for sale, as the page prints it. */
  active?: number | null
  /**
   * City grain: the count is Market Truth's MLS-city population, the houses
   * the page's supply bars name "Houses with a {city} address". Say so, so it
   * reads beside the map's "for sale on the map" count without contradicting
   * it (Matt 2026-10-04, reconcile the counts).
   */
  addressScope?: boolean
  /** Median asking price of those homes. */
  medianList?: number | null
  /** Raw months of supply (the page's own value, before formatting). */
  monthsOfSupply?: number | null
  /** Median sale price and the window it covers ("in September 2026", "over the last 12 months"). */
  saleMedian?: { value: number; when: string } | null
  /** 12-month median sale vs the 12 months before, as a fraction (0.032 = up 3.2%). */
  yoyMedian?: number | null
}

const MEANING: Record<string, string> = {
  sellers: 'sellers have the edge',
  balanced: 'neither buyers nor sellers have a clear edge',
  buyers: 'buyers have room to negotiate',
}

function count(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

/** Up to four standalone sentences, fewer when the page withholds a figure. */
export function placeTakeaways(input: PlaceTakeawaysInput): string[] {
  const place = input.place.trim()
  if (!place) return []
  const out: string[] = []
  const asOf = input.asOfLabel?.trim() ? ` as of ${input.asOfLabel.trim()}` : ''

  if (input.active != null && input.active > 0) {
    const ask =
      input.medianList != null && input.medianList > 0
        ? `, at a median asking price of ${formatPriceExact(input.medianList)}`
        : ''
    if (input.addressScope) {
      const houses = count(input.active, 'single-family house', 'single-family houses')
      out.push(`${houses} with a ${place} address ${input.active === 1 ? 'is' : 'are'} for sale${asOf}${ask}.`)
    } else {
      out.push(`${place} has ${count(input.active, 'single-family home', 'single-family homes')} for sale${asOf}${ask}.`)
    }
  }

  const verdict = marketVerdict(input.monthsOfSupply)
  if (input.monthsOfSupply != null && verdict.kind !== 'unknown' && MEANING[verdict.kind]) {
    const mos = formatMonthsOfSupply(input.monthsOfSupply)
    out.push(`${place} has ${mos} months of supply, a ${verdict.label}, so ${MEANING[verdict.kind]}.`)
  }

  if (input.saleMedian && input.saleMedian.value > 0 && input.saleMedian.when.trim()) {
    out.push(
      `The median single-family home in ${place} sold for ${formatPriceExact(input.saleMedian.value)} ${input.saleMedian.when.trim()}.`,
    )
  }

  if (input.yoyMedian != null && Number.isFinite(input.yoyMedian)) {
    // The pace tiles' rounding (formatPaceDelta in lib/data/market-truth/
    // public-pace.ts), mirrored here because that module reads the database.
    const pct = Math.round(input.yoyMedian * 1000) / 10
    if (pct === 0) {
      out.push(`The median sale price in ${place} over the last 12 months is level with the 12 months before.`)
    } else {
      out.push(
        `The median sale price in ${place} over the last 12 months is ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% from the 12 months before.`,
      )
    }
  }

  return out
}
