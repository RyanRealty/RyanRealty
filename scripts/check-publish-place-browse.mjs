#!/usr/bin/env node
/**
 * Place-page Browse homes must keep the place filter.
 *
 * Founding case: /subdivisions/ridge-at-eagle-crest Browse homes landed on
 * /homes-for-sale with no plat chip (fleet 70b9cdad41fa4d875ca6b5997a1bab5a).
 *
 *   node scripts/check-publish-place-browse.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/search/publish-place-browse-href.ts')
checks.push({
  label: 'publishPlaceBrowseHref withholds the regional inventory door',
  ok:
    /export function publishPlaceBrowseHref/.test(helper) &&
    /export function isPlaceFilteredSearchHref/.test(helper) &&
    /export function publishPlaceHeroCta/.test(helper) &&
    helper.includes("path === '/homes-for-sale'") &&
    helper.includes("path.startsWith('/homes-for-sale/')") &&
    helper.includes('70b9cdad41fa4d875ca6b5997a1bab5a'),
})

const split = src('components/site/explore/PlaceMapListSplit.client.tsx')
checks.push({
  label: 'PlaceMapListSplit gates map Browse homes through publishPlaceBrowseHref',
  ok:
    /from ['"]@\/lib\/search\/publish-place-browse-href['"]/.test(split) &&
    /publishPlaceBrowseHref\(browseHref \?\? viewAllHref\)/.test(split) &&
    /browseHref=\{mapBrowseHref\}/.test(split),
})

const inventory = src('components/site/explore/PlaceInventoryMap.tsx')
checks.push({
  label: 'PlaceInventoryMap passes a place-filtered browseHref to both map shapes',
  ok:
    /from ['"]@\/lib\/search\/publish-place-browse-href['"]/.test(inventory) &&
    /browseHref=\{browseHref\}/.test(inventory) &&
    /publishPlaceBrowseHref\(browseHref \?\? viewAllHref\)/.test(inventory),
})

// comm-d extracted the community page body into CommunityKbView (map door
// viewAllHref) and CommunityFeaturedView (map door browseHref); the page still
// computes the community-scoped listings path and hands it to both views.
const community = src('app/communities/[slug]/page.tsx')
const communityView = src('components/site/community/CommunityKbView.tsx')
const featuredView = src('components/site/comm-d/CommunityFeaturedView.tsx')
checks.push({
  label: 'community PlaceInventoryMap opens the community listings path',
  ok:
    /const listingsHref = homesForSalePath\(cityName, community\.subdivision\)/.test(community) &&
    /listingsHref=\{listingsHref\}/.test(community) &&
    /<PlaceInventoryMap/.test(communityView) &&
    /viewAllHref=\{listingsHref\}/.test(communityView) &&
    /browseHref=\{props\.listingsHref\}/.test(featuredView),
})

const map = src('components/site/kb/KbListingMapImpl.tsx')
checks.push({
  label: 'KbListingMap withholds Browse homes when browseHref is null',
  ok:
    /browseHref === undefined \? publishRegionalSearchHref\(\) : browseHref/.test(map) &&
    /\{mapBrowseHref \? \(/.test(map),
})

const subdivision = src('app/subdivisions/[slug]/page.tsx')
checks.push({
  label: 'subdivision hero See homes keeps the plat listings path',
  ok:
    /from ['"]@\/lib\/search\/publish-place-browse-href['"]/.test(subdivision) &&
    /cta=\{publishPlaceHeroCta\(/.test(subdivision) &&
    /subdivisionListingsPath\(cityName, displayName\)/.test(subdivision),
})

const zip = src('app/zip/[zip]/page.tsx')
checks.push({
  label: 'ZIP hero See homes keeps the parent-city listings path',
  ok:
    /from ['"]@\/lib\/search\/publish-place-browse-href['"]/.test(zip) &&
    /cta=\{publishPlaceHeroCta\(homesForSalePath\(cityName\)/.test(zip),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-place-browse: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-place-browse: ${checks.length}/${checks.length}`)
