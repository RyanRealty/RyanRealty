import { describe, expect, it } from 'vitest'
import {
  footprintProvenance,
  parseFootprintRow,
  platMemberSlugs,
  type PlatFootprint,
} from './getSubdivisionFootprint'

const SQUARE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-121.17, 44.3],
      [-121.16, 44.3],
      [-121.16, 44.31],
      [-121.17, 44.31],
      [-121.17, 44.3],
    ],
  ],
}

describe('platMemberSlugs', () => {
  it('slugifies, dedupes and sorts the plats the homes were classified into', () => {
    expect(
      platMemberSlugs(['Diamond Bar Ranch Phase 1', 'Diamond Bar Ranch Phase 1', 'Awbrey Butte Homesites Phase I']),
    ).toEqual(['awbrey-butte-homesites-phase-i', 'diamond-bar-ranch-phase-1'])
  })

  it('drops blanks and nulls rather than sending them to the RPC', () => {
    expect(platMemberSlugs([null, undefined, '   ', 'Clearpine Phase 3'])).toEqual(['clearpine-phase-3'])
  })
})

describe('parseFootprintRow', () => {
  it('reads a phases row into a footprint', () => {
    const out = parseFootprintRow('diamond-bar-ranch', {
      source: 'phases',
      part_slugs: ['diamond-bar-ranch-phase-1', 'diamond-bar-ranch-phase-2'],
      part_labels: ['Diamond Bar Ranch Phase 1', 'Diamond Bar Ranch Phase 2'],
      geojson: JSON.stringify(SQUARE),
    })
    expect(out?.source).toBe('phases')
    expect(out?.partSlugs).toHaveLength(2)
    expect(out?.geometry.type).toBe('Polygon')
  })

  it('is null on no row, an unknown source, no parts, bad JSON or a non-polygon', () => {
    expect(parseFootprintRow('x', null)).toBeNull()
    expect(parseFootprintRow('x', { source: 'guess', part_slugs: ['a'], geojson: JSON.stringify(SQUARE) })).toBeNull()
    expect(parseFootprintRow('x', { source: 'exact', part_slugs: [], geojson: JSON.stringify(SQUARE) })).toBeNull()
    expect(parseFootprintRow('x', { source: 'exact', part_slugs: ['a'], geojson: '{' })).toBeNull()
    expect(
      parseFootprintRow('x', {
        source: 'exact',
        part_slugs: ['a'],
        geojson: JSON.stringify({ type: 'Point', coordinates: [0, 0] }),
      }),
    ).toBeNull()
  })
})

describe('footprintProvenance', () => {
  const base: Omit<PlatFootprint, 'source' | 'partSlugs' | 'partLabels'> = {
    slug: 'diamond-bar-ranch',
    geometry: SQUARE,
  }

  it('names one recorded plat', () => {
    expect(
      footprintProvenance(
        { ...base, source: 'exact', partSlugs: ['park-addition'], partLabels: ['Park Addition'] },
        'Park Addition',
      ),
    ).toBe('The outline is the recorded plat of Park Addition, from Deschutes County GIS recorded subdivisions.')
  })

  it('names every phase it joined', () => {
    const line = footprintProvenance(
      {
        ...base,
        source: 'phases',
        partSlugs: ['diamond-bar-ranch-phase-1', 'diamond-bar-ranch-phase-2'],
        partLabels: ['Diamond Bar Ranch Phase 1', 'Diamond Bar Ranch Phase 2'],
      },
      'Diamond Bar Ranch',
    )
    expect(line).toContain('the 2 recorded plats of Diamond Bar Ranch joined into one shape')
    expect(line).toContain('Diamond Bar Ranch Phase 1, Diamond Bar Ranch Phase 2')
  })

  it('counts rather than lists once there are more than four parts', () => {
    const labels = ['A Phase 1', 'A Phase 2', 'A Phase 3', 'A Phase 4', 'A Phase 5']
    const line = footprintProvenance(
      { ...base, source: 'phases', partSlugs: labels.map((l) => l.toLowerCase()), partLabels: labels },
      'A',
    )
    expect(line).toContain('A Phase 1, A Phase 2, A Phase 3 and 2 more')
  })

  it('says the member plats are the ones the homes were found inside', () => {
    expect(
      footprintProvenance(
        { ...base, source: 'members', partSlugs: ['fall-river-estates'], partLabels: ['Fall River Estates'] },
        'Fall River Estate',
      ),
    ).toContain('the plat these homes were found inside')
  })
})
