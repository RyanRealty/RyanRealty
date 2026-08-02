#!/usr/bin/env node
/**
 * check-brand-voice.mjs
 *
 * Greps every JSX/TSX file under app/ and components/ for banned brand-voice
 * vocabulary in string literals (text content + JSX attributes). Fails CI if
 * any new file introduces a banned word.
 *
 * Banned vocabulary canonical source: marketing_brain_skills/brand-voice/voice_guidelines.md
 * and docs/SITE_SPEC.md acceptance criteria.
 *
 * Modes:
 *   node scripts/check-brand-voice.mjs                 → check against baseline, exit 1 if violations INCREASED
 *   node scripts/check-brand-voice.mjs --write-baseline → snapshot current state to scripts/brand-voice-baseline.json
 *   node scripts/check-brand-voice.mjs --report         → human-readable report, never exits 1
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative, sep, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/brand-voice-baseline.json')

// Single source of truth for the banned vocabulary, shared with the
// ESLint plugin at eslint-rules/no-brand-voice-violations.js. Test
// scripts/__tests__/brand-voice-vocabulary.test.cjs verifies parity.
const require = createRequire(import.meta.url)
const VOCAB = require('./brand-voice-vocabulary.cjs')
const ts = require('typescript')

const SCAN_DIRS = ['app', 'components']
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__'])
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

// Banned words sourced from scripts/brand-voice-vocabulary.cjs so this
// list and the ESLint rule's list cannot drift. Modify lists THERE,
// not here. The full canonical reference is CLAUDE.md §3.
const BANNED_WORDS = VOCAB.BANNED_WORD_STRINGS

// SCOPE — our language only (VOICE.md): the laws bind Ryan Realty's own
// authored marketing copy. Reviews/testimonials and broker-written listing
// remarks render from DATA (variables), never literals, so they are never
// scanned and never rewritten. The gate sees only sentences we typed in.
// VOICE.md "banned moves" — regex patterns for the law-breaking sentences that
// contain no banned word (self-virtue, warmth filler, category self-naming).
// Compiled once; run case-insensitively against each user-facing literal.
const BANNED_PATTERNS = (VOCAB.BANNED_PATTERNS ?? []).map((p) => ({
  law: p.law,
  label: p.label,
  re: new RegExp(p.source, 'i'),
}))

// PUNCTUATION (wired 2026-08-02). CLAUDE.md §6 listed "brand voice — banned
// words, Five Laws" as GATED, and the punctuation hard-fails in §2 as part of
// the same rule — but VOCAB.PUNCTUATION was exported and referenced NOWHERE in
// this file. The rule was documented, believed enforced, and checked by nothing.
// The cost: the em dash in the layout title template shipped in all 20 page
// titles, on every SERP listing, for as long as that template has existed.
//
// SCOPE — em dash and en dash ONLY, deliberately not all four entries:
//
//   semicolon      String literals in app/ and components/ are full of CSS and
//                  SVG, where ';' is SYNTAX ("display:none;color:red", style
//                  strings, path data). A blanket ban flags those as prose and
//                  drowns the real signal. §2 bans it in BODY PROSE, which this
//                  scanner cannot reliably separate from a style string.
//   exclamation    §2 allows one per piece and bans it only in market-data
//                  copy. That is a per-deliverable budget, not a per-literal
//                  rule, so a literal-level gate would encode the wrong rule.
//                  '!' is also code punctuation ('!important', '!=').
//
// Both remain enforced by human review per §2. Encoding them here would trade a
// real gate for a noisy one. The two dashes have no legitimate use in authored
// UI prose, so they gate cleanly at the literal level.
const BANNED_PUNCTUATION = (VOCAB.PUNCTUATION ?? []).filter((p) => p.char === '—' || p.char === '–')

// EXEMPTIONS. Each one is carved out by §2 itself or falls outside what §2
// governs. Without them this check flags legitimate output and the "fix" makes
// the product worse ("$300K – $500K" does not improve as "$300K. $500K").
//
// 1. DATA PLACEHOLDER — §2, verbatim: "the em-dash is allowed as a literal data
//    placeholder for 'unavailable' in a stats table." In practice that is
//    `${beds ?? '—'}`, so the dash sits INSIDE a ${...} expression. Stripping
//    interpolations before testing removes exactly this class, and only this
//    class, because authored prose never lives inside an expression.
// 2. NUMERIC RANGE — a dash separating two values ("2–4 beds", "$300K – $500K",
//    "${start} – ${end}") is typography, not prose punctuation. §2's remedy
//    ("replace with a period or comma") is incoherent applied to a range, which
//    is the tell that ranges were never the target.
// 3. DEBUG OUTPUT — §2: "Internal-only text (… debugging logs …) is NOT
//    governed." Console strings are tagged "[scope] …" by convention here.
// 4. CLIENT REVIEWS — §2: the gate "never touches reviews, external quotes, or
//    broker-written listing remarks." Those are the client's words, not ours;
//    editing them would misquote a real person.
const REVIEW_DATA_FILES = new Set(['app/lp/seller-home-value/data.ts'])

const INTERPOLATION = /\$\{[^}]*\}/g
// A sentinel that cannot occur in authored source text. Deliberately NOT a
// space: RANGE_SEPARATOR includes this character in its class, and a space
// there would make ' — ' read as a range and silently exempt real prose.
// Written as an escape, not a literal control byte, so the file stays text.
const PLACEHOLDER_MARK = '\u0000'

function stripInterpolations(value) {
  return value.replace(INTERPOLATION, PLACEHOLDER_MARK)
}

// A dash is a range separator when both sides are values rather than words:
// a digit, a currency/scale marker, or an interpolated expression.
const RANGE_SEPARATOR = new RegExp(
  `[\\d%${PLACEHOLDER_MARK}KkMm)]\\s*[–—]\\s*[\\d$${PLACEHOLDER_MARK}]`,
)

function isDebugOutput(value) {
  return /^\s*\[[a-z0-9_-]+\]/i.test(value)
}

// 5. EMBEDDED CODE — <style>{`...`}</style> and inline <script>{`...`}</script>
//    bodies are template literals holding CSS or JS, so the scanner sees them
//    as one giant "string". Any dash in them lives in a CSS or JS comment,
//    which §2 explicitly does not govern ("code comments"). Detect by syntax
//    rather than by tag, since the literal is all the scanner has.
function isEmbeddedCode(value) {
  if (/@media|:root\b|var\(--|function\s*\(|window\.|document\./.test(value)) return true
  // A CSS rule block: a selector, braces, and at least one `prop: value;` pair.
  return /\{[^}]*[a-z-]+\s*:[^};]+;/i.test(value)
}

// 6. SEO METADATA — Matt, 2026-08-02: "We can have em dashes in page titles for
//    SEO and SEO where appropriate." A SERP title is not body prose; the dash is
//    a scannable separator between the page name and the brand/qualifier, and it
//    is what Google renders. This exempts the metadata VALUES only — title,
//    template, default, description, siteName — and only from the PUNCTUATION
//    rule. Banned words and the VOICE.md banned moves still apply to titles,
//    because "stunning" in a <title> is still "stunning".
const SEO_METADATA_ASSIGNMENT = /\b(title|template|default|description|siteName)\s*:\s*(`|'|")?$/

function isSeoMetadataValue(lineText, value) {
  if (!lineText) return false
  // The literal's own line, up to where the literal starts.
  const idx = lineText.indexOf(value.slice(0, 24))
  const prefix = idx > 0 ? lineText.slice(0, idx) : lineText
  return SEO_METADATA_ASSIGNMENT.test(prefix.trimEnd())
}

function findPunctuationViolations(value, lineNum, snippet, relPath, lineText) {
  if (isSeoMetadataValue(lineText, value)) return []
  if (relPath && REVIEW_DATA_FILES.has(relPath)) return []
  if (isDebugOutput(value)) return []
  if (isEmbeddedCode(value)) return []
  // The bare placeholder itself: <span>—</span>, or the '—' literal handed to a
  // formatter as the "unavailable" value. Nothing but dashes and space, so it
  // cannot be a sentence. This is the §2 carve-out in its most literal form.
  if (/^[\s–—]+$/.test(value)) return []

  const stripped = stripInterpolations(value)
  const out = []
  for (const p of BANNED_PUNCTUATION) {
    if (!stripped.includes(p.char)) continue // dash lived inside ${...}: placeholder
    // Remove every range-separator occurrence, then see if any dash survives.
    let residual = stripped
    let prev
    do {
      prev = residual
      residual = residual.replace(RANGE_SEPARATOR, PLACEHOLDER_MARK)
    } while (residual !== prev)
    if (!residual.includes(p.char)) continue
    out.push({ word: `${p.label} — ${p.advice}`, line: lineNum, snippet })
  }
  return out
}

// Exported for scripts/__tests__/brand-voice-punctuation.test.mjs. The
// exemptions below encode §2 carve-outs; a silent regression in one of them
// would either re-open the em-dash hole or start flagging legitimate output.
export { findPunctuationViolations, isEmbeddedCode, isDebugOutput, stripInterpolations }

function normalize(p) {
  return p.split(sep).join('/')
}

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      yield* walk(full)
    } else if (entry.isFile()) {
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (FILE_EXTS.has(ext)) yield full
    }
  }
}

// Match anything inside a string literal (' " or `). We're not parsing JSX
// perfectly — we're catching the common case of user-visible text written as
// string literals. False positives in code comments are filtered below.
function extractStringLiterals(src) {
  const literals = []
  // Quick-and-dirty: scan for quotes and grab until matching quote, skip escaped.
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '/' && src[i + 1] === '/') {
      // Skip line comment
      const eol = src.indexOf('\n', i)
      i = eol === -1 ? src.length : eol
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      // Skip block comment
      const end = src.indexOf('*/', i + 2)
      i = end === -1 ? src.length : end + 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      const start = i
      i++
      while (i < src.length) {
        if (src[i] === '\\') {
          i += 2
          continue
        }
        if (src[i] === quote) {
          literals.push({ value: src.slice(start + 1, i), startIndex: start })
          i++
          break
        }
        // Template literal interpolation
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1
          i += 2
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++
            else if (src[i] === '}') depth--
            i++
          }
          continue
        }
        i++
      }
      continue
    }
    i++
  }
  return literals
}

