/**
 * Presentation helpers for Central Oregon trail detail pages.
 * buildTrailFaq builds the FAQ from VERIFIED registry facts + the live
 * nearby-homes count + city market (CLAUDE.md §0) and feeds the FAQPage schema.
 */

import { TRAIL_DIFFICULTY_LABEL, TRAIL_USE_LABEL, type CoTrail } from '@/data/co-trails'
import type { AreaMarket } from '@/lib/area-market'
import { marketSentence } from '@/lib/area-market'

function distancePhrase(t: CoTrail): string | null {
  if (typeof t.lengthMiles !== 'number') return null
  const note = t.distanceNote ? ` ${t.distanceNote}` : ''
  return `${t.lengthMiles} ${t.lengthMiles === 1 ? 'mile' : 'miles'}${note}`
}

export function buildTrailFaq(
  t: CoTrail,
  homes: { count: number; medianLabel: string | null; cityMarket?: AreaMarket | null },
): Array<{ question: string; answer: string }> {
  const faq: Array<{ question: string; answer: string }> = []

  const dist = distancePhrase(t)
  const useWord =
    t.use === 'mtb' ? 'mountain-bike trail' : t.use === 'both' ? 'hiking and biking trail' : 'hiking trail'
  faq.push({
    question: `How long is ${t.name}?`,
    answer: dist
      ? `${t.name} runs ${dist}, a ${useWord} managed by ${t.landManager} near ${t.city}, Central Oregon.`
      : `${t.name} is a ${useWord} managed by ${t.landManager} near ${t.city}, Central Oregon. The official source does not publish a set distance.`,
  })

  if (t.difficulty) {
    faq.push({
      question: `How hard is ${t.name}?`,
      answer: `${t.landManager} rates ${t.name} as ${TRAIL_DIFFICULTY_LABEL[t.difficulty].toLowerCase()}${
        typeof t.elevationGainFt === 'number' ? `, with about ${t.elevationGainFt.toLocaleString()} feet of elevation gain` : ''
      }.`,
    })
  }

  faq.push({
    question: `Can you ${t.use === 'mtb' ? 'mountain bike' : 'hike'} ${t.name}?`,
    answer: `Yes. ${t.name} is open for ${TRAIL_USE_LABEL[t.use].toLowerCase()}.${
      t.fee && t.fee.toLowerCase() !== 'free' ? ` A ${t.fee} is required to park at the trailhead.` : t.fee ? ' Parking is free.' : ''
    }`,
  })

  faq.push({
    question: `Are there homes for sale near ${t.name}?`,
    answer:
      homes.count > 0
        ? `Right now there are ${homes.count} active single-family homes for sale within about 1.5 miles of the ${t.name} trailhead${
            homes.medianLabel ? `, with a median list price around ${homes.medianLabel}` : ''
          }. Inventory changes often.`
        : `There are no active single-family listings within about 1.5 miles of the ${t.name} trailhead at the moment (much of the land around it is public forest). Inventory changes often, so it is worth checking current homes in ${t.city}.`,
  })

  const marketAnswer = homes.cityMarket ? marketSentence(homes.cityMarket) : null
  if (marketAnswer) faq.push({ question: `What is the housing market like in ${t.city}?`, answer: marketAnswer })

  return faq
}
