/**
 * WHAT THE COMPETITION RANGE IS CENTERED ON (reader review, 2026-10-07).
 *
 * The competition chapter's price range is read around the list the closed
 * sales set, BEFORE the homes for sale in that range are weighed: those homes
 * are what the active-days pull (finishRecommendedAfterActives) reads, so the
 * range cannot be centered on the list that pull produces without the range
 * depending on itself. The final rounding, band clamp and failed-ask cap also
 * come after. So the center can differ from the list the letter recommends
 * (Jackson: ±15% of $629,000 beside a $624,000 recommendation; Purcell ±10%
 * of $556,000 beside $545,000; Coho ±10% of $556,000 beside $551,000).
 *
 * THE CENTER IS A STARTING POINT, NOT A SUPPORTED PRICE (reader review,
 * 2026-10-08). The center is the weighted sale over the list-to-sale share,
 * before the band clamp, so it can sit ABOVE the top of the range the sales
 * support (Purcell $556,000 over $545,350; Coho $556,000 over $551,876;
 * Aldrich $480,000 over $479,161). Calling that number "the list price the
 * closed sales supported" gave a seller two ceilings. The sentence now says
 * what the center is in plain words, and when it sits outside the range the
 * sales support it says so and names the end the reader already has from the
 * opinion chapter. Every dollar it prints is the band's own center or an end
 * of the printed sales range.
 *
 * The letter says what the range is centered on, and when the range opened
 * past the base ±10% because fewer than five homes like this one were for
 * sale or under contract inside it, it says that too. When the center is the
 * recommended list (same dollars, or the same thousand), the figure is not
 * reprinted: the cover owns it (lib/cma/recommend-once.ts).
 */

import { usd } from '@/lib/cma/render-blocks'
import { isRecommendMark } from '@/lib/cma/recommend-once'

export type CompetitionBandBasis = {
  /** The list the range was read around. */
  center: number
  /** Half-width the printed range uses (0.10 = ±10%). */
  halfWidth: number
  /** The first step the ladder reads (COMPETITION_BAND_STEPS[0]). */
  baseHalfWidth: number
}

/** The range the sales support, as the opinion chapter prints it (valueLow / valueHigh). */
export type SupportedBand = {
  low?: number | null
  high?: number | null
}

/** The center's plain description. Never "the list price the closed sales supported". */
export const BAND_CENTER_DESCRIPTION = 'the list we started from before the homes for sale were weighed'

function pct(halfWidth: number): string {
  return `${Math.round(halfWidth * 100)}%`
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Where the center sits against the range the sales support. `null` when the
 * band is unknown or the center is inside it (inclusive at both ends).
 */
function centerOffBand(
  center: number,
  band: SupportedBand | null | undefined,
): { side: 'above' | 'below'; edge: number } | null {
  const a = num(band?.low)
  const b = num(band?.high)
  if (a == null || b == null) return null
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  if (center > high) return { side: 'above', edge: high }
  if (center < low) return { side: 'below', edge: low }
  return null
}

export function competitionBandBasisSentence(
  basis: Partial<CompetitionBandBasis> | null | undefined,
  finalRecommended: number | null | undefined,
  band?: SupportedBand | null,
): string {
  const center = Number(basis?.center)
  const halfWidth = Number(basis?.halfWidth)
  const base = Number(basis?.baseHalfWidth)
  if (!(center > 0) || !(halfWidth > 0) || !(halfWidth < 1)) return ''
  const rec = Number(finalRecommended)
  const atRec = rec > 0 && isRecommendMark(center, rec)
  let head: string
  if (atRec) {
    head = `This range is ${pct(halfWidth)} either side of the list price we recommend.`
  } else {
    const what = `This range is ${pct(halfWidth)} either side of ${usd(center)}, ${BAND_CENTER_DESCRIPTION}.`
    const off = centerOffBand(center, band)
    if (off) {
      const end = off.side === 'above' ? 'the top' : 'the bottom'
      // The recommended list was set after the clamp to the sales range, so
      // against a center outside that range it sits back toward the range.
      // Said only when the final figure actually does (rec is on the row).
      const where = rec > 0 && rec < center ? 'under' : rec > 0 && rec > center ? 'above' : null
      const consequence = where
        ? `, so the list price we recommend, set after that, sits ${where} the center.`
        : '.'
      head = `${what} That starting point is ${off.side} ${usd(off.edge)}, ${end} of the range the sales support${consequence}`
    } else {
      head = `${what} The list price we recommend was set after that, so it can sit off center.`
    }
  }
  const opened =
    base > 0 && Math.round(halfWidth * 100) > Math.round(base * 100)
      ? ` It opened from ${pct(base)} because fewer than five homes like yours were for sale or under contract inside ${pct(base)}.`
      : ''
  return `${head}${opened}`
}
