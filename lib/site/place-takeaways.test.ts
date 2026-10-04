import { describe, expect, it } from 'vitest'
import { placeTakeaways } from './place-takeaways'

const BEND = {
  place: 'Bend',
  asOfLabel: 'Oct 3, 2026',
  active: 726,
  medianList: 897_500,
  monthsOfSupply: 3.56,
  saleMedian: { value: 759_500, when: 'in September 2026' },
  yoyMedian: 0.0321,
}

describe('placeTakeaways', () => {
  it('answers the market question in up to four standalone sentences, each naming the place', () => {
    const t = placeTakeaways(BEND)
    expect(t).toEqual([
      'Bend has 726 single-family homes for sale as of Oct 3, 2026, at a median asking price of $897,500.',
      "Bend has 3.6 months of supply, a seller's market, so sellers have the edge.",
      'The median single-family home in Bend sold for $759,500 in September 2026.',
      'The median sale price in Bend over the last 12 months is up 3.2% from the 12 months before.',
    ])
    for (const s of t) expect(s).toContain('Bend')
  })

  it('prints prices exact, the way the FAQ and the Dataset do (§0)', () => {
    expect(placeTakeaways(BEND)[2]).toContain('$759,500')
    expect(placeTakeaways(BEND)[2]).not.toContain('$760,000')
  })

  it('rounds the 12-month change the way the pace tiles do (formatPaceDelta), at the half-way value too', () => {
    // Math.round(-32.5) is -32, so the tile reads -3.2%; toFixed on the absolute would say 3.3.
    expect(placeTakeaways({ place: 'X', yoyMedian: -0.0325 })[0]).toContain('is down 3.2% from')
    expect(placeTakeaways({ place: 'X', yoyMedian: -0.057 })[0]).toContain('is down 5.7% from')
    expect(placeTakeaways({ place: 'X', yoyMedian: 0.0004 })[0]).toContain('is level with the 12 months before')
  })

  it('drops a sentence when the page withholds its figure, never estimates it (§0)', () => {
    expect(placeTakeaways({ place: 'Tetherow', active: 12, monthsOfSupply: null, saleMedian: null, yoyMedian: null })).toEqual([
      'Tetherow has 12 single-family homes for sale.',
    ])
  })

  it('reads the verdict the way marketVerdict computes it, at the 4.0 edge too', () => {
    expect(placeTakeaways({ place: 'X', monthsOfSupply: 4 })[0]).toContain("seller's market")
    expect(placeTakeaways({ place: 'X', monthsOfSupply: 5.1 })[0]).toContain('balanced market, so neither buyers nor sellers')
    expect(placeTakeaways({ place: 'X', monthsOfSupply: 6 })[0]).toContain("buyer's market, so buyers have room")
  })

  it('never prints an em dash or a singular-plural slip', () => {
    expect(placeTakeaways({ place: 'X', active: 1 })[0]).toBe('X has 1 single-family home for sale.')
    for (const s of placeTakeaways(BEND)) expect(s).not.toMatch(/—|–| -- /)
  })
})
