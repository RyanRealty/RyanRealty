import { describe, expect, it } from 'vitest'
import { publishListingCardFacts, type ListingCardFactsInput } from './publish-listing-card-facts'

const base: ListingCardFactsInput = {
  price: 649_000,
  propertyType: 'A',
  propertySubType: 'Single Family Residence',
  subdivisionName: 'Park Addition',
  city: 'Bend',
  listNumber: '220000001',
  beds: 3,
  baths: 2,
  sqft: 1_900,
  pricePerSqft: 342,
  statusLabel: null,
}

describe('publishListingCardFacts', () => {
  it('prints the ask and beds · baths · sqft · $/sqft in the rail card’s order', () => {
    const facts = publishListingCardFacts(base)
    expect(facts.ask).toBe('$649,000')
    expect(facts.kind).toBeNull()
    expect(facts.meta).toEqual(['3 bd', '2 ba', '1,900 sqft', '$342/sqft'])
  })

  it('puts Pending before the price per square foot, as the rail card does', () => {
    const facts = publishListingCardFacts({ ...base, statusLabel: 'Pending' })
    expect(facts.meta).toEqual(['3 bd', '2 ba', '1,900 sqft', 'Pending', '$342/sqft'])
  })

  it('leaves out what the row does not have instead of printing a dash or a zero', () => {
    const facts = publishListingCardFacts({ ...base, beds: null, baths: null, sqft: null, pricePerSqft: null })
    expect(facts.meta).toEqual([])
  })

  it('publishes no ask for a commercial lease, whose ListPrice is rent', () => {
    const facts = publishListingCardFacts({ ...base, propertyType: 'G', price: 1.35 })
    expect(facts.ask).toBeNull()
    expect(facts.meta.some((m) => m.includes('/sqft'))).toBe(false)
  })

  it('publishes no ask when the row has none', () => {
    expect(publishListingCardFacts({ ...base, price: null }).ask).toBeNull()
  })

  it('gives a commercial lease its rate with the unit and the "For lease" label', () => {
    const facts = publishListingCardFacts({
      ...base,
      propertyType: 'G',
      price: 1.4,
      beds: null,
      baths: null,
      leaseRateOption: '$/SF/Mo',
    })
    expect(facts.ask).toBeNull()
    expect(facts.lease).toEqual({ rate: '$1.40/sq ft/mo', text: '$1.40/sq ft/mo', label: 'For lease' })
  })

  it('says "Lease rate not published" for a lease with no unit, never a bare number', () => {
    const facts = publishListingCardFacts({ ...base, propertyType: 'G', price: 1.2 })
    expect(facts.lease?.rate).toBeNull()
    expect(facts.lease?.text).toBe('Lease rate not published')
  })

  it('leaves lease null on a sale listing, even if a unit rides along', () => {
    expect(publishListingCardFacts({ ...base, leaseRateOption: '$/SF/Mo' }).lease).toBeNull()
  })
})
