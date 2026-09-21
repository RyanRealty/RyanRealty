import { describe, expect, it } from 'vitest'
import type { CommunitySubdivision } from '@/lib/data/geo/getCommunitySubdivisions'
import {
  overlaysFromChildCells,
  overlaysFromRegions,
  regionsFromChildCells,
} from './child-rings'

const square = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-121.4, 44.0],
      [-121.3, 44.0],
      [-121.3, 44.1],
      [-121.4, 44.1],
      [-121.4, 44.0],
    ],
  ],
}

function cell(over: Partial<CommunitySubdivision> = {}): CommunitySubdivision {
  return {
    slug: 'sunrise-village',
    label: 'Sunrise Village',
    geometry: square,
    activeHomes: 4,
    ...over,
  }
}

describe('overlaysFromChildCells', () => {
  it('maps a plat cell to a Split overlay door', () => {
    expect(overlaysFromChildCells([cell()])).toEqual([
      {
        label: 'Sunrise Village',
        href: '/subdivisions/sunrise-village',
        geojson: { type: 'Polygon', coordinates: square.coordinates },
      },
    ])
  })

  it('drops a point and an unnamed cell rather than inventing a ring', () => {
    expect(
      overlaysFromChildCells([
        cell({ geometry: { type: 'Point', coordinates: [-121, 44] } as unknown as CommunitySubdivision['geometry'] }),
        cell({ label: '  ', slug: 'blank' }),
      ]),
    ).toEqual([])
  })
})

describe('regionsFromChildCells', () => {
  it('names the child as a subdivision region with a door', () => {
    const [region] = regionsFromChildCells([cell()])
    expect(region).toMatchObject({
      id: 'subdivision:sunrise-village',
      kind: 'subdivision',
      kindLabel: 'Subdivision',
      name: 'Sunrise Village',
      href: '/subdivisions/sunrise-village',
    })
    expect(region?.geometry).toEqual(square)
  })

  it('drops Caldera MLS filing plats instead of painting them as visitor doors', () => {
    const regions = regionsFromChildCells([
      cell({ slug: 'caldera-springs-phase-c-2', label: 'Caldera Springs, Phase C-2' }),
      cell({ slug: 'phase-c1-sfr', label: 'Phase C1 Sfr' }),
      cell({ slug: 'olu-phase-a', label: 'Olu Phase A' }),
      cell({ slug: 'tetherow-phase-1', label: 'Tetherow Phase 1' }),
    ])
    expect(regions.map((region) => region.name)).toEqual(['Tetherow Phase 1'])
    expect(regions.map((region) => region.name).join(' ')).not.toMatch(/Sfr|Olu|Phase C-2/i)
  })
})

describe('overlaysFromRegions', () => {
  it('copies Atlas children onto Split overlays, parent excluded by the caller', () => {
    expect(
      overlaysFromRegions([
        {
          name: 'Larkspur',
          href: '/cities/bend/larkspur',
          geometry: square,
        },
      ]),
    ).toEqual([
      {
        label: 'Larkspur',
        href: '/cities/bend/larkspur',
        geojson: { type: 'Polygon', coordinates: square.coordinates },
      },
    ])
  })
})
