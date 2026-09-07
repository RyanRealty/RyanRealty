#!/usr/bin/env node
/**
 * Registry-resort index publish lock.
 *
 * /communities flagship + A-Z, and getCommunityBySlug metadata must print
 * the alias-aware resort set — the same set /communities/{slug} already
 * prints. Literal-name snapshot counts are a different geography.
 *
 * Homepage: Critiquito H9 may omit the communities ledger; when it renders
 * community tiles it must still print index activeCount (founding case:
 * homepage Tetherow 12 ACTIVE vs /communities/tetherow 35 homes,
 * fleet a7a6038f1d78857572e7e2199cf399bf). Do not resurrect the ledger
 * only to satisfy this gate.
 *
 *   node scripts/check-publish-resort-index-figures.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-resort-index-figures.ts')
checks.push({
  label: 'publishResortIndexFigures takes only the alias-aware pair',
  ok:
    /export function publishResortIndexFigures/.test(helper) &&
    helper.includes('aliasAwareCount') &&
    helper.includes('aliasAwareMedian') &&
    !helper.includes('activeSfrCount') &&
    !helper.includes('geo_snapshot'),
})

const loader = src('lib/kb/registry-resort-public-figures.ts')
checks.push({
  label: 'registry loader gates through publishResortIndexFigures + alias-aware tiles',
  ok:
    /from ['"]@\/lib\/market\/publish-resort-index-figures['"]/.test(loader) &&
    /publishResortIndexFigures\(/.test(loader) &&
    /resortActiveSfrCounts\(/.test(loader) &&
    /resortTilesForSlug\(/.test(loader) &&
    /fetchAllCityActiveSfr\(/.test(loader) &&
    /registryResortOverlayKeys/.test(loader) &&
    /mls_cities/.test(loader) &&
    /Same city door/.test(loader),
})

const index = src('app/actions/communities.ts')
checks.push({
  label: 'getCommunitiesForIndex overlays registry resort figures via lookupRegistryResortFigures',
  ok:
    /getRegistryResortPublicFigures/.test(index) &&
    /lookupRegistryResortFigures/.test(index) &&
    /published\.activeCount/.test(index) &&
    /published\.medianListPrice/.test(index),
})

checks.push({
  label: 'getCommunityBySlug overlays registry resort figures',
  ok:
    /resortFigures\?\.activeCount/.test(index) &&
    /resortFigures\?\.medianListPrice/.test(index),
})

const home = src('app/page.tsx')
const featured = src('app/_v3/home-featured-communities.ts')
// Critiquito H9 dropped the old communities ledger (id=communities). Home may
// still feature communities via the photo/info carousel — those figures must
// be alias-aware (getRegistryResortPublicFigures), never literal index counts.
const homeRendersFeaturedCommunities =
  /loadHomeFeaturedCommunitySlides/.test(home) ||
  /HomeFeaturedCommunity/.test(home) ||
  /getCommunitiesForIndex/.test(home) ||
  /COMM_FEATURED/.test(home) ||
  /id=["']communities["']/.test(home)
checks.push({
  label: homeRendersFeaturedCommunities
    ? 'homepage featured communities use alias-aware resort figures'
    : 'homepage omits communities ledger (Critiquito H9); resort figures stay on /communities',
  ok: homeRendersFeaturedCommunities
    ? /getRegistryResortPublicFigures/.test(featured) &&
      /activeCount/.test(featured) &&
      !/getCommunitiesForIndex/.test(home) &&
      !/id=["']communities["']/.test(home)
    : !/getCommunitiesForIndex/.test(home),
})

const place = src('app/communities/page.tsx')
checks.push({
  label: 'communities flagship prefers alias-aware figures over snapshot',
  ok:
    /from ['"]@\/lib\/kb\/registry-resort-public-figures['"]/.test(place) &&
    /resortFigures\.get\(r\.slug\)\?\.activeCount/.test(place) &&
    /formatPriceExact\(r\.medianPrice\)/.test(place) &&
    !/snap\?\.activeSfrCount \?\? idx\?\.activeCount/.test(place),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-resort-index-figures: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-resort-index-figures: ${checks.length}/${checks.length}`)
