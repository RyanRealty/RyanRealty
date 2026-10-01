import { describe, expect, it, vi } from 'vitest'

/**
 * readActiveSubdivisionRowsInCity throws on a failed page (SITE-212 review): the
 * read it replaced turned a failed page into an empty one, and the hour-long
 * cache over getSubdivisionsInCity would have kept that as "no subdivisions".
 */
function mockPages(pages: Array<{ data: unknown; error: { message: string } | null }>) {
  const ranges: Array<[number, number]> = []
  vi.resetModules()
  vi.doMock('@/lib/data/client', () => ({
    supabaseAnon: () => ({
      from: () => {
        const b: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'or', 'order']) b[m] = () => b
        b.range = (from: number, to: number) => {
          ranges.push([from, to])
          const page = pages[ranges.length - 1] ?? { data: [], error: null }
          return { then: (resolve: (v: unknown) => unknown) => resolve(page) }
        }
        return b
      },
    }),
  }))
  return ranges
}

describe('readActiveSubdivisionRowsInCity', () => {
  it('reads every page', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ SubdivisionName: `S${i % 7}`, StandardStatus: 'Active' }))
    const ranges = mockPages([
      { data: full, error: null },
      { data: full.slice(0, 304), error: null },
    ])
    const { readActiveSubdivisionRowsInCity } = await import('./readActiveSubdivisionRowsInCity')
    const rows = await readActiveSubdivisionRowsInCity('Bend')
    expect(rows).toHaveLength(1304)
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    vi.doUnmock('@/lib/data/client')
  })

  it('throws when a page fails instead of returning what it had', async () => {
    const full = Array.from({ length: 1000 }, () => ({ SubdivisionName: 'S', StandardStatus: 'Active' }))
    mockPages([
      { data: full, error: null },
      { data: null, error: { message: 'canceling statement due to statement timeout' } },
    ])
    const { readActiveSubdivisionRowsInCity } = await import('./readActiveSubdivisionRowsInCity')
    await expect(readActiveSubdivisionRowsInCity('Bend')).rejects.toThrow(/statement timeout/)
    vi.doUnmock('@/lib/data/client')
  })
})
