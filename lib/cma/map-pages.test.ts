/**
 * The map and the pages around it, as three readers found them on the rebuilt
 * 62475 Woodsman, 2382 Jackson and 3037 Purcell drafts (2026-10-08).
 */
import { describe, expect, it } from 'vitest'
import { compPinMap, pinLegendHtml, pinMapAlt, pinReading, type CmaPinFact } from '@/lib/cma/comp-pin-map'
import { labelsForUsedPlats, printedPlatName } from '@/lib/cma/map-outlines'
import { mapLegend, tablesHoldingPins } from '@/lib/cma/render-pricing-page'
import { competitionEmptySourceLine, withoutMapPointer } from '@/lib/cma/band-rivals'
import { didNotSellHeading, DID_NOT_SELL_HEADING } from '@/lib/cma/did-not-sell'
import { noOtherPeerSentence } from '@/lib/cma/market-status'
import { setAsideCompIndexes, setAsideSalePredicate } from '@/lib/cma/set-aside'
import type { CompArea } from '@/lib/pricing/comp-area'
import type { CmaAdjustedComp, CmaPricing } from '@/lib/cma/types'

const fact = (over: Partial<CmaPinFact> & Pick<CmaPinFact, 'key' | 'family'>): CmaPinFact => ({
  address: `${over.key} Test St`,
  outcome: 'sold $500K',
  domDays: 10,
  priceChanges: 0,
  latitude: 44.05,
  longitude: -121.05,
  ...over,
})

describe('set-aside sales on the map (62475 Woodsman, 2382 Jackson)', () => {
  const sale = (i: number, adjustedPrice: number, key: string | null = `K${i}`) =>
    ({ listingKey: key, address: `${i} Test St`, adjustedPrice }) as unknown as CmaAdjustedComp

  it('carries the grid decision to the map by listing key', () => {
    const comps = [sale(1, 500_000), sale(2, 520_000), sale(3, 540_000), sale(4, 560_000), sale(5, 700_000)]
    const pricing = {
      setAside: [
        { listingKey: 'K1', address: '1 Test St', reason: 'lowest' },
        { listingKey: 'K5', address: '5 Test St', reason: 'highest' },
      ],
    } as unknown as CmaPricing
    const aside = setAsideSalePredicate(pricing, comps)
    expect(comps.filter(aside).map((c) => c.listingKey)).toEqual(['K1', 'K5'])
    // Same address, different key: not the set-aside sale.
    expect(aside({ listingKey: 'K9', address: '1 Test St' })).toBe(false)
    expect([...setAsideCompIndexes(pricing, comps)]).toEqual([0, 4])
  })

  it('reads the trimmed rule on a row stored before the named list, the same way the table does', () => {
    const comps = [sale(1, 500_000), sale(2, 520_000), sale(3, 540_000), sale(4, 560_000), sale(5, 700_000)]
    const pricing = { rangeRule: { rule: 'trimmed-one-each-end' } } as unknown as CmaPricing
    const aside = setAsideSalePredicate(pricing, comps)
    expect(comps.filter(aside).map((c) => c.listingKey)).toEqual(['K1', 'K5'])
  })

  it('sets nothing aside when the row says nothing', () => {
    const comps = [sale(1, 500_000), sale(2, 520_000)]
    expect(comps.some(setAsideSalePredicate({} as CmaPricing, comps))).toBe(false)
  })

  it('names a set-aside pin as set aside, and the legend gives it its own line', () => {
    const drawn = [fact({ key: '1', family: 'closed' }), fact({ key: '2', family: 'closed', setAside: true })]
    expect(pinReading(drawn[1]!)).toContain('Set aside: did not set the price')
    expect(pinReading(drawn[0]!)).not.toContain('Set aside')
    const legend = pinLegendHtml(drawn)
    expect(legend).toContain('Closed sales: these set the price')
    expect(legend).toContain('Closed sales shown but set aside')
    expect(legend).toContain('class="pl-i is-closed is-aside"')
  })

  it('shows only the legend lines the map drew', () => {
    const onlyAside = pinLegendHtml([fact({ key: '1', family: 'closed', setAside: true })])
    expect(onlyAside).not.toContain('these set the price')
    expect(onlyAside).toContain('Closed sales shown but set aside')
  })

  it('reads the legend and alt text off the pins the tile drew, not every home offered', () => {
    const view = { centerLat: 44.05, centerLng: -121.05, zoom: 14, width: 640, height: 360 }
    const facts = [
      fact({ key: '1', family: 'closed' }),
      // Off the tile: offered, never drawn.
      fact({ key: 'i', family: 'unsold', latitude: 45.5, longitude: -122.6 }),
    ]
    const map = compPinMap({
      subject: { streetAddress: '9 Home St' },
      facts,
      mapDataUri: 'data:image/svg+xml;base64,AAAA',
      overlay: {
        view,
        pins: [
          { key: null, family: 'subject', lat: 44.0502, lng: -121.0502 },
          { key: '1', family: 'closed', lat: 44.05, lng: -121.05 },
          { key: 'i', family: 'unsold', lat: 45.5, lng: -122.6 },
        ],
      },
    })
    expect(map.pinsShown).toBe(true)
    expect(map.drawn.map((d) => d.key)).toEqual(['1'])
    expect(map.html).not.toContain('Came off the market unsold')
    expect(map.html).toContain('alt="Map of your home and the sales"')
  })

  it('writes alt text for exactly what is drawn (3037 Purcell)', () => {
    expect(pinMapAlt([])).toBe('Map of your home')
    expect(pinMapAlt([{ family: 'closed' }])).toBe('Map of your home and the sales')
    expect(pinMapAlt([{ family: 'closed' }, { family: 'active' }, { family: 'unsold' }])).toBe(
      'Map of your home, the sales, the homes for sale and the listings that came off',
    )
  })
})

