/**
 * Seller-facing story of how the pricing ladder picked comps.
 * Tiers come from lib/pricing/ladder.ts. This file does not invent a search.
 */

import { cleanText } from '@/lib/cma/render-blocks'

export type CompSearchStory = {
  stayedInSubdivision: boolean
  subdivisionName: string | null
  monthsBack: number | null
  radiusMiles: number | null
  usedSimilarSubdivisions: boolean
  headline: string
  body: string
}

export function parseTierRadiusMiles(tier: string): number | null {
  const m = tier.match(/(\d+(?:\.\d+)?)mi/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseTierMonths(tier: string): number | null {
  const m = tier.match(/(\d+)mo/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function maxNum(values: Array<number | null>): number | null {
  const kept = values.filter((n): n is number => n != null && n > 0)
  return kept.length ? Math.max(...kept) : null
}

export function describeCompSearch(opts: {
  subdivision: string | null | undefined
  tiersUsed: readonly string[]
}): CompSearchStory {
  const name = cleanText(opts.subdivision)
  const tiers = opts.tiersUsed
  if (tiers.length === 0) {
    return {
      stayedInSubdivision: false,
      subdivisionName: name,
      monthsBack: null,
      radiusMiles: null,
      usedSimilarSubdivisions: false,
      headline: name ? `Sales near ${name}` : 'Sales next to this home',
      body: name
        ? `The pins are the sales we kept. The outline is the ${name} subdivision when that boundary is on file.`
        : 'The pins on this map are the sales we kept.',
    }
  }
  const leftSubdivision = tiers.some(
    (t) => !t.startsWith('subdivision-') && t !== 'broker-selected',
  )
  const radiusMiles = maxNum(tiers.map(parseTierRadiusMiles))
  const monthsBack = maxNum(tiers.map(parseTierMonths))
  const usedSimilar = tiers.some((t) => t.startsWith('similar-sub') || t.startsWith('city-'))
  const monthBit = monthsBack != null ? ` from the last ${monthsBack} months` : ''

  if (!leftSubdivision && name) {
    return {
      stayedInSubdivision: true,
      subdivisionName: name,
      monthsBack,
      radiusMiles: null,
      usedSimilarSubdivisions: false,
      headline: `Sales inside ${name}`,
      body: `We stayed inside the ${name} subdivision${monthBit}. The outline is that subdivision. The pins are the sales we kept.`,
    }
  }
  if (!leftSubdivision) {
    return {
      stayedInSubdivision: true,
      subdivisionName: null,
      monthsBack,
      radiusMiles: null,
      usedSimilarSubdivisions: false,
      headline: 'Sales next to this home',
      body: `We used the closest recent closed sales${monthBit}. The pins on this map are those sales.`,
    }
  }

  const radiusBit =
    radiusMiles != null
      ? `opened to ${radiusMiles} mile${radiusMiles === 1 ? '' : 's'}`
      : 'opened past the subdivision'
  const similarBit = usedSimilar ? ' and brought in similar-priced subdivisions' : ''
  const where = radiusMiles != null ? `${radiusMiles} mile${radiusMiles === 1 ? '' : 's'}` : 'a wider search'
  return {
    stayedInSubdivision: false,
    subdivisionName: name,
    monthsBack,
    radiusMiles,
    usedSimilarSubdivisions: usedSimilar,
    headline: name ? `${name}, then ${where}` : `A wider search${radiusMiles != null ? `, ${radiusMiles} miles` : ''}`,
    body: name
      ? `There were not enough recent sales inside ${name}, so we ${radiusBit}${similarBit}${monthBit}. The outline is the subdivision. The circle is the search. The pins are the sales we kept.`
      : `There were not enough recent sales next to this home, so we ${radiusBit}${similarBit}${monthBit}. The circle is the search. The pins are the sales we kept.`,
  }
}
