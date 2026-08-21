#!/usr/bin/env node
/**
 * Median geography-caption lock.
 *
 * A published list median must be labeled with the geography of the number.
 * "Regional median" is only honest for the region pulse. KbSell withholds a
 * price that has no caption.
 * Founding case: /communities/tetherow printed $1,499,000 as Regional median
 * (fleet 5f0ec58d60988a52e76b8a559ef22f0c).
 *
 *   node scripts/check-publish-median-caption.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-median-caption.ts')
checks.push({
  label: 'publishSellMedian pairs a place number with a place caption',
  ok:
    /export function publishSellMedian/.test(helper) &&
    /export function medianCaptionForGrain/.test(helper) &&
    helper.includes("caption: 'Regional median'") &&
    helper.includes('medianCaptionForGrain(input.grain, input.placeName)'),
})

const sell = src('components/site/kb/KbSell.client.tsx')
checks.push({
  label: 'KbSell withholds a median that has no geography caption',
  ok:
    /medianCaption \? kbMoneyFull/.test(sell) &&
    !sell.includes('Regional median'),
})

const surfaces = [
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community page gates KbSell median through publishSellMedian',
  },
  {
    path: 'app/cities/[slug]/page.tsx',
    label: 'city page gates KbSell median through publishSellMedian',
  },
  {
    path: 'app/zip/[zip]/page.tsx',
    label: 'ZIP page gates KbSell median through publishSellMedian',
  },
  {
    path: 'components/site/explore/SubdivisionExploreTail.tsx',
    label: 'subdivision tail gates KbSell median through publishSellMedian',
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-median-caption['"]/.test(text) &&
      /publishSellMedian\(/.test(text),
  })
}

// Home-d has no KbSell block, so / prints no sell median. The trap stays
// armed: if KbSell returns to the homepage it must gate through
// publishSellMedian again.
const homepage = src('app/page.tsx')
checks.push({
  label: 'homepage gates KbSell median through publishSellMedian',
  ok: /KbSell/.test(homepage)
    ? /from ['"]@\/lib\/market\/publish-median-caption['"]/.test(homepage) &&
      /publishSellMedian\(/.test(homepage)
    : true,
})

// Hood-d replaced KbSell on the neighborhood page with HoodDAsk, which prints
// no median; the only neighborhood median left is the compare table, captioned
// by its place-name column headers. Same trap: KbSell returning to the page
// re-arms the publishSellMedian requirement.
const hoodPage = src('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
checks.push({
  label: 'neighborhood page gates KbSell median through publishSellMedian',
  ok: /KbSell/.test(hoodPage)
    ? /from ['"]@\/lib\/market\/publish-median-caption['"]/.test(hoodPage) &&
      /publishSellMedian\(/.test(hoodPage)
    : true,
})

const fact = src('lib/market/publish-fact-value.ts')
checks.push({
  label: 'publishFactValue withholds em-dash and blank facts',
  ok: /export function publishFactValue/.test(fact) && fact.includes('EMPTY_FACT'),
})

for (const surface of [
  { path: 'components/site/kb/KbResortOverview.tsx', label: 'KB resort membership facts gate through publishFactValue' },
]) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-fact-value['"]/.test(text) &&
      /publishFactValue\(/.test(text),
  })
}

const publicSrc = src('lib/market/publish-public-chart-source.ts')
checks.push({
  label: 'toPublicCoreChartSeries strips table names from chart sources',
  ok:
    /export function toPublicCoreChartSeries/.test(publicSrc) &&
    publicSrc.includes('Oregon Data Share') &&
    publicSrc.includes('must not leak table names'),
})

for (const surface of [
  { path: 'app/communities/[slug]/page.tsx', label: 'community charts pass toPublicCoreChartSeries' },
  { path: 'app/cities/[slug]/page.tsx', label: 'city charts pass toPublicCoreChartSeries' },
  { path: 'components/site/listing-detail/NeighborhoodMarketContext.tsx', label: 'listing market charts pass toPublicCoreChartSeries' },
]) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-public-chart-source['"]/.test(text) &&
      /toPublicCoreChartSeries\(/.test(text),
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-median-caption: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-median-caption: ${checks.length}/${checks.length}`)
