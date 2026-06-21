#!/usr/bin/env node
/**
 * check-access-denied-loop.mjs (ci:access-denied) — guards the audit p0.2c fix.
 *
 * The (protected) admin layout redirects non-admins to /admin/access-denied.
 * That target page MUST live OUTSIDE the (protected) route group (under the
 * no-auth app/admin/layout.tsx). If it lives INSIDE (protected), the group's
 * role guard re-runs on it and redirects to itself forever (infinite loop).
 * It must also actually EXIST, or every access-denied redirect 404s.
 */
import { existsSync } from 'node:fs'

const OUTSIDE = 'app/admin/access-denied/page.tsx'
const INSIDE = 'app/admin/(protected)/access-denied/page.tsx'
const fails = []

if (!existsSync(OUTSIDE)) {
  fails.push(`${OUTSIDE} missing — redirects to /admin/access-denied would 404`)
}
if (existsSync(INSIDE)) {
  fails.push(`${INSIDE} exists INSIDE the guarded group — the (protected) layout will redirect it to itself (infinite loop). Move it to ${OUTSIDE}.`)
}

console.log('admin access-denied loop gate (ci:access-denied)')
console.log('================================================')
if (fails.length) {
  for (const f of fails) console.error('  ✗ ' + f)
  console.error('\nFAILED — see the p0.2c entry in docs/audit/REMEDIATION_PROGRESS.md.')
  process.exit(1)
}
console.log('OK — access-denied page exists outside the guarded group (no redirect loop).')
process.exit(0)
