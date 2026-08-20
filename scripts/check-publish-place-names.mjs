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
import { readFileSync, existsSync } from 'node:fs'

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

checks.push({
  label: 'publishPlatDisplayName records Triple as Triple Knot',
  ok: helper.includes("triple: 'Triple Knot'") && helper.includes('RECORDED_PLAT_DISPLAY'),
})

const platPage = src('app/subdivisions/[slug]/page.tsx')
checks.push({
  label: 'plat page visitor name gates through publishPlatDisplayName',
  ok:
    /from ['"]@\/lib\/market\/publish-plat-display-name['"]/.test(platPage) &&
    /publishPlatDisplayName\(/.test(platPage) &&
    /function publishSubdivisionPageName/.test(platPage),
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

// The /neighborhoods/[slug] alias page is GONE (2026-08-19). It existed only to
// permanentRedirect() the 13 Bend districts, and a page-body redirect under the
// app/loading.tsx Suspense boundary cannot write a Location header — it served
// 200 with no <h1>. The hop is a pre-render hop now, and every slug the hop does
// not claim gets a real Next 404 instead of the old streamed soft-404.
checks.push({
  label: '/neighborhoods/[slug] has no page-body redirect (the hop is pre-render)',
  ok: !existsSync('app/neighborhoods/[slug]/page.tsx'),
})

const mw = src('middleware.ts')
const area = src('lib/subdivision-area-redirects.ts')
const hops = src('lib/routing/pre-render-hops.ts')
checks.push({
  label: 'middleware 308s /neighborhoods/{district} before render (Next 16 streaming)',
  ok:
    /export function resolveNeighborhoodAliasRedirect/.test(area) &&
    /resolveNeighborhoodAliasRedirect/.test(hops) &&
    /\/neighborhoods\\\//.test(hops) &&
    /resolvePreRenderHop/.test(mw),
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
