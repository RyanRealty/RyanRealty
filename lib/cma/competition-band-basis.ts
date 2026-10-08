/**
 * WHAT THE COMPETITION RANGE IS CENTERED ON (reader review, 2026-10-07).
 *
 * The competition chapter's price range is read around the list the build
 * had BEFORE the homes for sale in that range are weighed: those homes are
 * what the active-days pull (finishRecommendedAfterActives) reads, so the
 * range cannot be centered on the list that pull produces without the range
 * depending on itself. The band clamp and the thousand-dollar rounding also
 * come after (lib/cma/build.ts settleRecommended passes `current.recommended`
 * to assembleCompetition, which stores it as `bandBasis.center`). So the
 * center can differ from the list the letter prints.
 *
 * THE CENTER IS NOT PRINTED (reader review 2026-10-08). It printed as
 * "10% either side of $735,000, the list we started from before the homes
 * for sale were weighed" on 3062 NW Kelly Hill, under a $713,000 cover: a
 * figure that appears nowhere else on the page, is not the recommended price,
 * the weighted price or any method's output, and happened to equal one sale's
 * sold price, so a reader could not trace it. Jackson's $629,000 and
 * Purcell's $551,000 were the same kind of figure, and "That starting point
 * is above $550,951, the top of the range the sales support, so the list
 * price we recommend, set after that, sits under the center" rested on a $49
 * rounding difference and left "the center" ambiguous.
 *
 * So the sentence speaks only in figures the reader already has: the range's
 * two ends (printed in the sentence before it) and the price on the cover.
 * When the printed ends are exactly the cover price a whole percent either
 * way, rounded to the thousand as the range is drawn, it says the range is
 * that share either side of it. Equal at whole-percent rounding is not enough
 * (reader review 2026-10-08): Purcell's $496,000 to $606,000 is not 10% either
 * side of $550,000 ($495,000 to $605,000), and Jacksonville's $623,000 to
 * $843,000 is not 15% either side of $732,000; those say the cover sits near
 * the middle of the range, not exactly on it. When they do not, it says how the
 * range was set and how far each end sits from the cover price (Kelly Hill:
 * 7% under it to 13% over it), so the reader can check both from the page.
 * When the range opened past the base ±10% because fewer than five homes like
 * this one were for sale or under contract inside it, it says that too.
 *
 * A letter held for Matt names the cover number "the price on the cover",
 * never "the list price we recommend" (`opts.held`).
 */

import { COVER_PRICE_PHRASE, isRecommendMark } from '@/lib/cma/recommend-once'
import { bandAroundListAt } from '@/lib/cma/band-rivals'

export type CompetitionBandBasis = {
  /** The list the range was read around. */
  center: number
  /** Half-width the printed range uses (0.10 = ±10%). */
  halfWidth: number
  /** The first step the ladder reads (COMPETITION_BAND_STEPS[0]). */
  baseHalfWidth: number
}

/** The range the chapter prints (bandRivals.lo / bandRivals.hi), the ends the sentence before this one names. */
export type PrintedWindow = {
  lo?: number | null
  hi?: number | null
}

/** The center's plain description. Never "the list price the closed sales supported", and never in dollars. */
export const BAND_CENTER_DESCRIPTION = 'the list we started from before the homes for sale were weighed'

function pct(halfWidth: number): string {
  return `${Math.round(halfWidth * 100)}%`
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** How far each printed end sits from the printed list, in whole percent of the list. */
export function windowSplit(
  window: PrintedWindow | null | undefined,
  list: number | null | undefined,
): { under: number; over: number } | null {
  const lo = num(window?.lo)
  const hi = num(window?.hi)
  const rec = num(list)
  if (lo == null || hi == null || rec == null || lo > rec || rec > hi) return null
  return {
    under: Math.round(((rec - lo) / rec) * 100),
    over: Math.round(((hi - rec) / rec) * 100),
  }
}

/** True when the printed ends are exactly `list` ± `share`, drawn the way the range is (bandAroundListAt). */
function printedEndsAre(window: PrintedWindow | null | undefined, list: number, share: number): boolean {
  const lo = num(window?.lo)
  const hi = num(window?.hi)
  const drawn = bandAroundListAt(list, share)
  return lo != null && hi != null && drawn != null && drawn.lo === lo && drawn.hi === hi
}

export function competitionBandBasisSentence(
  basis: Partial<CompetitionBandBasis> | null | undefined,
  finalRecommended: number | null | undefined,
  window?: PrintedWindow | null,
  opts?: { held?: boolean },
): string {
  const center = Number(basis?.center)
  const halfWidth = Number(basis?.halfWidth)
  const base = Number(basis?.baseHalfWidth)
  if (!(center > 0) || !(halfWidth > 0) || !(halfWidth < 1)) return ''
  const rec = Number(finalRecommended)
  const listed = opts?.held ? COVER_PRICE_PHRASE : 'the list price we recommend'
  const Listed = `${listed.charAt(0).toUpperCase()}${listed.slice(1)}`
  const split = windowSplit(window, rec)
  // "X% either side" is said only when it is exactly true at the printed
  // dollars: the printed ends ARE the cover price X% either way, rounded to
  // the thousand the way the range is drawn (bandAroundListAt). 1355
  // Jacksonville printed "15% either side of the list price we recommend"
  // over $623,000 to $843,000, which is 15% of $733,000 (the stored center),
  // under a $732,000 cover; whole-percent rounding called 14.9% and 15.2%
  // both 15 (reader review 2026-10-08).
  const exact = split != null && split.under === split.over && printedEndsAre(window, rec, split.under / 100)
  let head: string
  if (split ? exact : rec > 0 && isRecommendMark(center, rec)) {
    // The printed ends sit the same share either side of the printed list.
    // A row with no printed ends falls back to the stored center's own mark.
    head = `This range is ${split ? `${split.under}%` : pct(halfWidth)} either side of ${listed}.`
  } else {
    const what = `This range was set ${pct(halfWidth)} either side of ${BAND_CENTER_DESCRIPTION}.`
    head = split
      ? split.under === split.over
        ? `${what} ${Listed} was set after they were weighed, so it sits near the middle of the range, not exactly on it.`
        : `${what} ${Listed} was set after they were weighed, so the range runs from ${split.under}% under it to ${split.over}% over it.`
      : `${what} ${Listed} was set after they were weighed, so it can sit off center.`
  }
  const opened =
    base > 0 && Math.round(halfWidth * 100) > Math.round(base * 100)
      ? ` It opened from ${pct(base)} because fewer than five homes like yours were for sale or under contract inside ${pct(base)}.`
      : ''
  return `${head}${opened}`
}
