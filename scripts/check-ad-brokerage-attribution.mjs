#!/usr/bin/env node
/**
 * check-ad-brokerage-attribution.mjs (ci:ad-brokerage-attribution)
 *
 * Oregon Administrative Rule OAR 863-015-0215 requires the licensed
 * brokerage name to appear in advertising. Cited in-repo at
 * social_media_skills/listing-description/SKILL.md:208 ("Licensed
 * brokerage name (Ryan Realty) must appear in advertising"). Matt is
 * the licensed principal broker — a rendered ad missing the brokerage
 * name is a compliance risk to Ryan Realty's license, not a style nit.
 *
 * Finding (2026-07-31, BROKER_SMS_AGENT_2026-07-31.md R0.3): 6 of the 10
 * single-image post templates in scripts/build_single_image_posts.py
 * (S1 just-listed, S3 open house, S4 coming soon, S5 price improvement,
 * S7 agent intro, S9 press feature) rendered with no "RYAN REALTY" string
 * anywhere in the output image. Fixed in the same commit that added this
 * gate — this script exists so the class cannot regress or grow silently.
 *
 * What this checks:
 *   1. scripts/build_single_image_posts.py — every top-level `def sN_*`
 *      template function body must contain the literal string
 *      "RYAN REALTY" somewhere in its source (an eyebrow, footer, or
 *      caption line rendered onto the image).
 *   2. social_media_skills/flyer-design/SKILL.md — the brokerage-footer
 *      requirement must be unconditional (no "footer if/when required"
 *      escape hatch) and the mandatory-inputs section must name
 *      "Ryan Realty" explicitly.
 *
 * IMPORTANT — new creative generators must be added to this gate. If you
 * add another Python/Node image or video builder that renders on-screen
 * text for an ad, flyer, or social post, add its path to PYTHON_GENERATORS
 * (or a new checker block below) so it is covered. A generator this gate
 * doesn't know about is a generator this gate can't protect.
 */
import { readFileSync, existsSync } from 'node:fs'

let failed = false

console.log('ad-brokerage-attribution gate (ci:ad-brokerage-attribution)')
console.log('=============================================================')

// ── 1. Python single-image post templates ──────────────────────────────────

// Add new generator scripts here as they're built (see header comment).
const PYTHON_GENERATORS = ['scripts/build_single_image_posts.py']

const DEF_RE = /^def (s\d+_[a-z_]+)\(/gm

for (const genPath of PYTHON_GENERATORS) {
  if (!existsSync(genPath)) {
    failed = true
    console.error(`  ✗ ${genPath} — file not found (listed in PYTHON_GENERATORS but missing)`)
    continue
  }

  const src = readFileSync(genPath, 'utf8')
  const matches = [...src.matchAll(DEF_RE)]

  if (matches.length === 0) {
    failed = true
    console.error(`  ✗ ${genPath} — no top-level "def sN_*(" template functions found. Regex drift?`)
    continue
  }

  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1]
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : src.length
    const body = src.slice(start, end)

    if (body.includes('RYAN REALTY')) {
      console.log(`  ok    ${genPath} :: ${name} — carries "RYAN REALTY"`)
    } else {
      failed = true
      console.error(
        `  FAIL  ${genPath} :: ${name} — no "RYAN REALTY" string rendered. ` +
          `Add a brokerage-attribution eyebrow/footer line matching the pattern ` +
          `used in the other sN_* templates (e.g. "RYAN REALTY  ·  <label>").`
      )
    }
  }
}

// ── 2. flyer-design SKILL.md ────────────────────────────────────────────────

const FLYER_SKILL = 'social_media_skills/flyer-design/SKILL.md'
const FOOTER_ESCAPE_RE = /footer (if|when) required/i

if (!existsSync(FLYER_SKILL)) {
  failed = true
  console.error(`  ✗ ${FLYER_SKILL} — file not found`)
} else {
  const flyerSrc = readFileSync(FLYER_SKILL, 'utf8')

  if (FOOTER_ESCAPE_RE.test(flyerSrc)) {
    failed = true
    console.error(
      `  FAIL  ${FLYER_SKILL} — matches /footer (if|when) required/i. ` +
        `Brokerage-attribution footer must be unconditional, not gated on "if/when required".`
    )
  } else {
    console.log(`  ok    ${FLYER_SKILL} — no conditional "footer if/when required" escape hatch`)
  }

  // "Required-content section" = the mandatory-inputs section, where every
  // flyer's non-negotiable content (photos, headshot, compliance copy) is
  // enumerated. It must name the brokerage explicitly, not just "the
  // brokerage name" in the abstract.
  const sectionMatch = flyerSrc.match(/## Inputs \(mandatory\)([\s\S]*?)(?=\n## |$)/)
  const inputsSection = sectionMatch ? sectionMatch[1] : ''

  if (!sectionMatch) {
    failed = true
    console.error(`  FAIL  ${FLYER_SKILL} — "## Inputs (mandatory)" section not found. Doc restructured?`)
  } else if (inputsSection.includes('Ryan Realty')) {
    console.log(`  ok    ${FLYER_SKILL} — "## Inputs (mandatory)" names Ryan Realty explicitly`)
  } else {
    failed = true
    console.error(
      `  FAIL  ${FLYER_SKILL} — "## Inputs (mandatory)" section does not name "Ryan Realty". ` +
        `Brokerage attribution must be explicit, not implied.`
    )
  }
}

// ── Verdict ──────────────────────────────────────────────────────────────────

if (failed) {
  console.error('\nFAILED — brokerage-name-in-advertising rule (OAR 863-015-0215) not satisfied.')
  process.exit(1)
}

console.log('\nOK — every checked template and doc carries brokerage attribution.')
process.exit(0)
