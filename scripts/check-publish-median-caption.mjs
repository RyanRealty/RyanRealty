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
    label: 'city sell surface publishes no uncaptioned median',
    // MOVED, NOT DROPPED (2026-08-26). The city page left the KB register and
    // KbSell left with it. The rule is "a published list median carries the
    // geography of the number", and this surface satisfies it the strongest way
    // available: the page's one capture sheet publishes no median at all — the
    // medians the page prints all sit in the market Instrument and the place
    // ledgers, each under a section that names its geography and its trace.
    // Put a money formatter or a median prop into the sheet and this fires.
    noMedianSurface: 'app/cities/[slug]/_v3/CityAlertSheet.client.tsx',
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
    label: 'ZIP sell surface publishes no uncaptioned median',
    // MOVED, NOT DROPPED (2026-08-26). The ZIP page left the KB register and
    // its sell surface is now a v3 Sheet. The rule is "a published list median
    // carries the geography of the number", and this surface satisfies it the
    // strongest way available: it publishes no median at all, because the two
    // KbSell printed are the same figures the market Instrument above it
    // prints under that section's own trace. Asserting that is a real check —
    // put a money formatter or a median prop back into the sheet and this
    // fires. A page that puts KbSell back satisfies the first arm instead.
    noMedianSurface: 'app/zip/[zip]/_v3/ZipSellSheet.client.tsx',
  },
  {
    path: 'app/subdivisions/[slug]/page.tsx',
    label: 'plat page publishes no uncaptioned median',
    // MOVED, NOT DROPPED (2026-08-26). SubdivisionExploreTail carried the plat's
    // KbSell and was deleted with the v3 migration. The rule — a published list
    // median carries the geography of the number — is satisfied here the
    // strongest way: publishPlatFigures is the ONLY source a plat median may
    // come from, and it reads the plat's own counted set. A parent-city or
    // community median under a plat heading is what ci:publish-plat-figures
    // forbids outright.
    platFiguresSurface: true,
  },
]

/** A money formatter or a median identifier reaching a sell surface. */
const PUBLISHES_A_MEDIAN =
  /formatPrice|formatPriceExact|formatPriceCompact|kbMoneyFull|toLocaleString|\bmedian/i

/**
 * Line comments BEFORE block comments. A `/*` inside a `//` line opens a
 * phantom block comment that swallows the rest of the file, which is exactly
 * how four public pages went invisible to G52 and G53 (migration recipe §5.3).
 */
const stripComments = (text) =>
  text.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')

for (const surface of surfaces) {
  const text = src(surface.path)
  const gatedThroughHelper =
    /from ['"]@\/lib\/market\/publish-median-caption['"]/.test(text) &&
    /publishSellMedian\(/.test(text)
  let ok = gatedThroughHelper
  if (!ok && surface.platFiguresSurface) {
    ok =
      /from ['"]@\/lib\/market\/publish-plat-figures['"]/.test(text) &&
      /publishPlatFigures\(/.test(text) &&
      !/cityPulse|communityPulse/.test(stripComments(text))
  }
  if (!ok && surface.noMedianSurface) {
    const sheet = src(surface.noMedianSurface)
    // The page may not hand a median to the sheet, and the sheet may not make
    // one of its own.
    const pageFeedsMedian = new RegExp(
      `<${surface.noMedianSurface.split('/').pop().replace(/\..*$/, '')}[^>]*median`,
      'i',
    ).test(text)
    ok = !PUBLISHES_A_MEDIAN.test(stripComments(sheet)) && !pageFeedsMedian
  }
  checks.push({ label: surface.label, ok })
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
