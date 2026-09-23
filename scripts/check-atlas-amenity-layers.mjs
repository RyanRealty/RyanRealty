#!/usr/bin/env node
/**
 * check-atlas-amenity-layers.mjs (ci:atlas-amenity-layers) — SITE-128 craft #2
 *
 * Place homes Atlas must paint recorded park polygons + trail lines, never
 * invented OSM corridors, and never a Google-blue tile on V3Atlas. Destination
 * park / trail pages stay on their own PlaceFieldMap.
 */
import { readFileSync } from 'node:fs'

const ATLAS = 'components/site/v3/V3Atlas.client.tsx'
const CSS = 'components/site/v3/V3Atlas.css'
const DAL = 'lib/data/places/getPlaceAmenityLayers.ts'
const LAYERS = 'lib/atlas/place-amenity-layers.ts'
const PLACE_PAGES = [
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/communities/[slug]/page.tsx',
  'app/subdivisions/[slug]/page.tsx',
]
const DESTINATION = ['app/parks/[slug]/page.tsx', 'app/central-oregon/trails/[slug]/page.tsx']

const failures = []

function read(rel) {
  return readFileSync(rel, 'utf8')
}

const atlas = read(ATLAS)
for (const needle of [
  'amenities',
  'data-atlas-amenity-layer',
  'data-atlas-amenity="park"',
  'data-atlas-amenity="trail"',
  'v3-atlas__amenity-park',
  'v3-atlas__amenity-trail',
  'lineStringParts',
]) {
  if (!atlas.includes(needle)) failures.push(`${ATLAS} must keep ${needle}`)
}

const css = read(CSS)
if (!css.includes('.v3-atlas__amenity-park') || !css.includes('.v3-atlas__amenity-trail')) {
  failures.push(`${CSS} must paint amenity park polygons and trail lines`)
}
if (!css.includes('var(--v3-navy)')) {
  failures.push(`${CSS} must stay on-brand navy`)
}
const amenityCss = css.slice(css.indexOf('.v3-atlas__amenity-park'))
if (/#4285|#1a73e8|rgb\(\s*66\s*,\s*133\s*,\s*244/i.test(amenityCss)) {
  failures.push(`${CSS} amenity paint must not use map-tile blue`)
}

const dal = read(DAL)
if (!dal.includes('getParkBoundaryGeoJSON') || !dal.includes('getTrailLineGeoJSON')) {
  failures.push(`${DAL} must wire the existing park / trail RPCs`)
}
if (/overpass|openstreetmap|\bosm\b/i.test(dal) || /overpass|openstreetmap|\bosm\b/i.test(read(LAYERS))) {
  failures.push('amenity layers must not invent OSM geometry')
}

for (const page of PLACE_PAGES) {
  const src = read(page)
  if (!src.includes('getPlaceAmenityLayers')) {
    failures.push(`${page} must fetch getPlaceAmenityLayers`)
  }
  // UXLIVE-3 (visibility audit 2026-09-22): a page may hand the layers
  // through deferredAtlasProps, which ships the same recorded parks and
  // trails at the precision the frame can draw; either wiring counts.
  const direct = src.includes('amenities={amenityLayers}')
  const deferred =
    /deferredAtlasProps\(\{[\s\S]*?amenities:\s*amenityLayers[\s\S]*?\}\)/.test(src) &&
    src.includes('amenities={atlasProps.amenities}')
  if (!direct && !deferred) {
    failures.push(`${page} must pass amenities={amenityLayers} (or deferredAtlasProps' amenities) to V3Atlas`)
  }
}

const communityAmenity = read('app/communities/[slug]/page.tsx')
const communityCallAt = communityAmenity.indexOf('getPlaceAmenityLayers({')
const communityFetch = communityCallAt >= 0 ? communityAmenity.slice(communityCallAt, communityCallAt + 420) : ''
if (!communityFetch.includes("grain: 'community'") || !/citySlug:\s*citySlug/.test(communityFetch)) {
  failures.push('community Atlas must fetch amenity layers at community grain with citySlug')
}

const subdivisionAmenity = read('app/subdivisions/[slug]/page.tsx')
const subdivisionCallAt = subdivisionAmenity.indexOf('getPlaceAmenityLayers({')
const subdivisionFetch =
  subdivisionCallAt >= 0 ? subdivisionAmenity.slice(subdivisionCallAt, subdivisionCallAt + 420) : ''
if (
  !subdivisionFetch.includes("grain: 'subdivision'") ||
  !/communitySlug:\s*resortSlug/.test(subdivisionFetch)
) {
  failures.push('subdivision Atlas must fetch amenity layers at subdivision grain with communitySlug')
}

if (!read(LAYERS).includes('amenityGeomTouchesPlace')) {
  failures.push(`${LAYERS} must keep official amenity geom against the recorded place ring`)
}

for (const page of DESTINATION) {
  const src = read(page)
  if (!src.includes('PlaceFieldMap')) {
    failures.push(`${page} must keep PlaceFieldMap (do not twin the destination map)`)
  }
  if (src.includes('getPlaceAmenityLayers')) {
    failures.push(`${page} must stay off the homes Atlas amenity fetch`)
  }
}

if (failures.length) {
  console.error('ci:atlas-amenity-layers FAILED\n')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}
console.log(
  'ci:atlas-amenity-layers OK — recorded park polys + trail lines on four place Atlases; community/subdivision grain wired; destinations untouched',
)
