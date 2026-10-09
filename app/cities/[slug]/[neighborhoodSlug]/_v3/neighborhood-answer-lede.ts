/**
 * The answer lede and meta description for a neighborhood page (AIV a5, SEO &
 * AEO Desk brief 2026-10-09, /workspace/search-content/brief-bend-neighborhood-answers-2026-10-09.md,
 * section 2B).
 *
 * Answer engines asked "median home price in Awbrey Butte" quote other sites'
 * figures while ours sat far down the page and the meta led with the LIST
 * median. The lede states the 12-month median SALE price first, in the first
 * screen, and the meta leads with it.
 *
 * BOUND, NOT TYPED. Every figure is an argument, and the page passes the same
 * reads its FAQ answer "What is the median home price in ..." prints from:
 * publicPace.medianClose and closedCount (12-month, detached), the city pace
 * row's medianClose, the boundary inventory's count and median ask, and
 * publicPace.saleToOriginal. A missing figure drops its clause or the whole
 * lede; nothing is filled in.
 *
 * Opt-in per place: Awbrey Butte only until it is reviewed live (brief 2B).
 */
import { formatPriceExact } from '@/lib/format/money'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'

/** Route params (citySlug/neighborhoodSlug) that print the lede and the bound meta. */
export const ANSWER_LEDE_PLACES: ReadonlySet<string> = new Set(['bend/awbrey-butte'])

export function answerLedeEnabled(citySlug: string, neighborhoodSlug: string): boolean {
  return ANSWER_LEDE_PLACES.has(`${citySlug}/${neighborhoodSlug}`)
}

export type NeighborhoodAnswerFigures = {
  placeName: string
  cityName: string
  /** 12-month median sale price, detached (publicPace.medianClose). */
  medianClose: number | null
  /** 12-month closed count, detached (publicPace.closedCount). */
  closedCount: number | null
  /** The city's 12-month median sale price, detached (city pace row). */
  cityMedianClose: number | null
  /** Single-family homes for sale inside the recorded boundary (the page's own count). */
  activeCount: number | null
  /** Median list price of those homes. */
  medianListPrice: number | null
  /** 12-month median sale price as a share of original list (0..1). */
  saleToOriginal: number | null
  /** The day the figures are as of, already formatted ("Oct 8, 2026"). */
  asOf: string | null
}

const positive = (n: number | null): n is number => n != null && Number.isFinite(n) && n > 0

/** "about 53% above Bend's citywide median of $765,000", or null when either median is missing. */
function versusCity(f: NeighborhoodAnswerFigures): string | null {
  if (!positive(f.medianClose) || !positive(f.cityMedianClose)) return null
  const pct = Math.round((f.medianClose / f.cityMedianClose - 1) * 100)
  const cityMedian = formatPriceExact(f.cityMedianClose)
  if (pct === 0) return `about even with ${f.cityName}'s citywide median of ${cityMedian}`
  return `about ${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} ${f.cityName}'s citywide median of ${cityMedian}`
}

/** The lede paragraph, or null when the 12-month median, count, or as-of day is missing. */
export function neighborhoodAnswerLede(f: NeighborhoodAnswerFigures): string | null {
  if (!positive(f.medianClose) || !positive(f.closedCount) || !f.asOf) return null
  const vs = versusCity(f)
  const sentences = [
    `The median sale price for a single-family home in ${f.placeName} was ${formatPriceExact(f.medianClose)} over the last 12 months, on ${f.closedCount.toLocaleString('en-US')} sales, as of ${f.asOf}${vs ? `, ${vs}` : ''}.`,
  ]
  const ask =
    positive(f.activeCount) && positive(f.medianListPrice)
      ? `The ${f.activeCount.toLocaleString('en-US')} homes for sale there now ask a median of ${formatPriceExact(f.medianListPrice)}`
      : null
  const sold = positive(f.saleToOriginal)
    ? `the typical home that sold closed at ${formatPaceShare(f.saleToOriginal)} of its original list price`
    : null
  if (ask && sold) sentences.push(`${ask}, and ${sold}.`)
  else if (ask) sentences.push(`${ask}.`)
  else if (sold) sentences.push(`${sold.charAt(0).toUpperCase()}${sold.slice(1)}.`)
  sentences.push(
    `Figures are from Oregon Data Share MLS, detached single-family homes inside the recorded ${f.placeName} boundary.`,
  )
  return sentences.join(' ')
}

/** The bound meta description, or null (the page keeps its existing one). */
export function neighborhoodAnswerMeta(f: NeighborhoodAnswerFigures): string | null {
  if (!positive(f.medianClose) || !positive(f.closedCount) || !f.asOf) return null
  const forSale = positive(f.activeCount)
    ? ` ${f.activeCount.toLocaleString('en-US')} homes for sale now.`
    : ''
  return `${f.placeName} median sale price: ${formatPriceExact(f.medianClose)} over the last 12 months (${f.closedCount.toLocaleString('en-US')} sales, ${f.asOf}).${forSale} Live data from the regional MLS.`
}
