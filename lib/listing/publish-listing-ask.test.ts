import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  computeMonthlyPiti,
  computeMonthlyPitiBreakdown,
  DEFAULT_PITI_RATE,
} from '@/lib/listing-tier1'
import {
  formatListingAsk,
  formatPublishedAsk,
  publishListingAsk,
  publishListingDrop,
  publishListingEstPayment,
  publishListingEstPaymentLabel,
  publishListingHistoryPrices,
} from './publish-listing-ask'

describe('publishListingAsk', () => {
  it('keeps the 7th Street and Hudspeth founding cases exact', () => {
    expect(publishListingAsk(424990)).toEqual({ ask: 424990 })
    expect(formatListingAsk(424990)).toBe('$424,990')
    expect(formatListingAsk(424990)).not.toBe('$425,000')
    expect(publishListingAsk(629500)).toEqual({ ask: 629500 })
    expect(formatListingAsk(629500)).toBe('$629,500')
    expect(formatListingAsk(629500)).not.toBe('$630,000')
  })

  it('withholds a missing or non-positive ask', () => {
    expect(publishListingAsk(0)).toBeNull()
    expect(publishListingAsk(null)).toBeNull()
  })

  it('keeps Boyd Acres and Old Bend place-card asks exact', () => {
    expect(formatPublishedAsk(949900)).toBe('$949,900')
    expect(formatPublishedAsk(949900)).not.toBe('$950,000')
    expect(formatPublishedAsk(899900)).toBe('$899,900')
    expect(formatPublishedAsk(1999500)).toBe('$1,999,500')
    expect(formatPublishedAsk(1999500)).not.toBe('$2,000,000')
    expect(formatPublishedAsk(919500)).toBe('$919,500')
    expect(formatPublishedAsk(919500)).not.toBe('$920,000')
    expect(formatPublishedAsk(1999900)).toBe('$1,999,900')
    expect(formatPublishedAsk(1999900)).not.toBe('$2,000,000')
  })
})

describe('publishListingDrop', () => {
  it('keeps Hudspeth drop math on the exact ask', () => {
    expect(publishListingDrop({ listPrice: 629500, originalListPrice: 645000 })).toEqual({
      ask: 629500,
      original: 645000,
      drop: 15500,
    })
  })

  it('keeps 7th Street drop math on the exact ask', () => {
    expect(publishListingDrop({ listPrice: 424990, originalListPrice: 430000 })).toEqual({
      ask: 424990,
      original: 430000,
      drop: 5010,
    })
  })

  it('withholds when original is not above the ask', () => {
    expect(publishListingDrop({ listPrice: 629500, originalListPrice: 629500 })).toBeNull()
    expect(publishListingDrop({ listPrice: 629500, originalListPrice: null })).toBeNull()
  })

  it('Mariposa: withholds $9.8M original when history only has the $7.9M ask', () => {
    expect(
      publishListingDrop({
        listPrice: 7_900_000,
        originalListPrice: 9_800_000,
        historyPrices: [7_900_000, 7_900_000],
      }),
    ).toBeNull()
  })

  it('reads prices off the published history rail', () => {
    expect(publishListingHistoryPrices([{ price: 7_900_000 }, { price: null }, { price: 9_800_000 }])).toEqual([
      7_900_000,
      9_800_000,
    ])
  })

  it('prints the drop when history already carries the original ask', () => {
    expect(
      publishListingDrop({
        listPrice: 7_900_000,
        originalListPrice: 9_800_000,
        historyPrices: [9_800_000, 7_900_000],
      }),
    ).toEqual({
      ask: 7_900_000,
      original: 9_800_000,
      drop: 1_900_000,
    })
  })
})

describe('publishListingEstPaymentLabel', () => {
  it('prints the leftover PITI as Est. $6,030/mo', () => {
    expect(publishListingEstPaymentLabel(6030)).toBe('Est. $6,030/mo')
  })

  it('withholds a missing or non-positive payment', () => {
    expect(publishListingEstPaymentLabel(null)).toBeNull()
    expect(publishListingEstPaymentLabel(0)).toBeNull()
  })
})

describe('one PITI formula — face Est. and calculator seed', () => {
  // Crosby-shaped: HOA is on the house. Face used to include it (and 0.35%
  // insurance); the calculator omitted HOA and used $1,000 / $300K insurance.
  const HOA_FIXTURE = {
    listPrice: 1_850_000,
    taxAnnual: 12_000,
    hoaMonthly: 75,
    mortgageRate: DEFAULT_PITI_RATE,
  }

  it('face and calculator seed the same cents for a fixture with HOA', () => {
    const face = publishListingEstPayment(HOA_FIXTURE)
    const calculatorSeed = computeMonthlyPitiBreakdown({
      ...HOA_FIXTURE,
      financedFraction: null,
      termMonths: null,
      insuranceAnnual: null,
    })
    expect(face).not.toBeNull()
    expect(calculatorSeed).not.toBeNull()
    expect(face!.piti).toBe(calculatorSeed!.total)
    expect(face!.piti).toBe(computeMonthlyPiti(HOA_FIXTURE))
    expect(face!.label).toBe(`Est. $${Math.round(face!.piti).toLocaleString('en-US')}/mo`)
  })

  it('the cents include the HOA dollar-for-dollar', () => {
    const withHoa = computeMonthlyPiti(HOA_FIXTURE)
    const withoutHoa = computeMonthlyPiti({ ...HOA_FIXTURE, hoaMonthly: null })
    expect(withHoa).not.toBeNull()
    expect(withoutHoa).not.toBeNull()
    expect(withHoa! - withoutHoa!).toBe(75)
  })

  it('the listing calculator seeds through computeMonthlyPiti, not a second insurance or rate', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'components/site/listing-detail/MortgageCalculator.tsx'),
      'utf8',
    )
    expect(src).toMatch(/computeMonthlyPitiBreakdown/)
    expect(src).toMatch(/DEFAULT_PITI_RATE/)
    expect(src).toMatch(/DEFAULT_PITI_INSURANCE_RATE/)
    expect(src).toMatch(/hoaMonthly/)
    expect(src).not.toMatch(/INSURANCE_PER_300K/)
    expect(src).not.toMatch(/DEFAULT_RATE_PCT/)
  })

  it('the face Est. label is computed, not leftover estimatedMonthlyPiti', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'components/site/listing-detail/PriceCtaStrip.tsx'),
      'utf8',
    )
    expect(src).toMatch(/publishListingEstPayment\(/)
    expect(src).not.toMatch(/estimatedMonthlyPiti/)
  })
})
