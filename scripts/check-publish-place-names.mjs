#!/usr/bin/env node
/**
 * Place-name publish lock.
 *
 * Visitor plat names withhold MLS abbreviations. Bend /neighborhoods/{slug}
 * 301s to /cities/bend/{slug}.
 *
 * Founding cases (fleet place-pages 2026-08-18):
 *   /subdivisions/river-meadows More areas printed Oww / DrrhTrs
 *     (fleet ca552556c46f87dbefdbe4ae948f1b68)
 *   /neighborhoods/awbrey-butte 404ed; live report is /cities/bend/awbrey-butte
 *     (fleet 869e578bf05ec02a89be62bb81403d1d)
 *
 *   node scripts/check-publish-place-names.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-plat-display-name.ts')
checks.push({
  label: 'publishPlatDisplayName withholds MLS abbreviations',
  ok:
    /export function publishPlatDisplayName/.test(helper) &&
    /export function looksLikeMlsAbbreviation/.test(helper) &&
    helper.includes('KNOWN_MLS_ABBREVIATIONS') &&
    helper.includes('oww') &&
    helper.includes('drrhtrs') &&
    helper.includes('stoneth'),
})

const catalog = src('lib/data/geo/plat-public-inventory.ts')
checks.push({
  label: 'registry A-Z catalog withholds MLS abbreviations via looksLikeMlsAbbreviation',
  ok:
    /from ['"]@\/lib\/market\/publish-plat-display-name['"]/.test(catalog) &&
    /looksLikeMlsAbbreviation\(t\)/.test(catalog) &&
    /export function isDisplayablePlatName/.test(catalog),
})

const extras = src('lib/explore/subdivision-page-extras.ts')
checks.push({
  label: 'peerPlatsForResort gates names through publishPlatDisplayName',
  ok:
    /from ['"]@\/lib\/market\/publish-plat-display-name['"]/.test(extras) &&
    /publishPlatDisplayName\(/.test(extras),
})

const place = src('lib/data/geo/resolvePlaceContext.ts')
checks.push({
  label: 'place-context plat nodes gate through publishPlatDisplayName',
  ok:
    /from ['"]@\/lib\/market\/publish-plat-display-name['"]/.test(place) &&
    /publishPlatDisplayName\(/.test(place),
})

const href = src('lib/data/geo/neighborhood-public-inventory.ts')
checks.push({
  label: 'bendNeighborhoodCanonicalHref maps district slugs to /cities/bend/{slug}',
  ok:
    /export function bendNeighborhoodCanonicalHref/.test(href) &&
    href.includes('`/cities/bend/${district.slug}`'),
})

const alias = src('app/neighborhoods/[slug]/page.tsx')
checks.push({
  label: '/neighborhoods/[slug] 301s Bend districts through the DAL helper',
  ok:
    /from ['"]@\/lib\/data['"]/.test(alias) &&
    /bendNeighborhoodCanonicalHref/.test(alias) &&
    /permanentRedirect/.test(alias) &&
    /generateStaticParams/.test(alias),
})

const mw = src('middleware.ts')
const area = src('lib/subdivision-area-redirects.ts')
checks.push({
  label: 'middleware 308s /neighborhoods/{district} before render (Next 16 streaming)',
  ok:
    /export function resolveNeighborhoodAliasRedirect/.test(area) &&
    /resolveNeighborhoodAliasRedirect/.test(mw) &&
    /\/neighborhoods\\\//.test(mw),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-place-names: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-place-names: ${checks.length}/${checks.length}`)
