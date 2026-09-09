#!/usr/bin/env node
/**
 * G-META — title uniqueness + budget + one-H1 for the content-registry detail
 * pages (docs/CONTENT_ENGINE_SPEC.md §8). Deterministic + offline.
 *
 * THE TITLE BUDGET COUNTS THE SUFFIX (SITE-25). A registry detail page's title
 * is the entity `name` and nothing else; app/layout.tsx then appends
 * " | Ryan Realty — Central Oregon" — 31 characters. The old bound was 48 on
 * the name alone and never counted those 31, so every "bounded" name still
 * composed a 79-char document title. The bound is now
 * MAX_TITLE − BRAND_SUFFIX.length, measured on the document title the visitor
 * actually gets.
 *
 * Parks were not covered at all before this node; /parks/smith-rock was live at
 * 75 characters. They are now.
 *
 * RATCHET. Names that already overflow are a frozen ledger in
 * scripts/content-metadata-baseline.json, not an exemption: a name not listed
 * may not overflow, and the list may only shrink. `--write-baseline` re-records
 * it, which is how a shortened name comes off. Overflowing does not shear the
 * title — lib/site/page-metadata.ts drops such a page to the short
 * " | Ryan Realty" brand rather than cutting a place name in half — it only
 * means the SERP will truncate the display.
 *
 * Research basis: titles should be unique + fit the SERP (~600px ≈ ~60 chars is
 * an industry proxy, NOT a Google hard limit). One <h1> is an
 * accessibility/house rule, not an SEO requirement (Google allows many).
 * Word-count minimums are a MYTH and deliberately NOT gated (see §8b).
 * (https://developers.google.com/search/docs/appearance/title-link)
 *
 * Usage:
 *   node scripts/check-content-metadata.mjs                 # CI
 *   node scripts/check-content-metadata.mjs --root DIR      # fixture tree (tests)
 *   node scripts/check-content-metadata.mjs --write-baseline
 */
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const rootFlag = argv.indexOf('--root')
const ROOT =
  rootFlag >= 0
    ? path.resolve(argv[rootFlag + 1])
    : path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const WRITE_BASELINE = argv.includes('--write-baseline')
const BASELINE_PATH = path.join(ROOT, 'scripts/content-metadata-baseline.json')

/** Kept in sync with lib/site/page-metadata.ts — the same two constants. */
const BRAND_SUFFIX = ' | Ryan Realty — Central Oregon'
const MAX_TITLE = 60
const MAX_NAME = MAX_TITLE - BRAND_SUFFIX.length

const FAMILIES = [
  ['park', 'data/co-parks.ts'],
  ['event', 'data/co-events.ts'],
  ['venue', 'data/co-venues.ts'],
  ['trail', 'data/co-trails.ts'],
]

const fail = []
const overflowing = []

function names(file) {
  const src = fs.readFileSync(file, 'utf8')
  const slugs = [...src.matchAll(/\n\s*slug:\s*'([^']+)'/g)]
  return slugs.map((m, i) => {
    const start = m.index
    const end = i + 1 < slugs.length ? slugs[i + 1].index : src.length
    const block = src.slice(start, end)
    const nm = block.match(/\bname:\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/)
    return { slug: m[1], name: nm ? nm[2] : null }
  })
}

function checkFamily(label, file) {
  const rows = names(file)
  const seen = new Map()
  for (const r of rows) {
    const key = `${label}/${r.slug}`
    if (!r.name) {
      fail.push(`${key}: missing name`)
      continue
    }
    if (r.name.length > MAX_NAME) {
      overflowing.push({
        key,
        name: r.name,
        docLength: r.name.length + BRAND_SUFFIX.length,
      })
    }
    const dupKey = r.name.toLowerCase()
    if (seen.has(dupKey))
      fail.push(`${label}: duplicate name "${r.name}" (${seen.get(dupKey)} + ${r.slug}) → duplicate <title>/meta`)
    else seen.set(dupKey, r.slug)
  }
}

for (const [label, rel] of FAMILIES) checkFamily(label, path.join(ROOT, rel))

// ── One page H1 per detail template ──
// Literal <h1> is the old KB hero. V3Instrument level={1} emits <h1> via
// V3Heading. A Quiet headingLevel={1} is the no-figures fallback. Count all
// three so a v3 page is not failed for leaving the literal tag behind.
function countPageH1(src) {
  const literal = (src.match(/<h1[\s>]/g) || []).length
  const instrument = (src.match(/<V3Instrument\b[\s\S]*?\blevel=\{1\}/g) || []).length
  const quiet = (src.match(/\bheadingLevel=\{1\}/g) || []).length
  return literal + instrument + quiet
}

for (const t of [
  'app/parks/[slug]/page.tsx',
  'app/central-oregon/events/[slug]/page.tsx',
  'app/central-oregon/venues/[slug]/page.tsx',
  'app/central-oregon/golf/[slug]/page.tsx',
  'app/central-oregon/trails/[slug]/page.tsx',
]) {
  const src = fs.readFileSync(path.join(ROOT, t), 'utf8')
  const h1s = countPageH1(src)
  if (h1s !== 1) fail.push(`${t}: has ${h1s} page H1s (must be exactly 1 for accessibility)`)
}

const ledger = overflowing.map((o) => o.key).sort()

if (WRITE_BASELINE) {
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        note:
          'Registry entity names whose document title overflows the 60-char budget once the ' +
          `${BRAND_SUFFIX.length}-char layout suffix "${BRAND_SUFFIX.trim()}" is counted. Frozen ledger for ` +
          'ci:content-metadata — the list may only shrink. Shorten the name to take one off, then rerun ' +
          'with --write-baseline.',
        maxName: MAX_NAME,
        names: ledger,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${ledger.length} name(s) to ${path.relative(ROOT, BASELINE_PATH)}`)
  process.exit(0)
}

const baseline = fs.existsSync(BASELINE_PATH)
  ? new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).names ?? [])
  : new Set()

for (const o of overflowing) {
  if (baseline.has(o.key)) continue
  fail.push(
    `${o.key}: name "${o.name}" is ${o.name.length} chars (> ${MAX_NAME}); with the ` +
      `${BRAND_SUFFIX.length}-char brand suffix the document title is ${o.docLength} chars and truncates in the SERP`,
  )
}

const stale = [...baseline].filter((k) => !ledger.includes(k))
for (const k of stale) {
  fail.push(`${k}: listed in the baseline but no longer overflows — rerun with --write-baseline so the ledger shrinks`)
}

console.log('content-metadata gate (G-META)')
console.log('==============================')
console.log(
  `${FAMILIES.length} registries · name budget ${MAX_NAME} chars (${MAX_TITLE} − ${BRAND_SUFFIX.length} suffix) · baseline ${baseline.size}`,
)
if (fail.length) {
  console.error(`\n✗ ${fail.length} metadata violation(s):`)
  for (const f of fail) console.error('  ' + f)
  process.exit(1)
}
console.log('✓ Titles are unique and budgeted with the suffix counted; one H1 per detail page.')
