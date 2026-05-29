#!/usr/bin/env node
/**
 * G31 — Boundary-map shared DAL gate.
 *
 * Enforces D88 (2026-05-28): every page that renders <NeighborhoodMap> or
 * <SiteNeighborhoodMap> MUST import getGeoBoundaryMapData from @/lib/data.
 *
 * This is the "same data path for every page type" requirement. The shared
 * DAL uses the listings_in_boundary PostGIS RPC so pins are spatially correct
 * on every surface (city / neighborhood / community). Ad-hoc polygon + pin
 * fetches (getBoundaryGeoJSON + getCityListings separately, or
 * getNeighborhoodListingsDAL with the wrong filter column) are banned.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

const GEO_PAGES = [
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/communities/[slug]/page.tsx',
]

const DAL_FN = 'getGeoBoundaryMapData'
const MAP_COMPONENTS = ['<NeighborhoodMap', '<SiteNeighborhoodMap']

const errors = []

for (const relPath of GEO_PAGES) {
  const abs = join(ROOT, relPath)
  if (!existsSync(abs)) continue
  const src = readFileSync(abs, 'utf8')

  const rendersMap = MAP_COMPONENTS.some((c) => src.includes(c))
  const importsSharedDAL =
    src.includes(DAL_FN) &&
    /(^|\n)\s*import[^;]+getGeoBoundaryMapData/.test(src)

  if (rendersMap && !importsSharedDAL) {
    errors.push(
      relPath + ': renders <NeighborhoodMap> but does NOT import `getGeoBoundaryMapData`.\n' +
      '  Every geo page that renders the boundary-map block MUST use the shared DAL.\n' +
      '  See D88 in docs/DESIGN_DIRECTIVES.md and lib/data/geo/getGeoBoundaryMapData.ts.'
    )
  }
}

if (errors.length) {
  console.error('\nG31 boundary-map gate FAILED:\n')
  for (const e of errors) console.error('  - ' + e + '\n')
  process.exit(1)
}

console.log('G31 boundary-map gate passed (' + GEO_PAGES.length + ' geo pages checked).')
