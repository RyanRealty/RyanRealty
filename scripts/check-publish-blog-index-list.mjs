#!/usr/bin/env node
/**
 * Blog index ItemList lock.
 *
 * Paginated /blog JSON-LD lists each published post once, with
 * collection-global positions. Founding case: Vacation Rental Rules on
 * page 2 and page 3 (fleet b75fc748ac2130f76a109a6f045121a9).
 *
 *   node scripts/check-publish-blog-index-list.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/blog/publish-blog-index-list.ts')
checks.push({
  label: 'publishBlogIndexItemList uses global positions and drops duplicate slugs',
  ok:
    /export function publishBlogIndexItemList/.test(helper) &&
    helper.includes('input.offset + itemListElement.length + 1') &&
    helper.includes('seen.has(slug)') &&
    helper.includes('numberOfItems: input.total'),
})

const dal = src('lib/data/blog/getPublishedBlogPosts.ts')
checks.push({
  label: 'getPublishedBlogPosts orders published_at DESC then id ASC',
  ok:
    /published-blog-posts-v4/.test(dal) &&
    /\.order\('published_at', \{ ascending: false \}\)/.test(dal) &&
    /\.order\('id', \{ ascending: true \}\)/.test(dal),
})

const page = src('app/blog/page.tsx')
checks.push({
  label: 'blog index JSON-LD goes through publishBlogIndexItemList',
  ok:
    /from ['"]@\/lib\/blog\/publish-blog-index-list['"]/.test(page) &&
    /publishBlogIndexItemList\(/.test(page) &&
    /mainEntity: publishBlogIndexItemList\(/.test(page) &&
    !/position: i \+ 1/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-blog-index-list: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-blog-index-list: ${checks.length}/${checks.length}`)
