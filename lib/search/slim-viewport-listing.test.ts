import { describe, expect, it } from 'vitest'
import type { ListingTileRow } from '@/app/actions/listings'
import { slimViewportListing } from './slim-viewport-listing'

function fatRow(): ListingTileRow & { publicRemarks: string; photoUrls: string[] } {
  return {
    ListingKey: 'k1',
    ListNumber: '220221970',
    ListPrice: 749_000,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    StreetNumber: '1',
    StreetName: 'Main',
    StreetSuffix: 'St',
    City: 'Bend',
    State: 'OR',
    PostalCode: '97701',
    SubdivisionName: 'Stonegate',
    BoundaryCity: 'Bend',
    BoundaryNeighborhood: 'Southeast Bend',
    PhotoURL: 'https://cdn.example/lead.jpg',
    Latitude: 44.0,
    Longitude: -121.2,
    StandardStatus: 'Active',
    TotalLivingAreaSqFt: 1800,
    PropertyType: 'A',
    PropertySubType: 'Single Family Residence',
    OnMarketDate: '2026-09-01',
    CloseDate: null,
    has_virtual_tour: false,
    tourUrl: null,
    photoUrls: [
      'https://cdn.example/1.jpg',
      'https://cdn.example/2.jpg',
      'https://cdn.example/3.jpg',
    ],
    ListOfficeName: 'Other Brokerage',
    publicRemarks: 'A very long MLS remark that must not ride the map payload. '.repeat(40),
  }
}

describe('slimViewportListing', () => {
  it('drops extra photo URLs, remarks, and office copy', () => {
    const slim = slimViewportListing(fatRow())
    expect(slim.ListingKey).toBe('k1')
    expect(slim.PhotoURL).toContain('lead.jpg')
    expect(slim.PropertyType).toBe('A')
    expect('photoUrls' in slim).toBe(false)
    expect('publicRemarks' in slim).toBe(false)
    expect(slim.ListOfficeName).toBeUndefined()
    expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(fatRow()).length / 2)
  })
})
