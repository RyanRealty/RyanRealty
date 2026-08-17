#!/usr/bin/env node
/**
 * Communities index featured vs A-Z count lock.
 *
 * Featured and A-to-Z on /communities must share publishCommunityIndexCount
 * for the same community name. Snapshot wins. Founding case: Tetherow
 * featured 19 vs A-Z 12 (fleet 7452bc192dba7000c82f043688697c0d).
 *
 *   node scripts/check-publish-community-index-count.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/market/publish-community-index-count.ts')
checks.push({
  label: 'publishCommunityIndexCount prefers snapshot then index count',
  ok:
    /export function publishCommunityIndexCount/.test(helper) &&
    /export function communityIndexNameKey/.test(helper) &&
    helper.includes('snapshotCount') &&
    helper.includes('indexCount'),
})

const page = src('app/communities/page.tsx')
checks.push({
  label: 'communities index featured and A-Z share publishCommunityIndexCount',
  ok:
    /from ['"]@\/lib\/market\/publish-community-index-count['"]/.test(page) &&
    /publishCommunityIndexCount\(/.test(page) &&
    /communityIndexNameKey\(/.test(page) &&
    /publishedByName/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-community-index-count: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-community-index-count: ${checks.length}/${checks.length}`)
