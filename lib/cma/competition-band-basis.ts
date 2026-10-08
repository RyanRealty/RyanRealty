/**
 * WHAT THE COMPETITION RANGE IS CENTERED ON (reader review, 2026-10-07).
 *
 * The competition chapter's price range is read around the list the closed
 * sales set, BEFORE the homes for sale in that range are weighed: those homes
 * are what the active-days pull (finishRecommendedAfterActives) reads, so the
 * range cannot be centered on the list that pull produces without the range
 * depending on itself. The final rounding, band clamp and failed-ask cap also
 * come after. So the center can differ from the list the letter recommends
 * (Jackson: ±15% of $591,000 beside a $573,000 recommendation; Purcell ±10%
 * of $531,000 beside $529,000; Coho ±10% of $556,000 beside $551,000).
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

function pct(halfWidth: number): string {
  return `${Math.round(halfWidth * 100)}%`
}

export function competitionBandBasisSentence(
  basis: Partial<CompetitionBandBasis> | null | undefined,
  finalRecommended: number | null | undefined,
): string {
  const center = Number(basis?.center)
  const halfWidth = Number(basis?.halfWidth)
  const base = Number(basis?.baseHalfWidth)
  if (!(center > 0) || !(halfWidth > 0) || !(halfWidth < 1)) return ''
  const rec = Number(finalRecommended)
  const atRec = rec > 0 && isRecommendMark(center, rec)
  const head = atRec
    ? `This range is ${pct(halfWidth)} either side of the list price we recommend.`
    : `This range is ${pct(halfWidth)} either side of ${usd(center)}, the list price the closed sales supported before we weighed the homes for sale. The list price we recommend was set after that, so it can sit off center.`
  const opened =
    base > 0 && Math.round(halfWidth * 100) > Math.round(base * 100)
      ? ` It opened from ${pct(base)} because fewer than five homes like yours were for sale or under contract inside ${pct(base)}.`
      : ''
  return `${head}${opened}`
}
