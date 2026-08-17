#!/usr/bin/env node
/**
 * Intra-page place figures on a blog post share one SoR.
 *
 * Drive ranges rewrite to the article's most specific pair. The live median
 * gap is the pulse pair, not the mid-2025 table.
 * Founding case: /blog/moving-to-redmond-oregon-guide (fleet 154056f672766e8786ab617fec90d627).
 *
 *   node scripts/check-publish-blog-place-figures.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/blog/publish-blog-place-figures.ts')
checks.push({
  label: 'publishBlogMedianGap withholds a missing or inverted pulse pair',
  ok:
    /export function publishBlogMedianGap/.test(helper) &&
    /export function rewriteBlogPlaceFigures/.test(helper) &&
    helper.includes('BLOG_REDMOND_BEND_DRIVE') &&
    helper.includes('gap <= 0'),
})

const page = src('app/blog/[slug]/page.tsx')
checks.push({
  label: 'blog post page rewrites place figures from pulse + the drive SoR',
  ok:
    /from ['"]@\/lib\/blog\/publish-blog-place-figures['"]/.test(page) &&
    /publishBlogMedianGap\(/.test(page) &&
    /rewriteBlogPlaceFigures\(/.test(page) &&
    /getMarketPulse\(\{ geoType: 'city', geoSlug: 'redmond' \}\)/.test(page) &&
    /getMarketPulse\(\{ geoType: 'city', geoSlug: 'bend' \}\)/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-blog-place-figures: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-blog-place-figures: ${checks.length}/${checks.length}`)
