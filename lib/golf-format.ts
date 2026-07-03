/**
 * Presentation helpers for Central Oregon golf-course detail pages.
 * buildGolfFaq builds the FAQ from VERIFIED registry facts + the live
 * nearby-homes count + city market (CLAUDE.md §0) and feeds the FAQPage schema.
 */

import { GOLF_ACCESS_LABEL, type CoGolfCourse } from '@/data/co-golf'
import type { AreaMarket } from '@/lib/area-market'
import { marketSentence } from '@/lib/area-market'

export function buildGolfFaq(
  c: CoGolfCourse,
  homes: { count: number; medianLabel: string | null; cityMarket?: AreaMarket | null },
): Array<{ question: string; answer: string }> {
  const faq: Array<{ question: string; answer: string }> = []

  const playAnswer =
    c.access === 'public'
      ? `Yes. ${c.name} is a public course, open to anyone booking a tee time.`
      : c.access === 'resort'
        ? `Yes. ${c.name} is a resort course, open to resort guests and, at most times, the public by tee time.`
        : c.access === 'semi-private'
          ? `${c.name} is semi-private. Members have priority, and public tee times are available at set times. Check the official site for current access.`
          : `${c.name} is a private club, open to members and their guests.`
  faq.push({ question: `Can I play ${c.name}?`, answer: playAnswer })

  faq.push({
    question: `How many holes is ${c.name}?`,
    answer: `${c.name} is a ${c.holes}-hole ${GOLF_ACCESS_LABEL[c.access].toLowerCase()} course in ${c.city}, Central Oregon${c.par ? `, playing to a par of ${c.par}` : ''}.`,
  })

  if (c.designer) {
    faq.push({
      question: `Who designed ${c.name}?`,
      answer: `${c.name} was designed by ${c.designer}${c.yearOpened ? ` and opened in ${c.yearOpened}` : ''}.`,
    })
  }

  faq.push({
    question: `Are there homes for sale near ${c.name}?`,
    answer:
      homes.count > 0
        ? `Right now there are ${homes.count} active single-family homes for sale within about 1.5 miles of ${c.name}${
            homes.medianLabel ? `, with a median list price around ${homes.medianLabel}` : ''
          }. Inventory changes often.`
        : `There are no active single-family listings within about 1.5 miles of ${c.name} at the moment. Inventory changes often, so it is worth checking current homes in ${c.city}.`,
  })

  const marketAnswer = homes.cityMarket ? marketSentence(homes.cityMarket) : null
  if (marketAnswer) faq.push({ question: `What is the housing market like in ${c.city}?`, answer: marketAnswer })

  return faq
}
