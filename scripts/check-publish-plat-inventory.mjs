#!/usr/bin/env node
/**
 * Plat inventory publish lock.
 *
 * Index tile, place hero, and #homes list must share one SFR counted set.
 * Founding case: /subdivisions/ridge-at-eagle-crest printed 14 in the hero
 * and listed 26 PropertyType-A cards while the index tile said 12
 * (fleet 37d5349b2d2e55aa62df73389d8bad85).
 *
 *   node scripts/check-publish-plat-inventory.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/data/geo/plat-public-inventory.ts')
checks.push({
  label: 'plat inventory SoR is listing_tile_mv SFR + PUBLIC_ACTIVE',
  ok:
    /export function rollupPlatPublicInventory/.test(helper) &&
    /export const getRegistryPlatPublicInventory/.test(helper) &&
    /export async function getPlatPublicInventory/.test(helper) &&
    helper.includes("from('listing_tile_mv')") &&
    helper.includes("eq('property_type', 'A')") &&
    helper.includes("eq('property_sub_type', 'Single Family Residence')") &&
    helper.includes('PUBLIC_ACTIVE_STATUSES'),
})

const index = src('app/subdivisions/page.tsx')
checks.push({
  label: 'subdivisions index reads getRegistryPlatPublicInventory',
  ok:
    /from ['"]@\/lib\/data\/geo\/plat-public-inventory['"]/.test(index) &&
    /getRegistryPlatPublicInventory/.test(index) &&
    !/getAllCommunitySnapshots/.test(index),
})

const place = src('app/subdivisions/[slug]/page.tsx')
checks.push({
  label: 'plat page publishes activeCount from getPlatPublicInventory',
  ok:
    /from ['"]@\/lib\/data\/geo\/plat-public-inventory['"]/.test(place) &&
    /getPlatPublicInventory/.test(place) &&
    /inventory\?\.activeCount/.test(place) &&
    !/featuredTiles\.length/.test(place) &&
    !/boundary\.pins\.length/.test(place),
})

checks.push({
  label: 'plat page hydrates the list from inventory listing keys',
  ok:
    /inventory\.listingKeys/.test(place) &&
    /listingKeys: boundaryListingKeys/.test(place) &&
    !/getCommunityListings\(/.test(place),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-plat-inventory: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-plat-inventory: ${checks.length}/${checks.length}`)
