/**
 * The four resort community answer blocks (SEO & AEO Desk brief 2026-10-08),
 * and the guarantee that the default `place` variant stays byte-identical.
 * Figures are the live Oct 8, 2026 values the brief traces.
 */
import { describe, expect, it } from 'vitest'
import { placeTakeaways } from './place-takeaways'

const AS_OF = 'Oct 8, 2026'

const BRASADA = {
  variant: 'community' as const,
  communitySlug: 'brasada-ranch',
  place: 'Brasada Ranch',
  asOfLabel: AS_OF,
  saleMedian: { value: 1_412_500, when: 'over the last 12 months' },
  medianList: 1_550_000,
}

const BBR = {
  variant: 'community' as const,
  communitySlug: 'black-butte-ranch',
  place: 'Black Butte Ranch',
  asOfLabel: AS_OF,
  saleMedian: { value: 1_060_000, when: 'over the last 12 months' },
  medianList: 1_190_000,
  yoyMedian: 0.047,
  cashShare: 0.441,
}

const TETHEROW = {
  variant: 'community' as const,
  communitySlug: 'tetherow',
  place: 'Tetherow',
  asOfLabel: AS_OF,
  saleMedian: { value: 2_257_500, when: 'over the last 12 months' },
  medianList: 2_747_500,
  cashShare: 0.633,
  cityCashShare: 0.282,
}

const BROKEN = {
  variant: 'community' as const,
  communitySlug: 'broken-top',
  place: 'Broken Top',
  asOfLabel: AS_OF,
  saleMedian: { value: 1_725_000, when: 'over the last 12 months' },
  medianList: 2_595_000,
  hasTownhomes: true,
  hasLots: true,
}

describe('placeTakeaways, community variant', () => {
  it('prints the brief Brasada answer word for word at the Oct 8 figures', () => {
    expect(placeTakeaways(BRASADA)).toEqual([
      'Brasada Ranch is a 1,800-acre resort community in Powell Butte, Oregon, about 25 minutes from Bend, built around the Brasada Canyons golf course.',
      'Single-family homes there sold for a median $1,412,500 over the last 12 months, and the homes for sale on Oct 8, 2026 were asking a median $1,550,000.',
      "Ryan Realty's brokers can show you any Brasada Ranch listing or, if you're selling, read the recent sales against your home.",
    ])
  })

  it('prints the brief Black Butte Ranch answer, including the 12-month change and cash share', () => {
    expect(placeTakeaways(BBR)).toEqual([
      'Black Butte Ranch is an 1,800-acre resort community 8 miles from Sisters, Oregon, with two 18-hole golf courses, Big Meadow and Glaze Meadow.',
      'Single-family homes there sold for a median $1,060,000 over the last 12 months, up 4.7% from the 12 months before, and the homes for sale on Oct 8, 2026 were asking a median $1,190,000.',
      "44.1% of last year's buyers paid cash.",
    ])
  })

  it('prints the brief Tetherow answer, cash against Bend', () => {
    expect(placeTakeaways(TETHEROW)).toEqual([
      "Tetherow is a 700-acre golf community on Bend's west side, built around a David McLay Kidd course that opened in 2008.",
      'Single-family homes there sold for a median $2,257,500 over the last 12 months, and the homes for sale on Oct 8, 2026 were asking a median $2,747,500.',
      "63.3% of last year's buyers paid cash, against 28.2% across Bend.",
    ])
  })

  it('prints the brief Broken Top answer, and names townhomes/lots only when present', () => {
    expect(placeTakeaways(BROKEN)).toEqual([
      'Broken Top is a gated golf community on Bend\'s west side, established in 1992 around a private Tom Weiskopf and Jay Morrish course.',
      'Single-family homes there sold for a median $1,725,000 over the last 12 months, and the homes for sale on Oct 8, 2026 were asking a median $2,595,000.',
      'Townhomes and lots also come up for sale inside the gates.',
    ])
    expect(placeTakeaways({ ...BROKEN, hasTownhomes: false, hasLots: false }).at(-1)).not.toMatch(
      /Townhomes|lots/,
    )
  })

  it('drops a clause, never estimates, when a figure is null', () => {
    const t = placeTakeaways({
      ...TETHEROW,
      saleMedian: null,
      medianList: null,
      cashShare: null,
    })
    expect(t).toEqual([
      "Tetherow is a 700-acre golf community on Bend's west side, built around a David McLay Kidd course that opened in 2008.",
    ])
    for (const s of t) expect(s).not.toMatch(/null|NaN|undefined|\$0\b/)
  })

  it('writes no dash of any kind', () => {
    for (const s of [...placeTakeaways(BRASADA), ...placeTakeaways(BBR), ...placeTakeaways(TETHEROW), ...placeTakeaways(BROKEN)]) {
      expect(s).not.toMatch(/\u2014|\u2013| -- /)
    }
  })
})

describe('placeTakeaways, place variant unchanged beside community', () => {
  it('ignores community-only inputs unless the variant asks for them', () => {
    expect(
      placeTakeaways({
        place: 'Tetherow',
        asOfLabel: AS_OF,
        active: 12,
        medianList: 1_650_000,
        communitySlug: 'tetherow',
        cashShare: 0.633,
        variant: 'place',
      }),
    ).toEqual(
      placeTakeaways({
        place: 'Tetherow',
        asOfLabel: AS_OF,
        active: 12,
        medianList: 1_650_000,
      }),
    )
  })
})
