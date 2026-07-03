#!/usr/bin/env node
/**
 * G-DUP — content-uniqueness gate (docs/CONTENT_ENGINE_SPEC.md §8).
 *
 * The #1 existential risk for a templated content generator is Google's
 * scaled-content-abuse / doorway-page spam policy: "many pages generated for the
 * primary purpose of manipulating rankings and not helping users" — the classic
 * search-and-replace pattern where sibling pages differ only in a swapped name.
 * (https://developers.google.com/search/docs/essentials/spam-policies)
 *
 * This gate FAILS THE BUILD if two sibling content pages' unique prose (the
 * registry `blurb`, which is the non-template body content) are too similar, or
 * if any blurb is thin. It is deterministic, offline, and runs in ms.
 *
 *   node scripts/check-content-uniqueness.mjs
 *
 * Thresholds (recommended starting values per the deep-research pass — tune
 * empirically, they are engineering judgment, not a Google-published number):
 *   - Jaccard 3-gram similarity between any two sibling blurbs must be < 0.60.
 *   - Every blurb must be >= 20 words (thin-content floor).
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const SIM_THRESHOLD = 0.6
const MIN_WORDS = 20

/** Extract [{ slug, blurb }] from a registry .ts file — object-scoped so a
 *  slug always pairs with the blurb inside its own object block. */
function extractBlurbs(file) {
  const src = fs.readFileSync(file, 'utf8')
  const slugMatches = [...src.matchAll(/\n\s*slug:\s*'([^']+)'/g)]
  // Blurb may be single- or double-quoted (Prettier flips to double quotes when
  // the string contains an apostrophe). Backreference \1 matches the same quote.
  const blurbRe = /\bblurb:\s*\n?\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/
  const out = []
  for (let i = 0; i < slugMatches.length; i++) {
    const start = slugMatches[i].index
    const end = i + 1 < slugMatches.length ? slugMatches[i + 1].index : src.length
    const block = src.slice(start, end)
    const bm = block.match(blurbRe)
    if (!bm) {
      console.error(
        `[check-content-uniqueness] no blurb found for ${path.relative(ROOT, file)} slug='${slugMatches[i][1]}'`,
      )
      process.exit(2)
    }
    out.push({ slug: slugMatches[i][1], blurb: bm[2].replace(/\\(['"\\])/g, '$1') })
  }
  return out
}

/** Set of lowercased 3-word shingles from prose. */
function shingles(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const set = new Set()
  for (let i = 0; i + 2 < words.length; i++) set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  return { set, wordCount: words.length }
}

function jaccard(a, b) {
  let inter = 0
  for (const s of a) if (b.has(s)) inter++
  return inter / (a.size + b.size - inter || 1)
}

function checkFamily(name, file) {
  const rows = extractBlurbs(file).map((r) => ({ ...r, ...shingles(r.blurb) }))
  const failures = []

  for (const r of rows) {
    if (r.wordCount < MIN_WORDS) {
      failures.push(`THIN: ${name}/${r.slug} blurb is ${r.wordCount} words (< ${MIN_WORDS})`)
    }
  }
  let maxSim = 0
  let maxPair = ''
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const sim = jaccard(rows[i].set, rows[j].set)
      if (sim > maxSim) {
        maxSim = sim
        maxPair = `${rows[i].slug} ~ ${rows[j].slug}`
      }
      if (sim >= SIM_THRESHOLD) {
        failures.push(
          `DUPLICATE: ${name}/${rows[i].slug} ~ ${name}/${rows[j].slug} — Jaccard ${sim.toFixed(2)} (>= ${SIM_THRESHOLD})`,
        )
      }
    }
  }
  return { count: rows.length, failures, maxSim, maxPair }
}

const families = [
  ['events', path.join(ROOT, 'data/co-events.ts')],
  ['venues', path.join(ROOT, 'data/co-venues.ts')],
  ['golf', path.join(ROOT, 'data/co-golf.ts')],
  ['trails', path.join(ROOT, 'data/co-trails.ts')],
]

let allFailures = []
console.log('content-uniqueness gate (G-DUP)')
console.log('===============================')
for (const [name, file] of families) {
  if (!fs.existsSync(file)) continue
  const r = checkFamily(name, file)
  console.log(
    `  ${name.padEnd(8)} ${r.count} pages · max sibling similarity ${r.maxSim.toFixed(2)} (${r.maxPair})`,
  )
  allFailures = allFailures.concat(r.failures)
}

if (allFailures.length) {
  console.error(`\n✗ ${allFailures.length} content-uniqueness violation(s):`)
  for (const f of allFailures) console.error('  ' + f)
  console.error(
    '\nSibling pages must not be search-and-replace duplicates (scaled-content-abuse risk).\nRewrite the offending blurb with genuinely distinct, first-hand content.',
  )
  process.exit(1)
}
console.log('\n✓ All content pages are sufficiently unique (no scaled-content-abuse pattern).')
