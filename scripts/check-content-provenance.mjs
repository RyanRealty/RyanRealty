#!/usr/bin/env node
/**
 * check-content-provenance.mjs — gate CONTENT-01 / DATA-16.
 *
 * The #1 recurring content risk: a subagent invents testimonials (e.g. "Sarah M.",
 * "James K.") or unsourced review counts and ships them on a public page. That is a
 * compliance + accuracy violation for a licensed brokerage. This gate makes that
 * mechanically impossible to merge.
 *
 * Three checks:
 *   A. PROVENANCE — every testimonial in the single source of truth
 *      (lib/testimonials.ts) carries an `author` + a `source` (Google/Zillow).
 *   B. SINGLE SOURCE OF TRUTH — no inline testimonial object literals
 *      (`quote:` paired with `author:`) anywhere in app/ or components/. Client
 *      quotes render ONLY from lib/testimonials.ts, never hand-typed into a page.
 *      Also bans the classic fabricated-attribution signature: a quoted
 *      "Firstname X." (single-initial surname) string in any page/component.
 *   C. BANNED CLAIMS — false/unverifiable claims that contradict the system or
 *      lack a source (extend BANNED_CLAIMS as needed).
 *
 * Run: node scripts/check-content-provenance.mjs   (wired into ci:gates)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE_OF_TRUTH = 'lib/testimonials.ts'
const SCAN_ROOTS = ['app', 'components']

// Phrases that must never appear on a public surface (unverifiable / contradicted
// by the system). Keep tight + high-signal.
const BANNED_CLAIMS = [
  /\bwe do not auto-?call\b/i,
  /\b#\s?1\s+(?:real\s?estate\s+)?(?:agent|broker|brokerage)\s+in\s+bend\b/i,
  /\baward-winning\b/i,
  /\bvoted\s+best\b/i,
]

// Fabricated-testimonial signature: a quoted "Firstname X." attribution. Real GBP
// authors are full names and live in the source of truth, so this only fires on
// hand-invented reviews.
const FAKE_ATTRIBUTION = /['"`]\s*[A-Z][a-z]+\s+[A-Z]\.\s*['"`]/

const errors = []

// ── Check A: provenance in the source of truth ──────────────────────────────
if (!existsSync(SOURCE_OF_TRUTH)) {
  errors.push(`${SOURCE_OF_TRUTH} (testimonial source of truth) is missing.`)
} else {
  const src = readFileSync(SOURCE_OF_TRUTH, 'utf8')
  const quotes = (src.match(/\bquote:/g) || []).length
  const sources = (src.match(/\bsource:/g) || []).length
  const authors = (src.match(/\bauthor:/g) || []).length
  if (quotes === 0) errors.push(`${SOURCE_OF_TRUTH}: no testimonials found.`)
  if (quotes !== sources || quotes !== authors) {
    errors.push(`${SOURCE_OF_TRUTH}: every testimonial needs author+source — found ${quotes} quote, ${authors} author, ${sources} source.`)
  }
}

// ── Checks B + C: scan rendered pages/components ────────────────────────────
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

for (const root of SCAN_ROOTS) {
  let files = []
  try { files = walk(root) } catch { continue }
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    const lines = text.split(/\r?\n/)

    // B1: inline testimonial DATA object (quote: "literal" ... author: "literal").
    // Only string-literal values count — `quote: string` (a prop/type annotation)
    // is not data and is ignored.
    lines.forEach((line, i) => {
      if (/\bquote:\s*['"`]/.test(line)) {
        const window = lines.slice(i, i + 5).join('\n')
        if (/\bauthor:\s*['"`]/.test(window)) {
          errors.push(`${f}:${i + 1}  inline testimonial data object — testimonials must live only in ${SOURCE_OF_TRUTH}.`)
        }
      }
      // B2: fabricated "Firstname X." attribution
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return
      if (FAKE_ATTRIBUTION.test(line)) {
        errors.push(`${f}:${i + 1}  fabricated-style attribution "${(line.match(FAKE_ATTRIBUTION) || [''])[0].trim()}" — source it from ${SOURCE_OF_TRUTH} or remove.`)
      }
      // C: banned claims
      for (const re of BANNED_CLAIMS) {
        if (re.test(line)) errors.push(`${f}:${i + 1}  banned/unverifiable claim matches ${re}.`)
      }
    })
  }
}

if (errors.length) {
  console.error('\nContent-provenance gate FAILED (CONTENT-01):')
  for (const e of errors) console.error('  ' + e)
  console.error(`\nClient quotes render only from ${SOURCE_OF_TRUTH} (each author+source). No hand-typed or invented testimonials/claims.`)
  process.exit(1)
}
console.log(`Content-provenance gate passed — testimonials sourced from ${SOURCE_OF_TRUTH}; no fabricated attributions or banned claims.`)
