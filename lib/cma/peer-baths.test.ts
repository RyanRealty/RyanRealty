/**
 * A came-off or competing home prints its baths the way the sales table does,
 * and the room sentence matches the printed counts (reader review of
 * cma-62475-woodsman, 2026-10-08).
 *
 * The "Did not sell" table printed "Baths | 3.5 | 3" for 3446 Jackwood: the
 * subject from its MLS split (3 full, 1 half) and the peer from
 * BathroomsTotal (3), which counts its half bath whole. Its row reads
 * BathroomsTotal 3, baths_full 2, baths_half 1: 2.5 baths, printed 2.5
 * everywhere else for a home with 2 full and 1 half.
 */
import { describe, expect, it } from 'vitest'
import { buildExpiredPeerSet, pickExpiredPeers } from '@/lib/cma/market-status'
import { activeEntries, unsoldEntries } from '@/lib/cma/matrix-entry'
import { didNotSellStories } from '@/lib/cma/did-not-sell'
import { bandRowToRival, rivalFactsLine, rivalVsSubjectLine, type BandInventoryRow } from '@/lib/cma/band-rivals'
import { sameAreaFit, sameAreaSubject } from '@/lib/cma/same-area-fit'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'
import type { CompArea } from '@/lib/pricing/comp-area'
import type { CmaSubject } from '@/lib/cma/types'

// The stored subject of cma-62475-woodsman (fields the fit and the cards read).
const WOODSMAN = {
  listingKey: '20260304003912862284000000',
  mlsNumber: null,
  streetAddress: '62475 Woodsman',
  city: 'Bend',
  subdivision: 'Shevlin West',
  subdivisionSlug: 'shevlin-west-phase-3',
  latitude: 44.073919,
  longitude: -121.37172,
  beds: 3,
  baths: 4,
  bathsFull: 3,
  bathsHalf: 1,
  sqft: 2673,
  yearBuilt: 2025,
  propertySubType: 'Single Family Residence',
  standardStatus: 'Canceled',
  lastListPrice: 1_699_000,
  lastListDate: '2026-03-04',
  photoUrl: null,
  publicRemarks: null,
} as unknown as CmaSubject

const AREA: CompArea = {
  kind: 'subdivision',
  names: ['Shevlin West'],
  radiusMiles: null,
  centre: { lat: 44.073919, lng: -121.37172 },
  source: 'test',
  sentence: 'Shevlin West, your own subdivision.',
}

// The 3446 Jackwood listings row (listing key 20260519200451052267000000), as stored.
const JACKWOOD: CmaMarketAreaRow = {
  ListingKey: '20260519200451052267000000',
  StreetNumber: '3446',
  StreetName: 'Jackwood',
  City: 'Bend',
  SubdivisionName: 'Shevlin West',
  Latitude: 44.074571,
  Longitude: -121.370504,
  StandardStatus: 'Canceled',
  ListPrice: 1_549_000,
  OriginalListPrice: 1_599_900,
  ClosePrice: null,
  CloseDate: null,
  ListDate: '2026-05-21T17:42:48+00:00',
  OnMarketDate: '2026-05-21T17:42:48+00:00',
  status_change_timestamp: '2026-07-27T16:14:36+00:00',
  TotalLivingAreaSqFt: 2565,
  BedroomsTotal: 3,
  BathroomsTotal: 3,
  baths_full: 2,
  baths_half: 1,
  DaysOnMarket: 66,
  CumulativeDaysOnMarket: 66,
  property_sub_type: 'Single Family Residence',
  year_built: 2022,
  lot_size_acres: 0.19,
}

const fitSubject = {
  ...sameAreaSubject(WOODSMAN),
  streetAddress: WOODSMAN.streetAddress,
  listingKey: WOODSMAN.listingKey,
  mlsNumber: WOODSMAN.mlsNumber,
}

