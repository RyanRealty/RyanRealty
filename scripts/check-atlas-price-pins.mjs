#!/usr/bin/env node
/**
 * check-atlas-price-pins.mjs (ci:atlas-price-pins) — SITE-127
 *
 * Place Atlas maps used to draw silent dots. Matt 2026-09-17: every for-sale
 * (and pending) mark on a city / neighborhood / community / subdivision map
 * must read as a short price (735K / $1.5M) and hover must blow up the home
 * (photo + ask). This gate runs the pin formatter and asserts the primitive
 * plus the four place pages still wire it. SITE-128 residual: overlapping
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
const PLACE_PAGES = [
  'app/cities/[slug]/page.tsx',
  'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
  'app/communities/[slug]/page.tsx',
  'app/subdivisions/[slug]/page.tsx',
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
const { formatAtlasPinPrice, atlasPinShouldPaint } = mod

function expect(label, actual, wanted) {
  if (!Object.is(actual, wanted)) {
    failures.push(`contract: ${label} — got ${JSON.stringify(actual)}, want ${JSON.stringify(wanted)}`)
  }
}

expect('735K', formatAtlasPinPrice(735_000), '735K')
expect('$1.5M', formatAtlasPinPrice(1_500_000), '$1.5M')
expect('$1M', formatAtlasPinPrice(1_000_000), '$1M')
expect('active paints', atlasPinShouldPaint({ s: 'active', p: 735_000 }), true)
expect('sold silent', atlasPinShouldPaint({ s: 'sold', p: 735_000 }), false)

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
  'atlasPinShouldPaint',
  'clusterAtlasPins',
  'v3-atlas__pin',
  'data-atlas-pin-price',
  'data-atlas-cluster',
  'data-atlas-pin-layer',
  'v3-atlas__home',
  'data-atlas-home',
  'v3-atlas__home-photo',
]) {
  if (!atlas.includes(needle)) failures.push(`${ATLAS} must keep ${needle} (silent dots regress)`)
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
  if (!src.includes('<V3Atlas')) {
    failures.push(`${page} must still mount V3Atlas so place maps share the price pins`)
  }
}

const cityPage = readFileSync('app/cities/[slug]/page.tsx', 'utf8')
for (const needle of ['clusterPins', 'ATLAS_PIN_CLUSTER_CELL_PX', 'CITY_FOLD_CLUSTER_STAGE']) {
  if (!cityPage.includes(needle)) {
    failures.push(`app/cities/[slug]/page.tsx must pass ${needle} so the city fold, not only the lib, drives clusters`)
  }
}
if (!clusterSrc.includes('CITY_FOLD_CLUSTER_STAGE')) {
  failures.push(`${CLUSTER} must export CITY_FOLD_CLUSTER_STAGE for the city fold first paint`)
}

if (failures.length) {
  console.error('ci:atlas-price-pins FAILED\n')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}
console.log('ci:atlas-price-pins OK — pins 735K/$1.5M, hover home, clusters, four place pages wired')
