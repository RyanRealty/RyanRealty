import { describe, it, expect } from 'vitest'
import { buildListingJsonLd, type ListingJsonLdInput } from './listing-json-ld'

const listing: ListingJsonLdInput['listing'] = {
  listingKey: 'k1', listNumber: '1', streetNumber: '1', streetName: 'Main', city: 'Bend', citySlug: 'bend',
  postalCode: '97701', boundaryCity: 'Bend', boundaryNeighborhood: null, subdivisionName: null, beds: 3, baths: 2,
  sqft: 1500, totalLivingAreaSqFt: 1500, lotSizeSqft: null, yearBuilt: 2000, lat: null, lng: null, status: 'Active',
}
const base = { listingKey: 'k1', street: '1 Main St', trail: [], wholePropertyPrice: 500000, photoUrls: [], agent: null }
const node = (l: ListingJsonLdInput['listing']) =>
  buildListingJsonLd({ ...base, listing: l }).find((s) => s.type === 'realEstateListing') as unknown as Record<string, unknown>

describe('buildListingJsonLd freshness', () => {
  it('maps OnMarketDate and ModificationTimestamp to ISO strings', () => {
    const n = node({ ...listing, onMarketDate: '2026-09-01T10:00:00+00:00', modifiedAt: '2026-10-02T08:30:00Z' })
    expect(n.datePosted).toBe('2026-09-01T10:00:00.000Z')
    expect(n.dateModified).toBe('2026-10-02T08:30:00.000Z')
  })
  it('omits keys when null, missing or invalid', () => {
    const n = node({ ...listing, onMarketDate: null, modifiedAt: 'garbage' })
    expect(n.datePosted).toBeUndefined()
    expect(n.dateModified).toBeUndefined()
  })
})

describe('buildListingJsonLd Quick facts match', () => {
  it('emits Residence about and additionalProperty from the same facts as the visible block', () => {
    const schemas = buildListingJsonLd({
      ...base,
      listing: {
        ...listing,
        communityName: 'Tetherow',
        hoaMonthly: 171,
        propertySubType: 'Single Family Residence',
        propertyType: 'A',
        onMarketDate: '2026-10-01',
      },
    })
    const rel = schemas.find((s) => s.type === 'realEstateListing') as unknown as {
      residenceType?: string
      additionalProperty?: { name: string; value: string }[]
      beds?: number
      baths?: number
      listPrice?: number
    }
    expect(rel.residenceType).toBe('SingleFamilyResidence')
    expect(rel.beds).toBe(3)
    expect(rel.baths).toBe(2)
    expect(rel.listPrice).toBe(500000)
    expect(rel.additionalProperty?.find((p) => p.name === 'Community')?.value).toBe('Tetherow')
    expect(rel.additionalProperty?.find((p) => p.name === 'HOA')?.value).toBe('$171 per month')
    expect(rel.additionalProperty?.find((p) => p.name === 'Status')?.value).toBe('Active')
  })

  it('withholds Residence about on a lot', () => {
    const n = node({
      ...listing,
      propertyType: 'D',
      propertySubType: 'Residential Lots',
      beds: null,
      baths: null,
      sqft: null,
    })
    expect(n.residenceType).toBeUndefined()
  })
})