describe('the caption under the map counts what is drawn (2382 Jackson)', () => {
  it('counts one table per kind of pin drawn, Active and Pending apart', () => {
    expect(tablesHoldingPins([{ family: 'closed' }, { family: 'active', status: 'active' }])).toBe(2)
    expect(
      tablesHoldingPins([
        { family: 'closed' },
        { family: 'active', status: 'active' },
        { family: 'active', status: 'pending' },
        { family: 'unsold' },
      ]),
    ).toBe(4)
    expect(tablesHoldingPins([{ family: 'closed' }, { family: 'closed' }])).toBe(1)
  })

  it('says the pins are above, and how many tables hold them', () => {
    expect(mapLegend({ pinsShown: true, tables: 2 })).toBe('Every pin above is a row in one of the two tables that follow.')
    expect(mapLegend({ pinsShown: true, tables: 1 })).toBe('Every pin above is a row in the table that follows.')
    expect(mapLegend({ pinsShown: false, tables: 3 })).toBe(
      'The three tables that follow list every home this map was drawn for.',
    )
    expect(mapLegend({ pinsShown: true, tables: 0 })).toBe('')
    expect(mapLegend({ pinsShown: true, tables: 2 })).not.toContain('below')
  })

  it('names the place it labelled without an outline, and why (3037 Purcell, rule 24)', () => {
    expect(
      mapLegend({ pinsShown: true, tables: 1, boundaryShown: true, parentShown: true, streetPlace: 'Holliday Park' }),
    ).toBe(
      'Every pin above is a row in the table that follows. The lines are the subdivisions these homes sit in, and the neighborhood around them. Holliday Park is named on the map but not outlined, because only its homes on your street are part of the area.',
    )
    // No outline sentence, no exception to it.
    expect(mapLegend({ pinsShown: true, tables: 1, boundaryShown: false, streetPlace: 'Holliday Park' })).toBe(
      'Every pin above is a row in the table that follows.',
    )
  })
})

