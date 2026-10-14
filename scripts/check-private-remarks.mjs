#!/usr/bin/env node
/**
 * check-private-remarks.mjs (ci:private-remarks). Matt, 2026-10-13:
 * MLS private remarks are used for scoring only and are never displayed.
 * Fails if any public page, component or API route (or any lib file outside
 * the admin/scoring allowlist) references a private-remarks field.
 */
import { execSync } from 'node:child_process'

const PATTERN = /private_?remarks|privateOfficeRemarks|semiPrivateRemarks/i
// Server-only readers and the denylist that strips these fields.
const ALLOW = [
  /^app\/admin\//,
  /^app\/actions\/admin-/,
  /^app\/api\/admin\//,
  /^lib\/data\/admin\//,
  /^lib\/spark\.ts$/,
  /^lib\/listing-customfields\.ts$/,
  /^lib\/listing-mapper\.ts$/,
  /^lib\/site\/bend-new-construction\.ts$/,
  /^lib\/scoring\//,
  /\.test\.[cm]?[jt]sx?$/,
]
const files = execSync("git ls-files 'app/**' 'components/**' 'lib/**' 'pages/**'", { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(t|j)sx?$|\.mjs$/.test(f))
  .filter((f) => !ALLOW.some((re) => re.test(f)))
import { readFileSync } from 'node:fs'
const hits = []
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((l, i) => { if (PATTERN.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`) })
}
console.log('private remarks never displayed (ci:private-remarks)')
if (hits.length) {
  for (const h of hits) console.error('  ✗ ' + h)
  console.error('\nFAILED: private remarks are for scoring only. Read them in lib/data/admin or lib/scoring, never in public pages, components or API responses.')
  process.exit(1)
}
console.log(`OK: ${files.length} public files, no private remarks.`)
