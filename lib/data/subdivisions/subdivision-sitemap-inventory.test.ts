/**
 * The counted-row form of the browse-pair aggregator must produce exactly what
 * the per-listing form produced.
 *
 * WHY THIS TEST EXISTS (SITE-54, 2026-09-09). The sitemap used to page every
 * listing_tile_mv row for a city through PostgREST (~129,192 rows for Bend) and
 * hand them to buildSubdivisionSlugsForCity one at a time. That read was the
 * single largest statement-timeout source on the database and it 504'd
 * /sitemaps/geo.xml. The counting moved into
 * public.subdivision_city_inventory_mv, so a row now arrives carrying an `n`.
 *
 * The claim the fix rests on is arithmetic: summing `buckets.length * n` is the
 * same total as adding `buckets.length` once per listing. This test is that
 * claim, checked against the old shape rather than asserted in a comment — it
 * expands each counted row back into n plain rows and requires both forms to
 * return the identical slug set, including at the exact threshold boundary
 * where a one-listing error flips a URL in or out of the sitemap.
 */

import { describe, expect, it } from 'vitest'
import {
  buildSubdivisionSlugsForCity,
  classifyLifetimeBuckets,
  type SubdivisionInventoryRow,
} from './subdivision-sitemap-inventory'

/** The pre-SITE-54 input: one row per listing, no `n`. */
function expand(counted: readonly SubdivisionInventoryRow[]): SubdivisionInventoryRow[] {
  const out: SubdivisionInventoryRow[] = []
  for (const row of counted) {
    const n = row.n ?? 1
    for (let i = 0; i < n; i++) {
      out.push({ subdivision_name: row.subdivision_name, standard_status: row.standard_status })
    }
  }
  return out
}

describe('buildSubdivisionSlugsForCity — counted rows', () => {
  it('a row without n still counts as one listing', () => {
    const rows: SubdivisionInventoryRow[] = [
      { subdivision_name: 'Awbrey Butte', standard_status: 'Active' },
      { subdivision_name: 'Awbrey Butte', standard_status: 'Closed' },
      { subdivision_name: 'Awbrey Butte', standard_status: 'Closed' },
    ]
    expect(buildSubdivisionSlugsForCity(rows, 3)).toEqual(['awbrey-butte'])
    expect(buildSubdivisionSlugsForCity(rows, 4)).toEqual([])
  })

  it('n rows and n expanded rows produce the same slugs', () => {
    const counted: SubdivisionInventoryRow[] = [
      { subdivision_name: 'Awbrey Butte', standard_status: 'Active', n: 4 },
      { subdivision_name: 'Awbrey Butte', standard_status: 'Closed', n: 11 },
      { subdivision_name: 'River Rim', standard_status: 'Closed', n: 2 },
      { subdivision_name: 'Tetherow', standard_status: 'Pending', n: 3 },
      { subdivision_name: 'N/A', standard_status: 'Closed', n: 40 },
    ]
    for (const floor of [1, 2, 3, 4, 15, 16]) {
      expect(buildSubdivisionSlugsForCity(counted, floor).sort()).toEqual(
        buildSubdivisionSlugsForCity(expand(counted), floor).sort(),
      )
    }
  })

  it('is exact at the threshold boundary', () => {
    const counted: SubdivisionInventoryRow[] = [
      { subdivision_name: 'River Rim', standard_status: 'Closed', n: 3 },
    ]
    expect(buildSubdivisionSlugsForCity(counted, 3)).toEqual(['river-rim'])
    expect(buildSubdivisionSlugsForCity(counted, 4)).toEqual([])
  })

  it('a status that lands in two buckets is weighted twice, per listing', () => {
    // classifyLifetimeBuckets is independent FILTERs, exactly like the RPC:
    // 'Pending Closed' hits both. The counted form must double it n times, not
    // once — this is the arithmetic the whole change rests on.
    expect(classifyLifetimeBuckets('Pending Closed')).toEqual(['pending', 'closed'])
    const counted: SubdivisionInventoryRow[] = [
      { subdivision_name: 'River Rim', standard_status: 'Pending Closed', n: 2 },
    ]
    expect(buildSubdivisionSlugsForCity(counted, 4)).toEqual(['river-rim'])
    expect(buildSubdivisionSlugsForCity(counted, 5)).toEqual([])
    expect(buildSubdivisionSlugsForCity(counted, 4)).toEqual(
      buildSubdivisionSlugsForCity(expand(counted), 4),
    )
  })

  it('a zero, missing or negative n means one listing, never zero', () => {
    // The MV never emits these, but a defensive floor of 1 keeps a malformed
    // row counted as the listing it is instead of silently vanishing a URL.
    const rows: SubdivisionInventoryRow[] = [
      { subdivision_name: 'River Rim', standard_status: 'Closed', n: 0 },
      { subdivision_name: 'River Rim', standard_status: 'Closed', n: -5 },
      { subdivision_name: 'River Rim', standard_status: 'Closed' },
    ]
    expect(buildSubdivisionSlugsForCity(rows, 3)).toEqual(['river-rim'])
  })

  it('drops N/A and empty names, and the unknown slug, whatever the count', () => {
    const rows: SubdivisionInventoryRow[] = [
      { subdivision_name: 'N/A', standard_status: 'Closed', n: 999 },
      { subdivision_name: '', standard_status: 'Closed', n: 999 },
      { subdivision_name: '   ', standard_status: 'Closed', n: 999 },
    ]
    expect(buildSubdivisionSlugsForCity(rows, 1)).toEqual([])
  })
})
