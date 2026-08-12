#!/usr/bin/env node
/**
 * check-naked-verb-headings.mjs — G62 (ci:naked-verb-headings).
 *
 * A section heading whose ENTIRE text is a bare verb says nothing. VOICE.md,
 * "Site pages": "Headings are sentence case and say something specific."
 * Search-traffic rule 2: "Headings state what someone would search" — nobody
 * types "explore".
 *
 * How this shipped (C-07): `KbExploreTowns` defaulted `title = 'Explore'`. Three
 * of its four callers passed a real title; the homepage did not, so it silently
 * inherited the placeholder and rendered "EXPLORE" as its H2 for months. A
 * design audit noticed the section read as filler and gave the EYEBROW scent
 * copy ("The six towns") to compensate — fixing the symptom one line above the
 * cause. Placeholder defaults are the mechanism; this gate is the backstop.
 *
 * DECIDABLE: literal string equality against a closed list. No semantics.
 * Checks JSX heading text and `title=` / `heading=` props whose value is a plain
 * string literal. Template literals and expressions are skipped — a computed
 * heading cannot be judged here.
 *
 * Usage:
 *   node scripts/check-naked-verb-headings.mjs
 *   node scripts/check-naked-verb-headings.mjs --report   # never fails
 */

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { walkFiles } from './lib/walk.mjs'

const REPORT = process.argv.includes('--report')

// Bare verbs / greetings that carry no page-specific meaning as a heading.
const NAKED = new Set([
  'explore', 'discover', 'learn more', 'browse', 'get started', 'welcome',
  'our story', 'read more', 'find out more', 'see more',
])

// <h1>Explore</h1> · <H2>Explore</H2> · title="Explore" · heading='Explore'
// AND the default-parameter form `title = 'Explore'` — which is how C-07 actually
// shipped. The whitespace around `=` is not optional in the regex: the first cut of
// this gate required `title="..."` and so passed the very defect it was written for.
// V3Heading is the v3 register's heading component and `headline` / `eyebrow` are
// the props its six patterns take (V3InstrumentProps.headline, V3StageProps.headline).
// Without them a migrated page ships `headline={v3Text('Explore')}` and this gate
// stays silent, which is C-07 with a new prop name.
// docs/plans/PUBLIC_PRODUCT/gate-contracts.md section 3.19.
const HEADING_TAG =
  /<(h[1-6]|H[1-6]|DisplayHeading|V3Heading)[^>]*>\s*([A-Za-z][A-Za-z ]{0,24})\s*<\/\1>/g
const HEADING_PROP =
  /\b(title|heading|headline|eyebrow)\s*=\s*(?:"([^"]{1,25})"|'([^']{1,25})'|\{\s*v3Text\(\s*(?:"([^"]{1,25})"|'([^']{1,25})')\s*\)\s*\})/g

const files = walkFiles('app').concat(walkFiles('components')).sort()
const fails = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(process.cwd(), file)
  const check = (text, index, kind) => {
    if (!NAKED.has(text.trim().toLowerCase())) return
    const line = src.slice(0, index).split('\n').length
    fails.push(`${rel}:${line}: ${kind} "${text.trim()}" — a bare verb states nothing. Say what the section is.`)
  }
  let m
  while ((m = HEADING_TAG.exec(src)) !== null) check(m[2], m.index, 'heading')
  while ((m = HEADING_PROP.exec(src)) !== null)
    check(m[2] ?? m[3] ?? m[4] ?? m[5], m.index, `${m[1]} prop`)
}

console.log('naked-verb heading gate (ci:naked-verb-headings)')
console.log('================================================')
console.log(`Scanned ${files.length} app/ + components/ files`)

if (fails.length === 0) {
  console.log('\n✓ OK — no heading is a bare verb.')
  process.exit(0)
}
console.log(`\n✗ ${fails.length} naked-verb heading(s):`)
for (const f of fails) console.log(`  ${f}`)
console.log('\nVOICE.md: headings say something specific, and state what someone would search.')
process.exit(REPORT ? 0 : 1)
