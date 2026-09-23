import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => null }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

import { buildRecordedPlatTree } from './getRecordedPlatTree'

describe('buildRecordedPlatTree', () => {
  const rows = [
    { id: 'c1', geo_type: 'city', geo_slug: 'bend', geo_label: 'Bend', parent_id: null },
    { id: 'n1', geo_type: 'neighborhood', geo_slug: 'bend-century-west', geo_label: 'Century West', parent_id: 'c1' },
    { id: 's1', geo_type: 'subdivision', geo_slug: 'tetherow-phase-1', geo_label: 'Tetherow Phase 1', parent_id: 'n1' },
    { id: 's2', geo_type: 'subdivision', geo_slug: 'loose-plat', geo_label: 'Loose Plat', parent_id: null },
    { id: 's3', geo_type: 'subdivision', geo_slug: 'tetherow-phase-1', geo_label: 'Tetherow Phase 1', parent_id: 'n1' },
  ]

  it('walks each plat up the parent chain to its city, once per slug', () => {
    const tree = buildRecordedPlatTree(rows)
    expect(tree.plats).toEqual([
      { slug: 'loose-plat', label: 'Loose Plat', treeCitySlug: '' },
      { slug: 'tetherow-phase-1', label: 'Tetherow Phase 1', treeCitySlug: 'bend' },
    ])
    expect(tree.citySlugs).toEqual(['bend'])
    expect(tree.neighborhoodSlugs).toEqual(['bend-century-west'])
  })
})
