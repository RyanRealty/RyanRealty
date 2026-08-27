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

const community = src('app/communities/[slug]/page.tsx')
checks.push({
  label: 'community PlaceInventoryMap opens the community listings path',
  ok:
    /viewAllHref=\{homesForSalePath\(cityName, community.subdivision\)\}/.test(community) &&
    /<PlaceInventoryMap/.test(community),
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

/**
 * THE ZIP ARM, RE-EXPRESSED FOR v3 (2026-08-26). The KB page's one inventory
 * door was KbHero's CTA, and the rule was that it kept the parent city's
 * filtered path instead of falling to bare /homes-for-sale. That page left the
 * KB register, so the assertion names what carries the same rule now: every
 * inventory door on the v3 page is built by zipSearchHref, which is STRICTER
 * than the old CTA — it carries this ZIP, not just the parent city — and no
 * door is the bare unfiltered index. The city path survives as the one row in
 * the closing Ledger that honestly means the whole city.
 *
 * A page that puts KbHero back satisfies the first arm instead, with no edit
 * here. What may not happen is the rule quietly ceasing to apply.
 */
const zip = src('app/zip/[zip]/page.tsx')
const zipConstants = src('app/zip/[zip]/_v3/zip-constants.ts')
const zipKbArm =
  /from ['"]@\/lib\/search\/publish-place-browse-href['"]/.test(zip) &&
  /cta=\{publishPlaceHeroCta\(homesForSalePath\(cityName\)/.test(zip)
const zipV3Arm =
  /zipSearchHref\(/.test(zip) &&
  /export function zipSearchHref/.test(zipConstants) &&
  zipConstants.includes('postalCode: zip') &&
  zipConstants.includes("propertyType: 'A'") &&
  /homesForSalePath\(cityName\)/.test(zip) &&
  // The founding defect, at this grain: a door that drops the place and lands
  // on the whole region's inventory.
  !/href: ['"]\/homes-for-sale['"]/.test(zip)
checks.push({
  label: 'ZIP inventory doors keep the place filter',
  ok: zipKbArm || zipV3Arm,
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
