/**
 * Presentation helpers for the /central-oregon/golf/[slug] per-course detail
 * pages. These pages are the "each course + homes for sale nearby" layer on top
 * of the canonical golf registry (data/golf/courses.ts) that also powers the
 * /lp/central-oregon-golf hub. One registry, no duplication.
 *
 * buildGolfFaq builds the FAQ from the registry facts + the live nearby-homes
 * count + city market (CLAUDE.md §0) and feeds the FAQPage schema.
 */

import type { CourseAccess, GolfCourse } from '@/data/golf/courses'
import type { AreaMarket } from '@/lib/area-market'
import { marketSentence } from '@/lib/area-market'

export const GOLF_ACCESS_LABEL: Record<CourseAccess, string> = {
  public: 'Public',
  resort: 'Resort',
  private: 'Private',
  municipal: 'Municipal',
  'semi-private': 'Semi-private',
}

/**
 * Map a registry `city` string to a real service-area city slug (for the market
 * band + the /cities/[slug] cross-link). The registry uses a few compound
 * labels ("Bend (NE)", "Sunriver / Caldera Springs") — normalize those.
 */
export function cityToGeoSlug(city: string): string {
  const base = city
    .replace(/\(.*?\)/g, '') // drop "(NE)"
    .split('/')[0] // "Sunriver / Caldera Springs" -> "Sunriver"
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base
}

/** Clean the display city (drop parentheticals / compound tails). */
export function displayCity(city: string): string {
  return city.replace(/\s*\(.*?\)/g, '').split('/')[0].trim()
}

export function buildGolfFaq(
  c: GolfCourse,
  homes: { count: number; medianLabel: string | null; cityMarket?: AreaMarket | null },
): Array<{ question: string; answer: string }> {
  const faq: Array<{ question: string; answer: string }> = []
  const city = displayCity(c.city)

  const playAnswer =
    c.access === 'public' || c.access === 'municipal'
      ? `Yes. ${c.shortName} is a ${GOLF_ACCESS_LABEL[c.access].toLowerCase()} course, open to anyone booking a tee time.`
      : c.access === 'resort'
        ? `Yes. ${c.shortName} is a resort course, open to resort guests and, at most times, the public by tee time.`
        : c.access === 'semi-private'
          ? `${c.shortName} is semi-private. Members have priority, and public tee times are available at set times. Check the course for current access.`
          : `${c.shortName} is a private club, open to members and their guests.`
  faq.push({ question: `Can I play ${c.shortName}?`, answer: playAnswer })

  faq.push({
    question: `How many holes is ${c.shortName}?`,
    answer: `${c.name} is a ${c.holes}-hole course in ${city}, Central Oregon, playing to a par of ${c.par}${
      typeof c.yardsBackTees === 'number' ? ` and ${c.yardsBackTees.toLocaleString()} yards from the back tees` : ''
    }.`,
  })

  faq.push({
    question: `Who designed ${c.shortName}?`,
    answer: `${c.name} was designed by ${c.designer} and opened in ${c.yearOpened}.`,
  })

  faq.push({
    question: `Are there homes for sale near ${c.shortName}?`,
    answer:
      homes.count > 0
        ? `Right now there are ${homes.count} active single-family homes for sale within about 1.5 miles of ${c.shortName}${
            homes.medianLabel ? `, with a median list price around ${homes.medianLabel}` : ''
          }. Inventory changes often.`
        : `There are no active single-family listings within about 1.5 miles of ${c.shortName} at the moment. Inventory changes often, so it is worth checking current homes in ${city}.`,
  })

  const marketAnswer = homes.cityMarket ? marketSentence(homes.cityMarket) : null
  if (marketAnswer) faq.push({ question: `What is the housing market like in ${city}?`, answer: marketAnswer })

  return faq
}
