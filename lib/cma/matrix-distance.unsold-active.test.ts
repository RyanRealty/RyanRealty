import { describe, expect, it } from 'vitest'
import { activeEntries, closedEntries, unsoldEntries } from '@/lib/cma/matrix-entry'
import type { CmaAdjustedComp } from '@/lib/cma/types'
import { proximityLabel } from '@/lib/cma/market-area'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import type { CmaBandRival } from '@/lib/cma/band-rivals'

const subject = { latitude: 44.058, longitude: -121.315 }

describe('matrix distance — unsold / active / pending from subject lat/lng', () => {
  it('computes proximity the same way closed comps do', () => {
    const peer: CmaExpiredPeer = {
      listingKey: 'U1',
      address: '123 Test',
      listPrice: 500_000,
      originalListPrice: 520_000,
      status: 'Expired',
      daysOnMarket: 40,
      onMarketDate: '2026-03-01',
      photoUrl: null,
      latitude: 44.06,
      longitude: -121.32,
      yearBuilt: 2010,
      sqft: 1800,
      lotAcres: 0.2,
      beds: 3,
      baths: 2,
    } as CmaExpiredPeer
    const expected = proximityLabel(
      { lat: subject.latitude, lng: subject.longitude },
      { lat: peer.latitude, lng: peer.longitude },
    )
    const unsold = unsoldEntries([peer], null, 'Bend', subject)
    expect(unsold[0]?.proximity).toBe(expected)
    expect(unsold[0]?.proximity).toMatch(/miles/)

    const rival: CmaBandRival = {
      listingKey: 'A1',
      address: '200 Test',
      listPrice: 510_000,
      status: 'Active',
      daysOnMarket: 12,
      photoUrl: null,
      latitude: 44.07,
      longitude: -121.3,
      originalListPrice: 510_000,
      onMarketDate: '2026-08-01',
    }
    const active = activeEntries([rival], null, 'Bend', subject)
    expect(active[0]?.proximity).toBe(
      proximityLabel(
        { lat: subject.latitude, lng: subject.longitude },
        { lat: rival.latitude, lng: rival.longitude },
      ),
    )
  })

  it('fills a blank closed-comp distance from coordinates (3871 Petrosa)', () => {
    const comp = {
      listingKey: 'P1',
      address: '3871 Petrosa',
      city: 'Bend',
      closePrice: 700_000,
      sqft: 1800,
      latitude: 44.07,
      longitude: -121.3,
      proximity: '',
      adjustedPrice: 700_000,
      weight: 1,
    } as CmaAdjustedComp
    const [row] = closedEntries([comp], null, subject)
    expect(row?.proximity).toBe(
      proximityLabel({ lat: subject.latitude, lng: subject.longitude }, { lat: 44.07, lng: -121.3 }),
    )
    expect(row?.proximity).toMatch(/miles/)
  })

  it('fills Monterey Mews expired rows when coordinates are stored as Latitude/Longitude', () => {
    const peer = {
      listingKey: 'M1',
      address: '12 Monterey Mews',
      listPrice: 480_000,
      originalListPrice: 499_000,
      status: 'Expired',
      daysOnMarket: 60,
      onMarketDate: '2026-01-01',
      photoUrl: null,
      latitude: null,
      longitude: null,
      Latitude: 44.062,
      Longitude: -121.318,
      yearBuilt: 2004,
      sqft: 1600,
      lotAcres: 0.15,
      beds: 3,
      baths: 2,
    } as CmaExpiredPeer & { Latitude: number; Longitude: number }
    const [row] = unsoldEntries([peer], null, 'Bend', subject)
    expect(row?.proximity).toMatch(/miles/)
    expect(row?.proximity).not.toBe('-')
  })
})
