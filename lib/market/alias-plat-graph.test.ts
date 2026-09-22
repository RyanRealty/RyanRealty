import { describe, expect, it } from 'vitest'
import {
  curatedVisitorChildDoors,
  dropCuratedLookalikes,
  findAliasPlatEntry,
  joinCuratedChildEntries,
} from './alias-plat-graph'
import { nameOnlyChildEntries, nearbySubdivisionPeers } from '@/lib/explore/nearby-place-peers'

const TETHEROW_GIS = [
  { name: 'Tetherow Phase 1', href: '/subdivisions/tetherow-phase-1' },
  { name: 'Tetherow Phase 6', href: '/subdivisions/tetherow-phase-6' },
  { name: 'Golf Homes at Tetherow', href: '/subdivisions/golf-homes-at-tetherow' },
  { name: 'Highlands Ridge Phase 3 & 4', href: '/subdivisions/highlands-ridge-phase-3-and-4' },
  { name: 'Highlands Ridge, Phases 1 & 2', href: '/subdivisions/highlands-ridge-phases-1-and-2' },
  { name: 'North Forty at Tetherow', href: '/subdivisions/north-forty-at-tetherow-also-in-section-2' },
  { name: 'Outrider Overlook', href: '/subdivisions/outrider-overlook' },
  { name: 'Tetherow Rim', href: '/subdivisions/tetherow-rim' },
  { name: 'Trailhead at Tetherow Phase 1', href: '/subdivisions/trailhead-at-tetherow-phase-1' },
  { name: 'Tetherow Cascades Vista Phase 1', href: '/subdivisions/tetherow-cascades-vista-phase-1' },
  { name: 'Tetherow Vacation Homes Phase Ia', href: '/subdivisions/tetherow-vacation-homes-phase-ia' },
]

const TETHEROW_LOOKALIKES = [
  { name: 'Sunrise Village', href: '/subdivisions/sunrise-village' },
  { name: 'Westbrook Meadows', href: '/subdivisions/westbrook-meadows' },
  { name: 'Braeburn', href: '/subdivisions/braeburn' },
  { name: '1st On The Hillsites', href: '/subdivisions/1st-on-the-hillsites' },
  { name: 'Lodges at Bachelor V', href: '/subdivisions/lodges-at-bachelor-v' },
  { name: 'Campbell Road', href: '/subdivisions/campbell-road' },
  { name: 'Roald West', href: '/subdivisions/roald-west' },
  { name: 'Triple Ridge Phase 1', href: '/subdivisions/triple-ridge-phase-1' },
  { name: 'Sunrise Village River Bluff', href: '/subdivisions/sunrise-village-river-bluff' },
]

const NWC_GIS = [
  { name: 'Northwest Crossing Phase 1', href: '/subdivisions/northwest-crossing-phase-1' },
  { name: 'Northwest Crossing Phase 27', href: '/subdivisions/northwest-crossing-phase-27' },
  { name: 'Northwest Crossing Phases 9 and 10', href: '/subdivisions/northwest-crossing-phases-9-and-10' },
  { name: 'Cottages at Northwest Crossing', href: '/subdivisions/cottages-at-northwest-crossing' },
  { name: 'Bungalows at Northwest Crossing Condominium Stage 1', href: '/subdivisions/bungalows-at-northwest-crossing-condominium-stage-1' },
  { name: 'Commons at Northwest Crossing', href: '/subdivisions/commons-at-northwest-crossing' },
  { name: 'Compass Gardens', href: '/subdivisions/compass-gardens' },
  { name: 'Fremont Row Condominiums', href: '/subdivisions/fremont-row-condominiums' },
  { name: 'Shevlin Park Villas', href: '/subdivisions/shevlin-park-villas' },
  { name: 'Shevlin Health and Wellness Center', href: '/subdivisions/shevlin-health-and-wellness-center' },
]

const NWC_LOOKALIKES = [
  { name: 'Skyliner Summit', href: '/subdivisions/skyliner-summit' },
  { name: 'Shevlin Ridge', href: '/subdivisions/shevlin-ridge' },
  { name: 'Westside Pines', href: '/subdivisions/westside-pines' },
  { name: 'Westside Meadows', href: '/subdivisions/westside-meadows' },
  { name: 'Valhalla Heights', href: '/subdivisions/valhalla-heights' },
  { name: 'Treeline Phase 1', href: '/subdivisions/treeline-phase-1' },
  { name: 'Outcrop', href: '/subdivisions/outcrop' },
]

function names(rows: ReadonlyArray<{ name: string }>): string[] {
  return rows.map((row) => row.name)
}

