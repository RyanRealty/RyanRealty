#!/usr/bin/env node
/**
 * check-market-narrative-integrity.mjs — ci:market-narrative-integrity (W8.7).
 *
 * §0 DATA ACCURACY: a published market narrative must not contain a fabricated
 * number. The generator (lib/data/market/market-narrative.ts) is deterministic
 * and interpolates ONLY the input stats row's values, so §0 holds by
 * construction — but "by construction" is only true if the code stays that way.
 * This gate EXECUTES the generator against fixtures and proves it:
 *
 *   A. Every number that appears in the generated prose equals a formatted
 *      value the fixture stats actually carry. A hardcoded or drifted figure
 *      (e.g. someone types "$500,000" into a template) fails immediately.
 *   B. The prose carries no banned punctuation (em-dash, en-dash, semicolon)
 *      and no banned real-estate cliché — the brand-voice hard-fail floor.
 *   C. A null/thin stats row produces NO market-direction claim it cannot
 *      support (no "seller's market" without a months-of-supply number).
 *
 * The module is pure + dependency-free so it can be esbuild-bundled here (same
 * rule as deliverable-path.ts). Exit 0 = every narrative number traces and the
 * voice floor holds. 1 = otherwise.
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const MODULE = 'lib/data/market/market-narrative.ts'
const problems = []

async function load() {
  const src = join(process.cwd(), MODULE)
  if (!existsSync(src)) return null
  const dir = mkdtempSync(join(tmpdir(), 'rr-narr-'))
  const out = join(dir, 'm.mjs')
  try {
    execFileSync(
      join(process.cwd(), 'node_modules/.bin/esbuild'),
      [src, '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error'],
      { stdio: 'pipe' },
    )
    return await import(pathToFileURL(out).href)
  } catch (err) {
    problems.push(`${MODULE}: could not bundle/execute — ${String(err.message).slice(0, 200)}`)
    return null
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Numeric CORE of a token, normalized so "$743,000", "$743,000,", "38 days",
 * "38", "4.3 months" all reduce to a comparable form: strip arrows, spaces,
 * unit words, thousands commas, and trailing sentence punctuation, keeping the
 * $ and % that carry meaning. "$743,000" -> "$743000", "38 days" -> "38".
 */
function coreOf(token) {
  return token
    .replace(/[↑↓]/g, '')
    .replace(/\b(days|day|months|month)\b/gi, '')
    .replace(/[,\s]/g, '')
    .replace(/[.,;:]+$/, '')
}

/** The set of numeric cores the fixture legitimately supports. */
function allowedNumbers(narrative) {
  const set = new Set()
  for (const f of narrative.figureTrace) set.add(coreOf(f.value))
  return set
}

/** Numeric core of every digit-bearing token in the prose. */
function numbersIn(text) {
  return (text.match(/\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|\$?\d+(?:\.\d+)?%?/g) ?? []).map(coreOf)
}

const BANNED_PUNCT = /[—–;]/
const BANNED_WORDS = /\b(stunning|nestled|boasts|charming|pristine|gorgeous|breathtaking|must-see|luxurious|turnkey|hidden gem|delve|tapestry|robust|seamless|elevate|unlock)\b/i

