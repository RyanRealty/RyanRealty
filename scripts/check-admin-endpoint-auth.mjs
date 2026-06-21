#!/usr/bin/env node
/**
 * check-admin-endpoint-auth.mjs (ci:admin-endpoint-auth) — audit p0.2b.
 *
 * Interactive admin endpoints must authenticate through the shared guards in
 * lib/auth/guards.ts (an admin session OR the cron secret), NOT a raw
 * `Bearer ${CRON_SECRET}`-only check that carries no operator identity.
 *
 * Scoped to the endpoints fixed in p0.2b. Add interactive admin endpoints here
 * as they are converted; genuinely cron-only maintenance routes (sync/*, etc.)
 * stay out.
 */
import { readFileSync } from 'node:fs'

const GUARDED = [
  'app/api/admin/gbp/set-website-utm/route.ts',
  'app/api/admin/expired-listing-lookup/route.ts',
]
const fails = []

for (const f of GUARDED) {
  let src
  try { src = readFileSync(f, 'utf8') } catch { fails.push(`${f}: missing`); continue }
  if (!src.includes("@/lib/auth/guards")) {
    fails.push(`${f}: must authenticate via @/lib/auth/guards (isAuthorizedAdminOrCron / requireAdminOr403), not a raw CRON_SECRET-only bearer`)
  }
}

console.log('admin endpoint auth gate (ci:admin-endpoint-auth)')
console.log('=================================================')
if (fails.length) {
  for (const x of fails) console.error('  ✗ ' + x)
  console.error('\nFAILED — see lib/auth/guards.ts and the p0.2b entry in docs/audit/REMEDIATION_PROGRESS.md.')
  process.exit(1)
}
console.log('OK — converted interactive admin endpoints authenticate via the shared guards.')
process.exit(0)