describe('came-off and competing homes print baths from the MLS split, like the sales (cma-62475-woodsman)', () => {
  it('carries the split onto the peer, and the room note matches 3.5 against 2.5', () => {
    const [peer] = pickExpiredPeers([JACKWOOD], fitSubject, AREA)
    expect(peer).toBeDefined()
    expect(peer!.bathsFull).toBe(2)
    expect(peer!.bathsHalf).toBe(1)
    // Whole baths 3 against 2: one bathroom apart on the subject's own plat, kept and disclosed.
    expect(peer!.roomDifference).toEqual(['baths'])
    const set = buildExpiredPeerSet({ rows: [JACKWOOD], subject: fitSubject, area: AREA, asOf: new Date('2026-10-08T12:00:00Z') })
    expect(set.sentence).toContain('3446 Jackwood is one bathroom different from yours.')
  })

  it('prints 2.5 in the "Did not sell" table and on the card, and 3.5 for the subject', () => {
    const [peer] = pickExpiredPeers([JACKWOOD], fitSubject, AREA)
    const [entry] = unsoldEntries([peer!], null, 'Bend', WOODSMAN)
    expect(entry!.baths).toBe(2.5)
    const stories = didNotSellStories({ subject: WOODSMAN, comps: [], market: null, peers: [peer!] })
    const card = stories.find((s) => s.title === '3446 Jackwood')
    expect(card?.facts).toContain('2.5 ba')
    expect(card?.facts).not.toMatch(/\b3 ba\b/)
    const own = stories.find((s) => s.isSubject)
    expect(own?.facts).toContain('3.5 ba')
  })

  it('a stored peer without the split still prints its recorded total', () => {
    const [peer] = pickExpiredPeers([{ ...JACKWOOD, baths_full: null, baths_half: null }], fitSubject, AREA)
    expect(peer!.bathsFull ?? null).toBeNull()
    const [entry] = unsoldEntries([peer!], null, 'Bend', WOODSMAN)
    expect(entry!.baths).toBe(3)
  })

  it('a home for sale prints and compares its baths the same way', () => {
    const row: BandInventoryRow = {
      ListingKey: 'R1',
      StreetNumber: '3446',
      StreetName: 'Jackwood',
      ListPrice: 1_549_000,
      OriginalListPrice: 1_599_900,
      DaysOnMarket: null,
      OnMarketDate: '2026-09-21T17:42:48+00:00',
      PhotoURL: null,
      Latitude: 44.074571,
      Longitude: -121.370504,
      BedroomsTotal: 3,
      BathroomsTotal: 3,
      baths_full: 2,
      baths_half: 1,
      TotalLivingAreaSqFt: 2565,
      year_built: 2022,
      property_sub_type: 'Single Family Residence',
      SubdivisionName: 'Shevlin West',
      City: 'Bend',
    }
    const rival = bandRowToRival(row, 'Active')!
    expect(rival.bathsFull).toBe(2)
    expect(rival.bathsHalf).toBe(1)
    expect(activeEntries([rival], null, 'Bend', WOODSMAN)[0]!.baths).toBe(2.5)
    expect(rivalFactsLine(rival)).toContain('2.5 ba')
    const vs = rivalVsSubjectLine(rival, {
      beds: 3,
      baths: 4,
      bathsFull: 3,
      bathsHalf: 1,
      sqft: 2673,
      yearBuilt: 2025,
      lotAcres: null,
      recommendedList: null,
      latitude: null,
      longitude: null,
    })
    expect(vs).toContain('1 fewer bath')
    // The fit compares whole baths when both homes carry the split, as the sales do.
    expect(sameAreaFit(AREA, sameAreaSubject(WOODSMAN), { ...rival, address: rival.address })).toEqual({
      ok: true,
      ownPlat: true,
      roomDifference: ['baths'],
    })
    // 3 full and 1 half against 3 full: the same whole bath count, nothing to note.
    expect(
      sameAreaFit(AREA, sameAreaSubject(WOODSMAN), { ...rival, baths: 3, bathsFull: 3, bathsHalf: 0 }),
    ).toEqual({ ok: true, ownPlat: true, roomDifference: [] })
  })

  it('a blank MLS count is unknown, never zero', () => {
    const rival = bandRowToRival(
      {
        ListingKey: 'R2',
        StreetNumber: '10',
        StreetName: 'Blank',
        ListPrice: 1_500_000,
        DaysOnMarket: null,
        OnMarketDate: null,
        PhotoURL: null,
        Latitude: null,
        Longitude: null,
        BedroomsTotal: null,
        BathroomsTotal: null,
        baths_full: null,
        baths_half: null,
        TotalLivingAreaSqFt: null,
      },
      'Active',
    )!
    expect(rival.beds).toBeNull()
    expect(rival.baths).toBeNull()
    expect(rival.bathsFull).toBeNull()
    expect(rival.sqft).toBeNull()
    const [peer] = pickExpiredPeers([{ ...JACKWOOD, BedroomsTotal: null, BathroomsTotal: null, baths_full: null, baths_half: null }], fitSubject, AREA)
    // An unknown count is a match (rule 4), so the blank home is not refused on rooms.
    expect(peer).toBeDefined()
    expect(peer!.roomDifference).toEqual([])
  })
})
