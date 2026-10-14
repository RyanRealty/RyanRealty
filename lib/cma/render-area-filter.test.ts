import { describe, expect, it } from 'vitest'
import { bandRowToRival } from '@/lib/cma/band-rivals'
import type { CmaBandRival } from '@/lib/cma/band-rivals'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import { activeRivalsFor, matrixSetsFromArgs, unsoldPeersFor } from '@/lib/cma/matrix-sets'
import { competitionPage, didNotSellPage, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import { auditCmaRenderRow } from '@/lib/cma/render-area-audit'

/**
 * 2902 Pinnacle, stored 2026-09-30. The MLS left every rival and unsold peer
 * with a null subdivision. The build counted them in the same plats the sales
 * sit in. Street numbers are the stored rows; no owner name.
 */
const PINNACLE_AREA = {
  kind: 'subdivisions' as const,
  names: ['Eaglenest', 'Mtn Peaks', 'Madison Park', 'Oakview', 'Obsidian Ridge'],
  radiusMiles: null,
  centre: { lat: 44.078897, lng: -121.261217 },
  source: 'stored',
  sentence: 'Eaglenest, Mtn Peaks, Madison Park, Oakview and Obsidian Ridge.',
}

const PINNACLE_SUBJECT = {
  listingKey: 'SUB',
  mlsNumber: '1',
  streetAddress: '2902 Pinnacle',
  city: 'Bend',
  subdivision: 'Featherstone',
  propertySubType: 'Single Family Residence',
  beds: 3,
  baths: 2,
  sqft: 1400,
  yearBuilt: 2004,
  latitude: 44.078897,
  longitude: -121.261217,
  standardStatus: 'Canceled',
  lastListPrice: 585000,
}

function rival(over: Partial<CmaBandRival>): CmaBandRival {
  return {
    listingKey: over.listingKey ?? 'K',
    address: over.address ?? '1 Main',
    listPrice: over.listPrice ?? 500000,
    status: over.status ?? 'Active',
    daysOnMarket: 10,
    photoUrl: null,
    latitude: over.latitude ?? 44.078,
    longitude: over.longitude ?? -121.261,
    propertySubType: 'Single Family Residence',
    subdivision: null,
    platSlug: null,
    ...over,
  }
}

function peer(over: Partial<CmaExpiredPeer>): CmaExpiredPeer {
  return {
    listingKey: over.listingKey ?? 'P',
    address: over.address ?? '2 Main',
    listPrice: over.listPrice ?? 480000,
    originalListPrice: 490000,
    status: over.status ?? 'Expired',
    daysOnMarket: 40,
    onMarketDate: '2026-01-01',
    photoUrl: null,
    listingHistoryLine: null,
    beds: 3,
    baths: 2,
    sqft: over.sqft ?? 1400,
    yearBuilt: 2000,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    latitude: over.latitude ?? 44.08,
    longitude: over.longitude ?? -121.26,
    subdivision: null,
    platSlug: null,
    ...over,
  }
}

const PINNACLE_RIVALS: CmaBandRival[] = [
  rival({ listingKey: 'a1', address: '21286 Beall', status: 'Active', listPrice: 529000, sqft: 1731, latitude: 44.076682, longitude: -121.25942 }),
  rival({ listingKey: 'a2', address: '2750 Great Horned', status: 'Active', listPrice: 539900, sqft: 1492, latitude: 44.078371, longitude: -121.256374 }),
  rival({ listingKey: 'p1', address: '2736 Rainier', status: 'Pending', listPrice: 539000, sqft: 1728, latitude: 44.076776, longitude: -121.262928 }),
  rival({ listingKey: 'p2', address: '21274 Beall', status: 'Pending', listPrice: 529900, sqft: 1661, latitude: 44.076522, longitude: -121.259682 }),
  rival({ listingKey: 'p3', address: '2820 Aldrich', status: 'Pending', listPrice: 549000, sqft: 1466, latitude: 44.082453, longitude: -121.260857 }),
]

const PINNACLE_PEERS: CmaExpiredPeer[] = [
  peer({ listingKey: 'e1', address: '2985 Alpenglow', status: 'Canceled', listPrice: 620000, sqft: 1860, latitude: 44.080132, longitude: -121.259529 }),
  peer({ listingKey: 'e2', address: '2745 Aldrich', status: 'Withdrawn', listPrice: 495000, sqft: 1201, latitude: 44.082009, longitude: -121.263489 }),
  peer({ listingKey: 'e3', address: '3204 Spring Creek', status: 'Withdrawn', listPrice: 505000, sqft: 1200, latitude: 44.082334, longitude: -121.258915 }),
]

const PINNACLE_COMPETITION_SENTENCE =
  '3 homes are for sale in Eaglenest, Mtn Peaks, Madison Park, Oakview and Obsidian Ridge between $483,000 and $591,000. 3 are under contract. The nearest five like yours are below.'

const PINNACLE_UNSOLD_SENTENCE =
  'Three homes like yours in Eaglenest, Mtn Peaks, Madison Park, Oakview and Obsidian Ridge came off the market without selling in the last nine months.'

function pinnacleArgs(status?: string) {
  return {
    subject: PINNACLE_SUBJECT,
    documentStatus: status ?? 'draft',
    compArea: PINNACLE_AREA,
    bandRivals: {
      area: PINNACLE_AREA,
      lo: 483000,
      hi: 591000,
      activeCount: 3,
      pendingCount: 3,
      rivals: PINNACLE_RIVALS,
      sentence: PINNACLE_COMPETITION_SENTENCE,
      source: 'stored',
      widenedFrom: null,
      ringsTried: [],
    },
    expiredPeers: {
      area: PINNACLE_AREA,
      windowMonths: 9,
      windowsTried: [3, 6, 9],
      count: 3,
      areaTotal: 4,
      found: 3,
      likeYours: true,
      shortfall: false,
      sentence: PINNACLE_UNSOLD_SENTENCE,
      peers: PINNACLE_PEERS,
    },
  }
}

describe('a blank place on the area the build drew still prints (2902 Pinnacle)', () => {
  it('keeps the five rivals and three unsold homes the build stored', () => {
    const sets = matrixSetsFromArgs(pinnacleArgs())
    expect(sets.active.map((r) => r.address)).toEqual([
      '21286 Beall',
      '2750 Great Horned',
      '2736 Rainier',
      '21274 Beall',
      '2820 Aldrich',
    ])
    expect(sets.unsold.map((p) => p.address)).toEqual(['2985 Alpenglow', '2745 Aldrich', '3204 Spring Creek'])
  })

  it('prints those homes, and the sentence counts the rows it draws', () => {
    const args = pinnacleArgs()
    const competition = competitionPage({
      ...args,
      comps: [],
      pricing: { recommended: 537000, valueLow: 500000, valueHigh: 560000, notes: [] },
      generatedAtIso: '2026-09-30T21:47:07.000Z',
    } as unknown as OpinionPageArgs)
    const body = competition?.body ?? ''
    for (const address of ['21286 Beall', '2750 Great Horned', '2736 Rainier', '21274 Beall', '2820 Aldrich']) {
      expect(body).toContain(address)
    }
    expect(body).toContain('2 homes are for sale between $483,000 and $591,000. 3 other homes are under contract.')
    expect(body).not.toContain('0 homes are for sale')

    const unsold = didNotSellPage({
      ...args,
      comps: [],
      market: null,
      pricing: { recommended: 537000, valueLow: 500000, valueHigh: 560000, notes: [] },
      generatedAtIso: '2026-09-30T21:47:07.000Z',
    } as unknown as OpinionPageArgs)
    const unsoldText = `${unsold?.toc ?? ''} ${unsold?.body ?? ''}`
    expect(unsoldText).toContain(PINNACLE_UNSOLD_SENTENCE)
    for (const address of ['2985 Alpenglow', '2745 Aldrich', '3204 Spring Creek']) {
      expect(unsoldText).toContain(address)
    }
    expect(unsoldText).not.toContain('No other listing like yours near you came off unsold')
  })

  it('still drops a blank peer the build did not draw on this area (2566 Keats)', () => {
    const area = {
      kind: 'subdivisions' as const,
      names: ['Hampton Park', 'Deer Pointe Village'],
      radiusMiles: null,
      centre: { lat: 44.075, lng: -121.294 },
      source: 'test',
      sentence: 'Hampton Park and the one subdivision next to it.',
    }
    const peers = unsoldPeersFor({
      subject: {
        propertySubType: 'Single Family Residence',
        listingKey: 'S',
        mlsNumber: '1',
        streetAddress: '2566 Keats',
      },
      area,
      peers: [
        peer({ listingKey: 'near', address: '2515 Keats', subdivision: 'Hampton Park', platSlug: null }),
        peer({
          listingKey: 'blank',
          address: '9 Nowhere',
          subdivision: null,
          platSlug: null,
          latitude: 45.2,
          longitude: -120.1,
        }),
      ],
    })
    expect(peers.map((p) => p.address)).toEqual(['2515 Keats'])
  })
})

describe('a delivered letter does not restate its competition (1195 Remarkable)', () => {
  const village = {
    kind: 'subdivision' as const,
    names: ['Awbrey Village'],
    radiusMiles: null,
    centre: { lat: 44.09, lng: -121.33 },
    source: 'stored',
    sentence: 'Awbrey Village, your own subdivision.',
  }
  const butte = {
    kind: 'neighborhood' as const,
    names: ['Awbrey Butte'],
    radiusMiles: null,
    centre: { lat: 44.09, lng: -121.33 },
    source: 'stored',
    sentence: 'Awbrey Butte.',
  }
  const rivals = [
    rival({ listingKey: 'r1', address: '3063 Duffy', subdivision: 'Awbrey Butte', listPrice: 1495000, latitude: 44.091, longitude: -121.331 }),
    rival({ listingKey: 'r2', address: '3454 Bryce Canyon', subdivision: 'Awbrey Park', listPrice: 1499999, latitude: 44.092, longitude: -121.332 }),
    rival({ listingKey: 'r3', address: '3209 Fairway Heights', subdivision: 'Rivers Edge Village', listPrice: 1525000, latitude: 44.093, longitude: -121.333 }),
    rival({ listingKey: 'r4', address: '1154 Redfield', subdivision: 'Awbrey Butte', listPrice: 1449900, latitude: 44.094, longitude: -121.334 }),
  ]
  const sentence =
    '13 homes are for sale in Awbrey Butte between $1,273,000 and $1,555,000. None are under contract right now. The nearest four like yours are below.'

  function args(status: string | undefined) {
    return {
      subject: {
        listingKey: 'SUB',
        mlsNumber: '2',
        streetAddress: '1195 Remarkable',
        city: 'Bend',
        subdivision: 'Awbrey Village',
        propertySubType: 'Single Family Residence',
        beds: 4,
        baths: 3,
        sqft: 3200,
        yearBuilt: 2006,
        latitude: 44.09,
        longitude: -121.33,
      },
      documentStatus: status,
      compArea: village,
      bandRivals: {
        area: butte,
        lo: 1273000,
        hi: 1555000,
        activeCount: 13,
        pendingCount: 0,
        rivals,
        sentence,
        source: 'stored',
        widenedFrom: null,
        ringsTried: [],
      },
      comps: [],
      pricing: { recommended: 1414000, valueLow: 1300000, valueHigh: 1500000, notes: [] },
      generatedAtIso: '2026-10-05T16:53:31.000Z',
    }
  }

  it('prints the four stored rivals and the sentence the letter was signed with', () => {
    const page = competitionPage(args('delivered') as unknown as OpinionPageArgs)
    const body = page?.body ?? ''
    for (const address of ['3063 Duffy', '3454 Bryce Canyon', '3209 Fairway Heights', '1154 Redfield']) {
      expect(body).toContain(address)
    }
    expect(body).toContain(sentence)
    expect(body).not.toContain('0 homes are for sale')
  })

  it('still drops those named subdivisions on a draft (rule 24, 3177 Coho)', () => {
    const kept = activeRivalsFor(rivals, args(undefined).subject, village, { buildArea: butte })
    expect(kept).toEqual([])
    const page = competitionPage(args('draft') as unknown as OpinionPageArgs)
    const body = page?.body ?? ''
    expect(body).toContain('0 homes are for sale between $1,273,000 and $1,555,000. None are under contract right now.')
    expect(body).not.toContain('3063 Duffy')
    expect(body).not.toContain('Awbrey Butte between')
  })
})

describe('a new build stores the place fields the render filters on', () => {
  it('writes platSlug null when the area read found no polygon', () => {
    const row = bandRowToRival(
      {
        ListingKey: 'K',
        ListPrice: 529000,
        DaysOnMarket: 12,
        OnMarketDate: '2026-09-01',
        PhotoURL: null,
        Latitude: 44.076682,
        Longitude: -121.25942,
        SubdivisionName: 'Oakview',
        StreetNumber: '21286',
        StreetName: 'Beall',
      },
      'Active',
    )
    expect(row?.subdivision).toBe('Oakview')
    expect(row?.platSlug).toBeNull()
    expect(row?.latitude).toBe(44.076682)
    expect(row?.longitude).toBe(-121.25942)
  })
})

describe('the render audit catches a blank place the letter would hide', () => {
  it('passes the Pinnacle row once the rows print, and flags it if they do not', () => {
    const row = auditCmaRenderRow({ slug: 'cma-2902-pinnacle', status: 'draft', args: pinnacleArgs() })
    expect(row.fail).toEqual([])
    expect(row.printedRivals).toBe(row.storedRivals)
    expect(row.printedRivals).toBe(5)
    expect(row.printedPeers).toBe(row.storedPeers)
    expect(row.printedPeers).toBe(3)
  })

  it('reports a draft whose named rivals sit outside the sales plats, and does not fail it', () => {
    const village = {
      kind: 'subdivision' as const,
      names: ['Awbrey Village'],
      radiusMiles: null,
      centre: { lat: 44.09, lng: -121.33 },
      source: 'stored',
      sentence: 'Awbrey Village.',
    }
    const butte = {
      kind: 'neighborhood' as const,
      names: ['Awbrey Butte'],
      radiusMiles: null,
      centre: { lat: 44.09, lng: -121.33 },
      source: 'stored',
      sentence: 'Awbrey Butte.',
    }
    const row = auditCmaRenderRow({
      slug: 'cma-1195-remarkable',
      status: 'draft',
      args: {
        subject: {
          listingKey: 'SUB',
          mlsNumber: '2',
          streetAddress: '1195 Remarkable',
          city: 'Bend',
          propertySubType: 'Single Family Residence',
        },
        compArea: village,
        bandRivals: {
          area: butte,
          lo: 1273000,
          hi: 1555000,
          activeCount: 13,
          pendingCount: 0,
          rivals: [
            rival({ listingKey: 'r1', address: '3063 Duffy', subdivision: 'Awbrey Butte', listPrice: 1495000 }),
          ],
          sentence: '13 homes are for sale in Awbrey Butte between $1,273,000 and $1,555,000. None are under contract right now.',
          source: 'stored',
        },
      },
    })
    expect(row.fail).toEqual([])
    expect(row.rule24.some((line) => line.includes('3063 Duffy'))).toBe(true)
  })
})
