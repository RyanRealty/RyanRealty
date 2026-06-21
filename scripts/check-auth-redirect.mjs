#!/usr/bin/env node
/**
 * check-auth-redirect.mjs (ci:auth-redirect) — guards the audit p0.2 open-redirect fix.
 *
 * Post-auth `next` redirects must be sanitized through safeRedirectPath()
 * (lib/auth/safeRedirect.ts), NOT the old `next.startsWith('/') ? next : ...`
 * check that let `//evil.com` (protocol-relative) through as an open redirect.
 */
import { readFileSync } from 'node:fs'

const FILES = ['app/actions/auth.ts', 'app/auth/callback/route.ts']
const WEAK = /startsWith\(\s*['"]\/['"]\s*\)\s*\?/
const fails = []

for (const f of FILES) {
  let src
  try { src = readFileSync(f, 'utf8') } catch { fails.push(`${f}: missing`); continue }
  if (WEAK.test(src)) fails.push(`${f}: uses the weak \`startsWith('/') ? ...\` redirect check — route it through safeRedirectPath()`)
  if (!src.includes('safeRedirectPath')) fails.push(`${f}: must import + use safeRedirectPath from @/lib/auth/safeRedirect`)
}

console.log('auth redirect-safety gate (ci:auth-redirect)')
console.log('============================================')
if (fails.length) {
  for (const x of fails) console.error('  ✗ ' + x)
  console.error('\nFAILED — see lib/auth/safeRedirect.ts and the p0.2 entry in docs/audit/REMEDIATION_PROGRESS.md.')
  process.exit(1)
}
console.log('OK — auth redirects are sanitized via safeRedirectPath().')
process.exit(0)
