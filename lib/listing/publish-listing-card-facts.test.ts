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
})
