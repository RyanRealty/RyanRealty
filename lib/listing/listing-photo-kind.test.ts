import { describe, expect, it } from 'vitest'
import { listingLeadPhotograph, listingPhotoKind } from './listing-photo-kind'

describe('listingPhotoKind (the listing\'s own words decide)', () => {
  it('reads the names and captions the two Redmond leases filed (row reads 2026-10-01)', () => {
    expect(listingPhotoKind({ name: 'Lot Line Adjustments' })).toBe('drawing')
    expect(listingPhotoKind({ name: 'midstate fertilizer aerial' })).toBe('capture')
    expect(listingPhotoKind({ name: '423 SW 6th street view2' })).toBe('capture')
    expect(listingPhotoKind({ name: '423 SW 6th St Aerial2' })).toBe('capture')
    expect(listingPhotoKind({ name: 'reimagined as a bike shop', caption: 'AI reimagined as a bike shop' })).toBe('render')
    expect(listingPhotoKind({ name: '1', caption: 'Photo representative of a similar unit' })).toBe('stand-in')
    expect(listingPhotoKind({ name: 'Lot boundary' })).toBe('drawing')
    expect(listingPhotoKind({ name: 'Flex floorplan' })).toBe('drawing')
  })

  it('a name that says nothing is a photograph', () => {
    for (const name of ['IMG_1821', 'DJI_0006', '20260609_112038', 'Main Photo', 'Front Exterior', 'Suite 203', 'Outside Warehouse', 'LOT 3, FAIRGROUNDS VIEW 2']) {
      expect(listingPhotoKind({ name, caption: '' })).toBe('photograph')
    }
    expect(listingPhotoKind({})).toBe('photograph')
  })
})

describe('listingLeadPhotograph', () => {
  it('skips what is not a photograph, in the listing\'s own order', () => {
    expect(
      listingLeadPhotograph([
        { name: '1263 SW Lake Rd Aerial', url: 'a.jpg' },
        { name: 'Suite 203', url: 'b.jpg' },
      ]),
    ).toBe('b.jpg')
  })

  it('is null when the listing files no photograph of the space', () => {
    expect(
      listingLeadPhotograph([
        { name: '423 SW 6th street view2', url: 'a.jpg' },
        { name: '423 SW 6th St Aerial2', url: 'b.jpg' },
        { name: 'reimagined as a bike shop', caption: 'AI reimagined as a bike shop', url: 'c.jpg' },
      ]),
    ).toBeNull()
    expect(listingLeadPhotograph([])).toBeNull()
  })

  it('never returns a photo without a URL', () => {
    expect(listingLeadPhotograph([{ name: 'Front', url: '  ' }, { name: 'Back', url: 'z.jpg' }])).toBe('z.jpg')
  })
})
