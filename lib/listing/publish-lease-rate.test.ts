import { describe, expect, it } from 'vitest'
import {
  LEASE_LABEL,
  LEASE_RATE_NOT_PUBLISHED,
  LEASE_RATE_OPTIONS,
  leaseRateOption,
  publishLeaseRate,
  publishLeaseRateRange,
  publishLeaseRateSummary,
  publishListingLeaseFigure,
} from './publish-lease-rate'

describe('publishLeaseRate, long register', () => {
  it('prints a per-square-foot rate with its cents and both halves of its unit', () => {
    expect(publishLeaseRate({ listPrice: 1.4, rateOption: '$/SF/Mo' })).toBe('$1.40 per sq ft per month')
    expect(publishLeaseRate({ listPrice: 18, rateOption: '$/SF/Yr' })).toBe('$18.00 per sq ft per year')
    expect(publishLeaseRate({ listPrice: 1.3, rateOption: '$/SF/Mo' })).toBe('$1.30 per sq ft per month')
  })

  it('prints a whole-space amount in whole dollars with its period', () => {
    expect(publishLeaseRate({ listPrice: 2500, rateOption: '$ Amt/Mo' })).toBe('$2,500 per month')
    expect(publishLeaseRate({ listPrice: 30000, rateOption: '$ Amt/Yr' })).toBe('$30,000 per year')
  })

  it('keeps a finer digit the feed carries instead of rounding the listed rate', () => {
    expect(publishLeaseRate({ listPrice: 1.375, rateOption: '$/SF/Mo' })).toBe('$1.375 per sq ft per month')
    expect(publishLeaseRate({ listPrice: 2500.5, rateOption: '$ Amt/Mo' })).toBe('$2,500.50 per month')
  })
})

describe('publishLeaseRate, compact register', () => {
  it('fits a card slot and still carries the unit', () => {
    expect(publishLeaseRate({ listPrice: 1.4, rateOption: '$/SF/Mo' }, 'compact')).toBe('$1.40/sq ft/mo')
    expect(publishLeaseRate({ listPrice: 18, rateOption: '$/SF/Yr' }, 'compact')).toBe('$18.00/sq ft/yr')
    expect(publishLeaseRate({ listPrice: 2500, rateOption: '$ Amt/Mo' }, 'compact')).toBe('$2,500/mo')
    expect(publishLeaseRate({ listPrice: 30000, rateOption: '$ Amt/Yr' }, 'compact')).toBe('$30,000/yr')
  })
})

