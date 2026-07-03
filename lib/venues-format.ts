/**
 * Presentation helpers for Central Oregon venue detail pages.
 *
 * buildVenueFaq builds the FAQ from VERIFIED registry facts + the live
 * nearby-homes count (CLAUDE.md §0) — every answer is factual, and it feeds the
 * FAQPage schema (the direct AEO lever).
 */

import { VENUE_TYPE_LABEL, VENUE_KIND_LABEL, type CoVenue } from '@/data/co-venues'
import type { AreaMarket } from '@/lib/area-market'
import { marketSentence } from '@/lib/area-market'

export function buildVenueFaq(
  v: CoVenue,
  homes: { count: number; medianLabel: string | null; cityMarket?: AreaMarket | null },
): Array<{ question: string; answer: string }> {
  const typeLabel = VENUE_TYPE_LABEL[v.venueType].toLowerCase()
  const faq: Array<{ question: string; answer: string }> = []

  faq.push({
    question: `What is ${v.name}?`,
    answer: `${v.name} is a ${typeLabel} in ${v.city}, Central Oregon.`,
  })

  const kindAnswer =
    v.kind === 'music'
      ? `${v.name} regularly hosts live music.`
      : v.kind === 'performing-arts'
        ? `${v.name} hosts theater and performing arts.`
        : `${v.name} hosts both live music and theater or performing arts.`
  faq.push({ question: `What kind of shows does ${v.name} host?`, answer: kindAnswer })

  faq.push({
    question: `How do I see what is playing at ${v.name}?`,
    answer: `See the current lineup on the ${v.name} calendar, linked on this page. New shows are added often.`,
  })

  faq.push({
    question: `Are there homes for sale near ${v.name}?`,
    answer:
      homes.count > 0
        ? `Right now there are ${homes.count} active single-family homes for sale within about 1.5 miles of ${v.name}${
            homes.medianLabel ? `, with a median list price around ${homes.medianLabel}` : ''
          }. Inventory changes often.`
        : `There are no active single-family listings within about 1.5 miles of ${v.name} at the moment. Inventory changes often, so it is worth checking current homes in ${v.city}.`,
  })

  const marketAnswer = homes.cityMarket ? marketSentence(homes.cityMarket) : null
  if (marketAnswer) {
    faq.push({ question: `What is the housing market like in ${v.city}?`, answer: marketAnswer })
  }

  return faq
}

/** Human label for the venue's kind (for the fact band). */
export function venueKindLabel(v: CoVenue): string {
  return VENUE_KIND_LABEL[v.kind]
}
