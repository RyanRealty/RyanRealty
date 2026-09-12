/**
 * The plat's did-not-sell story, in the words a person would use (SITE-55).
 *
 * The figure is a market statistic, so it obeys §0 the way every other figure
 * on this site does: the count comes from one aggregate, the median prints only
 * where the MV measured one, the window is stated rather than implied, and the
 * zero case is a sentence rather than a hidden section — "every listing that
 * came off the market in {name} in the last twelve months sold" is an ANSWER,
 * and a page that hides the question when the answer is good is a page that
 * cannot be trusted when the answer is bad.
 *
 * No addresses. Oregon MLS policy holds that Withdrawn, Expired and Cancelled
 * listings may not be actively marketed (docs/MASTER_SPEC.md §3.8), so this
 * publisher takes the aggregate and never a row.
 */

import type { PlatUnsoldOutcome } from '@/lib/data/subdivisions/getPlatUnsoldOutcomes'
import { formatDate } from '@/lib/format/date'

export type PlatUnsoldRead = {
  /** The claim, as a person says it. */
  sentence: string
  /** False when the plat is outside the view's measured set: say nothing. */
  measured: boolean
  /** The §0 trace, for the source line under it. */
  source: string
  /** The lead figure and its label, when there is one to draw. */
  figure: { value: string; label: string } | null
  /** True when nothing failed — the page still speaks. */
  clean: boolean
}

function windowPhrase(row: Pick<PlatUnsoldOutcome, 'windowStart' | 'windowEnd'>): string {
  if (!row.windowStart || !row.windowEnd) return 'the last twelve months'
  return `the twelve months to ${formatDate(row.windowEnd)}`
}

/**
 * `outcome` is null when the plat has no row at all, which the MV writes only
 * for a plat where nothing came off unsold in the window — so a null is the
 * clean case, not a missing read.
 */
/**
 * The behaviour clauses are written to follow a comma ("it ran 223 days",
 * "and cut the ask 7.1% first"). Standing alone as their own sentence, the
 * leading conjunction is noise and the first letter is a capital.
 */
function sentenceCase(text: string): string {
  const body = text.replace(/^and\s+/, '')
  return body.charAt(0).toUpperCase() + body.slice(1)
}

