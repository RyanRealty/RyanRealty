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

const hero = src('components/site/kb/KbHero.client.tsx')
checks.push({
  label: 'KbHero default See homes uses the regional href',
  ok:
    /from ['"]@\/lib\/search\/publish-regional-search-href['"]/.test(hero) &&
    /publishRegionalSearchHref\(/.test(hero),
})

const towns = src('components/site/kb/KbExploreTowns.client.tsx')
checks.push({
  label: 'KbExploreTowns default See homes for sale uses the regional href',
  ok:
    /from ['"]@\/lib\/search\/publish-regional-search-href['"]/.test(towns) &&
    /publishRegionalSearchHref\(/.test(towns),
})

const map = src('components/site/kb/KbListingMapImpl.tsx')
checks.push({
  label: 'homepage map Browse homes uses the regional href',
  ok:
    /from ['"]@\/lib\/search\/publish-regional-search-href['"]/.test(map) &&
    /publishRegionalSearchHref\(/.test(map),
})

const home = src('app/page.tsx')
checks.push({
  label: 'homepage does not hardcode the Bend-injecting /homes-for-sale door on regional CTAs',
  ok:
    !/cta=\{\{\s*href:\s*['"]\/homes-for-sale['"]/.test(home) &&
    /viewAllHref=\{publishRegionalSearchHref\(\)\}/.test(home),
})

const footer = src('components/site/kb/KbFooter.client.tsx')
checks.push({
  label: 'homepage footer See homes for sale uses the regional href',
  ok:
    /from ['"]@\/lib\/search\/publish-regional-search-href['"]/.test(footer) &&
    /publishRegionalSearchHref\(/.test(footer),
})

const featured = src('components/site/kb/KbFeatured.client.tsx')
checks.push({
  label: 'unscoped featured See homes for sale uses the regional href',
  ok:
    /from ['"]@\/lib\/search\/publish-regional-search-href['"]/.test(featured) &&
    /viewAllHref = publishRegionalSearchHref\(\)/.test(featured),
})

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

const menu = src('lib/site-menu.ts')
checks.push({
  label: 'legacy MENU Buy door is the regional list href',
  ok:
    /label: 'Buy',\s*href: '\/homes-for-sale\?view=list'/.test(menu) &&
    /label: 'All homes for sale', href: '\/homes-for-sale\?view=list'/.test(menu),
})

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