const mod = await load()
if (mod && typeof mod.buildMarketNarrative === 'function') {
  // Fixtures use a DIGIT-FREE period label ("this period") so the ONLY numbers
  // in the prose are stat figures — any other number is a fabrication.
  const base = {
    geoLabel: 'Bend',
    periodLabel: 'this period',
    medianSalePrice: 742500,
    soldCount: 262,
    medianDom: 38,
    avgSaleToListRatio: 0.984,
    medianPpsf: 415,
    endOfPeriodInventory: 486,
    yoyMedianPriceDeltaPct: 2.1,
    yoyDomChange: 5,
    yoyInventoryChangePct: -3.4,
    monthsOfSupply: 4.3,
  }
  const fixtures = [
    { name: "seller's (mos 3.1)", stats: { ...base, monthsOfSupply: 3.1 } },
    { name: 'balanced (mos 4.3)', stats: base },
    { name: "buyer's (mos 7.2)", stats: { ...base, monthsOfSupply: 7.2 } },
    { name: 'thin (mos null, dom null)', stats: { ...base, monthsOfSupply: null, medianDom: null, avgSaleToListRatio: null } },
    { name: 'declining prices', stats: { ...base, yoyMedianPriceDeltaPct: -6.7, yoyInventoryChangePct: 12.5 } },
    // The REAL data shape: sale-to-list is a fraction (0.9697), not a percent.
    // The independent review shipped a "1.0% of asking" because the generator
    // formatted the raw fraction. This fixture + check D below catch the class.
    { name: 'real fractional sale-to-list', stats: { ...base, avgSaleToListRatio: 0.9697 } },
    // 4-digit inventory must comma-group ("1,075"), not split into "107"+"5".
    { name: 'four-digit inventory', stats: { ...base, endOfPeriodInventory: 1075 } },
  ]

  for (const fx of fixtures) {
    const n = mod.buildMarketNarrative(fx.stats)
    const sections = [
      n.overview, n.priceAnalysis, n.speedAnalysis, n.inventoryAnalysis, n.buyerOutlook, n.sellerOutlook,
      ...n.faq.flatMap((f) => [f.q, f.a]),
    ]
    const allowed = allowedNumbers(n)

    // A. every number traces. The MoS thresholds in the FAQ explainer are
    // written as WORDS ("four to six"), so no bare 4/6 digit should appear — the
    // exemption is scoped to that one sentence only, so a fabricated "6 offers"
    // elsewhere is NOT excused (an evasion the global exemption allowed).
    for (const section of sections) {
      const isThresholdExplainer = /months or less|four to six|six or more/i.test(section)
      for (const num of numbersIn(section)) {
        if (isThresholdExplainer && (num === '4' || num === '6')) continue
        if (!allowed.has(num)) {
          problems.push(
            `${MODULE}: [${fx.name}] emits the number "${num}" which does not trace to any stat figure (${[...allowed].join(', ')}). §0: a market narrative may only state numbers from its source row.`,
          )
        }
      }
    }

    // D. §0 PLAUSIBILITY BAND on sale-to-list. Trace-membership alone cannot
    // catch a UNIT error: the mis-scaled "1.0%" is written into the trace by the
    // same mis-scaled formatter, so it "traces" and passes A. A sale-to-list
    // percentage is meaningless outside ~50-150% of asking, so an out-of-band
    // value is a formatting/unit bug regardless of tracing.
    if (fx.stats.avgSaleToListRatio != null) {
      const m = /sold for\s+(\d+(?:\.\d+)?)%\s+of asking/i.exec(n.priceAnalysis)
      if (!m) {
        problems.push(`${MODULE}: [${fx.name}] price analysis has no "sold for X% of asking" figure to plausibility-check.`)
      } else {
        const stl = Number(m[1])
        if (stl < 50 || stl > 150) {
          problems.push(
            `${MODULE}: [${fx.name}] sale-to-list reads ${stl}% of asking, outside the plausible 50-150% band. This is a unit/scale bug — sale-to-list is a fraction in the cache and must be multiplied by 100.`,
          )
        }
      }
    }

    // E. four-digit counts must comma-group so numbersIn (and a reader) do not
    // split "1075" into "107" + "5".
    if (fx.stats.endOfPeriodInventory != null && fx.stats.endOfPeriodInventory >= 1000) {
      if (!n.inventoryAnalysis.includes('1,075') && String(fx.stats.endOfPeriodInventory) === '1075') {
        problems.push(`${MODULE}: [${fx.name}] four-digit inventory is not comma-grouped ("1,075") — it renders as a splittable "1075".`)
      }
    }

    // B. voice floor
    for (const section of sections) {
      if (BANNED_PUNCT.test(section)) {
        problems.push(`${MODULE}: [${fx.name}] prose contains an em-dash/en-dash/semicolon (brand voice).`)
      }
      const w = BANNED_WORDS.exec(section)
      if (w) problems.push(`${MODULE}: [${fx.name}] prose contains the banned word "${w[0]}" (brand voice).`)
    }

    // C. no unsupported market-direction CLAIM when MoS is null. FAQ QUESTIONS
    // legitimately name both directions ("is it a buyer's or a seller's
    // market?") — that is not a claim, so exclude the question text and scan
    // only the analysis + outlook prose + FAQ answers.
    if (fx.stats.monthsOfSupply == null) {
      const claimText = [
        n.overview, n.priceAnalysis, n.speedAnalysis, n.inventoryAnalysis, n.buyerOutlook, n.sellerOutlook,
        ...n.faq.map((f) => f.a),
      ].join(' ').toLowerCase()
      if (/\b(is a (?:seller's|buyer's) market|this is a (?:seller's|buyer's) market|a balanced market\b)/.test(claimText)) {
        problems.push(
          `${MODULE}: [${fx.name}] claims a market direction with no months-of-supply number. §0: do not assert seller's/buyer's/balanced without the figure.`,
        )
      }
    }
  }
} else if (!problems.length) {
  problems.push(`${MODULE}: does not export buildMarketNarrative — the generator is missing.`)
}

console.log('Market narrative §0 + voice gate (ci:market-narrative-integrity)')
console.log('================================================================')
if (problems.length) {
  for (const pr of problems) console.error(`  ✗ ${pr}`)
  console.error(`\n\x1b[31m✗ ci:market-narrative-integrity: ${problems.length} problem(s).\x1b[0m`)
  process.exit(1)
}
console.log('✓ Every narrative number traces to its stats row; voice floor holds; no unsupported verdict.')
process.exit(0)
