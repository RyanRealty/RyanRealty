import { describe, expect, it } from 'vitest'
import { compAreaContains, type CompArea } from '@/lib/pricing/comp-area'
import { dedupeRivalsByAddress } from '@/lib/cma/matrix-sets'
import { rivalAddress } from '@/lib/cma/band-rivals'
import { publishUnparsedStreetLine } from '@/lib/listing/publish-street-line'

const oaksidePocket: CompArea = {
  kind: 'subdivision',
  names: ['Meridian'],
  radiusMiles: null,
  centre: { lat: 44.06, lng: -121.3 },
  source: 'test',
  sentence: 'These sales came from Meridian.',
}

describe('competition geo — Oakside pocket-first', () => {
  it('Oakside shape: city-wide Butler Market / Jones / Quimby / 4th fall outside the pocket', () => {
    expect(compAreaContains(oaksidePocket, { subdivision: 'Meridian', city: 'Bend' })).toBe(true)
    expect(compAreaContains(oaksidePocket, { subdivision: 'Butler Market', city: 'Bend' })).toBe(false)
    expect(compAreaContains(oaksidePocket, { subdivision: 'Jones', city: 'Bend' })).toBe(false)
    expect(compAreaContains(oaksidePocket, { subdivision: 'Quimby', city: 'Bend' })).toBe(false)
    expect(compAreaContains(oaksidePocket, { subdivision: '4th', city: 'Bend' })).toBe(false)
  })

  it('Nugget shape: Active + Pending at the same address keep Pending', () => {
    const kept = dedupeRivalsByAddress([
      {
        listingKey: 'A',
        address: '61102 Aspen Rim',
        listPrice: 900_000,
        status: 'Active',
        daysOnMarket: 10,
        photoUrl: null,
        latitude: 44,
        longitude: -121,
      },
      {
        listingKey: 'P',
        address: '61102 Aspen Rim',
        listPrice: 900_000,
        status: 'Pending',
        daysOnMarket: 12,
        photoUrl: null,
        latitude: 44,
        longitude: -121,
      },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.status).toBe('Pending')
    expect(kept[0]?.listingKey).toBe('P')
  })

  it('Marshmallow shape: street number 0 is an unknown address', () => {
    expect(rivalAddress({ StreetNumber: '0', StreetName: 'Wagyu' })).toBe('Wagyu')
    expect(publishUnparsedStreetLine('0 Wagyu')).toBe('Wagyu')
  })
})
