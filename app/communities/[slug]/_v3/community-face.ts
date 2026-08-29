/**
 * Community face copy. Traces, captions, the few market figures, and the FAQ
 * filter live here so HUD labels and the buyer/seller H2 stay off
 * the public HTML.
 */

import type { V3InstrumentFigure, V3QuietItem } from '@/components/site/v3'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'

const FEED = 'live MLS through Oregon Data Share'

/** The few figures the community face prints. Pace, mix, and mart stay off. */
export const COMMUNITY_FACE_FIGURE_LABELS = new Set([
  'median list price',
  'detached homes for sale',
  'months of supply',
  'median to pending · 90 days',
  'sale to original list · 12 months',
])

export function communityFaceMarketFigures(
  figures: readonly V3InstrumentFigure[],
): V3InstrumentFigure[] {
  return figures.filter((figure) => COMMUNITY_FACE_FIGURE_LABELS.has(String(figure.label)))
}

const BUYER_SELLER_QUESTION =
  /Is [^\n]{0,120}buyer(?:'|’)s or seller(?:'|’)s market\?/

export function communityFaceFaqs<T extends { question: string }>(faqs: readonly T[]): T[] {
  return faqs.filter((item) => !BUYER_SELLER_QUESTION.test(item.question))
}

export function communityFaceMarketTrace(placeName: string, hasMos: boolean): string {
  return (
    `regional MLS through Oregon Data Share. ` +
    `Detached single-family houses assigned to ${placeName} by the recorded boundary polygon. ` +
    `Every figure names its own window. A figure the feed withheld is absent, not estimated.` +
    (hasMos ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')
  )
}

export function communityFaceAbsenceItems(placeName: string, hasRows: boolean): V3QuietItem[] {
  const tail = hasRows ? ' The homes above carry their own live list prices.' : ''
  const body =
    `Oregon Data Share published no figure for ${placeName} on this refresh, ` +
    `so this page is not printing a median, a supply figure, or a verdict.${tail}`
  return [{ kind: 'prose', term: 'No live market figures right now', body }]
}

export function communityFaceFieldCaption(input: {
  placeName: string
  count: number
  mosLabel: string | null
  verdictKind: 'sellers' | 'balanced' | 'buyers' | 'unknown'
  verdictLabel: string
}): string | null {
  if (input.count <= 0) return null
  const homes = `${input.count.toLocaleString('en-US')} ${
    input.count === 1 ? 'home' : 'homes'
  } for sale in ${input.placeName}`
  if (input.verdictKind === 'unknown' || input.mosLabel == null) return homes
  return `${homes} · ${input.mosLabel} months of supply · a ${input.verdictLabel}`
}

export function communityFaceFieldTrace(placeName: string, branch: CommunityFaceFieldBranch): string {
  if (branch === 'alias') {
    return (
      `${FEED}, active homes matched to ${placeName} through the registry's ` +
      `subdivision aliases, the same set the alias-aware counts use. The map plots this same set. ` +
      `A type chip filters this same list.`
    )
  }
  if (branch === 'boundary') {
    return (
      `${FEED}, active homes inside the recorded ${placeName} boundary. ` +
      `The map plots this same set. A type chip filters this same list.`
    )
  }
  return (
    `${FEED}, active homes recorded under the ${placeName} subdivision name. ` +
    `The map plots this same set. A type chip filters this same list.`
  )
}

export type CommunityFaceFieldBranch = 'alias' | 'boundary' | 'subdivision-name'
