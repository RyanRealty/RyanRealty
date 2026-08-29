/**
 * Neighborhood face copy. Traces, captions, the few market figures, and the
 * FAQ filter live here so HUD labels and the buyer/seller H2 stay off
 * the public HTML.
 */

import type { V3InstrumentFigure, V3QuietItem } from '@/components/site/v3'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'

const FEED = 'live MLS through Oregon Data Share'

/** The few figures the neighborhood face prints. Pace, mix, and mart stay off. */
export const NEIGHBORHOOD_FACE_FIGURE_LABELS = new Set([
  'median list price',
  'detached homes for sale',
  'months of supply',
  'median to pending · 90 days',
  'sale to original list · 12 months',
])

export function neighborhoodFaceMarketFigures(
  figures: readonly V3InstrumentFigure[],
): V3InstrumentFigure[] {
  return figures.filter((figure) => NEIGHBORHOOD_FACE_FIGURE_LABELS.has(String(figure.label)))
}

const BUYER_SELLER_QUESTION =
  /Is [^\n]{0,120}buyer(?:'|’)s or seller(?:'|’)s market\?/

export function neighborhoodFaceFaqs<T extends { question: string }>(faqs: readonly T[]): T[] {
  return faqs.filter((item) => !BUYER_SELLER_QUESTION.test(item.question))
}

export function neighborhoodFaceMarketTrace(placeName: string, hasMos: boolean): string {
  return (
    `regional MLS through Oregon Data Share. ` +
    `Detached single-family houses assigned to ${placeName} by the recorded boundary polygon. ` +
    `Every figure names its own window. A figure the feed withheld is absent, not estimated.` +
    (hasMos ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')
  )
}

export function neighborhoodFaceAbsenceItems(placeName: string, hasRows: boolean): V3QuietItem[] {
  const tail = hasRows ? ' The homes above carry their own live list prices.' : ''
  const body =
    `Oregon Data Share published no figure for ${placeName} on this refresh, ` +
    `so this page is not printing a median, a supply figure, or a verdict.${tail}`
  return [{ kind: 'prose', term: 'No live market figures right now', body }]
}

export function neighborhoodFaceFieldCaption(input: {
  placeName: string
  count: number
  totalQualifying: number
  mosLabel: string | null
  verdictKind: 'sellers' | 'balanced' | 'buyers' | 'unknown'
  verdictLabel: string
}): string | null {
  if (input.count <= 0) return null
  const homes =
    input.totalQualifying > input.count
      ? `The ${input.count.toLocaleString('en-US')} highest-priced listings in ${input.placeName}`
      : `${input.count.toLocaleString('en-US')} ${input.count === 1 ? 'home' : 'homes'} for sale in ${input.placeName}`
  if (input.verdictKind === 'unknown' || input.mosLabel == null) return homes
  return `${homes} · ${input.mosLabel} months of supply · a ${input.verdictLabel}`
}

export function neighborhoodFaceFieldTrace(placeName: string): string {
  return (
    `${FEED}, active single-family homes inside the recorded ${placeName} boundary ` +
    `(the same counted set the neighborhoods index uses), each with a list price and a street. ` +
    `The map plots this same set.`
  )
}

/** First three about paragraphs stay open. The rest sit behind Read more. */
export const ABOUT_FOLD_AFTER = 3
