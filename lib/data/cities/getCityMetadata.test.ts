import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * SITE-140 regression lock.
 *
 * `communities` holds 1,848+ rows. `getCommunityHeroUrlsBySlug()` used to run
 * `sb.from('communities').select('slug, name, hero_image_url')` with no
 * filter, no order, and no pagination — PostgREST's default 1,000-row page
 * silently truncated the read at an arbitrary point in physical row order.
 * Live-verified against production: `northwest-crossing` sat at index 1097,
 * past the cutoff, so its live hero_image_url never reached the site even
 * though the row had one — and 9 other communities (broken-top,
 * caldera-springs, petrosa, eagle-crest, awbrey-glen, crosswater,
 * black-butte-ranch, brasada-ranch, westgate) were dropped the same way. The
 * fix filters server-side (`.not('hero_image_url', 'is', null)`) so the read
 * is the ~16 rows that actually have a photo, never the whole table.
 */
const from = vi.fn()
vi.mock('@/lib/data/client', () => ({ supabaseAnon: () => ({ from }) }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))

function mockCommunitiesTable(rows: Array<{ slug: string | null; name: string | null; hero_image_url: string | null }>) {
  const notCalls: Array<[string, string, null]> = []
  const builder = {
    select: () => builder,
    not: (col: string, op: string, value: null) => {
      notCalls.push([col, op, value])
      return builder
    },
    then: (resolve: (v: { data: typeof rows }) => void) => resolve({ data: rows }),
  }
  from.mockReturnValue(builder)
  return { notCalls }
}

describe('getCommunityHeroUrlsBySlug', () => {
  beforeEach(() => {
    vi.resetModules()
    from.mockReset()
  })

  it('filters the query to non-null hero_image_url server-side, never a bare unpaginated select', async () => {
    const { notCalls } = mockCommunitiesTable([
      { slug: 'northwest-crossing', name: 'NorthWest Crossing', hero_image_url: 'https://cdn/nwc.png' },
    ])
    const { getCommunityHeroUrlsBySlug } = await import('./getCityMetadata')
    await getCommunityHeroUrlsBySlug()
    // The regression: a select() with no .not()/.order()/.range() relies on
    // PostgREST's implicit 1,000-row page, which is exactly what truncated
    // northwest-crossing (row 1097) off the read.
    expect(notCalls).toEqual([['hero_image_url', 'is', null]])
  })

  it('keys a returned row by both its stored slug and its slugified name', async () => {
    mockCommunitiesTable([
      { slug: 'northwest-crossing', name: 'NorthWest Crossing', hero_image_url: 'https://cdn/nwc.png' },
    ])
    const { getCommunityHeroUrlsBySlug } = await import('./getCityMetadata')
    const out = await getCommunityHeroUrlsBySlug()
    expect(out['northwest-crossing']).toBe('https://cdn/nwc.png')
  })

  it('drops rows with no hero_image_url and rows with no slug or name', async () => {
    mockCommunitiesTable([
      { slug: 'tetherow', name: 'Tetherow', hero_image_url: '  ' },
      { slug: null, name: null, hero_image_url: 'https://cdn/orphan.png' },
    ])
    const { getCommunityHeroUrlsBySlug } = await import('./getCityMetadata')
    const out = await getCommunityHeroUrlsBySlug()
    expect(out).toEqual({})
  })

  it('a null client (no env configured) returns an empty map, not a throw', async () => {
    vi.doMock('@/lib/data/client', () => ({ supabaseAnon: () => null }))
    const { getCommunityHeroUrlsBySlug } = await import('./getCityMetadata')
    expect(await getCommunityHeroUrlsBySlug()).toEqual({})
  })
})
