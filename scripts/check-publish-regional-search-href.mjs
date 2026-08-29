#!/usr/bin/env node
/**
 * Regional inventory door lock.
 *
 * A control that names the Central Oregon set must open list view with no
 * city. Split/map `/homes-for-sale` injects Bend.
 * Founding case: homepage See homes next to 1,836 homes (fleet
 * ef6af6b44156e99f0f5ca42850819b19).
 *
 *   node scripts/check-publish-regional-search-href.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/search/publish-regional-search-href.ts')
checks.push({
  label: 'SoR is list view with no city',
  ok:
    /export function publishRegionalSearchHref/.test(helper) &&
    helper.includes("/homes-for-sale?view=list") &&
    /export function isRegionalSearchHref/.test(helper),
})

// KbHero and KbExploreTowns were deleted with their last consumer
// (app/page.tsx, 2026-08-27 v3 rebuild). Their default-prop checks died with
// the components; the rule they enforced — every regional See-homes door goes
// through publishRegionalSearchHref — lives on in the homepage arm below,
// which pins the one regional door the page still publishes (Stage See homes).

// KbListingMapImpl left with the KB register (2026-08-27). Its arm asserted the
// map's own Browse door went through publishRegionalSearchHref; the v3 map
// carries no browse door at all, so there is no door left to mis-build. The
// rule survives on the homepage arm directly below, which pins the Stage
// See homes door.

const home = src('app/page.tsx')
// Regional doors are HomeHeroSearch (empty submit), leftoverMarketFigures'
// browse link, and the Field See all. All go through publishRegionalSearchHref.
checks.push({
  label: 'homepage does not hardcode the Bend-injecting /homes-for-sale door on regional CTAs',
  ok:
    !/cta=\{\{\s*href:\s*['"]\/homes-for-sale['"]/.test(home) &&
    !/href:\s*['"]\/homes-for-sale['"]/.test(home) &&
    (/viewAllHref=\{publishRegionalSearchHref\(\)\}/.test(home) ||
      (/href:\s*publishRegionalSearchHref\(\)/.test(home) &&
        /browse:\s*publishRegionalSearchHref\(\)/.test(home))),
})

// KbFooter and KbFeatured left with the KB register (2026-08-27). Both arms
// asserted that an UNSCOPED "See homes for sale" door goes through
// publishRegionalSearchHref rather than being typed as a bare /homes-for-sale.
// The one site footer (V3Footer) builds its doors from V3_FOOTER_COLUMNS, whose
// links are the IA lock's, and the featured rail is now the homepage Field. The
// homepage arm above pins the Stage See homes door the page still publishes.

const search = src('app/search/page.tsx')
checks.push({
  label: 'list view still skips the silent Bend city inject',
  ok:
    search.includes("view !== 'list' ? defaultCity") &&
    search.includes("const defaultCity = 'Bend'"),
})

const nav = src('lib/site-nav.ts')
checks.push({
  label: 'Homes / Buy nav door is the regional list href, not the Bend inject',
  ok:
    /export const REGIONAL_SEARCH: NavLink = \{[\s\S]*href: '\/homes-for-sale\?view=list'/.test(nav) &&
    /href: REGIONAL_SEARCH\.href/.test(nav) &&
    /children: \[\s*REGIONAL_SEARCH,/.test(nav),
})

// lib/site-menu.ts was DELETED 2026-08-27: its only importers were the legacy
// MobileNav and SiteHeader, both gone with the old chrome, so the menu data it
// held fed nothing. The rule its arm carried — the Buy door is the regional
// LIST href, never a silent Bend inject — survives on the nav arm above, which
// pins the live menu source (lib/site-nav.ts).

const frame = src('app/globals.css')
checks.push({
  label: 'search app-frame does not double-count a 64px fixed header',
  ok:
    /height:\s*calc\(100dvh - 3\.5rem\)/.test(frame) &&
    /margin-top:\s*0/.test(frame) &&
    !/\.search-app-frame \{[^}]*margin-top:\s*64px/.test(frame),
})

const dock = src('app/search/search-frame.css')
checks.push({
  label: 'app-frame filter dock stays in flow so it cannot cover count/sort',
  ok:
    /\.search-app-frame \.search-filter-dock/.test(dock) &&
    /position:\s*relative/.test(dock),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\n${checks.length}/${checks.length} publish-regional-search-href`)
