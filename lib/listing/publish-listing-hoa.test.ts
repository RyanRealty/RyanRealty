import { describe, expect, it } from 'vitest'
import { formatListingHoa, publishListingHoa } from './publish-listing-hoa'

describe('publishListingHoa', () => {
  it('keeps Foley / 7th / Canyons founding cases exact', () => {
    expect(formatListingHoa(publishListingHoa({ hoaMonthly: 22 })!)).toBe('$22 per month')
    expect(formatListingHoa(publishListingHoa({ hoaMonthly: 45 })!)).toBe('$45 per month')
    expect(formatListingHoa(publishListingHoa({ hoaMonthly: 1529 })!)).toBe('$1,529 per month')
    expect(formatListingHoa(publishListingHoa({ hoaMonthly: 1529 })!)).not.toBe('$2,000 per month')
    expect(formatListingHoa(publishListingHoa({ hoaMonthly: 22 })!)).not.toBe('$0 per month')
  })

  it('prefers ingest monthly over a raw association fee', () => {
    expect(
      publishListingHoa({
        hoaMonthly: 1529,
        associationFee: 2000,
        associationFeeFrequency: 'Monthly',
      }),
    ).toEqual({ monthly: 1529 })
  })

  it('normalizes an annual association fee when monthly is missing', () => {
    expect(
      publishListingHoa({
        hoaMonthly: null,
        associationFee: 18348,
        associationFeeFrequency: 'Annually',
      }),
    ).toEqual({ monthly: 1529 })
  })

  it('withholds a missing or non-positive fee', () => {
    expect(publishListingHoa({ hoaMonthly: 0, associationFee: 0 })).toBeNull()
    expect(publishListingHoa({ hoaMonthly: null, associationFee: null })).toBeNull()
  })
})
