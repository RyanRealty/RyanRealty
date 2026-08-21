#!/usr/bin/env node
/**
 * Place-index / city-inventory / public-methodology publish lock.
 *
 * Founding cases (fleet place-pages 2026-08-17):
 *   /cities La Pine $500,000 vs /cities/la-pine $499,900
 *   /cities/terrebonne hero 6 vs #homes 24
 *   /communities A-Z Eagle Crest 0 vs page 73
 *   /housing-market source leaks closed_cte+ILIKE
 *   /cities/bend/century-west Unsplash palm-tree hero
 *
 *   node scripts/check-publish-place-index-truth.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const indexMedian = src('lib/market/publish-index-median.ts')
checks.push({
  label: 'formatIndexMedianUsd is exact whole dollars',
  ok:
    /export function formatIndexMedianUsd/.test(indexMedian) &&
    !indexMedian.includes('Math.round(n / 1000)'),
})

for (const surface of [
  { path: 'app/cities/page.tsx', label: 'cities index' },
  { path: 'app/neighborhoods/page.tsx', label: 'neighborhoods index' },
  { path: 'app/subdivisions/page.tsx', label: 'subdivisions index' },
]) {
  const text = src(surface.path)
  checks.push({
    label: `${surface.label} prints medians through formatIndexMedianUsd`,
    ok:
      /from ['"]@\/lib\/market\/publish-index-median['"]/.test(text) &&
      /formatIndexMedianUsd\(/.test(text) &&
      !text.includes('Math.round(n / 1000) * 1000'),
  })
}

const cityInv = src('lib/market/publish-city-inventory.ts')
checks.push({
  label: 'publishCityInventory prefers a complete tile set under the cap',
  ok:
    /export function publishCityInventory/.test(cityInv) &&
    /source: 'tiles'/.test(cityInv) &&
    /tileCount >= args.tileLimit/.test(cityInv),
})

const cityPage = src('app/cities/[slug]/page.tsx')
checks.push({
  label: 'city page gates hero / facts / JSON-LD through publishCityInventory',
  ok:
    /from ['"]@\/lib\/market\/publish-city-inventory['"]/.test(cityPage) &&
    /publishCityInventory\(/.test(cityPage) &&
    /CITY_TILE_FETCH_LIMIT/.test(cityPage) &&
    /cityHeroLead\(/.test(cityPage),
})

const hero = src('lib/market/publish-place-hero.ts')
checks.push({
  label: 'publishPlaceHeroUrl rejects Unsplash stock',
  ok: /unsplash/i.test(hero) && /export function publishPlaceHeroUrl/.test(hero),
})

const nbh = src('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
checks.push({
  label: 'neighborhood page gates the hero through publishPlaceHeroUrl',
  ok:
    /from ['"]@\/lib\/market\/publish-place-hero['"]/.test(nbh) &&
    /publishNeighborhoodHero\(/.test(nbh),
})

const method = src('lib/market/publish-public-methodology.ts')
checks.push({
  label: 'public methodology withholds closed_cte / ILIKE / table names',
  ok:
    /PUBLIC_CLOSED_SALES_METHODOLOGY/.test(method) &&
    /closed_cte/.test(method) &&
    /ILIKE/.test(method),
})

for (const surface of [
  { path: 'app/housing-market/_v3/closed-kpis.ts', label: 'closedMartSource' },
  { path: 'app/housing-market/history/page.tsx', label: 'housing-market history' },
  { path: 'app/housing-market/central-oregon/page.tsx', label: 'housing-market region' },
  { path: 'app/cities/[slug]/_v3/city-mart.ts', label: 'placeMartTrace' },
]) {
  const text = src(surface.path)
  checks.push({
    label: `${surface.label} prints PUBLIC_CLOSED_SALES_METHODOLOGY, not the internal stamp`,
    ok:
      /PUBLIC_CLOSED_SALES_METHODOLOGY/.test(text) &&
      !/ANALYTICS_METHODOLOGY_V1/.test(text) &&
      !/closed_cte\+service_area_v1/.test(text),
  })
}

const communities = src('app/actions/communities.ts')
checks.push({
  label: 'getCommunitiesForIndex looks up overlay via lookupRegistryResortFigures',
  ok:
    /lookupRegistryResortFigures/.test(communities) &&
    /entityKey: row.entityKey/.test(communities),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-place-index-truth: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-place-index-truth: ${checks.length}/${checks.length}`)
