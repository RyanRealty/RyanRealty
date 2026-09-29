/**
 * SITE-209: every member plat for a city, paged past PostgREST's 1,000-row
 * cap with `.order('geo_slug').range()`, one cache entry per 500-row page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type RpcRow = { geo_slug: string; geo_label: string; geojson: string | null; active_homes: number | null }

const h = vi.hoisted(() => ({
  rows: [] as Array<{ geo_slug: string; geo_label: string; geojson: string | null; active_homes: number | null }>,
  count: null as number | null | 'exact',
  error: null as { message: string } | null,
  calls: [] as Array<{ fn: string; args: unknown; opts: unknown; order: unknown; range: [number, number] }>,
  cacheKeys: [] as string[][],
  cacheOpts: [] as Array<{ revalidate?: number; tags?: string[] }>,
}))

// A fake PostgREST builder: `.rpc().order().range()` serves pages of the
// in-memory list, ordered by geo_slug like the live RPC, and reports the
// exact count of the whole result set on every page.
vi.mock('@/lib/data/client', () => ({
  supabaseAnon: () => ({
    rpc: (fn: string, args: unknown, opts: unknown) => {
      const call = { fn, args, opts, order: null as unknown, range: [0, 0] as [number, number] }
      return {
        order: (column: string, options: unknown) => {
          call.order = { column, options }
          return {
            range: (from: number, to: number) => {
              call.range = [from, to]
              h.calls.push(call)
              if (h.error) return Promise.resolve({ data: null, error: h.error, count: null })
              const sorted = [...h.rows].sort((a, b) => (a.geo_slug < b.geo_slug ? -1 : a.geo_slug > b.geo_slug ? 1 : 0))
              const data = sorted.slice(from, to + 1)
              const count = h.count === 'exact' ? sorted.length : h.count
              return Promise.resolve({ data, error: null, count })
            },
          }
        },
      }
    },
  }),
}))

// The one door: pass the callback through, record the key parts.
vi.mock('@/lib/data/cache/next-cache', () => ({
  unstable_cache: (fn: () => unknown, keyParts: string[], opts: { revalidate?: number; tags?: string[] }) => {
    h.cacheKeys.push(keyParts)
    h.cacheOpts.push(opts)
    return fn
  },
}))

import { getCommunitySubdivisions } from './getCommunitySubdivisions'

/** Tiny square so 1,201 rows stay a small in-memory list. */
function square(i: number): string {
  const x = -121.5 + (i % 40) * 0.001
  const y = 44 + Math.floor(i / 40) * 0.001
  return JSON.stringify({
    type: 'Polygon',
    coordinates: [[[x, y], [x + 0.0005, y], [x + 0.0005, y + 0.0005], [x, y + 0.0005], [x, y]]],
  })
}

/**
 * Slugs `plat-0000`..`plat-1200` sort by slug in that order (zero-padded), so
 * "the row at index 1000 by slug" is `plat-1000`, on page 2 (rows 1000-1499).
 * activeHomes is deliberately NOT monotone in slug order so the published
 * (activeHomes desc) order differs from the read order.
 */
function fakeRows(n: number): RpcRow[] {
  return Array.from({ length: n }, (_, i) => ({
    geo_slug: `plat-${String(i).padStart(4, '0')}`,
    geo_label: `Plat ${String(i).padStart(4, '0')}`,
    geojson: square(i),
    active_homes: (i * 7919) % 13, // 0..12, scattered
  }))
}

beforeEach(() => {
  h.rows = fakeRows(1201)
  h.count = 'exact'
  h.error = null
  h.calls.length = 0
  h.cacheKeys.length = 0
  h.cacheOpts.length = 0
})

