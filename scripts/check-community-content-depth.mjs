#!/usr/bin/env node
/**
 * check-community-content-depth.mjs — G33b, the depth + provenance half of the
 * community content contract.
 *
 * WHY THIS EXISTS SEPARATELY FROM G33. check-community-content.mjs (G33) asks
 * only whether `about_prose` is NON-EMPTY. That was the right question during
 * the 2026-05 rollout, when the problem was pages with no content at all. It is
 * the wrong question now: on 2026-08-02 all 27 configs passed G33 while their
 * median prose was 181 words, and the shortest (widgi-creek) was 113. A 113-word
 * stub is not editorial, and G33 called it covered.
 *
 * That mattered because the 2026-08-02 website audit traced the site's zero
 * non-brand search visibility to exactly this: competitors on plain WordPress
 * ranked for named-neighborhood queries because they published long-form
 * ARTICLES, while this site published data pages. Search Console then confirmed
 * it from the site's own numbers, 7 of the top 20 pages being blog posts holding
 * positions 4.5-8.9 against 14.5 site-wide. Depth is the product here, so depth
 * gets a gate.
 *
 * WHAT IT ENFORCES, per data/resort-community-<slug>.json:
 *
 *   1. DEPTH. about_prose must reach MIN_WORDS. Ratcheted per slug against
 *      scripts/community-content-depth-baseline.json: a config may never lose
 *      words it already had. Shrink-only in the good direction.
 *
 *   2. PROVENANCE. Any config whose prose clears SOURCES_REQUIRED_ABOVE words
 *      must carry a `sources` array of {url, publisher, supports} entries.
 *      G33's own docblock says "Content facts are NEVER invented" and nothing
 *      checked it. Long-form multiplies the number of factual claims on the
 *      page, so the sourcing requirement scales with the prose.
 *
 *   3. NO MARKET FIGURES IN STATIC PROSE (§0). Prices, percentages, medians,
 *      inventory counts, days on market and months-of-supply claims must NOT be
 *      hardcoded here. Those numbers are live, they change hourly, and the page
 *      already renders them from the database through live components right
 *      beside this prose. A market figure frozen into JSON is stale the day it
 *      ships. This is the same class as the 2026-08-02 CityComparisonTable
 *      defect, where published methodology drifted from the live computation.
 *
 * CLI: default pass/fail · --report (human, exit 0) · --write-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DATA_DIR = join(ROOT, 'data')
const BASELINE_PATH = join(ROOT, 'scripts', 'community-content-depth-baseline.json')

const args = new Set(process.argv.slice(2))
const WRITE_BASELINE = args.has('--write-baseline')
const REPORT = args.has('--report')

/** Editorial floor. Below this it is a stub, not an article. */
const MIN_WORDS = 400
/** Above this, the claim density demands a sources array. */
const SOURCES_REQUIRED_ABOVE = 300

/**
 * Market figures that must never be frozen into static prose.
 * Deliberately narrow: it must catch "$875,000", "sell for around $1.2M",
 * "12.4% appreciation", "median price", "months of supply", "days on market" —
 * and NOT catch a street address, a founding year, an acreage, an elevation, or
 * an HOA dues figure, all of which are durable facts this prose SHOULD carry.
 */
const MARKET_FIGURE_PATTERNS = [
  { re: /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|million)?\b/i, what: 'a dollar figure' },
  { re: /\b\d+(?:\.\d+)?\s?%/, what: 'a percentage' },
  { re: /\bmedian\s+(?:list\s+|sale\s+|sales\s+|home\s+)?price/i, what: 'a median price claim' },
  { re: /\bmonths?\s+of\s+supply\b/i, what: 'a months-of-supply claim' },
  { re: /\bdays?\s+on\s+market\b/i, what: 'a days-on-market claim' },
  { re: /\bprice\s+per\s+(?:square\s+foot|sq\.?\s?ft)/i, what: 'a price-per-sqft claim' },
  { re: /\bappreciat(?:ed|ion|ing)\b/i, what: 'an appreciation claim' },
  { re: /\bsell(?:s|ing)?\s+for\s+(?:about|around|roughly|approximately)?\s*\$?\d/i, what: 'a sale-price claim' },
]

/** HOA dues are a durable, published fact and live in their own numeric keys. */
const DUES_CONTEXT = /\b(?:hoa|dues|assessment|association fee)\b/i

