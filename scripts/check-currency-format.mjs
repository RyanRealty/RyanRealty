#!/usr/bin/env node
/**
 * check-currency-format.mjs (ci:currency-format) — audit p1.4, extended SITE-139.
 *
 * Currency and compact-price text must format through lib/format/money.ts
 * (formatPrice / formatPriceCompact / formatPriceExact) — the one house
 * publisher — not a hand-rolled copy. Three checks:
 *
 *  1. CURRENCY — hand-rolled `Intl.NumberFormat(... currency ...)`. Ratchet:
 *     existing offenders are baselined (`files`); NEW ones fail. Baseline may
 *     only shrink.
 *
 *  2. COMPACT-LOWERCASE (SITE-139, Matt 2026-09-21) — a hand-rolled compact
 *     price template printing a lowercase k/m suffix ("$795k", "$1.2m")
 *     instead of the house's uppercase K/M ("$795K", "$1.2M"). ZERO
 *     TOLERANCE, no baseline: "map chips use $795k / $1.2M while listing
 *     cards still print $650K — one house publisher." Four real call sites
 *     did exactly this (lib/listing/publish-listing-figure.ts,
 *     lib/maps/animated-sales-map.ts, lib/data/crm/getContactListingAlerts.ts,
 *     components/tools/EquityProjectionChart.client.tsx) and check #1's
 *     Intl.NumberFormat regex never saw any of them — none call Intl at all.
 *     That was the hole this closes. One documented exception:
 *     lib/cma/recommend-once.ts pushes BOTH cases into a list of strings it
 *     MATCHES against upstream prose to de-duplicate a reprinted figure — a
 *     parser, not a publisher — allowlisted by exact path below.
 *
 *  3. COMPACT-TEMPLATE (ratchet) — a hand-rolled compact-price template in
 *     EITHER case: a `$${...}` interpolation that divides by 1000 / 1_000_000
 *     or calls `.toFixed(` inline, immediately followed by K/M/k/m. Existing
 *     offenders (search-filter crumbs, CMA valuation pages, LP calculators,
 *     dev prototypes, admin panels) are baselined (`compactTemplateFiles`) —
 *     several are kept ON PURPOSE because formatPriceCompact's exact-million
 *     case ("$1.0M") is worse than their own ("$1M") for a filter chip or a
 *     CMA figure; see the comment at each site. NEW hand-rolled copies fail.
 *     Baseline may only shrink.
 *
 * Usage:
 *   node scripts/check-currency-format.mjs                  # check
 *   node scripts/check-currency-format.mjs --write-baseline # record current offenders (checks 1 + 3)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const BASELINE = 'scripts/currency-format-baseline.json'
const WRITE = process.argv.includes('--write-baseline')

// ── check 1: inline Intl currency formatter ────────────────────────────────
const CURRENCY = /Intl\.NumberFormat\([^)]*currency/i

// ── checks 2 + 3: hand-rolled compact-price templates ──────────────────────
// A `$${...}` interpolation immediately followed by K/M/k/m (not part of a
// longer word, so "KB"/"kg" never match).
const COMPACT_LOWERCASE = /\$\$\{[^}]*\}\s*[km](?![A-Za-z])/
// Same shape, but only when the interpolation itself does the money math
// (divides by a thousand-ish number, or calls .toFixed) — the signature of a
// copy-pasted formatter rather than an unrelated "$${x}K" that isn't money.
const COMPACT_TEMPLATE = /\$\$\{[^}]*(?:\/\s*1_?000|\.toFixed\()[^}]*\}\s*[KMkm](?![A-Za-z])/

// Documented matchers/parsers, not publishers — see the file's own doc
// comment. Exempt from checks 2 and 3 (never from check 1).
const COMPACT_EXEMPT = new Set(['lib/cma/recommend-once.ts'])

const allFiles = [...walkFiles('app'), ...walkFiles('lib'), ...walkFiles('components')]
const currencyFiles = allFiles.filter(
  (f) => !f.startsWith('lib/format/') && !/\.test\.(ts|tsx)$/.test(f),
)
const compactFiles = currencyFiles.filter((f) => !COMPACT_EXEMPT.has(f))

const currencyOffenders = currencyFiles.filter((f) => CURRENCY.test(readFileSync(f, 'utf8'))).sort()

const lowercaseOffenders = []
for (const f of compactFiles) {
  const content = readFileSync(f, 'utf8')
  content.split('\n').forEach((line, i) => {
    if (COMPACT_LOWERCASE.test(line)) lowercaseOffenders.push(`${f}:${i + 1}: ${line.trim()}`)
  })
}

const compactTemplateOffenders = compactFiles
  .filter((f) => COMPACT_TEMPLATE.test(readFileSync(f, 'utf8')))
  .sort()

if (WRITE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Files with inline currency Intl.NumberFormat (files) or a hand-rolled ' +
          'compact-price template (compactTemplateFiles) — migrate to ' +
          'lib/format/money.ts. Either count may only shrink. The lowercase-suffix ' +
          'check (SITE-139) is never baselined: it must always be zero, outside the ' +
          'one documented lib/cma/recommend-once.ts matcher.',
        files: currencyOffenders,
        compactTemplateFiles: compactTemplateOffenders,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `Wrote ${currencyOffenders.length} currency offenders and ${compactTemplateOffenders.length} compact-template offenders to ${BASELINE}`,
  )
  process.exit(0)
}

const stored = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}
const currencyBaseline = new Set(stored.files ?? [])
const compactBaseline = new Set(stored.compactTemplateFiles ?? [])

const newCurrency = currencyOffenders.filter((f) => !currencyBaseline.has(f))
const newCompactTemplate = compactTemplateOffenders.filter((f) => !compactBaseline.has(f))

console.log('currency-format gate (ci:currency-format)')
console.log('=========================================')
console.log(`${currencyOffenders.length} inline currency formatters (baseline ${currencyBaseline.size})`)
console.log(`${compactTemplateOffenders.length} hand-rolled compact-price templates (baseline ${compactBaseline.size})`)
console.log(`${lowercaseOffenders.length} lowercase-suffix compact-price templates (zero tolerance)`)

let failed = false

if (lowercaseOffenders.length) {
  failed = true
  console.error(
    '\nSITE-139: hand-rolled compact price prints a lowercase k/m suffix ' +
      '("$795k") next to the house style\'s uppercase K/M ("$650K") — two ' +
      'house publishers disagreeing on one page. Use lib/format/money.ts ' +
      'formatPriceCompact, or match its uppercase K/M if the file must stay ' +
      'import-free:',
  )
  for (const h of lowercaseOffenders) console.error(`  ✗ ${h}`)
}

if (newCurrency.length) {
  failed = true
  console.error('\nNEW inline currency Intl.NumberFormat (use lib/format/money.ts formatPrice/formatPriceCompact):')
  for (const f of newCurrency) console.error(`  ✗ ${f}`)
}

if (newCompactTemplate.length) {
  failed = true
  console.error('\nNEW hand-rolled compact-price template (use lib/format/money.ts formatPriceCompact, or document why not):')
  for (const f of newCompactTemplate) console.error(`  ✗ ${f}`)
}

if (failed) {
  console.error(
    '\nMigrate to the helper, or `node scripts/check-currency-format.mjs --write-baseline` ' +
      'if truly unavoidable (checks 1 + 3 only — check 2 never baselines).',
  )
  process.exit(1)
}
console.log('OK — no new inline currency formatters, no new hand-rolled compact-price templates, no lowercase suffix anywhere.')
process.exit(0)
