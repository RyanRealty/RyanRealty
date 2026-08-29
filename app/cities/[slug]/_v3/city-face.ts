/**
 * City face copy. Traces, captions, the few market figures, and the FAQ
 * filter live here so HUD labels and the buyer/seller H2 stay off
 * the public HTML.
 */

import type { V3InstrumentFigure, V3QuietItem } from '@/components/site/v3'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'

const FEED = 'live MLS through Oregon Data Share'

/** The few figures the city face prints. Pace, mix, and mart stay off this page. */
export const CITY_FACE_FIGURE_LABELS = new Set([
  'median list price',
  'detached homes for sale',
  'months of supply',
  'median to pending · 90 days',
  'sale to original list · 12 months',
])

export function cityFaceMarketFigures(
  figures: readonly V3InstrumentFigure[],
): V3InstrumentFigure[] {
  return figures.filter((figure) => CITY_FACE_FIGURE_LABELS.has(String(figure.label)))
}

const BUYER_SELLER_QUESTION =
  /Is [^\n]{0,120}buyer(?:'|’)s or seller(?:'|’)s market\?/

export function cityFaceFaqs<T extends { question: string }>(faqs: readonly T[]): T[] {
  return faqs.filter((item) => !BUYER_SELLER_QUESTION.test(item.question))
}

export function cityFaceMarketTrace(cityName: string, hasMos: boolean): string {
  return (
    `regional MLS through Oregon Data Share. ` +
    `Detached single-family houses inside the ${cityName} city boundary. ` +
    `Every figure names its own window. A figure the feed withheld is absent, not estimated.` +
    (hasMos ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')
  )
}

export function cityFaceAbsenceItems(cityName: string, hasRows: boolean): V3QuietItem[] {
  const tail = hasRows ? ' The homes above carry their own live list prices.' : ''
  const body =
    `Oregon Data Share published no figure for ${cityName} on this refresh, ` +
    `so this page is not printing a median, a supply figure, or a verdict.${tail}`
  return [{ kind: 'prose', term: 'No live market figures right now', body }]
}

export function cityFaceFieldCaption(input: {
  cityName: string
  count: number
  mosLabel: string | null
  verdictKind: 'sellers' | 'balanced' | 'buyers' | 'unknown'
  verdictLabel: string
}): string | null {
  if (input.count <= 0) return null
  const homes = `The ${input.count.toLocaleString('en-US')} newest listings in ${input.cityName}`
  if (input.verdictKind === 'unknown' || input.mosLabel == null) return homes
  return `${homes} · ${input.mosLabel} months of supply · a ${input.verdictLabel}`
}

export function cityFaceFieldTrace(cityName: string): string {
  return (
    `${FEED}, the newest active homes ` +
    `with a ${cityName} address, a list price, and a street. The map plots this same set. ` +
    `A type chip filters this same list.`
  )
}
