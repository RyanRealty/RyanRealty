#!/usr/bin/env node
/**
 * check-currency-format.mjs (ci:currency-format) — audit p1.4.
 *
 * Currency must format through lib/format/money.ts (formatPrice /
 * formatPriceCompact), not hand-rolled `Intl.NumberFormat(... currency ...)`.
 * Ratchet: existing offenders are baselined; NEW ones fail. The baseline may
 * only shrink as call sites migrate to the helper.
 *
 * Usage:
 *   node scripts/check-currency-format.mjs                  # check
 *   node scripts/check-currency-format.mjs --write-baseline # record current offenders
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'

const BASELINE = 'scripts/currency-format-baseline.json'
const WRITE = process.argv.includes('--write-baseline')
const CURRENCY = /Intl\.NumberFormat\([^)]*currency/i

function walk(dir, acc = []) {
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) { if (!/(^|\/)(node_modules|\.next|\.git)(\/|$)/.test(p)) walk(p, acc) }
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

const files = [...walk('app'), ...walk('lib'), ...walk('components')].filter(
  (f) => !f.startsWith('lib/format/') && !/\.test\.(ts|tsx)$/.test(f),
)
const offenders = files.filter((f) => CURRENCY.test(readFileSync(f, 'utf8'))).sort()

if (WRITE) {
  writeFileSync(BASELINE, JSON.stringify({ note: 'Files with inline currency Intl.NumberFormat — migrate to lib/format/money.ts. Count may only shrink.', files: offenders }, null, 2) + '\n')
  console.log(`Wrote ${offenders.length} offenders to ${BASELINE}`)
  process.exit(0)
}

const baseline = existsSync(BASELINE) ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).files ?? []) : new Set()
const neu = offenders.filter((f) => !baseline.has(f))

console.log('currency-format gate (ci:currency-format)')
console.log('=========================================')
console.log(`${offenders.length} inline currency formatters (baseline ${baseline.size})`)
if (neu.length) {
  console.error('\nNEW inline currency Intl.NumberFormat (use lib/format/money.ts formatPrice/formatPriceCompact):')
  for (const f of neu) console.error(`  ✗ ${f}`)
  console.error('\nMigrate to the helper, or `node scripts/check-currency-format.mjs --write-baseline` if truly unavoidable.')
  process.exit(1)
}
console.log('OK — no new inline currency formatters.')
process.exit(0)
