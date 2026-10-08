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
  /**
   * 'place' (default) is the /cities and /communities set above, unchanged.
   * 'market' is the /housing-market/<city> answer block (SEO & AEO Desk brief
   * 2026-10-08): sale price first, then the 12-month change, pace, and supply,
   * written to be quoted on its own. The inputs below are read only by it.
   */
  variant?: 'place' | 'market'
  /** Same month a year earlier, from the same monthly series as saleMedian. */
  priorYearMonthMedian?: { value: number; label: string } | null
  /** Median sale price over the last 12 months (publicPace.medianClose). */
  medianClose12?: number | null
  /** Closed sales over the last 12 months (publicPace.closedCount). */
  closedCount12?: number | null
  /** Median list-to-pending, homes that closed in the last 90 days (hud.daysToPending). */
  daysToPending90?: number | null
  /** Median days from listing to closing, last 12 months (publicPace.daysToClose). */
  daysToClose12?: number | null
}

const MEANING: Record<string, string> = {
  sellers: 'sellers have the edge',
  balanced: 'neither buyers nor sellers have a clear edge',
  buyers: 'buyers have room to negotiate',
}

function count(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
}

/** The pace tiles' rounding (formatPaceDelta), so every percent here matches its tile. */
function pctOf(fraction: number): number {
  return Math.round(fraction * 1000) / 10
}

/** A day count we can print: positive and finite, whole or to a tenth. Never "0 days". */
function days(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  const tenths = Math.round(n * 10) / 10
  return tenths > 0 ? (Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)) : null
}

const THRESHOLD_CLAUSE: Record<string, string> = {
  sellers: '4 months or less favors sellers',
  balanced: 'between 4 and 6 months is balanced',
  buyers: '6 months or more favors buyers',
}

/**
 * The market-page answer block: four sentences, each standing alone when an
 * answer engine lifts it. Every figure is a value the page already prints from
 * the same read; a null drops its clause, never an estimate (§0).
 */
function marketTakeaways(place: string, input: PlaceTakeawaysInput): string[] {
  const out: string[] = []
  const asOfLabel = input.asOfLabel?.trim() || null

  // T1. The latest complete month's median sale, against the same month a year earlier.
  const sale = input.saleMedian && input.saleMedian.value > 0 && input.saleMedian.when.trim() ? input.saleMedian : null
  if (sale) {
    const lead = asOfLabel
      ? `As of ${asOfLabel}, the median sale price of a single-family home in ${place} was`
      : `The median sale price of a single-family home in ${place} was`
    const prior = input.priorYearMonthMedian
    let change = ''
    if (prior && prior.value > 0 && prior.label.trim()) {
      const pct = pctOf(sale.value / prior.value - 1)
      change =
        pct === 0
          ? `, about even with ${formatPriceExact(prior.value)} in ${prior.label.trim()}`
          : `, ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% from ${formatPriceExact(prior.value)} in ${prior.label.trim()}`
    }
    out.push(`${lead} ${formatPriceExact(sale.value)} ${sale.when.trim()}${change}.`)
  }

  // T2. The 12-month median, its sample, and its change.
  if (input.medianClose12 != null && input.medianClose12 > 0) {
    const n = input.closedCount12 != null && input.closedCount12 > 0
      ? ` on ${input.closedCount12.toLocaleString('en-US')} sales`
      : ''
    let change = ''
    if (input.yoyMedian != null && Number.isFinite(input.yoyMedian)) {
      const pct = pctOf(input.yoyMedian)
      change =
        pct === 0
          ? ', about even with the 12 months before'
          : `, ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% from the 12 months before`
    }
    out.push(`Over the last 12 months, ${place}'s median sale price was ${formatPriceExact(input.medianClose12)}${n}${change}.`)
  }

  // T3. How long it takes: under contract (90-day window) and to closing (12 months).
  const pending = days(input.daysToPending90)
  const close = days(input.daysToClose12)
  if (pending && close) {
    out.push(
      `${place} homes that closed in the last 90 days spent a median ${pending} days on the market before going under contract, and over the last 12 months the median time from listing to closing was ${close} days.`,
    )
  } else if (pending) {
    out.push(`${place} homes that closed in the last 90 days spent a median ${pending} days on the market before going under contract.`)
  } else if (close) {
    out.push(`Over the last 12 months, the median time from listing to closing in ${place} was ${close} days.`)
  }

  // T4. Supply and the verdict it supports (ci:market-formula thresholds).
  const verdict = marketVerdict(input.monthsOfSupply)
  if (input.monthsOfSupply != null && THRESHOLD_CLAUSE[verdict.kind]) {
    out.push(
      `${place} has ${formatMonthsOfSupply(input.monthsOfSupply)} months of supply, which makes it a ${verdict.label} (${THRESHOLD_CLAUSE[verdict.kind]}).`,
    )
  }

  return out
}

/** Up to four standalone sentences, fewer when the page withholds a figure. */
export function placeTakeaways(input: PlaceTakeawaysInput): string[] {
  const place = input.place.trim()
  if (!place) return []
  if (input.variant === 'market') return marketTakeaways(place, input)
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
