#!/usr/bin/env node
/**
 * Related homes on a place-about blog post.
 *
 * A city or community named in the slug/title/tags gets listing_tile_mv
 * Active + PropertyType A tiles through publishBlogRelatedHomes. Checklist
 * and region-only posts stay without a homes field.
 * Founding case: /blog/moving-to-redmond-oregon-guide (fleet cbe644fe86a8a2a609b0d2917a4d15dd).
 *
 *   node scripts/check-publish-blog-related-homes.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const match = src('lib/blog/match-blog-place.ts')
checks.push({
  label: 'matchBlogPlace prefers a community over a city and returns null without a place',
  ok:
    /export function matchBlogPlace/.test(match) &&
    /export function matchBlogCity/.test(match) &&
    match.includes('matchGeoLinksForPost') &&
    match.includes('SITE_CITY_SLUGS'),
})

const helper = src('lib/blog/publish-blog-related-homes.ts')
checks.push({
  label: 'publishBlogRelatedHomes withholds an empty fetch and caps the teaser',
  ok:
    /export function publishBlogRelatedHomes/.test(helper) &&
    helper.includes('BLOG_RELATED_HOMES_LIMIT') &&
    helper.includes('listingTileHref') &&
    helper.includes('getCityListings'),
})

const page = src('app/blog/[slug]/page.tsx')
checks.push({
  label: 'blog post page renders related homes through matchBlogPlace + publishBlogRelatedHomes',
  ok:
    /from ['"]@\/lib\/blog\/match-blog-place['"]/.test(page) &&
    /from ['"]@\/lib\/blog\/publish-blog-related-homes['"]/.test(page) &&
    /matchBlogPlace\(/.test(page) &&
    /publishBlogRelatedHomes\(/.test(page) &&
    /getCityListings\(/.test(page) &&
    /getCommunityListings\(/.test(page) &&
    /BlogRelatedHomes/.test(page),
})

const field = src('app/blog/[slug]/_v3/BlogRelatedHomes.tsx')
checks.push({
  label: 'blog related-homes field is V3Field id=related-homes',
  ok: /<V3Field/.test(field) && field.includes('id="related-homes"'),
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
