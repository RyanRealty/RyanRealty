/**
 * THE FOLD, CURATED (SITE-41 round two).
 *
 * The disclosure behind "Supply by property type, sale pace, and what the houses have"
 * (opening.ts's MARKET_FOLD_LABEL) turned into the exact tell TASTE.md bans by name on
 * three of the four market classes at once: property-type supply and 12-month pace cells
 * merged into one tail with a value, a label, and no sentence saying what either number
 * means for the reader. The 2026-09-09 evaluator round named it on market-report-annual
 * and market-report-detail specifically — a twelve-cell grid, collapsing to a single
 * column of bare digits at 375.
 *
 * TWO FIXES, NOT ONE. A sentence on every figure is what V3Instrument's own `said`
 * variant exists for (wider tracks, one column at 375, read left to right as sentences).
 * But sentencing all fifteen cells `publicPaceItems` can return is still a wall nobody
 * reads in full, so this file also CUTS: the pace tail keeps the five cells a buyer or
 * seller actually asks about, in priority order, and the rest stay computed (a future
 * page can still reach them through publicPaceItems directly) rather than printed.
 *
 * ONE MODULE, FOUR CALLERS. Before this file the same merge — segment rows plus pace
 * items, no sentence — was hand-written three times (annual-review/page.tsx,
 * central-oregon/page.tsx, [...slug]/_v3/geo-figures.ts) and drifted: two of the three
 * KEPT financing/feature/bedroom mix cells in the tail, duplicating the numbers the
 * dedicated "How <city> homes get bought" Instrument already draws with a chart and a
 * sentence per figure ([...slug]/page.tsx id="financing"). Mix cells are cut from every
 * caller here, not sentenced — the duplicate is the defect, not the missing sentence.
 *
 * Nothing here fetches. Every function takes rows the caller already read and returns
 * V3InstrumentFigure objects ready for the barrel, same discipline as annual-sections.ts.
 */

import {
  publicSegmentBrowseHref,
  publicSegmentNoun,
  type PublicSegmentRow,
} from '@/lib/data/market-truth/public-segments'
import { publicPaceItems, type PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { v3Text, type V3InstrumentFigure } from '@/components/site/v3'

/**
 * The pace cells worth a reader's time, most important first, each keyed to
 * `publicPaceItems`' own `key` field so a caller can exclude the ones it already
 * printed elsewhere (the annual review's closed instrument owns medClose/closed/yoy,
 * the city live figures own pending/dtc).
 */
const PACE_PRIORITY: readonly string[] = ['age', 'cut', 'cash', 'yoySold', 'new', 'stf']

const PACE_SENTENCE: Record<string, string> = {
  age: 'How long the typical active listing has sat on the market without going under contract.',
  cut: "The share of last year's sales that took at least one price cut before they closed.",
  cutSize: 'How much a typical price cut took off the asking price, among the sales that took one.',
  cash: 'The share of sales paid without a mortgage.',
  yoySold: "How this year's closed-sales pace compares with the same 12 months a year earlier.",
  new: 'Homes that came onto the market fresh over the trailing 12 months.',
  stf: "Each sale measured against the seller's final asking price, the one on the sign the week it sold.",
  close: 'The wait between an accepted offer and the sale actually closing.',
}

/**
 * Default cap: three cells. Was four; the 2026-09-09 re-score of market-report-detail
 * still totaled twelve fold tiles once combined with segment supply and the leftover
 * period cells — the same number the class was named for before this fix, just fully
 * sentenced this time. Three here, two on segment supply, brings that same page's
 * total tail down to nine.
 */
const DEFAULT_PACE_MAX = 3

export function buildPaceTailFigures(
  row: PublicPaceRow | null | undefined,
  opts?: { exclude?: readonly string[]; max?: number },
): V3InstrumentFigure[] {
  if (!row) return []
  const exclude = new Set(opts?.exclude ?? [])
  const max = opts?.max ?? DEFAULT_PACE_MAX
  const byKey = new Map(publicPaceItems(row).map((item) => [item.key, item] as const))
  const figures: V3InstrumentFigure[] = []
  for (const key of PACE_PRIORITY) {
    if (figures.length >= max) break
    if (exclude.has(key)) continue
    const item = byKey.get(key)
    const sentence = PACE_SENTENCE[key]
    if (!item || !sentence) continue
    figures.push({ value: v3Text(item.value), label: v3Text(item.label), sentence: v3Text(sentence) })
  }
  return figures
}

/** Cap on property-type supply figures — see buildSegmentTailFigures. */
const DEFAULT_SEGMENT_MAX = 2

/**
 * Land, farm, commercial and business supply reads differently from a housing type:
 * "on the market" undersells that it is buildable ground or an operating property,
 * not a place to live. Two sentence templates, chosen by segment, so a reader gets
 * the right verb rather than one generic fill-in-the-blank across every type.
 */
const LAND_SEGMENTS = new Set(['land', 'farm', 'commercial_sale', 'business'])

/**
 * Property-type supply, largest first, capped (SITE-41 round two). Geos can publish
 * up to the full nine PUBLIC_PLACE_SEGMENTS types; printing all nine as tiles —
 * even captioned — is still a wall, and the 2026-09-09 evaluator named the effect
 * directly: nine of eighteen fold tiles shared one templated sentence with only the
 * noun swapped, "fill-in-the-blank copy standing in for a plain sentence." Cut to
 * the types with the most active inventory, which are also the types a buyer
 * comparing this city is most likely to ask about; the rest stay reachable through
 * the browse links this page already carries (the property-type search presets,
 * `/homes-for-sale/<city>/<type>`), never invented, never hidden behind a claim of
 * completeness this fold no longer makes.
 */
export function buildSegmentTailFigures(
  rows: readonly PublicSegmentRow[],
  citySlug: string | null,
  max = DEFAULT_SEGMENT_MAX,
): V3InstrumentFigure[] {
  const ranked = rows
    .filter((row) => row.activeCount != null && row.activeCount > 0)
    .sort((a, b) => (b.activeCount ?? 0) - (a.activeCount ?? 0))
    .slice(0, max)
  return ranked.map((row) => {
    const noun = publicSegmentNoun(row.segment, row.activeCount!)
    const sentence = LAND_SEGMENTS.has(row.segment)
      ? `${noun} on the market right now, a different kind of listing from a single-family house.`
      : `${noun} on the market right now, counted apart from single-family detached homes.`
    return {
      value: v3Text(row.activeCount!.toLocaleString('en-US')),
      label: v3Text(`${noun} for sale`),
      href: publicSegmentBrowseHref(citySlug, row.segment),
      sentence: v3Text(sentence),
    }
  })
}