describe('plat names print without their county file number (62475 Woodsman)', () => {
  it.each([
    ['Shevlin West Phase 4 Pz-20-0010', 'Shevlin West Phase 4'],
    ['Acadia Pointe, Phases I And II Pz 20-0569', 'Acadia Pointe, Phases I And II'],
    ['Westhaven Pz20-0183', 'Westhaven'],
    ['Acapella Pz 20-0027 , Pz 20-0028', 'Acapella'],
    ['Canyon Trails Phase 1 711-21-000194-sub', 'Canyon Trails Phase 1'],
    ['Owen Ridge Phases 1 And 2 711-22-000209-plng Sub', 'Owen Ridge Phases 1 And 2'],
    ['Canyon Rim Village , Phase 11 711-21-000087-plng , 711-21-000088-plng', 'Canyon Rim Village, Phase 11'],
    ['North Trailside 711-20-000129-md, 711-20-000130-zma, 711-20-000131-sub', 'North Trailside'],
    ['Sego Estates, Phase 1 711-18-000117-sub 711-20-000109-plng-e', 'Sego Estates, Phase 1'],
    ['Caldera Springs, Phase D 247-24-000360-tp', 'Caldera Springs, Phase D'],
    ['Westgate Phase 8 247-19-000500-mp 247-19-000501-tp', 'Westgate Phase 8'],
    ['Sisters Woodlands Phase 1 Sub-21-01', 'Sisters Woodlands Phase 1'],
    ['Larch Commons East Sub 24-02', 'Larch Commons East'],
    ['Brooks Camp Mod 20-02/sub20-01', 'Brooks Camp'],
    ['Kampstra Replat Of Parcel 3 Plat. No. 2002-61', 'Kampstra Replat Of Parcel 3'],
  ])('%s → %s', (recorded, printed) => {
    expect(printedPlatName(recorded)).toBe(printed)
  })

  it.each([
    'Silver Sage Phase I',
    'Silver Sage Phase 2',
    'Holliday Park Third Addition Phase III',
    'Northwest Crossing Phases 20-22',
    'Broken Top Phase I-f Lots 113-116',
    'Deschutes River Recreation Homesites Inc. Blocks 14-17',
    'Crescent Creek No. 2',
    'Cagle Subdivision Plat No. 1',
    'Shevlin West Phases 1 & 2',
  ])('keeps a real name as recorded: %s', (recorded) => {
    expect(printedPlatName(recorded)).toBe(recorded)
  })

  it('labels the map with the printed name', () => {
    const ring = [
      { lat: 44.07, lng: -121.37 },
      { lat: 44.08, lng: -121.37 },
      { lat: 44.08, lng: -121.36 },
    ]
    const labels = labelsForUsedPlats({ plats: [{ label: 'Shevlin West Phase 4 Pz-20-0010', rings: [ring] }] })
    expect(labels.map((l) => l.text)).toEqual(['Shevlin West Phase 4'])
  })
})

describe('pages with nothing to draw say so (62475 Woodsman, 2382 Jackson, 3037 Purcell)', () => {
  it('rewrites a stored pointer at "this map", and nothing else', () => {
    expect(
      withoutMapPointer(
        'One other home is listed there in that range, but it is not close to this home in bedrooms, bathrooms, size or age, so it is not on this map. Nothing from outside Shevlin West was added to make up the number.',
      ),
    ).toBe(
      'One other home is listed there in that range, but it is not close to this home in bedrooms, bathrooms, size or age, so it is not compared here. Nothing from outside Shevlin West was added to make up the number.',
    )
    expect(
      withoutMapPointer('None were close to this home in bedrooms, bathrooms, size or age, so none are on this map.'),
    ).toBe('None were close to this home in bedrooms, bathrooms, size or age, so they are not compared here.')
    expect(withoutMapPointer('2 homes like yours are for sale.')).toBe('2 homes like yours are for sale.')
  })

  it('marks the trace as a source when no table is drawn', () => {
    expect(
      competitionEmptySourceLine(
        'Homes for sale and under contract in Shevlin West between $1,418,000 and $1,734,000, from the Oregon Data Share MLS as of Oct 7, 2026.',
      ),
    ).toBe(
      'Source: homes for sale and under contract in Shevlin West between $1,418,000 and $1,734,000, from the Oregon Data Share MLS as of Oct 7, 2026.',
    )
    expect(competitionEmptySourceLine('')).toBe('')
  })

  it('never heads an empty chapter with a plural', () => {
    expect(didNotSellHeading({ shown: 1, ownFailed: true })).toBe(DID_NOT_SELL_HEADING)
    expect(didNotSellHeading({ shown: 0, ownFailed: true })).toBe('No other listing like yours near you came off unsold.')
    expect(didNotSellHeading({ shown: 0, ownFailed: false })).toBe('No listing like yours near you came off unsold.')
  })

  it('names the area and the longest window tried', () => {
    const area = {
      kind: 'subdivisions',
      names: ['Silver Sage', 'Holliday Park'],
      radiusMiles: null,
      centre: { lat: 44.08, lng: -121.27 },
      source: 'test',
      sentence: 'Silver Sage, your own subdivision, with the Holliday Park homes on your street.',
      street: { key: 'purcell', names: ['Holliday Park'], platSlugs: ['holliday-park-third-addition-phase-iii'] },
    } as unknown as CompArea
    expect(noOtherPeerSentence(area, 18)).toBe(
      'No other home like yours in Silver Sage or your street in Holliday Park came off the market without selling in the last 18 months.',
    )
    expect(noOtherPeerSentence(area, null)).toBe('')
  })
})