describe('SITE-144 curated alias graph', () => {
  it('maps MLS Triple to Tetherow, never Triple Ridge', () => {
    expect(findAliasPlatEntry('Triple')?.aliasSlug).toBe('tetherow')
    expect(findAliasPlatEntry('triple')?.aliasSlug).toBe('tetherow')
    expect(findAliasPlatEntry('Triple Ridge')?.aliasSlug).not.toBe('tetherow')
    expect(findAliasPlatEntry('Triple Ridge Phase 1')).toBeNull()
  })

  it('replaces the Tetherow GIS phase dump with visitor names', () => {
    const rows = nameOnlyChildEntries([TETHEROW_GIS])
    expect(names(rows)).toEqual([
      'North Forty',
      'Cascades Vista',
      'Highlands Ridge',
      'Outrider Overlook',
      'Trailhead',
      'Triple Knot',
      'The Rim',
      'Golf Homes at Tetherow',
    ])
    expect(names(rows).join(' ')).not.toMatch(/Phase\s+[0-9]/i)
    expect(rows.some((row) => /sfr/i.test(row.name))).toBe(false)
  })

  it('never lists known Tetherow lookalikes as children', () => {
    const rows = nameOnlyChildEntries([[...TETHEROW_GIS, ...TETHEROW_LOOKALIKES]])
    const haystack = `${names(rows).join(' | ')} ${rows.map((row) => row.href).join(' ')}`.toLowerCase()
    for (const look of TETHEROW_LOOKALIKES) {
      expect(haystack).not.toContain(look.name.toLowerCase())
      expect(haystack).not.toContain(look.href.replace('/subdivisions/', ''))
    }
    expect(haystack).not.toContain('triple-ridge')
    expect(haystack).not.toContain('sunrise-village')
  })

  it('replaces the NWC phase dump and drops Shevlin lookalikes', () => {
    const rows = nameOnlyChildEntries([[...NWC_GIS, ...NWC_LOOKALIKES]])
    expect(names(rows)).toEqual([
      'Cottages at Northwest Crossing',
      'Bungalows at Northwest Crossing',
      'Commons at Northwest Crossing',
      'Compass Gardens',
      'Fremont Row',
      'Live/work Townhomes',
      'Mcneal Way',
      'Northwest Crossing Condominium',
    ])
    const haystack = `${names(rows).join(' | ')} ${rows.map((row) => row.href).join(' ')}`.toLowerCase()
    expect(haystack).not.toMatch(/phase\s+[0-9]/i)
    for (const look of [...NWC_LOOKALIKES, NWC_GIS.find((r) => r.href.includes('shevlin-park'))!]) {
      expect(haystack).not.toContain(look.name.toLowerCase())
    }
    expect(haystack).not.toContain('shevlin')
    expect(haystack).not.toContain('skyliner')
  })

  it('leaves a non-curated alias dump (Petrosa) as recorded member names', () => {
    const rows = nameOnlyChildEntries([
      [
        { name: 'Petrosa Phase 1', href: '/subdivisions/petrosa-phase-1' },
        { name: 'Petrosa Phase 2', href: '/subdivisions/petrosa-phase-2' },
      ],
    ])
    expect(rows).toEqual([
      { name: 'Petrosa Phase 1', href: '/subdivisions/petrosa-phase-1' },
      { name: 'Petrosa Phase 2', href: '/subdivisions/petrosa-phase-2' },
    ])
  })

  it('drops Tetherow lookalikes from a Tetherow plat nearby rail', () => {
    const peers = nearbySubdivisionPeers({
      selfSlug: 'tetherow-phase-6',
      ring: {
        ring: [
          { slug: 'sunrise-village-river-bluff', label: 'Sunrise Village River Bluff', rank: 1 },
          { slug: 'triple-ridge-phase-1', label: 'Triple Ridge Phase 1', rank: 2 },
          { slug: 'awbrey-glen', label: 'Awbrey Glen', rank: 3 },
        ],
      },
    })
    expect(names(peers)).toEqual(['Awbrey Glen'])
  })

  it('drops NWC lookalikes from an NWC plat nearby rail', () => {
    const dropped = dropCuratedLookalikes('northwest-crossing-phase-1', [
      { name: 'Shevlin Park Villas', href: '/subdivisions/shevlin-park-villas' },
      { name: 'Skyliner Summit', href: '/subdivisions/skyliner-summit' },
      { name: 'Awbrey Butte', href: '/cities/bend/awbrey-butte' },
    ])
    expect(names(dropped)).toEqual(['Awbrey Butte'])
  })

  it('keeps visitor children on the curated entries themselves', () => {
    const tetherow = findAliasPlatEntry('Tetherow')
    const nwc = findAliasPlatEntry('NorthWest Crossing')
    expect(tetherow?.childJoin).toBe('visitor-children')
    expect(nwc?.childJoin).toBe('visitor-children')
    expect(names(curatedVisitorChildDoors(tetherow!))).toContain('Triple Knot')
    expect(names(curatedVisitorChildDoors(nwc!))).toContain('Cottages at Northwest Crossing')
    expect(joinCuratedChildEntries(TETHEROW_GIS).some((row) => row.name === 'Tetherow Phase 6')).toBe(false)
  })
})
