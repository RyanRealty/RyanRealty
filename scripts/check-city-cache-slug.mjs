#!/usr/bin/env node
/**
 * City URL hyphen → cache space-form lock.
 *
 * market_pulse_live / market_stats_cache key cities on lower("City")
 * (`la pine`). Public URLs use hyphens (`/housing-market/la-pine`).
 * Passing the URL slug to a city-tier cache read 404s a published market.
 * Founding case: hub printed La Pine 175 SFR; /housing-market/la-pine
 * returned NEXT_HTTP_ERROR_FALLBACK;404 (fleet 75370225805bb52d38b151ced2dab5c1).
 *
 *   node scripts/check-city-cache-slug.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/city-cache-slug.ts')
checks.push({
  label: 'canonicalCityCacheSlug exists and returns the space form first',
  ok:
    /export function canonicalCityCacheSlug/.test(helper) &&
    /export function citySlugCandidates/.test(helper) &&
    helper.includes("replace(/[^a-z0-9]+/g, ' ')") &&
    helper.includes('space-separated first'),
})

const surfaces = [
  {
    path: 'app/housing-market/[...slug]/_v3/geo-constants.ts',
    label: 'housing-market resolveGeo uses canonicalCityCacheSlug for city geoSlug',
    need: /geoSlug:\s*canonicalCityCacheSlug\(citySlug\)/,
  },
  {
    path: 'components/site/MarketSnapshot.tsx',
    label: 'MarketSnapshot city pulse uses canonicalCityCacheSlug',
    need: /canonicalCityCacheSlug\(citySlug\)/,
  },
  {
    path: 'app/cities/[slug]/page.tsx',
    label: 'city page cache reads use canonicalCityCacheSlug',
    need: /canonicalCityCacheSlug\(slug\)/,
  },
  {
    path: 'lib/market/search-city-sfr-publish.ts',
    label: 'homes-for-sale city pulse uses canonicalCityCacheSlug',
    need: /canonicalCityCacheSlug\((?:args\.)?relatedCitySlug\)/,
  },
]

for (const surface of surfaces) {
  const text = src(surface.path)
  checks.push({
    label: surface.label,
    ok:
      /from ['"]@\/lib\/market\/city-cache-slug['"]/.test(text) &&
      /canonicalCityCacheSlug\(/.test(text) &&
      surface.need.test(text),
  })
}

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\ncity-cache-slug: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\ncity-cache-slug: ${checks.length}/${checks.length}`)
