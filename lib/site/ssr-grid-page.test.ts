import { describe, expect, it } from 'vitest'
import { COMMUNITY_SSR_GRID_PAGE, SSR_GRID_PAGE, SSR_MAP_SEED_HOMES, seedPage } from './ssr-grid-page'

describe('SSR_GRID_PAGE', () => {
  it('is one page of 24 cards', () => {
    expect(SSR_GRID_PAGE).toBe(24)
  })

  it('seeds a shorter community fold and an empty map prop', () => {
    expect(COMMUNITY_SSR_GRID_PAGE).toBe(12)
    expect(COMMUNITY_SSR_GRID_PAGE).toBeLessThan(SSR_GRID_PAGE)
    expect(SSR_MAP_SEED_HOMES).toEqual([])
  })

  it('seeds only the first page and leaves a short list alone', () => {
    const rows = Array.from({ length: 80 }, (_, i) => i)
    expect(seedPage(rows)).toHaveLength(24)
    expect(seedPage(rows)[0]).toBe(0)
    expect(seedPage(rows)[23]).toBe(23)
    expect(seedPage(rows.slice(0, 7))).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
