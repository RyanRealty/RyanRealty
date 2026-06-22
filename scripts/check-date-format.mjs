#!/usr/bin/env node
/**
 * check-date-format.mjs (ci:date-format) — audit p1.4.
 *
 * Dates should format through lib/format/date.ts (formatDate / formatDateTime,
 * brand timezone), not inline `toLocaleDateString` / `Intl.DateTimeFormat`.
 * Ratchet: existing inline formatters are baselined; NEW ones fail. Baseline
 * may only shrink as call sites migrate.
 *
 * Usage:
 *   node scripts/check-date-format.mjs                  # check
 *   node scripts/check-date-format.mjs --write-baseline # record current offenders
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const BASELINE = 'scripts/date-format-baseline.json'
const WRITE = process.argv.includes('--write-baseline')
const INLINE_DATE = /\.toLocaleDateString\(|Intl\.DateTimeFormat\(/

const files = [...walkFiles('app'), ...walkFiles('lib'), ...walkFiles('components')].filter(
  (f) => !f.startsWith('lib/format/') && !/\.test\.(ts|tsx)$/.test(f),
)
const offenders = files.filter((f) => INLINE_DATE.test(readFileSync(f, 'utf8'))).sort()

if (WRITE) {
  writeFileSync(BASELINE, JSON.stringify({ note: 'Files with inline date formatting — migrate to lib/format/date.ts. Count may only shrink.', files: offenders }, null, 2) + '\n')
  console.log(`Wrote ${offenders.length} offenders to ${BASELINE}`)
  process.exit(0)
}

const baseline = existsSync(BASELINE) ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).files ?? []) : new Set()
const neu = offenders.filter((f) => !baseline.has(f))

console.log('date-format gate (ci:date-format)')
console.log('=================================')
console.log(`${offenders.length} inline date formatters (baseline ${baseline.size})`)
if (neu.length) {
  console.error('\nNEW inline date formatting (use lib/format/date.ts formatDate/formatDateTime):')
  for (const f of neu) console.error(`  ✗ ${f}`)
  console.error('\nMigrate to the helper, or `node scripts/check-date-format.mjs --write-baseline` if truly unavoidable.')
  process.exit(1)
}
console.log('OK — no new inline date formatters.')
process.exit(0)
