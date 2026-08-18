#!/usr/bin/env node
/**
 * Planned-community MLS alias publish lock.
 *
 * Crooked River Ranch homes are MLS-tagged Crr*, not "Crooked River Ranch".
 * cityResorts() stays is_resort === true so Three Rivers Oww cannot join
 * the golf ledger. The community page + index overlay the Crr-family set.
 *
 * Founding case: /communities/crooked-river-ranch published 0 homes
 * (fleet:public-ux:place-pages 2026-08-18).
 *
 *   node scripts/check-publish-community-mls-aliases.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-community-mls-aliases.ts')
checks.push({
  label: 'Crr3_C matches the Crr family prefix',
  ok:
    /export function subdivisionMatchesCommunityAlias/.test(helper) &&
    helper.includes("prefix === 'crr'") &&
    /isCrrFamilySubdivisionName/.test(helper),
})

checks.push({
  label: 'registryEntryUsesMlsAliasScan excludes is_resort rows',
  ok:
    /export function registryEntryUsesMlsAliasScan/.test(helper) &&
    helper.includes('entry.is_resort === true'),
})

const aliases = src('lib/subdivision-aliases.ts')
checks.push({
  label: 'getSubdivisionMatchNames merges registry aliases',
  ok:
    /from ['"]@\/data\/resort-communities\.json['"]/.test(aliases) &&
    /registryAliasesForName/.test(aliases) &&
    /export function getSubdivisionMatchNames/.test(aliases),
})

const page = src('app/communities/[slug]/page.tsx')
checks.push({
  label: 'community page applies alias tiles when the registry has a Crr-family scan',
  ok:
    /from ['"]@\/lib\/market\/publish-community-mls-aliases['"]/.test(page) &&
    /registryEntryUsesMlsAliasScan/.test(page) &&
    /communityMlsAliasInventory/.test(page) &&
    /publishedAliasAwareSet/.test(page) &&
    /hasMlsAliasScan/.test(page),
})

const cityResorts = src('lib/kb/resort-active-counts.ts')
checks.push({
  label: 'cityResorts still requires is_resort === true',
  ok:
    /export function cityResorts/.test(cityResorts) &&
    cityResorts.includes('c.is_resort === true'),
})

const registry = JSON.parse(src('data/resort-communities.json'))
const crr = (registry.communities ?? []).find((c) => c.slug === 'crooked-river-ranch')
const aliasesLower = (crr?.subdivision_aliases ?? []).map((a) => String(a).toLowerCase())
checks.push({
  label: 'CRR stays is_resort false and lists live Crr aliases',
  ok:
    crr?.is_resort === false &&
    aliasesLower.includes('crr') &&
    aliasesLower.includes('crr3_c') &&
    aliasesLower.includes('crooked river ranch'),
})

const actions = src('app/actions/communities.ts')
const lookup = src('lib/kb/lookup-published-community-figures.ts')
checks.push({
  label: 'index + getCommunityBySlug overlay registry alias figures',
  ok:
    /lookupPublishedCommunityFigures/.test(actions) &&
    /publishCanonicalCommunityName/.test(actions) &&
    /isOrphanCrrIndexSubdivision/.test(actions) &&
    /getRegistryAliasPublicFigures/.test(lookup),
})

const plat = src('lib/data/geo/plat-public-inventory.ts')
checks.push({
  label: 'isDisplayablePlatName withholds the Crr family',
  ok: plat.includes('crr(?:$|[\\s\\d_])'),
})

const failed = checks.filter((c) => !c.ok)
for (const check of checks) {
  console.log(`${check.ok ? 'ok' : 'FAIL'}  ${check.label}`)
}
if (failed.length > 0) {
  console.error(`\n${failed.length} publish-community-mls-aliases check(s) failed`)
  process.exit(1)
}
console.log(`\n${checks.length}/${checks.length} publish-community-mls-aliases`)
