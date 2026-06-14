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
import { join, relative, sep } from 'node:path'
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
const LEXICON_FILES = new Set([
  'app/api/cron/crm-smart-followups/route.ts',
])

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

main()