export function publishPlatUnsold(input: {
  placeName: string
  outcome: PlatUnsoldOutcome | null
  closedCount?: number | null
  windowEnd?: string | null
}): PlatUnsoldRead {
  const { placeName, outcome } = input

  // NOT MEASURED IS NOT CLEAN. A null read means the plat is outside the view's
  // key set, not that every listing there sold — the distinction that published
  // a false clean record for Diamond Bar Ranch before the view was rebuilt to
  // carry a row per plat (CLAUDE.md §0).
  if (!outcome) {
    return {
      measured: false,
      clean: false,
      figure: null,
      sentence: '',
      source: '',
    }
  }

  if (outcome.unsoldCount < 1) {
    const when = outcome.windowEnd
      ? `the twelve months to ${formatDate(outcome.windowEnd)}`
      : input.windowEnd
        ? `the twelve months to ${formatDate(input.windowEnd)}`
        : 'the last twelve months'
    return {
      measured: true,
      clean: true,
      figure: null,
      sentence: `Every home that came off the market in ${placeName} in ${when} sold. None expired, none was withdrawn, none was cancelled.`,
      // THE TRACE OPENS WITH ITS SOURCE'S NAME. V3SourceLine derives the one
      // visible clause structurally, so a trace that opened
      // "public.subdivision_plat_unsold_mv, …" published the visible words
      // "SOURCE public" — a table identifier, and half of one. The name comes
      // first and the plumbing follows it.
      source:
        `Central Oregon MLS, this plat — measured and zero. Listings with StandardStatus Expired, Canceled or Withdrawn and an off-market date inside the window, ` +
        `attributed to the recorded plat by point-in-polygon and by MLS subdivision name, counted once each, read from public.subdivision_plat_unsold_mv. ` +
        `The view carries a row for every plat it measures, so this zero was measured rather than missing.`,
    }
  }

  const n = outcome.unsoldCount
  const homes = n === 1 ? 'one home' : `${n.toLocaleString('en-US')} homes`
  const parts: string[] = [
    `${homes.charAt(0).toUpperCase()}${homes.slice(1)} came off the market in ${placeName} without selling in ${windowPhrase(outcome)}`,
  ]
  if (outcome.medianDaysListed != null) {
    const days = Math.round(outcome.medianDaysListed)
    parts.push(`${n === 1 ? 'it ran' : 'the middle one ran'} ${days.toLocaleString('en-US')} days`)
  }
  if (outcome.cutCount > 0 && outcome.medianCutPct != null) {
    const cut = outcome.medianCutPct.toFixed(1)
    parts.push(
      // The n === 1 case has to read as one home, not as a population. "every
      // one cut the ask first, a median of 7.1%" beside "One home came off the
      // market" was the sentence a Golf Homes at Tetherow render actually
      // printed: grammatically plural, and a "median" over a single row is a
      // value, not a median.
      n === 1
        ? `and cut the ask ${cut}% first`
        : outcome.cutCount === n
          ? `and every one cut the ask first, a median of ${cut}%`
          : `and ${outcome.cutCount} of them cut the ask first, a median of ${cut}%`,
    )
  } else if (outcome.cutCount === 0) {
    parts.push(n === 1 ? `and never cut the ask` : `and not one of them cut the ask first`)
  }

  // NO SOLD COMPARISON IN THIS SENTENCE. It read well — "19 did not sell, 9
  // did" — and it was two populations in one breath: the plat's closed count is
  // the DETACHED segment of market_metric, while a failed listing here is any
  // property type that came off unsold. The ratio of the two is not a ratio of
  // anything. The section directly above this one is "What sold in {name}", so
  // the reader gets the comparison by looking, from two figures that each say
  // what they counted (§0).
  const beside = ''

  return {
    measured: true,
    clean: false,
    figure: { value: n.toLocaleString('en-US'), label: n === 1 ? 'home did not sell' : 'homes did not sell' },
    // TWO SENTENCES, NOT ONE COMMA RUN. The window phrase ends in a date that
    // already carries a comma ("the twelve months to Sep 9, 2026"), so joining
    // the whole thing on commas published "…to Sep 9, 2026, it ran 223 days,
    // and cut the ask 7.1% first." The count and its window are one statement;
    // what those listings did is the next.
    sentence: `${parts[0]}.${parts.length > 1 ? ` ${sentenceCase(parts.slice(1).join(', '))}.` : ''}${beside}`,
    source:
      // Opens with the source's name for the same reason as the clean case.
      `Central Oregon MLS, this plat — listings with StandardStatus Expired, Canceled or Withdrawn and an off-market date between ` +
      `${outcome.windowStart ?? 'the window start'} and ${outcome.windowEnd ?? 'the window end'}, attributed to the recorded plat by point-in-polygon ` +
      `(${outcome.unsoldInPolygon}) and by MLS subdivision name (${outcome.unsoldByName}), counted once each, read from public.subdivision_plat_unsold_mv. ` +
      // A "median over 1" is a value, not a median, and the trace should not
      // claim a statistic it did not compute (§0).
      (outcome.daysSample === 1 && n === 1
        ? `Days listed is the contract date to the off-market date, on the one listing that carries both dates`
        : `Days listed is the contract date to the off-market date, median over ${outcome.daysSample} of the ${n} that carry both dates`) +
      (outcome.cutCount === 0
        ? '; none of them cut the ask'
        : outcome.cutCount === 1
          ? '; the cut is the total price change on the one that cut'
          : `; the cut is the total price change, median over the ${outcome.cutCount} that cut`) +
      `. Internet-display and IDX opt-outs are excluded, as everywhere else on the site.`,
  }
}
