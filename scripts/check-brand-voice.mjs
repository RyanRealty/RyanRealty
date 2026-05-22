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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const BASELINE_PATH = join(ROOT, 'scripts/brand-voice-baseline.json')

const SCAN_DIRS = ['app', 'components']
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'out', 'build', 'dist', '__tests__'])
const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

// The hard-fail banned vocabulary. Each MUST be word-boundary matched
// (so "stunning" hits but "kingstunning" wouldn't — though that's unlikely).
// Pulled from voice_guidelines.md §6 and the SITE_SPEC.md banned list.
const BANNED_WORDS = [
  // Real-estate clichés
  'stunning',
  'nestled',
  'breathtaking',
  'charming',
  'gorgeous',
  'pristine',
  'boasts',
  'must-see',
  'must see',
  'dream home',
  'meticulously maintained',
  "entertainer's dream",
  'tucked away',
  'hidden gem',
  'turnkey',
  'immaculate',
  'captivating',
  'exquisite',
  // AI filler
  'delve',
  'leverage',
  'tapestry',
  'navigate',
  'robust',
  'seamless',
  'comprehensive',
  'elevate',
  'unlock',
  'holistic',
  'vibrant',
  'bustling',
  'eclectic',
  'curated',
  'bespoke',
  'foster',
  // Vague hedging
  'approximately',
  'roughly',
  // Marketing slop
  'top producing',
  'white glove',
  'luxury concierge',
  'premier brokerage',
  'boutique brokerage',
  'your real estate journey',
  'we are passionate about',
  'we pride ourselves on',
  // Fake urgency
  "don't miss out",
  "won't last long",
  'act fast',
  'act now',
]

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

function scanFile(absPath) {
  const relPath = normalize(relative(ROOT, absPath))
  let content
  try {
    content = readFileSync(absPath, 'utf8')
  } catch {
    return null
  }

  const literals = extractStringLiterals(content)
  const violations = []
  for (const lit of literals) {
    const lower = lit.value.toLowerCase()
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(lower)) {
        const lineNum = content.slice(0, lit.startIndex).split('\n').length
        violations.push({ word, line: lineNum, snippet: lit.value.slice(0, 80) })
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
