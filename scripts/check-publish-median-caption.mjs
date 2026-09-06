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

// publishSellMedian, medianCaptionForGrain, and KbSell were deleted with
// their last consumer (app/page.tsx, 2026-08-27 v3 rebuild): every sell
// surface on the barrel publishes NO median at all, which the per-surface
// arms below assert directly. The founding rule — a published list median
// carries the geography of the number — survives as those arms. If a sell
// surface that prints a median returns, it must bring the publisher back
// with it, and this pin returns too.

const surfaces = [
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community sell surface publishes no uncaptioned median',
    // MOVED, NOT DROPPED (2026-08-26). The community page left the KB register
    // and KbSell left with it; the page's one capture sheet publishes no
    // median at all, and every median it prints sits in a section that names
    // its geography and its trace. Put a money formatter or a median prop into
    // the sheet and this fires.
    noMedianSurface: 'app/communities/[slug]/_v3/CommunityAlertSheet.client.tsx',
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
    label: 'neighborhood sell surface publishes no uncaptioned median',
    // MOVED, NOT DROPPED (2026-08-26). The neighborhood page left the KB
    // register and KbSell left with it; the page's one capture sheet publishes
    // no median at all, and every median it prints sits in a section that
    // names its geography and its trace. Put a money formatter or a median
    // prop into the sheet and this fires.
    noMedianSurface: 'app/cities/[slug]/[neighborhoodSlug]/_v3/NeighborhoodAlertsSheet.client.tsx',
  },
  {
    path: 'app/page.tsx',
    label: 'homepage sell ask publishes no uncaptioned median',
    // RE-EXPRESSED AGAIN (2026-08-27, second move). The seller ask stopped
    // being the market Instrument's ghost action when the page was ordered for
    // conversion: the Instrument's action is now the door to the full market
    // report, and the seller ask is its own SellValueForm section (pagePath '/'
    // keeps the ?from= attribution the ghost action carried). The rule is
    // unchanged: the ask surface publishes no median of its own — the medians
    // this page prints sit in the Instrument figures and the towns ledger, each
    // under a section naming its geography and trace. The form file is checked
    // for a median it might mint, and the page for a median it might feed in.
    noMedianSurface: 'app/sell/_v3/SellValueForm.tsx',
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
  if (!ok && surface.noMedianAsk) {
    // The valuation ask exists and its visible label carries no figure.
    const ask = /action=\{\{\s*label:\s*v3Text\('([^']*)'\),\s*href:\s*valuationHref\(/.exec(text)
    ok = Boolean(ask) && !PUBLISHES_A_MEDIAN.test(ask[1]) && !/[$\d]/.test(ask[1])
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

// publishFactValue and its one consumer (KbResortOverview's at-a-glance strip)
// left with the KB register (2026-08-26). The surviving surface for those
// facts — buildPlaceKnowledge in app/communities/[slug]/_v3/place-knowledge.ts
// — takes TYPED config values and composes its own sentences, so the
// em-dash-string class the helper guarded cannot reach it. If a string-fact
// strip returns, it must bring the publisher back with it.

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
]) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok: /placeMedianChart\(/.test(text) && /placeCostChart\(/.test(text),
  })
}
{
  const listing = src('app/listing/[listingKey]/page.tsx')
  checks.push({
    label: 'listing ask instrument is leftover HUD, not a pulse chart',
    ok: !/leftoverHudKpis/.test(listing) && !/buildListingAskClaim/.test(listing),
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
