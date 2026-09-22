#!/usr/bin/env node
/**
 * check-atlas-price-pins.mjs (ci:atlas-price-pins) — SITE-127
 *
 * Place Atlas maps used to draw silent dots. Matt 2026-09-17: every for-sale
 * (and pending) mark on a city / neighborhood / community / subdivision map
 * must read as a short price ($795k / $1.2M) and hover must blow up the home
 * (photo + ask). This gate runs the pin formatter and asserts the primitive
 * plus the four place pages still wire it. Look/Split fold pills and place
 * listing cards must use the same $795k / $1.2M face (SITE-139). SITE-128 residual: overlapping
 * pills must cluster (clusterAtlasPins grid cells) so a city fold is not
 * one 759 pile and not one 759 bubble.
 * Silent dots cannot regress.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const CONTRACT = 'lib/atlas/pin-price.ts'
const CLUSTER = 'lib/atlas/cluster-pins.ts'
const ATLAS = 'components/site/v3/V3Atlas.client.tsx'
const BUILDER = 'lib/atlas/build-place-atlas.ts'
const TILES = 'lib/data/listings/getAtlasTiles.ts'
const MARKERS = 'lib/maps/markers.ts'
const SEARCH_MAP = 'components/SearchMapClustered.tsx'
const PLACE_LOOK_MAP = 'components/site/v3/V3PlaceLookMap.client.tsx'
const PLACE_PAGES = [
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/communities/[slug]/page.tsx',
  'app/subdivisions/[slug]/page.tsx',
]
const FOLD_PAGES = [
  'app/cities/[slug]/page.tsx',
]

const failures = []

const source = readFileSync(CONTRACT, 'utf8')
if (/^\s*import\s/m.test(source)) {
  failures.push(`${CONTRACT} must stay import-free — this gate transpiles and executes it.`)
}
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const { formatAtlasPinPrice, formatAtlasClusterPin, atlasClusterAskSpan, atlasPinShouldPaint } = mod

function expect(label, actual, wanted) {
  if (!Object.is(actual, wanted)) {
    failures.push(`contract: ${label} — got ${JSON.stringify(actual)}, want ${JSON.stringify(wanted)}`)
  }
}

expect('$735k', formatAtlasPinPrice(735_000), '$735k')
expect('$795k', formatAtlasPinPrice(795_000), '$795k')
expect('$650k', formatAtlasPinPrice(650_000), '$650k')
expect('$1.2M', formatAtlasPinPrice(1_200_000), '$1.2M')
expect('$1.5M', formatAtlasPinPrice(1_500_000), '$1.5M')
expect('$1M', formatAtlasPinPrice(1_000_000), '$1M')
expect('cluster same ask', formatAtlasClusterPin(735_000, 735_400), '$735k')
expect('cluster span', formatAtlasClusterPin(735_000, 1_500_000), '$735k+')
expect('token $1.32 is not $0k', formatAtlasPinPrice(1.32), '')
expect('token $3k is not a pin', formatAtlasPinPrice(3_000), '')
expect('never $0k+', formatAtlasClusterPin(1.32, 5_285_000), '')
expect('real NC span', formatAtlasClusterPin(185_000, 5_285_000), '$185k+')
expect(
  'cluster span skips tokens',
  JSON.stringify(atlasClusterAskSpan([1.32, 3_000, 185_000, 5_285_000])),
  JSON.stringify({ min: 185_000, max: 5_285_000 }),
)
expect('active paints', atlasPinShouldPaint({ s: 'active', p: 735_000 }), true)
expect('sold silent', atlasPinShouldPaint({ s: 'sold', p: 735_000 }), false)
expect('token does not paint', atlasPinShouldPaint({ s: 'active', p: 1.32 }), false)

const clusterSrc = readFileSync(CLUSTER, 'utf8')
if (/^\s*import\s/m.test(clusterSrc)) {
  failures.push(`${CLUSTER} must stay import-free — this gate transpiles and executes it.`)
}
const clusterJs = ts.transpileModule(clusterSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const clusterMod = await import(`data:text/javascript;base64,${Buffer.from(clusterJs).toString('base64')}`)
const { clusterAtlasPins } = clusterMod
const piled = clusterAtlasPins(
  [
    { i: 0, x: 100, y: 100 },
    { i: 1, x: 108, y: 104 },
    { i: 2, x: 400, y: 300 },
  ],
  40,
)
expect('pile collapses', piled.length, 2)
expect('pile count', piled[0]?.count, 2)
expect('spaced pin stays', piled[1]?.count, 1)

const atlas = readFileSync(ATLAS, 'utf8')
for (const needle of [
  'formatAtlasPinPrice',
  'formatAtlasClusterPin',
  'atlasClusterAskSpan',
  'atlasPinShouldPaint',
  'clusterAtlasPins',
  'v3-atlas__pin',
  'data-atlas-pin-price',
  'data-atlas-cluster',
  'data-atlas-cluster-price',
  'data-atlas-pin-layer',
  'v3-atlas__home',
  'data-atlas-home',
  'v3-atlas__home-photo',
]) {
  if (!atlas.includes(needle)) failures.push(`${ATLAS} must keep ${needle} (silent dots regress)`)
}
if (/>\s*\{mark\.count\}\s*</.test(atlas)) {
  failures.push(`${ATLAS}: cluster pills must print $795k/$1.2M, not a bare count`)
}

const builder = readFileSync(BUILDER, 'utf8')
if (!builder.includes('listingRowPhotoSrc')) {
  failures.push(`${BUILDER} must size a photo onto each AtlasDot for the hover blow-up`)
}
if (!builder.includes('publishCardAddress')) {
  failures.push(`${BUILDER} must publish the card street onto each AtlasDot`)
}

const tiles = readFileSync(TILES, 'utf8')
for (const col of ['photo_url', 'beds', 'baths', 'sqft', 'street_suffix']) {
  if (!tiles.includes(col)) failures.push(`${TILES} must read ${col} for the hover card`)
}
if (tiles.includes('details->>StreetSuffix') || /StreetSuffix(?!:)/.test(tiles)) {
  failures.push(
    `${TILES} must not read listings.StreetSuffix — the column is not first-class; sold heat does not need a suffix`,
  )
}

for (const page of PLACE_PAGES) {
  const src = readFileSync(page, 'utf8')
  // Community and neighborhood mount the same Atlas through PlaceSubdivisionAtlas.
  if (!src.includes('<V3Atlas') && !src.includes('<PlaceSubdivisionAtlas')) {
    failures.push(`${page} must still mount V3Atlas so place maps share the price pins`)
  }
}

const cityPage = readFileSync('app/cities/[slug]/page.tsx', 'utf8')
for (const needle of [
  'clusterPins',
  'ATLAS_PIN_CLUSTER_CELL_PX',
  'CITY_FOLD_CLUSTER_STAGE',
  'CITY_FOLD_CLUSTER_STAGE_PHONE',
  'clusterStageHintPhone',
]) {
  if (!cityPage.includes(needle)) {
    failures.push(`app/cities/[slug]/page.tsx must pass ${needle} so the city fold, not only the lib, drives clusters`)
  }
}
for (const needle of [
  'CITY_FOLD_CLUSTER_STAGE',
  'CITY_FOLD_CLUSTER_STAGE_PHONE',
  'pickCityFoldClusterStage',
  'projectPinsToFoldStage',
  'floorCityFoldPaintView',
]) {
  if (!clusterSrc.includes(needle)) {
    failures.push(`${CLUSTER} must export ${needle} so desktop/phone fold stages stay locked`)
  }
}
if (!atlas.includes('projectPinsToFoldStage')) {
  failures.push(`${ATLAS} must cluster city-fold pins on the locked fold stage, not live GBR`)
}

const markers = readFileSync(MARKERS, 'utf8')
if (!markers.includes('formatAtlasPinPrice')) {
  failures.push(`${MARKERS} must delegate formatPriceLabel to formatAtlasPinPrice (fold $ vs K mix)`)
}
if (/toFixed\(0\)\}k/.test(markers) || markers.includes('"$895k"') || /return `\$\$\{price\}`/.test(markers)) {
  failures.push(`${MARKERS}: formatPriceLabel must delegate to formatAtlasPinPrice ($795k / $1.2M)`)
}

const searchMap = readFileSync(SEARCH_MAP, 'utf8')
for (const needle of ['formatAtlasPinPrice', 'formatAtlasClusterRange']) {
  if (!searchMap.includes(needle)) {
    failures.push(`${SEARCH_MAP} must use ${needle} so Look/Split fold pills match Atlas`)
  }
}
if (/formatPriceLabel\(/.test(searchMap)) {
  failures.push(`${SEARCH_MAP} must print formatAtlasPinPrice, not the old $895k formatPriceLabel path`)
}

const lookMap = readFileSync(PLACE_LOOK_MAP, 'utf8')
if (!lookMap.includes('SearchMapClustered')) {
  failures.push(`${PLACE_LOOK_MAP} must keep SearchMapClustered so city/neighborhood fold pills stay wired`)
}

for (const page of FOLD_PAGES) {
  const src = readFileSync(page, 'utf8')
  if (!src.includes('<V3PlaceLook')) {
    failures.push(`${page} must still mount V3PlaceLook so the fold map shares Atlas pin language`)
  }
}

const ASK = 'lib/listing/publish-listing-ask.ts'
const askSrc = readFileSync(ASK, 'utf8')
if (!askSrc.includes('formatAtlasPinPrice')) {
  failures.push(`${ASK} must print compact cards through formatAtlasPinPrice`)
}
if (!askSrc.includes('export function formatPublishedSaleAskCompact')) {
  failures.push(`${ASK} must export formatPublishedSaleAskCompact so cards share the chip face`)
}

const CARD_FILES = [
  'lib/place/first-look.ts',
  'lib/data/listings/getPlaceOpeningListings.ts',
  'app/zip/[zip]/_v3/zip-constants.ts',
]
for (const file of CARD_FILES) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes('formatPublishedSaleAskCompact')) {
    failures.push(`${file} must print listing-card asks through formatPublishedSaleAskCompact`)
  }
  if (/formatPriceCompact\(/.test(src) && /formatPriceCompact\([\s\S]*listPrice/.test(src)) {
    failures.push(`${file} must not format a listing ask through formatPriceCompact`)
  }
}

if (failures.length) {
  console.error('ci:atlas-price-pins FAILED\n')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}
console.log('ci:atlas-price-pins OK — pins $795k/$1.2M, hover home, clusters, fold + cards share pin face')
