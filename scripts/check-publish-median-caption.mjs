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
    path: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    label: 'neighborhood page gates KbSell median through publishSellMedian',
  },
  {
    path: 'app/page.tsx',
    label: 'homepage gates KbSell median through publishSellMedian',
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

checks.push({
  label: 'city-d does not mount KbSell',
  ok: !/<KbSell/.test(src('app/cities/[slug]/page.tsx')),
})

const cityCharts = src('app/cities/[slug]/_v3/city-market-charts.tsx')
checks.push({
  label: 'city Chart Room Time/Relate/Rank live on the city template',
  ok:
    /buildYearCard\(/.test(cityCharts) &&
    /buildRelateCard\(/.test(cityCharts) &&
    /buildMosCard\(/.test(cityCharts),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-median-caption: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-median-caption: ${checks.length}/${checks.length}`)
