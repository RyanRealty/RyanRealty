/**
 * The sixty cuts as one drawing (SITE-49).
 *
 * The 2026-09-08 taste table scored /price-drops 30 and named the cause: "the
 * only data display in the first viewport is a photo-price-badge-address card,
 * identical in form to a portal's price-reduced search results. There is no
 * distribution of the 60 cuts, no sparkline of the price history, nothing that
 * turns the count into a picture." So the page opens with the distribution the
 * count already implies: one mark per cut on a shared axis of cut size, each
 * giving up its address and its percent to a hover, a tap or the keyboard.
 *
 * NOTHING IS INVENTED. Every mark is a row the grid below renders; the axis is
 * the cut percent the row carries; a row without a percent draws no mark and is
 * counted out of n rather than plotted at zero (CLAUDE.md §0). The drawing is
 * omitted below V3_DRAWING_MIN_STRIP marks, which is the primitive's own honest
 * floor, and says why.
 */

import type { V3DrawingFigure, V3DrawingPoint } from '@/components/site/v3'
import type { PriceDrop } from '@/lib/data'
import { formatPriceCompact } from '@/lib/format/money'
import { listingMlsStreetLine } from '@/lib/listing/publish-street-line'

/** A cut is drawable when it has a positive percent this axis can place. */
function drawablePct(drop: PriceDrop): number | null {
  const pct = drop.lastDropPct
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return null
  return pct
}

export function priceDropPoints(drops: readonly PriceDrop[]): V3DrawingPoint[] {
  const points: V3DrawingPoint[] = []
  for (const drop of drops) {
    const pct = drawablePct(drop)
    if (pct == null) continue
    // A suffix with no name ("Ct") is what publishStreetLine returns when the
    // MV row has only that; it is not an address, and a mark whose reading is
    // "Ct, Bend" names nothing. Require the name the reader would recognise.
    const street = drop.streetName?.trim() ? listingMlsStreetLine(drop) : ''
    if (!street) continue
    const cut = drop.lastDropAmount
    const amount =
      cut != null && Number.isFinite(cut) && cut > 0 ? formatPriceCompact(cut) : null
    const place = drop.city?.trim()
    points.push({
      id: drop.listingKey,
      at: pct,
      tick: `${pct.toFixed(1)}% off`,
      label: [
        `${street}${place ? `, ${place}` : ''}`,
        `${pct.toFixed(1)}% off${amount ? `, ${amount} cut` : ''}`,
      ].join(' · '),
    })
  }
  return points.sort((a, b) => a.at - b.at)
}

/**
 * The figure the page draws above the grid. `claim` is the sentence a person
 * would say; `source` is the §0 trace for the marks themselves, which is a
 * different population from the page's own list (a row with no percent is in
 * the list and not on the axis, and the trace says so).
 */
export function priceDropDistribution(input: {
  drops: readonly PriceDrop[]
  total: number
  /** The pull's row cap, so the drawing can say why total and n differ. */
  cap: number
  placeLabel: string
  windowDays: number
  fetchedAt: string | null
}): V3DrawingFigure | null {
  const points = priceDropPoints(input.drops)
  if (points.length === 0) return null

  const deepest = points[points.length - 1]!
  const shallowest = points[0]!
  const median = points[Math.floor((points.length - 1) / 2)]!

  return {
    key: 'cuts',
    draw: 'strip',
    claim: `${points.length} of this week's ${input.placeLabel} price cuts, smallest to deepest: the middle one came down ${median.at.toFixed(1)}%, the deepest ${deepest.at.toFixed(1)}%.`,
    caption: 'Every cut this week by how far the ask came down',
    sampleKey: 'cuts',
    // What the marks actually give up. The primitive's default names a month,
    // which these marks do not carry.
    askHint: 'Hover, tap or tab a cut for the home, the percent and the dollars.',
    source:
      `Active single-family listings in the ${input.placeLabel} service area with a documented asking-price cut in the last ${input.windowDays} days ` +
      `(the same pull the list below renders). ${input.total} cuts are in the window and the pull is capped at ${input.cap}, ` +
      `so ${input.total > input.cap ? `${input.total - input.cap} of them are not on this page at all` : 'every one of them is here'}. ` +
      `One mark per cut, placed at the cut as a percent of the previous ask; ` +
      `${input.drops.length - points.length} row(s) in the pull carry no percent or no street and are not plotted. ` +
      `Range ${shallowest.at.toFixed(1)}% to ${deepest.at.toFixed(1)}%` +
      (input.fetchedAt ? `. Read ${input.fetchedAt}` : ''),
    points,
  }
}
