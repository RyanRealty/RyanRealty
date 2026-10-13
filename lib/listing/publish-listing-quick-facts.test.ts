import { describe, expect, it } from 'vitest'
import {
  listingResidenceType,
  publishListingQuickFacts,
} from './publish-listing-quick-facts'

const NOW = new Date('2026-10-13T17:00:00.000Z')

const FULL = {
  street: '1 Main St',
  city: 'Bend',
  price: 500_000,
  beds: 3,
  baths: 2.5,
  sqft: 1500,
  lotSizeAcres: 0.25,
  lotSizeSqft: 10_890,
  yearBuilt: 2000,
  communityName: 'Tetherow',
  subdivisionName: 'Tetherow',
  status: 'Active',
  onMarketDate: '2026-10-01',
  hoaMonthly: 171,
  propertySubType: 'Single Family Residence',
  propertyType: 'A',
  now: NOW,
}

describe('publishListingQuickFacts', () => {
  it('prints a sentence and a definition list from known fields', () => {
    const facts = publishListingQuickFacts(FULL)
    expect(facts).not.toBeNull()
    expect(facts!.sentence).toBe(
      'This 3-bed, 2.5-bath home at 1 Main St in Bend is listed at $500,000. It has 1,500 square feet, sits on 0.25 acres, was built in 2000, and is in Tetherow. Status is Active, with 12 days on market and HOA dues of $171 per month.',
    )
    expect(facts!.rows).toEqual([
      { term: 'Price', value: '$500,000' },
      { term: 'Beds', value: '3' },
      { term: 'Baths', value: '2.5' },
      { term: 'Living area', value: '1,500 sqft' },
      { term: 'Lot', value: '0.25 acres' },
      { term: 'Year built', value: '2000' },
      { term: 'Community', value: 'Tetherow' },
      { term: 'Status', value: 'Active' },
      { term: 'Days on market', value: '12 days' },
      { term: 'HOA', value: '$171 per month' },
    ])
    expect(facts!.residenceType).toBe('SingleFamilyResidence')
  })

  it('hides a missing field instead of guessing', () => {
    const facts = publishListingQuickFacts({
      street: '1 Main St',
      city: 'Bend',
      price: 425_000,
      beds: 3,
      baths: null,
      sqft: null,
      yearBuilt: null,
      communityName: null,
      subdivisionName: 'N/A',
      status: 'Active',
      onMarketDate: null,
      hoaMonthly: null,
      now: NOW,
    })
    expect(facts!.rows.map((r) => r.term)).toEqual(['Price', 'Beds', 'Status'])
    expect(facts!.sentence).toBe('This 3-bed home at 1 Main St in Bend is listed at $425,000. Status is Active.')
    expect(facts!.sentence).not.toMatch(/null|undefined|NaN|\$0\b/)
    for (const row of facts!.rows) expect(row.value).not.toMatch(/null|undefined|NaN/)
  })

  it('uses the close price and days to close on a sold home', () => {
    const facts = publishListingQuickFacts({
      street: '55550 Heidi Ct',
      city: 'Bend',
      price: 1_100_000,
      beds: 3,
      baths: 3,
      sqft: 3174,
      status: 'Closed',
      onMarketDate: '2026-06-01',
      closeDate: '2026-09-08',
      now: NOW,
    })
    expect(facts!.rows.find((r) => r.term === 'Sold price')?.value).toBe('$1,100,000')
    expect(facts!.rows.find((r) => r.term === 'Status')?.value).toBe('Sold')
    expect(facts!.rows.find((r) => r.term === 'Days on market')?.value).toBe('99 days')
    expect(facts!.sentence).toContain('sold for $1,100,000')
    expect(facts!.sentence).toContain('It was on the market 99 days')
  })

  it('does not count expired days to today', () => {
    const facts = publishListingQuickFacts({
      street: '9 Pine',
      city: 'Bend',
      price: 400_000,
      status: 'Expired',
      onMarketDate: '2022-07-14',
      now: NOW,
    })
    expect(facts!.rows.find((r) => r.term === 'Days on market')).toBeUndefined()
    expect(facts!.sentence).toContain('off the market')
    expect(facts!.sentence).not.toMatch(/1,000|days on market/i)
  })

  it('prefers communityName over a sentinel subdivision', () => {
    const facts = publishListingQuickFacts({
      price: 1,
      communityName: 'Sunriver',
      subdivisionName: 'N/A',
      status: 'Active',
      now: NOW,
    })
    expect(facts!.rows.find((r) => r.term === 'Community')?.value).toBe('Sunriver')
  })

  it('prints lot sqft when acres are missing, and withholds a zero HOA', () => {
    const facts = publishListingQuickFacts({
      price: 300_000,
      lotSizeSqft: 8712,
      hoaMonthly: 0,
      associationFee: 0,
      status: 'Active',
      now: NOW,
    })
    expect(facts!.rows.find((r) => r.term === 'Lot')?.value).toBe('8,712 sqft')
    expect(facts!.rows.find((r) => r.term === 'HOA')).toBeUndefined()
  })

  it('returns null when nothing honest remains', () => {
    expect(publishListingQuickFacts({ status: 'Coming Soon', now: NOW })).toBeNull()
  })

  it('writes no dash of any kind', () => {
    const facts = publishListingQuickFacts(FULL)!
    expect(facts.sentence).not.toMatch(/\u2014|\u2013| -- /)
    for (const row of facts.rows) {
      expect(row.term).not.toMatch(/\u2014|\u2013/)
      expect(row.value).not.toMatch(/\u2014|\u2013/)
    }
  })
})

describe('listingResidenceType', () => {
  it('names a house, a condo, and a townhome, and withholds a lot', () => {
    expect(listingResidenceType('Single Family Residence', 'A')).toBe('SingleFamilyResidence')
    expect(listingResidenceType('Condominium', 'A')).toBe('Apartment')
    expect(listingResidenceType('Townhouse', 'A')).toBe('House')
    expect(listingResidenceType('Residential Lots', 'D')).toBeNull()
    expect(listingResidenceType(null, 'G')).toBeNull()
    expect(listingResidenceType(null, 'A')).toBe('Residence')
  })
})
