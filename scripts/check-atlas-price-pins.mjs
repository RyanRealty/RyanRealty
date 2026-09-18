#!/usr/bin/env node
/**
 * check-atlas-price-pins.mjs (ci:atlas-price-pins) — SITE-127
 *
 * Place Atlas maps used to draw silent dots. Matt 2026-09-17: every for-sale
 * (and pending) mark on a city / neighborhood / community / subdivision map
 * must read as a short price (735K / $1.5M) and hover must blow up the home
 * (photo + ask). This gate runs the pin formatter and asserts the primitive
 * plus the four place pages still wire it. Silent dots cannot regress.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const CONTRACT = 'lib/atlas/pin-price.ts'
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

const atlas = readFileSync(ATLAS, 'utf8')
for (const needle of [
  'formatAtlasPinPrice',
  'atlasPinShouldPaint',
  'v3-atlas__pin',
  'data-atlas-pin-price',
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
if (!tiles.includes('StreetSuffix:details->>StreetSuffix')) {
  failures.push(
    `${TILES} closed walk must alias StreetSuffix from details — listings has no StreetSuffix column`,
  )
}

for (const page of PLACE_PAGES) {
  const src = readFileSync(page, 'utf8')
  if (!src.includes('<V3Atlas')) {
    failures.push(`${page} must still mount V3Atlas so place maps share the price pins`)
  }
}

if (failures.length) {
  console.error('ci:atlas-price-pins FAILED\n')
  for (const f of failures) console.error(`  • ${f}`)
  process.exit(1)
}
console.log('ci:atlas-price-pins OK — pins 735K/$1.5M, hover home, four place pages wired')
