import { describe, expect, it } from 'vitest'
import { walkPlatBoundaryCity } from './getPlatBoundaryCity'

type Row = { id: string; geo_type: string; geo_slug: string; geo_label: string; parent_id: string | null }

const rows: Row[] = [
  { id: 'c1', geo_type: 'city', geo_slug: 'bend', geo_label: 'Bend', parent_id: null },
  { id: 'n1', geo_type: 'neighborhood', geo_slug: 'bend-century-west', geo_label: 'Century West', parent_id: 'c1' },
  { id: 'p1', geo_type: 'subdivision', geo_slug: 'courtyard-garages-at-broken-top', geo_label: 'Courtyard Garages At Broken Top', parent_id: 'n1' },
  { id: 'p2', geo_type: 'subdivision', geo_slug: 'rock-ridge-cabin-sites-of-black-butte-ranch', geo_label: 'Rock Ridge Cabin Sites Of Black Butte Ranch', parent_id: null },
  { id: 'x1', geo_type: 'neighborhood', geo_slug: 'loop-a', geo_label: 'Loop A', parent_id: 'x2' },
  { id: 'x2', geo_type: 'neighborhood', geo_slug: 'loop-b', geo_label: 'Loop B', parent_id: 'x1' },
  { id: 'p3', geo_type: 'subdivision', geo_slug: 'looping-plat', geo_label: 'Looping Plat', parent_id: 'x1' },
  { id: 'p4', geo_type: 'subdivision', geo_slug: 'direct-plat', geo_label: 'Direct Plat', parent_id: 'c1' },
]
const readPlat = async (slug: string) => rows.find((r) => r.geo_type === 'subdivision' && r.geo_slug === slug) ?? null
const readById = async (id: string) => rows.find((r) => r.id === id) ?? null

describe('walkPlatBoundaryCity', () => {
  it('walks plat → neighborhood → city and returns the city label and slug', async () => {
    await expect(walkPlatBoundaryCity('courtyard-garages-at-broken-top', readPlat, readById)).resolves.toEqual({
      city: 'Bend',
      citySlug: 'bend',
      neighborhood: { label: 'Century West', slug: 'bend-century-west' },
    })
  })
  it('reports no neighborhood when the plat hangs straight off the city', async () => {
    // SITE-47: the opening's sentence changes shape when there is no nearer
    // container, so "none" has to be distinguishable from "not walked".
    await expect(walkPlatBoundaryCity('direct-plat', readPlat, readById)).resolves.toEqual({
      city: 'Bend',
      citySlug: 'bend',
      neighborhood: null,
    })
  })
  it('answers null for a plat with no parent chain (never a guessed city)', async () => {
    await expect(walkPlatBoundaryCity('rock-ridge-cabin-sites-of-black-butte-ranch', readPlat, readById)).resolves.toBeNull()
  })
  it('answers null for an unknown plat', async () => {
    await expect(walkPlatBoundaryCity('not-a-plat', readPlat, readById)).resolves.toBeNull()
  })
  it('caps the walk so a cyclic parent chain cannot spin', async () => {
    await expect(walkPlatBoundaryCity('looping-plat', readPlat, readById)).resolves.toBeNull()
  })
})
