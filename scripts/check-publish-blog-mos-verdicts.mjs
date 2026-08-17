#!/usr/bin/env node
/**
 * Blog MOS verdict lock.
 *
 * A months-of-supply figure may sit next to only the marketVerdict() bucket.
 * Founding case: /blog/central-oregon-market-report-july-2026 called 5.4
 * "the middle" and "buyer's territory" in the same paragraph
 * (fleet f865ead5d3569de3da1b49d9d5fff190).
 *
 *   node scripts/check-publish-blog-mos-verdicts.mjs
 */
import { readFileSync } from 'node:fs'

const checks = []

function src(path) {
  return readFileSync(path, 'utf8')
}

const helper = src('lib/blog/publish-blog-mos-verdicts.ts')
checks.push({
  label: 'rewriteBlogMosVerdicts routes buckets through marketVerdict',
  ok:
    /export function rewriteBlogMosVerdicts/.test(helper) &&
    /export function rewriteBlogMosTerritoryClaims/.test(helper) &&
    /from ['"]@\/lib\/market\/classify['"]/.test(helper) &&
    /marketVerdict\(/.test(helper) &&
    helper.includes("are firmly in buyer's territory"),
})

const page = src('app/blog/[slug]/page.tsx')
checks.push({
  label: 'blog post page rewrites MOS verdicts after the current-MOS list',
  ok:
    /from ['"]@\/lib\/blog\/publish-blog-mos-verdicts['"]/.test(page) &&
    /rewriteBlogMosVerdicts\(/.test(page) &&
    /const articleBody = rewriteBlogMosVerdicts\(currentMosBody\)/.test(page),
})

const failed = checks.filter((c) => !c.ok)
for (const c of checks) {
  console.log(`${c.ok ? 'ok' : 'FAIL'}  ${c.label}`)
}
if (failed.length) {
  console.error(`\npublish-blog-mos-verdicts: ${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\npublish-blog-mos-verdicts: ${checks.length}/${checks.length}`)
