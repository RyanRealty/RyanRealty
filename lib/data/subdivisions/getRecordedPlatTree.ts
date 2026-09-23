/**
 * getRecordedPlatTree — every recorded plat's slug, county label and the city
 * the county boundary tree places it in, plus the slugs that already name a
 * city or a neighborhood (visibility audit 2026-09-22, SEO-7 / EXP-3).
 *
 * SOURCE. public.boundaries, geo_type in ('subdivision', 'neighborhood',
 * 'city'): 3,427 plats, 28 neighborhood polygons and 11 city polygons as of
 * 2026-09-23. No geometry is read: slug, label and parent_id only. A plat's
 * city is found by walking parent_id (plat -> neighborhood -> city), the same
 * walk getPlatBoundaryCity makes for one plat, done here once for all of them
 * in memory. A plat with no chain to a city answers '' and the caller falls
 * back to the city its sales were filed under.
 *
 * SERVICE client: public.boundaries hides subdivision rows from anon through
 * RLS. The output is non-sensitive (slugs and the county's own labels).
 *
 * Cached 6h. Throws on a failed or empty read so makeResilientCached never
 * caches "no plats" for the window.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type RecordedPlat = {
  slug: string
  label: string
  /** City slug from the county boundary tree, '' when the chain reaches none. */
  treeCitySlug: string
}

export type RecordedPlatTree = {
  plats: RecordedPlat[]
  /** geo_slug of every geo_type='city' row. */
  citySlugs: string[]
  /** geo_slug of every geo_type='neighborhood' row (Bend districts and resort polygons). */
  neighborhoodSlugs: string[]
}

type TreeRow = {
  id?: string | null
  geo_type?: string | null
  geo_slug?: string | null
  geo_label?: string | null
  parent_id?: string | null
}

const MAX_HOPS = 4

/** Pure: resolve each plat's city through the parent chain. Exported for the test. */
export function buildRecordedPlatTree(rows: readonly TreeRow[]): RecordedPlatTree {
  const byId = new Map<string, TreeRow>()
  for (const row of rows) if (row.id) byId.set(row.id, row)

  const cityOf = (row: TreeRow): string => {
    let cur: TreeRow | undefined = row
    for (let hop = 0; hop <= MAX_HOPS && cur; hop += 1) {
      if (cur.geo_type === 'city') return (cur.geo_slug ?? '').trim()
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return ''
  }

  const plats: RecordedPlat[] = []
  const citySlugs = new Set<string>()
  const neighborhoodSlugs = new Set<string>()
  const seen = new Set<string>()
  for (const row of rows) {
    const slug = (row.geo_slug ?? '').trim()
    if (!slug) continue
    if (row.geo_type === 'city') citySlugs.add(slug)
    else if (row.geo_type === 'neighborhood') neighborhoodSlugs.add(slug)
    else if (row.geo_type === 'subdivision') {
      if (seen.has(slug)) continue
      seen.add(slug)
      plats.push({ slug, label: (row.geo_label ?? '').trim() || slug, treeCitySlug: cityOf(row) })
    }
  }
  plats.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  return {
    plats,
    citySlugs: [...citySlugs].sort(),
    neighborhoodSlugs: [...neighborhoodSlugs].sort(),
  }
}

async function fetchRecordedPlatTree(): Promise<RecordedPlatTree> {
  const supabase = createServiceClient()
  // id is the table's primary key, so ordering by it is a total order and the
  // range pages can neither skip nor repeat a row (G48 / ci:row-cap).
  const { rows, error } = await fetchPagedRows<TreeRow>((from, to) =>
    supabase
      .from('boundaries')
      .select('id,geo_type,geo_slug,geo_label,parent_id')
      .in('geo_type', ['subdivision', 'neighborhood', 'city'])
      .order('id', { ascending: true })
      .range(from, to),
  )
  if (error) throw new Error(`getRecordedPlatTree: boundaries read failed: ${error.message}`)
  const tree = buildRecordedPlatTree(rows)
  if (tree.plats.length === 0) {
    throw new Error('getRecordedPlatTree: boundaries returned 0 subdivision rows')
  }
  return tree
}

export const getRecordedPlatTree = makeResilientCached(
  fetchRecordedPlatTree,
  ['recorded-plat-tree-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market, 'boundaries'] },
  { plats: [], citySlugs: [], neighborhoodSlugs: [] } as RecordedPlatTree,
)
