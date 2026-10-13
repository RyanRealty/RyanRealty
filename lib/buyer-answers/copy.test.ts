import { describe, expect, it } from 'vitest'
import {
  costAnswer,
  hoaAnswer,
  livingAnswer,
  presetAnswer,
  strAnswer,
  vsAnswer,
} from './copy'
import { wordCount } from './format'
import type { BuyerAnswerFigures } from './types'
import { sourcedStr } from './sourced'

function place(over: Partial<BuyerAnswerFigures> & Pick<BuyerAnswerFigures, 'name'>): BuyerAnswerFigures {
  return {
    publicSlug: over.publicSlug ?? 'tetherow',
    durableSlug: over.durableSlug ?? 'tetherow',
    placeKind: over.placeKind ?? 'community',
    cityName: over.cityName ?? 'Bend',
    citySlug: over.citySlug ?? 'bend',
    hubHref: over.hubHref ?? '/communities/tetherow',
    activeCount: over.activeCount ?? 12,
    medianListPrice: over.medianListPrice ?? 1_850_000,
    monthsOfSupply: over.monthsOfSupply ?? 6.2,
    medianDaysToPending: over.medianDaysToPending ?? 41,
    closedLast30Days: over.closedLast30Days ?? 2,
    refreshedAt: over.refreshedAt ?? '2026-10-13T12:00:00.000Z',
    hoaAnnual: over.hoaAnnual !== undefined ? over.hoaAnnual : 1464,
    hoaKind: over.hoaKind !== undefined ? over.hoaKind : 'master',
    hoaBasis: over.hoaBasis ?? null,
    listingCount: over.listingCount ?? 12,
    name: over.name,
  }
}

describe('buyer-answer copy', () => {
  const asOf = 'Oct 13, 2026'

  it('keeps living, cost, HOA, STR, vs, and preset answers at 40-60 words', () => {
    const tetherow = place({ name: 'Tetherow' })
    const caldera = place({
      name: 'Caldera Springs',
      publicSlug: 'caldera-springs',
      durableSlug: 'caldera-springs',
      hubHref: '/communities/caldera-springs',
      activeCount: 8,
      medianListPrice: 2_100_000,
      medianDaysToPending: 55,
    })
    const answers = [
      livingAnswer(tetherow, asOf),
      costAnswer(tetherow, asOf),
      hoaAnswer(tetherow, asOf),
      strAnswer(tetherow, sourcedStr('tetherow')!, asOf),
      vsAnswer(tetherow, caldera, asOf),
      presetAnswer({
        city: 'Bend',
        plural: 'homes under $500,000',
        count: 84,
        medianListPrice: 750_000,
        medianDaysToPending: 28,
        asOf,
      }),
    ]
    for (const answer of answers) {
      const n = wordCount(answer)
      expect(answer).not.toMatch(/[—–]/)
      expect(n, answer).toBeGreaterThanOrEqual(40)
      expect(n, answer).toBeLessThanOrEqual(60)
      expect(answer).toContain('Oregon Data Share MLS, as of Oct 13, 2026')
    }
  })

  it('does not invent who should live in a place', () => {
    const answer = livingAnswer(place({ name: 'Sunriver' }), asOf)
    expect(answer.toLowerCase()).not.toMatch(/families|retirees|good for|perfect for|ideal for/)
    expect(answer).toContain('not who should live there')
  })

  it('keeps a measured HOA lede at 40-60 words with a short sample, not the hub paragraph', () => {
    const answer = hoaAnswer(
      place({
        name: 'Tetherow',
        hoaAnnual: 2052,
        hoaKind: 'measured',
        hoaBasis: 'median of 132 listings since October 2023',
      }),
      asOf,
    )
    const n = wordCount(answer)
    expect(n).toBeGreaterThanOrEqual(40)
    expect(n).toBeLessThanOrEqual(60)
    expect(answer).toContain('$2,052')
    expect(answer).toContain('median of 132 listings since October 2023')
    expect(answer).not.toContain('Dues vary by property')
  })

  it('omits an HOA dollar when none was published', () => {
    const answer = hoaAnswer(place({ name: 'Eagle Crest', hoaAnnual: null, hoaKind: null }), asOf)
    expect(answer).not.toMatch(/\$\d/)
    expect(answer).toContain('not published')
  })

  it('does not invent a zero inventory as a price', () => {
    const answer = livingAnswer(place({ name: 'Tetherow', activeCount: 0, medianListPrice: null }), asOf)
    expect(answer).toContain('no single-family homes for sale')
    expect(answer).not.toContain('median list price')
  })
})
