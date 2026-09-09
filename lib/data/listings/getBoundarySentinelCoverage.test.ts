/**
 * SITE-23 regression guards.
 *
 * Two things were wrong, and neither had a mechanism holding it:
 *
 *   1. `boundaries` held no polygon for Powell Butte at any geo_type, so every
 *      home there — Brasada Ranch, a registry resort community with its own
 *      /communities page, included — classified as outside every polygon and
 *      took the 'Outside Boundaries' sentinel in listings.boundary_city.
 *      That one is now held mechanically by ci:boundary-provenance, whose
 *      `city` floor was raised to 11 in the same change so deleting the row
 *      again turns the build red.
 *
 *   2. refresh_listing_boundary_tags() batched on `boundary_city IS NULL`, so a
 *      row that had already taken the sentinel was never looked at again. A
 *      polygon added LATER could not reach the homes it covered — which is
 *      exactly what happened: the Brasada Ranch polygon was re-sourced on
 *      2026-08-26 and 114 Brasada listings kept the sentinel and a NULL
 *      boundary_neighborhood while their points sat inside it.
 *
 * (2) is the one a test has to hold, because it is a single WHERE clause and it
 * reads as a deliberate optimisation. So this reads the migration and pins the
 * re-eligibility clause. Text assertions on SQL are the pattern already used in
 * lib/data/market-truth/city-segments.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { BOUNDARY_CITY_SENTINEL } from './getBoundarySentinelCoverage'

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20260908210000_powell_butte_city_boundary_and_sentinel_reclassify.sql'
)
const SQL = readFileSync(MIGRATION, 'utf8')

describe('SITE-23 — the boundary classifier reaches homes a later polygon covers', () => {
  it('names the sentinel with the exact string the classifier writes', () => {
    // lib/slug.ts and app/listing/[listingKey]/listing-json-ld.ts both refuse
    // this string as a URL segment by matching /^outside[\s-]*boundaries$/i.
    // If the classifier ever wrote a different string, those refusals would
    // stop matching and the sentinel would go out in a canonical again.
    expect(BOUNDARY_CITY_SENTINEL).toBe('Outside Boundaries')
    expect(SQL).toContain("coalesce(p.city, 'Outside Boundaries')")
  })

  it('adds the Powell Butte polygon from an authoritative Census layer, not a drawn one', () => {
    expect(SQL).toContain("'powell-butte'")
    expect(SQL).toContain('GEOID=4101392550')
    expect(SQL).toContain('TIGER/Line 2024 County Subdivisions')
    expect(SQL).toContain('tigerweb.geo.census.gov')
    // ST_GeomFromGeoJSON of verbatim TIGER geometry at 4326, cast to the
    // MultiPolygon the column holds. A hull, a buffer or a hand-typed ring
    // would not look like this (feedback_gis_authoritative_only).
    expect(SQL).toContain('ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(')
  })

  it('re-examines a sentinel row when the boundary set has gained a row since it was tagged', () => {
    // The batch filter. `boundary_city IS NULL` alone is the bug: it freezes a
    // sentinel row forever. The OR branch below is what unfreezes it, and
    // boundary_tagged_at is what keeps that from being an infinite retry — the
    // concern the original migration named.
    expect(SQL).toMatch(/l\.boundary_city IS NULL\s*\n\s*--[^\n]*\n\s*OR \(/)
    expect(SQL).toContain("l.boundary_city = 'Outside Boundaries'")
    expect(SQL).toContain('l.boundary_tagged_at IS NULL OR l.boundary_tagged_at < v_boundaries_at')
    expect(SQL).toContain('boundary_tagged_at = now()')
  })

  it('reads the newest boundary row without an aggregate over a stat table', () => {
    // ORDER BY ... LIMIT 1 rather than max(imported_at): same answer, and the
    // stat-source rule (CLAUDE.md §7.6) is about the shape as much as the
    // intent.
    expect(SQL).toContain('SELECT imported_at INTO v_boundaries_at')
    expect(SQL).toMatch(/ORDER BY imported_at DESC\s*\n\s*LIMIT 1;/)
    expect(SQL).not.toMatch(/max\(imported_at\)/)
  })

  it('backfills every status, because off-market listing URLs stay indexed', () => {
    // SITE-21's ruling. Several of the 45 sentinel URLs Search Console holds
    // for Brasada Ranch are Expired or Canceled; the RPC is Active-only, so the
    // one-time backfill is what reaches them. If it ever grew a status filter,
    // those rows would keep the sentinel.
    const backfill = SQL.slice(SQL.indexOf('-- 3 ---'))
    expect(backfill).toContain("WHERE s.boundary_city = 'Outside Boundaries'")
    expect(backfill).not.toContain('StandardStatus')
  })
})