function configFiles() {
  return readdirSync(DATA_DIR)
    .filter((f) => f.startsWith('resort-community-') && f.endsWith('.json'))
    .sort()
}

const slugOf = (file) => file.replace(/^resort-community-/, '').replace(/\.json$/, '')

function proseOf(config) {
  const p = config.about_prose
  if (Array.isArray(p)) return p.filter((x) => typeof x === 'string').join('\n\n')
  return typeof p === 'string' ? p : ''
}

const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0)

/** Sentences carrying a banned market figure, with what tripped them. */
function marketFigureHits(prose) {
  const hits = []
  // Split on sentence boundaries so the report can quote the offending sentence.
  for (const sentence of prose.split(/(?<=[.!?])\s+/)) {
    for (const { re, what } of MARKET_FIGURE_PATTERNS) {
      if (!re.test(sentence)) continue
      // An HOA dues figure is a durable published fact, not a market figure.
      if (DUES_CONTEXT.test(sentence) && /\$/.test(sentence)) continue
      hits.push({ what, sentence: sentence.trim().slice(0, 160) })
      break
    }
  }
  return hits
}

function validSources(config) {
  const s = config.sources
  if (!Array.isArray(s)) return 0
  return s.filter(
    (e) => e && typeof e.url === 'string' && /^https?:\/\//.test(e.url) && typeof e.supports === 'string' && e.supports.trim()
  ).length
}

const measured = {}
const failures = []

for (const file of configFiles()) {
  const slug = slugOf(file)
  let config
  try {
    config = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'))
  } catch (err) {
    failures.push(`${file}: does not parse as JSON (${err.message})`)
    continue
  }

  const prose = proseOf(config)
  const words = wordCount(prose)
  measured[slug] = words

  const market = marketFigureHits(prose)
  for (const hit of market) {
    failures.push(
      `${file}: static prose contains ${hit.what}, which must come from the live components beside it, never frozen into JSON (§0).\n      "${hit.sentence}"`
    )
  }

  if (words > SOURCES_REQUIRED_ABOVE && validSources(config) === 0) {
    failures.push(
      `${file}: ${words} words of prose and no usable \`sources\` array. Long-form multiplies factual claims; each needs a checkable URL. Add [{url, publisher, supports}].`
    )
  }
}

if (WRITE_BASELINE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note:
          'Per-slug about_prose word counts. RATCHET: a config may never drop below its ' +
          'recorded count. Regenerate with --write-baseline only when counts have GROWN.',
        minWords: MIN_WORDS,
        generatedAt: new Date().toISOString(),
        words: measured,
      },
      null,
      2
    ) + '\n'
  )
  console.log(`Wrote depth baseline for ${Object.keys(measured).length} configs.`)
  process.exit(0)
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).words ?? {}
  : {}

for (const [slug, words] of Object.entries(measured)) {
  const was = baseline[slug]
  if (was !== undefined && words < was) {
    failures.push(
      `data/resort-community-${slug}.json: about_prose shrank from ${was} to ${words} words. This ratchet only moves up.`
    )
  }
  if (words < MIN_WORDS && (was === undefined || was >= MIN_WORDS)) {
    failures.push(
      `data/resort-community-${slug}.json: ${words} words of about_prose, below the ${MIN_WORDS}-word editorial floor. A stub is what the 2026-08-02 audit identified as the cause of zero non-brand visibility.`
    )
  }
}

const counts = Object.values(measured)
const belowFloor = counts.filter((w) => w < MIN_WORDS).length
const median = counts.length ? [...counts].sort((a, b) => a - b)[Math.floor(counts.length / 2)] : 0

console.log('Community content DEPTH gate (G33b)')
console.log('===================================')
console.log(`Configs:                ${counts.length}`)
console.log(`Median prose words:     ${median}`)
console.log(`Below ${MIN_WORDS}-word floor:   ${belowFloor}`)

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):`)
  for (const f of failures) console.error(`  - ${f}`)
  console.error(
    '\nFix: write the editorial, cite the sources, and keep every market figure out of\n' +
      'static prose. The live components beside this copy already publish those numbers.'
  )
  process.exit(REPORT ? 0 : 1)
}

console.log('\nOK — every community config clears the editorial floor, carries sources, and')
console.log('holds no frozen market figures.')
