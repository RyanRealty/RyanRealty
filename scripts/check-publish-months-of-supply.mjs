#!/usr/bin/env node
/**
 * Pulse months-of-supply publish lock.
 *
 * Pulse MOS uses that row's active_count as the numerator. A place page that
 * prints a different active count (or a 12-month sold count the implied
 * six-month closes cannot sit inside) must run publishMonthsOfSupply before
 * the HUD, FAQ, or Dataset see the figure.
 * Founding case: /communities/tetherow 4.6 MOS + 35 actives + 36 sold/12mo
 * (fleet 5d55abbd72a67d25a5d7232b46fd2fb0).
 *
 *   node scripts/check-publish-months-of-supply.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-months-of-supply.ts')
checks.push({
  label: 'publishMonthsOfSupply withholds a mismatched numerator and impossible six-month closes',
  ok:
    /export function publishMonthsOfSupply/.test(helper) &&
    /export function impliedSixMonthCloses/.test(helper) &&
    helper.includes('pulseActive !== shownActive') &&
    helper.includes('implied > sold'),
})

const leftoverHud = src('lib/market/publish-leftover-hud.ts')
checks.push({
  label: 'leftoverHudKpis gates MOS through publishMonthsOfSupply',
  ok:
    /from ['"]@\/lib\/market\/publish-months-of-supply['"]/.test(leftoverHud) &&
    /publishMonthsOfSupply\(/.test(leftoverHud) &&
    leftoverHud.includes("source: 'market-truth'"),
})

const leftoverHudSurfaces = [
  {
    path: 'app/communities/[slug]/page.tsx',
    label: 'community page gates HUD + FAQ MOS through leftoverHudKpis',
  },
  {
    path: 'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    label: 'neighborhood page gates HUD + FAQ MOS through leftoverHudKpis',
  },
  {
    path: 'app/cities/[slug]/page.tsx',
    label: 'city page gates HUD + FAQ MOS through leftoverHudKpis',
  },
  {
    path: 'app/page.tsx',
    label: 'homepage HUD gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/housing-market/[...slug]/page.tsx',
    label: 'housing-market geo gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/housing-market/page.tsx',
    label: 'housing-market hub gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/housing-market/central-oregon/page.tsx',
    label: 'central-oregon report gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/housing-market/annual-review/page.tsx',
    label: 'annual-review gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/months-of-supply/page.tsx',
    label: 'months-of-supply page gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/cities/page.tsx',
    label: 'cities index gates MOS through leftoverHudKpis',
  },
  {
    path: 'components/site/MarketSnapshot.tsx',
    label: 'MarketSnapshot gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/housing-market/reports/page.tsx',
    label: 'housing-market reports hub gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/lp/expired-listing/page.tsx',
    label: 'expired LP gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/lp/buyer-listing-alerts/page.tsx',
    label: 'buyer LP gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/listing/[listingKey]/page.tsx',
    label: 'listing page gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/search/og/[...slug]/route.tsx',
    label: 'search OG gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/housing-market/og/[...slug]/route.tsx',
    label: 'housing-market OG gates MOS through leftoverHudKpis',
  },
  {
    path: 'app/lp/seller-home-value/data.ts',
    label: 'seller LP snapshot gates MOS through leftoverHudKpis',
  },
]

const surfaces = [
  {
    path: 'lib/site/market-faq.ts',
    label: 'buildMarketFaq refuses an impossible MOS + sold year',
  },
  {
    path: 'lib/data/crm/getMarketReportData.ts',
    label: 'CRM market-report block gates live MOS through publishMonthsOfSupply',
  },
  {
    path: 'app/api/reports/export/route.ts',
    label: 'report export gates live MOS through publishMonthsOfSupply',
  },
  {
    path: 'lib/blog/publish-blog-current-mos.ts',
    label: 'blog current-MOS rewriter gates figures through publishMonthsOfSupply',
  },
]

const blogPage = src('app/blog/[slug]/page.tsx')
checks.push({
  label: 'blog post page rewrites current MOS from pulse and sits on the v3 gutter',
  ok:
    /from ['"]@\/lib\/blog\/publish-blog-current-mos['"]/.test(blogPage) &&
    /publishBlogCurrentMos\(/.test(blogPage) &&
    /getMarketPulse\(/.test(blogPage) &&
    /v3-article-island/.test(blogPage) &&
    /V3ArticleIsland\.css/.test(blogPage),
})

const about = src('app/about/page.tsx')
checks.push({
  label: 'about city ledger reads leftover overlays, not pulse city snapshots',
  ok:
    /getDetachedOverlays\(/.test(about) &&
    /from ['"]@\/lib\/data\/market-truth\/getSellBendMarket['"]/.test(about) &&
    !/getMarketPulseCitySnapshots\(/.test(about),
})

for (const surface of leftoverHudSurfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-leftover-hud['"]/.test(text) &&
      /leftoverHudKpis\(/.test(text),
  })
}

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/publish-months-of-supply['"]/.test(text) &&
      /publishMonthsOfSupply\(/.test(text),
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-months-of-supply: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-months-of-supply: ${checks.length}/${checks.length}`)
