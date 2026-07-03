#!/usr/bin/env node
/**
 * G-META — title/description uniqueness + one-H1 for content pages
 * (docs/CONTENT_ENGINE_SPEC.md §8). Titles are generated from the registry
 * `name` as `${name} | Central Oregon Events|Live Music & Shows`, so unique,
 * length-bounded names guarantee unique, non-truncated titles. Deterministic +
 * offline.
 *
 * Research basis: titles should be unique + fit the SERP (~600px ≈ ~60 chars is
 * an industry proxy, NOT a Google hard limit — we bound the registry `name` so
 * the composed title stays in range). One <h1> is an accessibility/house rule,
 * not an SEO requirement (Google allows many). Word-count minimums are a MYTH
 * and deliberately NOT gated (see §8b).
 * (https://developers.google.com/search/docs/appearance/title-link)
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const fail = []
const MAX_NAME = 48 // leaves room for the " | Central Oregon …" suffix under ~60 chars

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
    if (!r.name) {
      fail.push(`${label}/${r.slug}: missing name`)
      continue
    }
    if (r.name.length > MAX_NAME)
      fail.push(`${label}/${r.slug}: name "${r.name}" is ${r.name.length} chars (> ${MAX_NAME}); title would truncate in the SERP`)
    const key = r.name.toLowerCase()
    if (seen.has(key)) fail.push(`${label}: duplicate name "${r.name}" (${seen.get(key)} + ${r.slug}) → duplicate <title>/meta`)
    else seen.set(key, r.slug)
  }
}

checkFamily('event', path.join(ROOT, 'data/co-events.ts'))
checkFamily('venue', path.join(ROOT, 'data/co-venues.ts'))
checkFamily('golf', path.join(ROOT, 'data/co-golf.ts'))
checkFamily('trail', path.join(ROOT, 'data/co-trails.ts'))

// ── One <h1> per detail template ──
for (const t of [
  'app/central-oregon/events/[slug]/page.tsx',
  'app/central-oregon/venues/[slug]/page.tsx',
  'app/central-oregon/golf/[slug]/page.tsx',
  'app/central-oregon/trails/[slug]/page.tsx',
]) {
  const src = fs.readFileSync(path.join(ROOT, t), 'utf8')
  const h1s = (src.match(/<h1[\s>]/g) || []).length
  if (h1s !== 1) fail.push(`${t}: has ${h1s} <h1> tags (must be exactly 1 for accessibility)`)
}

console.log('content-metadata gate (G-META)')
console.log('==============================')
if (fail.length) {
  console.error(`\n✗ ${fail.length} metadata violation(s):`)
  for (const f of fail) console.error('  ' + f)
  process.exit(1)
}
console.log('✓ Titles/descriptions are unique + bounded; one H1 per detail page.')