// JSX TEXT CHILDREN — the slogan blind spot (added 2026-06-14). The literal
// scanner above only sees quoted strings; copy written as element children
// (<H2>Ready to work with us?</H2>, <Body>the whole brokerage is behind you</Body>)
// is invisible to it, which let a whole class of slogans ship past the gate.
// Parse with the TS compiler and collect JsxText nodes so banned words +
// VOICE.md moves are caught in element children too. A parse failure falls back
// to literal-only scanning (never throws the gate).
function extractJsxText(content) {
  const out = []
  let sf
  try {
    sf = ts.createSourceFile('scan.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  } catch {
    return out
  }
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      const raw = node.getText(sf)
      if (raw.trim().length > 1) out.push({ value: raw, startIndex: node.getStart(sf) })
    }
    node.forEachChild(visit)
  }
  visit(sf)
  return out
}

// A string literal is a code-mechanical token when it appears as an
// import path (`from '<...>'`) or as the argument to `require()` or
// `import()`. Those are NOT user-facing prose and matching banned
// words inside them is a false positive (the canonical example is
// `import dynamic from 'next/dynamic'` flagging the AI-filler word
// "dynamic"). Skip them.
const IMPORT_PATH_LINE = /(^|\s)(from|import\s*\(|require\s*\()\s*['"`]/

// Framework-mechanical string VALUES that are not prose. The canonical case is
// the Next.js route-segment-config `export const dynamic = 'force-dynamic'` —
// the literal 'force-dynamic' contains the banned AI-filler word "dynamic", but
// it is a Next.js API value, never user-visible copy. Matching it is a false
// positive (it inflated the baseline across every force-dynamic admin page).
// Files whose PURPOSE is voice enforcement embed the banned-word lexicon
// itself (regexes, LLM prompt rules listing the banned words). Every hit in
// them is a meta-reference, not prose — skip the whole file.
const LEXICON_FILES = new Set([])

const MECHANICAL_LITERALS = new Set([
  'force-dynamic',
  'force-static',
  'force-cache',
  'force-no-store',
])

// PUBLIC-FACING ONLY (Matt directive 2026-06-13: "I'm only looking at content
// that's public facing. If it's within the code, I'm not concerned — it's
// really what the public sees that should make sense"). The voice laws govern
// what a visitor reads, not internal code strings. Skip non-rendered / internal
// surfaces entirely: server actions (AI prompts, generation logic), API routes,
// admin UI (staff-facing), and metadata files (sitemap/robots). The remaining
// app/ pages + components/ are the public marketing surfaces.
const EXCLUDED_PATH_PREFIXES = [
  'app/api/',
  'app/actions/',
  'app/admin/',
  'components/admin/',
]
const EXCLUDED_EXACT_FILES = new Set([
  'app/sitemap.ts',
  'app/robots.ts',
])
function isInternal(relPath) {
  return (
    EXCLUDED_EXACT_FILES.has(relPath) ||
    EXCLUDED_PATH_PREFIXES.some((p) => relPath.startsWith(p))
  )
}

function scanFile(absPath) {
  const relPath = normalize(relative(ROOT, absPath))
  if (LEXICON_FILES.has(relPath)) return null
  if (isInternal(relPath)) return null // public-facing surfaces only
  let content
  try {
    content = readFileSync(absPath, 'utf8')
  } catch {
    return null
  }
  const lines = content.split('\n')

  const literals = extractStringLiterals(content)
  const violations = []
  for (const lit of literals) {
    const lineNum = content.slice(0, lit.startIndex).split('\n').length
    const lineText = lines[lineNum - 1] ?? ''
    // Skip if this string literal is on an import line.
    if (IMPORT_PATH_LINE.test(lineText)) continue
    // Skip framework-mechanical config values (e.g. Next.js 'force-dynamic').
    if (MECHANICAL_LITERALS.has(lit.value.trim())) continue
    const lower = lit.value.toLowerCase()
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(lower)) {
        violations.push({ word, line: lineNum, snippet: lit.value.slice(0, 80) })
      }
    }
    // VOICE.md banned moves — law-breaking sentences with no banned word.
    for (const pat of BANNED_PATTERNS) {
      if (pat.re.test(lit.value)) {
        violations.push({ word: `Law ${pat.law}: ${pat.label}`, line: lineNum, snippet: lit.value.slice(0, 80) })
      }
    }
    violations.push(...findPunctuationViolations(lit.value, lineNum, lit.value.slice(0, 80), relPath, lineText))
  }

  // JSX text children — slogans written between tags, invisible to the literal
  // scanner. Same banned-word + banned-move checks. (Import-line / mechanical-
  // literal skips don't apply: JSX text is never an import path or config value.)
  for (const frag of extractJsxText(content)) {
    const lineNum = content.slice(0, frag.startIndex).split('\n').length
    const snippet = frag.value.trim().slice(0, 80)
    const lower = frag.value.toLowerCase()
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(lower)) {
        violations.push({ word, line: lineNum, snippet })
      }
    }
    for (const pat of BANNED_PATTERNS) {
      if (pat.re.test(frag.value)) {
        violations.push({ word: `Law ${pat.law}: ${pat.label}`, line: lineNum, snippet })
      }
    }
    violations.push(...findPunctuationViolations(frag.value, lineNum, snippet, relPath, lines[lineNum - 1] ?? ''))
  }

  if (violations.length === 0) return null
  return { file: relPath, count: violations.length, violations }
}