describe('getCommunitySubdivisions (SITE-209 paging)', () => {
  it('returns every row past PostgREST\'s 1,000-row cap, including the one at index 1000 by slug', async () => {
    const out = await getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' })
    expect(out).toHaveLength(1201)
    expect(new Set(out.map((p) => p.slug)).size).toBe(1201)
    const target = out.find((p) => p.slug === 'plat-1000')
    expect(target).toMatchObject({ slug: 'plat-1000', label: 'Plat 1000' })
    expect(target!.geometry.type).toBe('Polygon')
    // The last row of the list is there too.
    expect(out.some((p) => p.slug === 'plat-1200')).toBe(true)
  })

  it('reads 500-row pages ordered by geo_slug with an exact count, over the RPC', () => {
    return getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' }).then(() => {
      expect(h.calls).toHaveLength(3)
      for (const call of h.calls) {
        expect(call.fn).toBe('community_subdivisions')
        expect(call.args).toEqual({ p_geo_type: 'city', p_geo_slug: 'bend' })
        expect(call.opts).toEqual({ count: 'exact' })
        expect(call.order).toEqual({ column: 'geo_slug', options: { ascending: true } })
      }
      expect(h.calls.map((c) => c.range)).toEqual([
        [0, 499],
        [500, 999],
        [1000, 1499],
      ])
    })
  })

  it('caches each page under its own v2 key on the geoNeighborhood window', async () => {
    await getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' })
    expect(h.cacheKeys).toEqual([
      ['community-subdivisions-v2', 'city', 'bend', 'page', '0'],
      ['community-subdivisions-v2', 'city', 'bend', 'page', '1'],
      ['community-subdivisions-v2', 'city', 'bend', 'page', '2'],
    ])
    for (const opts of h.cacheOpts) {
      expect(opts.revalidate).toBeGreaterThan(0)
      expect(opts.tags).toContain('boundaries')
    }
  })

  it('returns the published order: activeHomes desc, then label, then slug', async () => {
    const out = await getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' })
    for (let i = 1; i < out.length; i += 1) {
      const a = out[i - 1]!
      const b = out[i]!
      const cmp =
        b.activeHomes - a.activeHomes ||
        a.label.localeCompare(b.label, 'en') ||
        a.slug.localeCompare(b.slug, 'en')
      expect(cmp).toBeLessThanOrEqual(0)
    }
    expect(out[0]!.activeHomes).toBe(12)
    expect(out[out.length - 1]!.activeHomes).toBe(0)
  })

  it('keeps a slug that straddles a page boundary once (first occurrence wins)', async () => {
    // Model a materialized-view refresh between reads: the same slug is served
    // on page 1 and again on page 2 with a different count.
    const dup = { ...h.rows[999]!, geo_slug: 'plat-0999', active_homes: 99 }
    h.rows.push(dup)
    const out = await getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' })
    const hits = out.filter((p) => p.slug === 'plat-0999')
    expect(hits).toHaveLength(1)
    expect(out).toHaveLength(1201)
  })

  it('reads page 0 alone when the total fits in one page', async () => {
    h.rows = fakeRows(49)
    const out = await getCommunitySubdivisions({ geoType: 'neighborhood', geoSlug: 'broken-top' })
    expect(out).toHaveLength(49)
    expect(h.calls).toHaveLength(1)
    expect(h.calls[0]!.range).toEqual([0, 499])
    expect(h.cacheKeys).toEqual([['community-subdivisions-v2', 'neighborhood', 'broken-top', 'page', '0']])
  })

  it('reads page 0 alone when the total is exactly one page', async () => {
    h.rows = fakeRows(500)
    const out = await getCommunitySubdivisions({ geoType: 'city', geoSlug: 'redmond' })
    expect(out).toHaveLength(500)
    expect(h.calls).toHaveLength(1)
  })

  it('an RPC error rejects, so the failure is never cached', async () => {
    h.error = { message: 'statement timeout' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' })).rejects.toThrow(
      /community_subdivisions RPC failed for city\/bend page 0/,
    )
    spy.mockRestore()
  })

  it('a row with unparsable geometry is dropped without shortening the page count', async () => {
    h.rows[1100] = { ...h.rows[1100]!, geojson: '{not json' }
    h.rows[10] = { ...h.rows[10]!, geojson: JSON.stringify({ type: 'LineString', coordinates: [] }) }
    const out = await getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' })
    expect(out).toHaveLength(1199)
    expect(h.calls).toHaveLength(3)
  })

  it('walks pages until a short one when PostgREST withholds the count', async () => {
    h.count = null
    const out = await getCommunitySubdivisions({ geoType: 'city', geoSlug: 'bend' })
    expect(out).toHaveLength(1201)
    expect(h.calls.map((c) => c.range)).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ])
  })
})
