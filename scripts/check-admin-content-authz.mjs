#!/usr/bin/env node
/**
 * check-admin-content-authz.mjs (ci:admin-content-authz) — admin rebuild RC5.
 *
 * The content-write server actions (blog / guides / communities / site pages /
 * brokerage) are public `'use server'` POST endpoints that mutate public-site
 * content via the SERVICE ROLE. Several used to write BEFORE (or without) any
 * caller check — an unauthenticated stored-XSS / defacement hole. The RC5 fix
 * added an in-body `checkAdminAction(<capability>)` guard with a fail-closed
 * early return to each mutating action.
 *
 * This gate is the regression lock for those guards. Per file it asserts:
 *   1. `checkAdminAction` is imported.
 *   2. The number of `checkAdminAction(` calls is >= the floor (a removed guard
 *      drops the count and fails).
 *   3. Every guard's result is actually checked — the count of `checkAdminAction(`
 *      calls must not exceed the count of `!<x>.ok` early-return checks, so a
 *      guard can never be called-but-ignored (fake protection).
 *
 * Raising a floor (adding a new guarded action) is a deliberate edit here.
 * Lowering one requires justifying why an action no longer needs a caller check.
 *
 * Modes:
 *   node scripts/check-admin-content-authz.mjs           → exit 1 on any violation
 *   node scripts/check-admin-content-authz.mjs --report  → human summary, never exits 1
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REPORT = process.argv.includes('--report')

// Per-file floor of required checkAdminAction guards (the RC5 surface).
const REQUIRED = {
  'app/actions/blog.ts': 3,
  'app/actions/guides.ts': 3,
  'app/actions/geo-places.ts': 3,
  'app/actions/site-pages.ts': 1,
  'app/actions/brokerage.ts': 7,
}

const fails = []
const summary = []

for (const [rel, floor] of Object.entries(REQUIRED)) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    fails.push(`${rel}: MISSING — a guarded content-write action file was removed or renamed.`)
    continue
  }
  const src = readFileSync(abs, 'utf8')
  const imported = /from '@\/lib\/admin\/require-admin'/.test(src) && /checkAdminAction/.test(src)
  const calls = (src.match(/checkAdminAction\(/g) || []).length
  // Fail-closed early returns that consume a guard result: `if (!<x>.ok)` .
  const okChecks = (src.match(/if \(!\s*[A-Za-z0-9_.]+\.ok\)/g) || []).length

  summary.push(`${rel}: ${calls} guards (floor ${floor}), ${okChecks} ok-checks`)

  if (!imported) fails.push(`${rel}: does not import checkAdminAction from @/lib/admin/require-admin.`)
  if (calls < floor) {
    fails.push(`${rel}: ${calls} checkAdminAction guard(s), floor is ${floor} — a caller check was removed.`)
  }
  if (calls > okChecks) {
    fails.push(
      `${rel}: ${calls} checkAdminAction call(s) but only ${okChecks} fail-closed !ok check(s) — a guard is called but its result is ignored.`,
    )
  }
}

if (REPORT) {
  console.log('admin-content-authz — RC5 content-write guard floors:')
  for (const s of summary) console.log('  ' + s)
  if (fails.length) {
    console.log('\nWould fail:')
    for (const f of fails) console.log('  ✗ ' + f)
  } else {
    console.log('\n  ✓ all content-write actions carry their fail-closed admin guards')
  }
  process.exit(0)
}

if (fails.length) {
  console.error('✗ ci:admin-content-authz — content-write authorization regressed:\n')
  for (const f of fails) console.error('  ✗ ' + f)
  console.error('\nThese actions mutate public-site content via the service role. Each mutating')
  console.error('action must keep its in-body checkAdminAction(<capability>) guard with a')
  console.error('fail-closed early return. See CLAUDE.md RC5 + lib/admin/require-admin.ts.')
  process.exit(1)
}

console.log(`✓ ci:admin-content-authz — ${Object.keys(REQUIRED).length} content-write action files retain their admin guards`)
