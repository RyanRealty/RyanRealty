#!/usr/bin/env node
/**
 * Search status chrome lock.
 *
 * A pending/sold SEO preset must name that status on the filter chip and
 * on listing cards. Hardcoding "For Sale" or omitting Pending is a class.
 * Founding case: /homes-for-sale/bend/awbrey-butte/pending
 * (fleet 009a30599d628b93f6f094b1cbe63595).
 *
 *   node scripts/check-publish-search-status.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/search/publish-search-status.ts')
checks.push({
  label: 'SoR maps pending chip + Pending card badge',
  ok:
    /export function publishSearchStatusChip/.test(helper) &&
    /export function publishListingStatusBadge/.test(helper) &&
    helper.includes("value: 'pending', label: 'Under contract only'") &&
    helper.includes("kind: 'pending', label: 'Pending'"),
})

const bar = src('components/SearchFilterBar.tsx')
checks.push({
  label: 'SearchFilterBar chip uses publishSearchStatusChip',
  ok:
    /from ['"]@\/lib\/search\/publish-search-status['"]/.test(bar) &&
    /publishSearchStatusChip\(props\.statusFilter\)/.test(bar) &&
    /SEARCH_STATUS_FILTER_CHIPS/.test(bar) &&
    !/^\s+For Sale$/m.test(bar),
})

/**
 * Search inventory now prints status on the Field door via one mapper.
 * Follow that builder; the wrappers no longer assemble card chrome.
 */
const searchField = src('app/search/_v3/search-field-items.ts')
checks.push({
  label: 'search Field doors use publishListingStatusBadge',
  ok:
    /from ['"]@\/lib\/search\/publish-search-status['"]/.test(searchField) &&
    /publishListingStatusBadge\(row\.StandardStatus\)/.test(searchField),
})

const card = src('components/site/ListingCard.tsx')
checks.push({
  label: 'ListingCard has a pending badge kind',
  ok: /ListingBadge = .*'pending'/.test(card) && /pending: 'bg-primary text-primary-foreground'/.test(card),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-search-status: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-search-status: ${checks.length}/${checks.length}`)
