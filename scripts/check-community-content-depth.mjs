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
 * What actually makes a figure unsafe to freeze is not that it is money. It is
 * that it GOES STALE. A 1910 land price and a 2021 pool-rebuild budget are
 * historical record and are true forever. Active inventory is wrong tomorrow.
 *
 * A first cut here flagged any "$" or "%" and produced six false positives out
 * of ten on real copy: a nonprofit's cumulative giving, two school rankings, a
 * $23M aquatic-center rebuild, 1910 lot prices, a 1921 park purchase, and a
 * municipal sewer project. Every one is a durable fact this prose SHOULD carry,
 * and a gate that flags them teaches authors to strip good material. So the rule
 * is currency-of-claim, not presence-of-currency.
 *
 * A sentence is flagged when it carries a number AND reads as a CURRENT market
 * claim, and is cleared when it is anchored to a past year.
 */

/** Any numeric token that could carry a market figure. */
const HAS_NUMBER = /\$\s?\d|\b\d+(?:\.\d+)?\s?%|\b\d[\d,]*(?:\.\d+)?\b/

/** Named market metrics. These are stale-by-tomorrow regardless of phrasing. */
const MARKET_METRIC =
  /\b(?:median\s+(?:list|close|closing|sale|sales|sold|home)?\s*price|sale[-\s]?to[-\s]?list|days?\s+on\s+market|days?\s+to\s+pending|months?\s+of\s+supply|price\s+per\s+(?:square\s+foot|sq\.?\s?ft)|appreciat(?:ed|ion|ing)|absorption\s+rate|market\s+velocity|active\s+inventory|homes?\s+for\s+sale|currently\s+(?:listed|asking)|list\s+price)\b/i

/** Currency sitting directly on housing stock: "$759,000 townhomes". */
const PRICE_ON_HOUSING =
  /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|mm|million)?\b[^.]{0,40}\b(?:home|homes|house|houses|townhome|townhomes|condo|condos|cabin|cabins|lot|lots|property|properties|residence|residences)\b|\b(?:home|homes|house|houses|townhome|townhomes|condo|condos|lot|lots|property|properties)\b[^.]{0,40}\$\s?\d/i

/** "sell for about $X", "trade at $X", "start in the $Xs". */
const SALE_CLAIM =
  /\b(?:sell(?:s|ing)?|sold|trade[ds]?|trading|start(?:s|ing)?|range[sd]?|ranging)\b[^.]{0,30}\$\s?\d/i

/**
 * A sentence anchored to a past year is a historical record, not a live figure.
 * Three-year lag so "as of 2025" style recency claims are still caught.
 */
const HISTORICAL_CUTOFF = new Date().getFullYear() - 3

function isHistorical(sentence) {
  const years = sentence.match(/\b(1[6-9]\d{2}|20\d{2})\b/g)
  if (!years) return false
  return years.some((y) => Number(y) <= HISTORICAL_CUTOFF)
}

/** HOA dues are a durable, published fact and live in their own numeric keys. */
const DUES_CONTEXT = /\b(?:hoa|dues|assessment|association fee|initiation)\b/i

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

/** Sentences making a CURRENT market claim, with what tripped them. */
function marketFigureHits(prose) {
  const hits = []
  for (const sentence of prose.split(/(?<=[.!?])\s+/)) {
    if (!HAS_NUMBER.test(sentence)) continue
    // Anchored to a past year: historical record, true forever, allowed.
    if (isHistorical(sentence)) continue
    // HOA dues are published durable facts with their own numeric keys.
    if (DUES_CONTEXT.test(sentence)) continue

    let what = null
    if (MARKET_METRIC.test(sentence)) what = 'a named market metric'
    else if (PRICE_ON_HOUSING.test(sentence)) what = 'a price attached to housing stock'
    else if (SALE_CLAIM.test(sentence)) what = 'a sale-price claim'
    if (!what) continue

    hits.push({ what, sentence: sentence.trim().slice(0, 160) })
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

const baselineFile = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : {}
const baseline = baselineFile.words ?? {}

/**
 * CORRECTIONS — the one way a count may legitimately go down.
 *
 * A pure ratchet makes deleting a false claim cost more than leaving it in,
 * which puts this gate in direct conflict with §0. That is not theoretical: on
 * 2026-08-26 the gate went red on main because commit 05917a61 removed Awbrey
 * Glen's claim to five neighbouring subdivisions it does not contain, plus a
 * second contradictory yardage for its course. Accuracy shrank the prose by 37
 * words and the ratchet punished it. §0 outranks a word count, always.
 *
 * So a shrink is allowed ONLY when it is declared here with the exact before
 * and after counts, the commit that caused it, and the reason. Declaring it is
 * the point — a correction is a deliberate, reviewable act, and an undeclared
 * shrink still fails. The counts must match exactly, so a correction entry
 * cannot be left behind to license future thinning.
 */
const corrections = baselineFile.corrections ?? {}

for (const [slug, words] of Object.entries(measured)) {
  const was = baseline[slug]
  if (was !== undefined && words < was) {
    const c = corrections[slug]
    const declared =
      c && c.from === was && c.to === words && typeof c.reason === 'string' && c.reason.trim().length > 20
    if (!declared) {
      failures.push(
        `data/resort-community-${slug}.json: about_prose shrank from ${was} to ${words} words. This ratchet only moves up.\n` +
          `      If the words came out because they were WRONG, declare it in scripts/community-content-depth-baseline.json:\n` +
          `        "corrections": { "${slug}": { "from": ${was}, "to": ${words}, "commit": "<sha>", "reason": "<what was false>" } }`
      )
    }
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
