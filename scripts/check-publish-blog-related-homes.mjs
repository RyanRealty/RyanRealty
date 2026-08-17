#!/usr/bin/env node
/**
 * Blog related-homes publish lock.
 *
 * Place posts (a named community, or a city with buy-intent) render a
 * related-homes Ledger of live tiles. Lifestyle posts do not invent one.
 * Contextual CTA: place → see those homes; otherwise talk to a broker.
 *
 * Founding cases: /blog/brasada-ranch-central-oregon,
 * /blog/caldera-springs-buyers-guide, /blog/best-neighborhoods-bend-retirees
 * vs /blog/arts-culture-central-oregon and /blog/retirement-central-oregon.
 *
 *   node scripts/check-publish-blog-related-homes.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/blog/publish-blog-related-homes.ts')
checks.push({
  label: 'matchBuyablePlaceForPost + publishBlogRelatedHomes withhold without a place',
  ok:
    /export function matchBuyablePlaceForPost/.test(helper) &&
    /export function publishBlogRelatedHomes/.test(helper) &&
    /if \(!input\.place\) return null/.test(helper) &&
    /BUY_INTENT/.test(helper) &&
    /matchGeoLinksForPost/.test(helper),
})

checks.push({
  label: 'lifestyle CTA is Talk to a broker; place CTA is See {label} homes',
  ok:
    /export function publishBlogContextualCta/.test(helper) &&
    helper.includes("label: 'Talk to a broker'") &&
    helper.includes('href: \'/contact\'') &&
    helper.includes('See ${place.label} homes'),
})

const dal = src('lib/data/blog/getBlogRelatedHomes.ts')
checks.push({
  label: 'DAL uses alias-aware resort tiles or city SFR, never invents rows',
  ok:
    /export async function getBlogRelatedHomes/.test(dal) &&
    /fetchAllCityActiveSfr/.test(dal) &&
    /resortTilesForSlug/.test(dal) &&
    /getCityListings/.test(dal) &&
    /propertyType: 'A'/.test(dal),
})

const rows = src('app/blog/[slug]/_v3/blog-related-homes.ts')
checks.push({
  label: 'Ledger rows publish formatPublishedAsk',
  ok:
    /from ['"]@\/lib\/listing\/publish-listing-ask['"]/.test(rows) &&
    /formatPublishedAsk\(tile\.listPrice\)/.test(rows) &&
    !/formatPrice\(/.test(rows),
})

const page = src('app/blog/[slug]/page.tsx')
checks.push({
  label: 'blog post page gates related homes and contextual CTA through the publisher',
  ok:
    /from ['"]@\/lib\/blog\/publish-blog-related-homes['"]/.test(page) &&
    /from ['"]@\/lib\/data\/blog\/getBlogRelatedHomes['"]/.test(page) &&
    /matchBuyablePlaceForPost\(/.test(page) &&
    /publishBlogRelatedHomes\(/.test(page) &&
    /publishBlogContextualCta\(/.test(page) &&
    /getBlogRelatedHomes\(/.test(page) &&
    /id="related-homes"/.test(page) &&
    /Talk to a broker/.test(page) === false,
})

checks.push({
  label: 'related-homes Ledger is not a second Keep reading block',
  ok:
    /id="related-homes"/.test(page) &&
    /On the market now/.test(page) &&
    !/id="related-homes"[\s\S]{0,400}Keep reading/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-blog-related-homes: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-blog-related-homes: ${checks.length}/${checks.length}`)
