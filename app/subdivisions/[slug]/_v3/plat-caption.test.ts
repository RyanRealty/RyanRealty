import { describe, expect, it } from 'vitest'
import { platCaption } from './plat-caption'

describe('platCaption', () => {
  it('names the photograph first when the opening borrowed the resort frame', () => {
    // §0 applies to a picture that makes a claim: nothing may imply this frame
    // was shot inside the subdivision it sits above.
    expect(
      platCaption({
        displayName: 'Ridge at Eagle Crest',
        resortLabel: 'Eagle Crest',
        photographOf: 'Eagle Crest',
        cityName: 'Redmond',
        activeForSale: 14,
        medianAsking: '$910,000',
      }),
    ).toBe(
      'That photograph is Eagle Crest. Ridge at Eagle Crest is one of the subdivisions inside it, and 14 of its homes are for sale right now.',
    )
  })

  it('keeps the photograph attribution when there is no count to add', () => {
    expect(
      platCaption({
        displayName: 'Ridge at Eagle Crest',
        resortLabel: 'Eagle Crest',
        photographOf: 'Eagle Crest',
        activeForSale: null,
      }),
    ).toBe('That photograph is Eagle Crest. Ridge at Eagle Crest is one of the subdivisions inside it.')
  })

  it('leads with the resort, and adds the asking price when the counted set has one', () => {
    expect(
      platCaption({
        displayName: 'River Meadows',
        resortLabel: 'Three Rivers',
        cityName: 'Bend',
        activeForSale: 10,
        medianAsking: '$675,000',
      }),
    ).toBe(
      "River Meadows is one of Three Rivers's subdivisions. 10 of its homes are for sale right now, and the typical one is asking $675,000.",
    )
  })

  it('leads with the neighborhood chain when the boundary tree has one', () => {
    expect(
      platCaption({
        displayName: 'Park Addition',
        neighborhoodLabel: 'Old Bend',
        cityName: 'Bend',
        activeForSale: 4,
      }),
    ).toBe('Park Addition sits inside Old Bend, in Bend, and 4 of its homes are on the market today.')
  })

  it('leads with the inventory when the city is the only container', () => {
    expect(
      platCaption({ displayName: 'Easton', cityName: 'Bend', activeForSale: 20 }),
    ).toBe("20 homes are for sale in Easton right now, one of Bend's subdivisions.")
  })

  it('is a different grammar per setting, not one sentence with the name swapped', () => {
    const resort = platCaption({ displayName: 'A', resortLabel: 'R', cityName: 'C', activeForSale: 3 })!
    const hood = platCaption({ displayName: 'A', neighborhoodLabel: 'N', cityName: 'C', activeForSale: 3 })!
    const city = platCaption({ displayName: 'A', cityName: 'C', activeForSale: 3 })!
    // Strip every proper noun and the count: what remains is the grammar, and
    // the three settings may not share one.
    const skeleton = (s: string) => s.replace(/\b[ARNC]\b/g, '*').replace(/\d+/g, '#')
    expect(new Set([skeleton(resort), skeleton(hood), skeleton(city)]).size).toBe(3)
  })

  it('never publishes a zero: an absent or short read drops the clause, not the caption', () => {
    // ABSENT IS NOT ZERO. A timed-out tiles read leaves the same empty array an
    // empty subdivision leaves, so 0 may never become "no homes are for sale".
    expect(platCaption({ displayName: 'Easton', cityName: 'Bend', activeForSale: 0 })).toBe(
      "Easton is one of Bend's subdivisions.",
    )
    expect(platCaption({ displayName: 'Easton', cityName: 'Bend', activeForSale: null })).toBe(
      "Easton is one of Bend's subdivisions.",
    )
  })

  it('agrees in number with a single listing', () => {
    expect(platCaption({ displayName: 'Easton', cityName: 'Bend', activeForSale: 1 })).toBe(
      "1 home is for sale in Easton right now, one of Bend's subdivisions.",
    )
    expect(
      platCaption({ displayName: 'Easton', resortLabel: 'Tetherow', activeForSale: 1 }),
    ).toBe("Easton is one of Tetherow's subdivisions, and 1 of its homes is for sale right now.")
  })

  it('separates thousands so a four-figure count is readable', () => {
    expect(platCaption({ displayName: 'Big Plat', cityName: 'Bend', activeForSale: 1200 })).toBe(
      "1,200 homes are for sale in Big Plat right now, one of Bend's subdivisions.",
    )
  })

  it('says nothing rather than nothing-in-a-sentence when the page knows no setting and no count', () => {
    expect(platCaption({ displayName: 'Unplaced', cityName: null, activeForSale: null })).toBeNull()
    expect(platCaption({ displayName: '   ' })).toBeNull()
  })

  it('never says plat, the county word parity.json keeps off the public page', () => {
    const all = [
      platCaption({ displayName: 'A', photographOf: 'R', activeForSale: 2 }),
      platCaption({ displayName: 'A', resortLabel: 'R', activeForSale: 2, medianAsking: '$1.2M' }),
      platCaption({ displayName: 'A', neighborhoodLabel: 'N', cityName: 'C' }),
      platCaption({ displayName: 'A', cityName: 'C', activeForSale: 2 }),
      platCaption({ displayName: 'A', activeForSale: 2 }),
    ]
    for (const line of all) {
      expect(line).toBeTruthy()
      expect(line!.toLowerCase()).not.toContain('plat')
      // Every branch is a sentence: it ends in a full stop and starts capitalised.
      expect(line!).toMatch(/^[A-Z0-9].*\.$/)
    }
  })
})