function scanAll() {
  const results = []
  for (const dir of SCAN_DIRS) {
    const absDir = join(ROOT, dir)
    if (!existsSync(absDir)) continue
    for (const file of walk(absDir)) {
      const r = scanFile(file)
      if (r) results.push(r)
    }
  }
  results.sort((a, b) => b.count - a.count)
  return results
}

function summarize(results) {
  const total = results.reduce((s, r) => s + r.count, 0)
  const byFile = Object.fromEntries(results.map((r) => [r.file, r.count]))
  return { total, byFile }
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return null
  }
}

function main() {
  const args = process.argv.slice(2)
  const writeBaseline = args.includes('--write-baseline')
  const reportOnly = args.includes('--report')

  const results = scanAll()
  const summary = summarize(results)

  if (writeBaseline) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: summary.total,
          byFile: summary.byFile,
          note: 'Generated by scripts/check-brand-voice.mjs --write-baseline. Total must monotonically decrease toward 0.',
        },
        null,
        2
      ) + '\n'
    )
    console.log(`✓ Baseline written: ${summary.total} violations across ${results.length} files.`)
    process.exit(0)
  }

  if (reportOnly) {
    console.log(`Brand voice scan — ${summary.total} violations across ${results.length} files\n`)
    for (const r of results.slice(0, 20)) {
      console.log(`  ${r.count.toString().padStart(4)} ${r.file}`)
      for (const v of r.violations.slice(0, 3)) {
        console.log(`         line ${v.line}: "${v.word}" — ${v.snippet}`)
      }
    }
    if (results.length > 20) console.log(`  ... and ${results.length - 20} more files`)
    process.exit(0)
  }

  const baseline = loadBaseline()
  if (!baseline) {
    console.error('✗ No baseline found at scripts/brand-voice-baseline.json')
    console.error('  Run: node scripts/check-brand-voice.mjs --write-baseline')
    process.exit(2)
  }

  if (summary.total > baseline.total) {
    console.error(`✗ Brand voice regression: ${summary.total} violations vs baseline ${baseline.total}`)
    console.error('')
    for (const r of results) {
      const baselineCount = baseline.byFile[r.file] ?? 0
      if (r.count > baselineCount) {
        console.error(`  ${r.file}: ${r.count} (baseline: ${baselineCount})`)
        for (const v of r.violations.slice(0, 5)) {
          console.error(`    line ${v.line}: "${v.word}" — ${v.snippet}`)
        }
      }
    }
    console.error('')
    console.error('See marketing_brain_skills/brand-voice/voice_guidelines.md §6.')
    process.exit(1)
  }

  if (summary.total < baseline.total) {
    console.log(`✓ Brand voice improved: ${summary.total} violations vs baseline ${baseline.total} (−${baseline.total - summary.total})`)
  } else {
    console.log(`✓ Brand voice stable: ${summary.total} violations (= baseline)`)
  }
  process.exit(0)
}

// Only run the scan when invoked as a CLI. Importing this module (the test
// imports the exemption helpers) must not kick off a full scan or process.exit.
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main()
}
