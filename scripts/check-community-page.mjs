#!/usr/bin/env node
/**
 * G32 — Community page completeness gate.
 *
 * Enforces D89–D92 (2026-05-29): the community detail page at
 * app/communities/[slug]/page.tsx MUST import and use all four required
 * elements for a complete resort-community page:
 *
 *   D89 — communityImage (photo resolver) from @/lib/geo-images
 *   D90 — OpenHousesGrid (open-houses section)
 *   D91 — ListingCard (homes-for-sale card grid)
 *   D92 — getGeoBoundaryMapData (polygon-fit boundary map — also enforced by G31)
 *
 * The page is the single canonical place for resort-community pages.
 * Importing these ensures:
 *   - Photos resolve via the full communityImage() resolver (not golfCommunityImage
 *     alone, which only covers 7/14 communities).
 *   - An open-houses section is always present.
 *   - Listing cards are rendered so buyers see the actual homes.
 *   - The boundary map fits the polygon, not arbitrary listing pins.
 *
 * Model on scripts/check-boundary-map.mjs (G31).
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const PAGE = 'app/communities/[slug]/page.tsx'
const errors = []

const abs = join(ROOT, PAGE)
if (!existsSync(abs)) {
  errors.push(`${PAGE}: file not found. The community detail page must exist.`)
} else {
  const src = readFileSync(abs, 'utf8')

  // D89 — communityImage resolver
  const hasCommunityImage =
    src.includes('communityImage') &&
    /(^|\n)\s*import[^;]+communityImage/.test(src)
  if (!hasCommunityImage) {
    errors.push(
      `${PAGE}: missing import of \`communityImage\` from \`@/lib/geo-images\`.\n` +
      `  D89: community pages MUST resolve hero + tile photos via communityImage(slug),\n` +
      `  which covers all 14 resort communities (including the 7 without golf-LP photos).\n` +
      `  See lib/geo-images.ts for the full resolver and docs/DESIGN_DIRECTIVES.md D89.`
    )
  }

  // D90 — OpenHousesGrid
  const hasOpenHousesGrid =
    src.includes('OpenHousesGrid') &&
    /(^|\n)\s*import[^;]+OpenHousesGrid/.test(src)
  if (!hasOpenHousesGrid) {
    errors.push(
      `${PAGE}: missing import of \`OpenHousesGrid\`.\n` +
      `  D90: community pages MUST render an open-houses section so buyers see\n` +
      `  upcoming events in the area. Use <OpenHousesGrid city={cityName} daysAhead={14} />.\n` +
      `  See docs/DESIGN_DIRECTIVES.md D90.`
    )
  }

  // D91 — ListingCard
  const hasListingCard =
    src.includes('ListingCard') &&
    /(^|\n)\s*import[^;]+ListingCard/.test(src)
  if (!hasListingCard) {
    errors.push(
      `${PAGE}: missing import of \`ListingCard\`.\n` +
      `  D91: community pages MUST render listing cards (photo, price, beds/baths/sqft, link)\n` +
      `  for the active homes within the community boundary.\n` +
      `  Use getListingTiles({ listingKeys }) fed by the boundary pins.\n` +
      `  See docs/DESIGN_DIRECTIVES.md D91.`
    )
  }

  // D92 — getGeoBoundaryMapData (overlap with G31, belt-and-suspenders here)
  const hasBoundaryMapData =
    src.includes('getGeoBoundaryMapData') &&
    /(^|\n)\s*import[^;]+getGeoBoundaryMapData/.test(src)
  if (!hasBoundaryMapData) {
    errors.push(
      `${PAGE}: missing import of \`getGeoBoundaryMapData\` from \`@/lib/data\`.\n` +
      `  D92/D88: the boundary map MUST use the shared DAL so the polygon fits correctly.\n` +
      `  See docs/DESIGN_DIRECTIVES.md D88/D92 and lib/data/geo/getGeoBoundaryMapData.ts.`
    )
  }

  // D94 — getCommunitySubdivisions (subdivisions-within section + broken-out map polygons)
  const hasCommunitySubdivisions =
    src.includes('getCommunitySubdivisions') &&
    /(^|\n)\s*import[^;]+getCommunitySubdivisions/.test(src)
  if (!hasCommunitySubdivisions) {
    errors.push(
      `${PAGE}: missing import of \`getCommunitySubdivisions\` from \`@/lib/data\`.\n` +
      `  D94: community pages MUST source their child GIS subdivision plats via the\n` +
      `  gated community_subdivisions RPC (DAL: getCommunitySubdivisions) — never an\n` +
      `  ad-hoc boundaries query — to render the "Subdivisions within" section AND the\n` +
      `  broken-out subdivision polygons on the map. See docs/DESIGN_DIRECTIVES.md D94.`
    )
  }

  // D95 — getResortCommunityContent (resort-LP-level rich content)
  const hasResortContent =
    src.includes('getResortCommunityContent') &&
    /(^|\n)\s*import[^;]+getResortCommunityContent/.test(src)
  if (!hasResortContent) {
    errors.push(
      `${PAGE}: missing import of \`getResortCommunityContent\` from \`@/lib/resort-community-content\`.\n` +
      `  D95: community pages MUST surface resort-LP-level depth (overview prose, at-a-glance\n` +
      `  facts, drive times, amenities) from data/resort-community-[slug].json when a verified\n` +
      `  config exists. The loader returns null otherwise so the page never shows invented\n` +
      `  facts. See docs/DESIGN_DIRECTIVES.md D95.`
    )
  }
}

if (errors.length) {
  console.error('\nG32 community-page gate FAILED:\n')
  for (const e of errors) console.error('  - ' + e + '\n')
  process.exit(1)
}

console.log('G32 community-page gate passed (all 6 required imports present).')
