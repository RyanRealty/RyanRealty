#!/usr/bin/env node
/**
 * Search count publish lock.
 *
 * URL filters share one filter-match number. A map-viewport count may print
 * only when it differs, labeled "in this map view". City browse that is all
 * property types must say so next to an SFR FAQ.
 * Founding case: /homes-for-sale?maxPrice=800000&beds=3 sheet 409 vs
 * results 318 (fleet d8f52b39ceceb240344f408d574fee27 and siblings).
 *
 *   node scripts/check-publish-search-count.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/search/publish-search-count.ts')
checks.push({
  label: 'publishSearchCountPair withholds a same-value viewport and labels a different one',
  ok:
    /export function publishSearchCountPair/.test(helper) &&
    helper.includes("grain: 'filter-match'") &&
    helper.includes("grain: 'map-viewport'") &&
    helper.includes('homes in this map view') &&
    helper.includes('return { match, viewport: null }'),
})

const sheet = src('components/search/AllFiltersSheet.tsx')
checks.push({
  label: 'All filters apply label gates through publishSearchCount',
  ok:
    /from ['"]@\/lib\/search\/publish-search-count['"]/.test(sheet) &&
    /publishSearchCount\(/.test(sheet) &&
    sheet.includes('onPointerDown={handleApply}'),
})

const map = src('components/search/MapSearchView.tsx')
checks.push({
  label: 'Field count is one map-viewport number',
  ok:
    /from ['"]@\/lib\/search\/publish-search-count['"]/.test(map) &&
    /publishSearchCount\(/.test(map) &&
    map.includes("grain: 'map-viewport'") &&
    map.includes('countSearchListings(') &&
    map.includes('publishSearchCountPair(') === false,
})

const filters = src('components/search/SearchFilters.tsx')
checks.push({
  label: '390 filter chips are in the layout, not hidden sm:contents',
  ok:
    !filters.includes('hidden flex-wrap items-center gap-2 sm:contents') &&
    filters.includes('overflow-x-auto') &&
    filters.includes('min-h-11') &&
    filters.includes('All filters'),
})

const city = src('app/search/[...slug]/page.tsx')
checks.push({
  label: 'city browse header gates through publishSearchCount all-types',
  ok:
    /from ['"]@\/lib\/search\/publish-search-count['"]/.test(city) &&
    /publishSearchCount\(/.test(city) &&
    city.includes("grain: filterOpts.propertyType ? 'filter-match' : 'all-types'"),
})

const faq = src('lib/site/market-faq.ts')
checks.push({
  label: 'FAQ count question names single-family when the answer is SFR',
  ok:
    faq.includes('How many single-family homes are for sale') &&
    faq.includes('active single-family listings'),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-search-count: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log('publish-search-count: ok')
