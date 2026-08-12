#!/usr/bin/env node
/**
 * check-market-formula.mjs (ci:market-formula) — audit p0.4.
 *
 * Months of supply is active listings / (homes closed in the last 6 months / 6)
 * per CLAUDE.md §0 — NEVER "active listings divided by (closed last 30 days
 * times 2)". Public market surfaces must use MOS_METHODOLOGY_CLAUSE /
 * MOS_THRESHOLD_CLAUSE / marketVerdict() from lib/market/classify.ts so the
 * published methodology can never drift from the canonical formula again.
 *
 * CHECK 3 (added 2026-08-12): the DIGITS, not the formula. A public surface may
 * not round a months-of-supply value itself. lib/format/months-of-supply.ts is
 * the single boundary-safe display rule — 4.02 prints 4.1, 5.97 prints 5.9 —
 * because naive rounding walks the printed number across a threshold the raw
 * value does not cross, and the page then prints a figure its own verdict and its
 * own threshold sentence contradict. `Math.round(mos * 10) / 10` and
 * `mos.toFixed(1)` are exactly the two expressions that did it, twice: once
 * inside lib/site/market-faq.ts, and once on /communities/<slug>, which published
 * 4.0 in its Instrument, 4.1 in its FAQ answer, and 4.1 in its Dataset variable —
 * three values of one statistic on one page, every gate green. Checks 1 and 2
 * could not see it: check 1 matches a formula STRING and check 2 only reads
 * lib/data + lib/site. This one reads the same public surfaces check 1 does.
 *
 * The pre-existing sites are a FROZEN LEDGER, not an exemption: a file not listed
 * may not round at all, and a listed file may not grow. The count only shrinks,
 * and a file that reaches zero comes off the list.
 */
import { readFileSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const BAD_FORMULA = /closed last 30 days (times 2|\* ?2)/i
const SELF = new Set([
  'lib/market/classify.ts',
  'lib/market/classify.test.ts',
  'scripts/check-market-formula.mjs',
])

// components/ is IN scope (added 2026-08-02). This gate's own docblock names
// "closed last 30 days times 2" as the exact string it exists to prevent — and
// that string shipped, live, in components/site/CityComparisonTable.tsx beside
// a number computed with the 6-month formula, because the scan stopped at app/
// and lib/. A presenter component is a public market surface like any page.
const files = [...walkFiles('app'), ...walkFiles('lib'), ...walkFiles('components')].filter(
  (f) => !SELF.has(f),
)
const formulaHits = files.filter((f) => BAD_FORMULA.test(readFileSync(f, 'utf8')))

// Ban inline MoS verdict thresholds in the data layer (audit p0.4b) — the
// <=4 / <6 / >=6 boundaries live ONLY in lib/market/classify.ts (marketVerdict).
// Scoped to the reusable data layer; page-prose verdict sites are a tracked
// follow-up (correct today, article-variation labels).
const THRESHOLD = /\bmos\b\s*(<=\s*4|<\s*6|>=\s*6)/i
const dataFiles = [...walkFiles('lib/data'), ...walkFiles('lib/site')].filter((f) => !SELF.has(f))
const thresholdHits = dataFiles.filter((f) => THRESHOLD.test(readFileSync(f, 'utf8')))

// ── CHECK 3: nobody rounds months of supply except the canonical formatter ──
// An identifier naming the statistic: mos (not "mosaic"), monthsOfSupply,
// months_of_supply, monthsSupply, with any property path around it, so
// `input.mosDisplay` and `pulse.monthsOfSupply` both match.
//
// CASE-SENSITIVE ON PURPOSE. Under /i the guard `mos(?![a-z])` also rejects an
// uppercase next character, so `mosRaw` and `mosDisplay` — the two identifiers
// this rule exists to catch — silently fell out of scope while "mosaic" was the
// only thing it excluded. Case-sensitive, `mos` followed by a non-lowercase char
// keeps both and still drops mosaic/moss.
const MOS_IDENT =
  '[A-Za-z0-9_$.?]*(?:mos(?![a-z])|Mos(?![a-z])|monthsOfSupply|MonthsOfSupply|months_of_supply|monthsSupply)[A-Za-z0-9_$.?]*'
const MOS_ROUND = new RegExp(`Math\\.round\\(\\s*${MOS_IDENT}\\s*\\*\\s*10\\s*\\)\\s*\\/\\s*10`, 'g')
// Only the display forms the canon covers: no argument, 0, or 1 decimal. Deeper
// precision is not the printed-figure class this rule governs.
const MOS_TOFIXED = new RegExp(`${MOS_IDENT}\\.toFixed\\(\\s*[01]?\\s*\\)`, 'g')

// The one file allowed to round it, plus the classifier and the tests that pin
// the boundaries. Not a ledger: these ARE the canonical rule and its proof.
const MOS_DISPLAY_OWNERS = new Set([
  'lib/format/months-of-supply.ts',
  'lib/format/months-of-supply.test.ts',
  'lib/market/classify.ts',
  'lib/market/classify.test.ts',
  'lib/site/market-faq.ts',
  'lib/site/market-faq.test.ts',
])

// FROZEN LEDGER of surfaces still rounding at the call site, measured
// 2026-08-12. Every one of them can print a figure its own verdict contradicts
// at a boundary value. May only SHRINK: a file not listed here may not round at
// all, and a listed file may not grow. Fix one by calling formatMonthsOfSupply
// and lowering (or deleting) its row in the same commit.
//
// app/dev/** is the prototype harness and is out of scope: nothing there is
// published. Everything else that renders, emails, narrates, or scripts a
// months-of-supply figure IS in scope, video and CMA included, because §0 does
// not stop at the web surface.
//
// PAID DOWN 2026-08-12: the two neighborhood-route rows are gone. That page
// rounded in _v3/neighborhood-sections.ts to print the figure and again in
// page.tsx to decide whether printing it was safe, and the second rounding was
// there only because the first one was unsafe. Both now go through
// formatMonthsOfSupply, which is boundary-safe by construction, so the figure
// ships on every row that carries one instead of being withheld at 4.02 — a
// value the same page was already publishing through buildMarketFaq.
//
// PAID DOWN 2026-08-12: the app/pulse/page.tsx row is gone, both sites with it.
// That page derived `Math.round(mosRaw * 10) / 10` and printed it with
// `.toFixed(1)` in the Instrument, directly under a headline verdict taken from
// marketVerdict(mosRaw) and a source line carrying MOS_THRESHOLD_CLAUSE. At a
// stored 4.02 it printed "4.0 months of supply" beside "a balanced market" and
// the sentence "4 months of supply or less is a seller's market" — the exact
// three-way contradiction check 3 exists to catch, one viewport tall. It now
// calls formatMonthsOfSupply(mosRaw), so the digits and the verdict cannot
// disagree, and the route-local builder takes the formatted STRING rather than a
// number so the rounding cannot reappear at the call site.
const MOS_ROUNDING_LEDGER = {
  'app/actions/dashboard.ts': 1,
  'app/housing-market/page.tsx': 2,
  'lib/area-market.ts': 1,
  'lib/cma/market.ts': 1,
  'lib/data/market/market-narrative.ts': 1,
  'lib/youtube-market-report/citation-builder.ts': 1,
  'lib/youtube-market-report/generate-script.ts': 2,
  'lib/youtube-market-report/scene-builders.ts': 3,
  'components/pulse/PulseHero.tsx': 1,
  'components/site/PriceBandTable.tsx': 1,
  'components/site/sell/SellMarketContext.tsx': 1,
}

const displayScope = [...walkFiles('app'), ...walkFiles('lib'), ...walkFiles('components')].filter(
  (f) => !SELF.has(f) && !MOS_DISPLAY_OWNERS.has(f) && !f.startsWith('app/dev/'),
)
const roundingHits = []
for (const f of displayScope) {
  const src = readFileSync(f, 'utf8')
  const n = (src.match(MOS_ROUND)?.length ?? 0) + (src.match(MOS_TOFIXED)?.length ?? 0)
  if (n === 0) continue
  const allowed = MOS_ROUNDING_LEDGER[f] ?? 0
  if (n > allowed) roundingHits.push({ file: f, found: n, allowed })
}

console.log('market MoS-formula gate (ci:market-formula)')
console.log('===========================================')
let failed = false
if (formulaHits.length) {
  failed = true
  console.error('Files publishing the WRONG months-of-supply formula ("closed last 30 days times 2"):')
  for (const h of formulaHits) console.error(`  ✗ ${h}`)
  console.error('  Use MOS_METHODOLOGY_CLAUSE from lib/market/classify.ts (canonical §0 formula).')
}
if (thresholdHits.length) {
  failed = true
  console.error('Data-layer files with inline MoS thresholds (use marketVerdict() from lib/market/classify.ts):')
  for (const h of thresholdHits) console.error(`  ✗ ${h}`)
}
if (roundingHits.length) {
  failed = true
  console.error('Surfaces rounding months of supply themselves (use formatMonthsOfSupply from lib/format/months-of-supply.ts):')
  for (const h of roundingHits) {
    console.error(`  ✗ ${h.file} — ${h.found} site(s), ledger allows ${h.allowed}`)
  }
  console.error('  Math.round(mos*10)/10 and mos.toFixed(1) print a number that can cross a')
  console.error('  threshold the raw value does not, contradicting the verdict beside it (§0).')
}
if (failed) {
  console.error('\nFAILED.')
  process.exit(1)
}
const debt = Object.entries(MOS_ROUNDING_LEDGER).reduce((a, [, n]) => a + n, 0)
console.log(`OK — canonical MoS formula + data-layer verdicts via lib/market/classify.ts.`)
console.log(`     ${debt} call-site rounding(s) still on the frozen ledger; the count only shrinks.`)
process.exit(0)
