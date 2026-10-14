#!/usr/bin/env node
/**
 * ci-pr-app-change.mjs — classify a pull request for the CI `changes` job.
 *
 * Writes app=true|false to GITHUB_OUTPUT. Same skip list as Vercel
 * (`scripts/lib/product-diff.mjs`), including a scripts-only package.json
 * edit. Unknown git state fails closed (app=true) so a product PR still builds.
 *
 * Usage (ci.yml changes job):
 *   GITHUB_BASE_SHA=... GITHUB_HEAD_SHA=... node scripts/ci-pr-app-change.mjs
 */
import { appendFileSync } from 'node:fs'
import { classifyProductDiff, listChangedFiles } from './lib/product-diff.mjs'

const prev = (process.env.GITHUB_BASE_SHA || process.env.PRODUCT_DIFF_PREV || '').trim()
const head = (process.env.GITHUB_HEAD_SHA || 'HEAD').trim() || 'HEAD'
const files = listChangedFiles({ prev, head })
const result = classifyProductDiff(files, { prev, head })
const app = result.status === 'skip' || result.status === 'empty' ? 'false' : 'true'

console.log(`[ci-pr-app-change] ${result.status} app=${app} files=${result.files.length}`)
for (const file of result.files.slice(0, 30)) {
  const mark = result.blockers.includes(file) ? 'BUILD' : 'skip'
  console.log(`  · ${mark} ${file}`)
}
if (result.files.length > 30) console.log(`  · … ${result.files.length - 30} more`)

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `app=${app}\n`)
}
process.exit(0)