describe('publishLeaseRate withholds rather than print a bare or wrong number', () => {
  it('publishes nothing without a unit, or with a unit that is not one of the four', () => {
    expect(publishLeaseRate({ listPrice: 1.4, rateOption: null })).toBeNull()
    expect(publishLeaseRate({ listPrice: 1.4, rateOption: undefined })).toBeNull()
    expect(publishLeaseRate({ listPrice: 1.4, rateOption: '' })).toBeNull()
    expect(publishLeaseRate({ listPrice: 1.4, rateOption: '$/SF/Wk' })).toBeNull()
    expect(publishLeaseRate({ listPrice: 2500, rateOption: 'Monthly' })).toBeNull()
  })

  it('publishes nothing for a missing, zero, negative or non-finite price', () => {
    for (const listPrice of [null, undefined, 0, -1.4, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(publishLeaseRate({ listPrice, rateOption: '$/SF/Mo' })).toBeNull()
    }
  })

  it('publishes nothing when the printed amount would be zero dollars', () => {
    expect(publishLeaseRate({ listPrice: 0.00001, rateOption: '$/SF/Mo' })).toBeNull()
  })

  it('withholds a per-square-foot rate at or above the unit break (65315 Highway 97, Bend)', () => {
    expect(publishLeaseRate({ listPrice: 3000, rateOption: '$/SF/Mo' })).toBeNull()
    expect(publishLeaseRate({ listPrice: 3000, rateOption: '$/SF/Yr' })).toBeNull()
    expect(publishLeaseRate({ listPrice: 100, rateOption: '$/SF/Yr' })).toBeNull()
    expect(publishLeaseRate({ listPrice: 36, rateOption: '$/SF/Yr' })).toBe('$36.00 per sq ft per year')
  })

  it('withholds a whole-space amount under the unit break (5598 Table Rock, Medford)', () => {
    expect(publishLeaseRate({ listPrice: 1.1, rateOption: '$ Amt/Mo' })).toBeNull()
    expect(publishLeaseRate({ listPrice: 99.99, rateOption: '$ Amt/Yr' })).toBeNull()
    expect(publishLeaseRate({ listPrice: 325, rateOption: '$ Amt/Mo' })).toBe('$325 per month')
  })

  it('never prints a number without a unit word', () => {
    for (const option of LEASE_RATE_OPTIONS) {
      for (const listPrice of [0.29, 1.4, 36, 325, 2500, 125000]) {
        for (const register of ['long', 'compact'] as const) {
          const text = publishLeaseRate({ listPrice, rateOption: option }, register)
          if (text == null) continue
          expect(text).toMatch(/(per month|per year|\/mo|\/yr)$/)
        }
      }
    }
  })
})

describe('leaseRateOption', () => {
  it('reads the four feed values, tolerating case and spacing only', () => {
    expect(leaseRateOption('$/SF/Mo')).toBe('$/SF/Mo')
    expect(leaseRateOption(' $  amt/mo ')).toBe('$ Amt/Mo')
    expect(leaseRateOption('$/sf/yr')).toBe('$/SF/Yr')
    expect(leaseRateOption('$Amt/Mo')).toBeNull()
    expect(leaseRateOption({ '$/SF/Mo': true })).toBeNull()
    expect(leaseRateOption(1.4)).toBeNull()
  })
})

describe('publishListingLeaseFigure', () => {
  it('is null for a listing that is not a commercial lease', () => {
    expect(publishListingLeaseFigure({ price: 649_000, propertyType: 'A', leaseRateOption: null })).toBeNull()
    expect(publishListingLeaseFigure({ price: 1_200_000, propertyType: 'F', leaseRateOption: '$/SF/Mo' })).toBeNull()
  })

  it('gives a lease its compact rate and the lease label', () => {
    expect(publishListingLeaseFigure({ price: 1.4, propertyType: 'G', leaseRateOption: '$/SF/Mo' })).toEqual({
      rate: '$1.40/sq ft/mo',
      text: '$1.40/sq ft/mo',
      label: LEASE_LABEL,
    })
    expect(publishListingLeaseFigure({ price: 1.4, propertyType: 'g', leaseRateOption: '$/SF/Mo' }, 'long')?.text).toBe(
      '$1.40 per sq ft per month',
    )
  })

  it('says the rate is not published when the unit is unknown, never a bare number', () => {
    const figure = publishListingLeaseFigure({ price: 1.2, propertyType: 'G', leaseRateOption: null })
    expect(figure).toEqual({ rate: null, text: LEASE_RATE_NOT_PUBLISHED, label: 'For lease' })
    expect(publishListingLeaseFigure({ price: 1.2, propertyType: 'G' })?.text).toBe('Lease rate not published')
  })
})

describe('publishLeaseRateRange', () => {
  const rows = [
    { listPrice: 1.4, rateOption: '$/SF/Mo' },
    { listPrice: 0.9, rateOption: '$/SF/Mo' },
    { listPrice: 2.5, rateOption: '$/SF/Mo' },
    { listPrice: 985, rateOption: '$ Amt/Mo' },
    { listPrice: 3000, rateOption: '$/SF/Mo' },
    { listPrice: 1.2, rateOption: null },
  ]

  it('spans the rents in one unit, leaving other units and contradictions out', () => {
    expect(publishLeaseRateRange(rows, '$/SF/Mo')).toBe('$0.90 to $2.50 per sq ft per month')
  })

  it('prints the one rent when the rents agree or there is only one', () => {
    expect(publishLeaseRateRange([{ listPrice: 1.4, rateOption: '$/SF/Mo' }], '$/SF/Mo')).toBe('$1.40 per sq ft per month')
    expect(publishLeaseRateRange(rows, '$ Amt/Mo')).toBe('$985 per month')
  })

  it('is null when nothing publishes in that unit', () => {
    expect(publishLeaseRateRange(rows, '$/SF/Yr')).toBeNull()
    expect(publishLeaseRateRange([], '$/SF/Mo')).toBeNull()
  })
})

describe('publishLeaseRateSummary', () => {
  // Prineville's four active leases, read live 2026-09-23 (listing_tile_mv
  // property_type 'G', Active; unit from listings.details "Lease Rate Options"):
  // MLS 220220473 0.85 $/SF/Mo, 220228181 0.75 $/SF/Mo, 220228710 750 $ Amt/Mo,
  // 220216013 2.6 with no unit.
  const prineville = [
    { listPrice: 2.6, rateOption: null },
    { listPrice: 0.85, rateOption: '$/SF/Mo' },
    { listPrice: 750, rateOption: '$ Amt/Mo' },
    { listPrice: 0.75, rateOption: '$/SF/Mo' },
  ]

  it('describes every lease the count covers: each unit its own span and count, the withheld counted', () => {
    expect(publishLeaseRateSummary(prineville)).toBe(
      '2 from $0.75 to $0.85 per sq ft per month · 1 at $750 per month · 1 rate not published',
    )
  })

  it('counts a unit its own number contradicts as not published, never in a span (65315 Highway 97, Bend)', () => {
    const bend = [
      { listPrice: 1.4, rateOption: '$/SF/Mo' },
      { listPrice: 0.9, rateOption: '$/SF/Mo' },
      { listPrice: 2.5, rateOption: '$/SF/Mo' },
      { listPrice: 985, rateOption: '$ Amt/Mo' },
      { listPrice: 3000, rateOption: '$/SF/Mo' },
      { listPrice: 1.2, rateOption: null },
    ]
    expect(publishLeaseRateSummary(bend)).toBe(
      '3 from $0.90 to $2.50 per sq ft per month · 1 at $985 per month · 2 rates not published',
    )
  })

  it('is the plain span when every lease publishes in one unit', () => {
    expect(
      publishLeaseRateSummary([
        { listPrice: 0.85, rateOption: '$/SF/Mo' },
        { listPrice: 0.65, rateOption: '$/SF/Mo' },
        { listPrice: 0.29, rateOption: '$/SF/Mo' },
      ]),
    ).toBe('$0.29 to $0.85 per sq ft per month')
    expect(publishLeaseRateSummary([{ listPrice: 3.33, rateOption: '$/SF/Mo' }])).toBe('$3.33 per sq ft per month')
  })

  it('never converts a yearly rate into a monthly one or mixes the two in a span', () => {
    const text = publishLeaseRateSummary([
      { listPrice: 1.5, rateOption: '$/SF/Mo' },
      { listPrice: 18, rateOption: '$/SF/Yr' },
      { listPrice: 24, rateOption: '$/SF/Yr' },
    ])
    expect(text).toBe('2 from $18.00 to $24.00 per sq ft per year · 1 at $1.50 per sq ft per month')
    expect(text).not.toMatch(/\$1\.50 to|\$2\.00|\$1\.25/)
  })

  it('says "at" for a group that shares one rent', () => {
    expect(
      publishLeaseRateSummary([
        { listPrice: 1, rateOption: '$/SF/Mo' },
        { listPrice: 1, rateOption: '$/SF/Mo' },
        { listPrice: 8000, rateOption: '$ Amt/Mo' },
      ]),
    ).toBe('2 at $1.00 per sq ft per month · 1 at $8,000 per month')
  })

  it('says the rate is not published when none publishes, and is null for no leases', () => {
    expect(publishLeaseRateSummary([{ listPrice: 1.25, rateOption: null }])).toBe(LEASE_RATE_NOT_PUBLISHED)
    expect(
      publishLeaseRateSummary([
        { listPrice: 1.25, rateOption: null },
        { listPrice: 3000, rateOption: '$/SF/Mo' },
      ]),
    ).toBe('Lease rates not published')
    expect(publishLeaseRateSummary([])).toBeNull()
  })

  it('adds up to the set it describes', () => {
    const text = publishLeaseRateSummary(prineville)!
    const counts = [...text.matchAll(/(?:^|· )(\d+) /g)].map((m) => Number(m[1]))
    expect(counts.reduce((a, b) => a + b, 0)).toBe(prineville.length)
  })
})
