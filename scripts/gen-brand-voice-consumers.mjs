#!/usr/bin/env node
/**
 * gen-brand-voice-consumers.mjs — W11.1 codegen bridge.
 *
 * scripts/brand-voice-vocabulary.cjs is the ONE canonical banned-vocabulary
 * source, but it is CommonJS in scripts/ — the Next app bundle cannot `require`
 * it at runtime, and Python cannot import it at all. So the ~13 runtime consumers
 * historically each hand-typed their own copy, which drifted (e.g. several still
 * hard-banned "about"/"spacious"/"turnkey" that the canonical source un-banned
 * 2026-06-02).
 *
 * This generator reads the canonical .cjs and emits DERIVED, in-bundle artifacts
 * the consumers CAN import:
 *   - lib/brand-voice/generated-vocabulary.ts  (TS module for app-bundle + tsx)
 *   - scripts/_brand_voice_vocab_generated.py  (module for the build_*.py fleet)
 *
 * Modes:
 *   --write   regenerate both artifacts on disk (run after editing the .cjs)
 *   --check   regenerate to memory and exit 1 if either on-disk file differs
 *             (this is what ci:voice-vocab-parity runs — a drifted or stale
 *             generated artifact fails the commit)
 *
 * Determinism: output is a pure function of the canonical .cjs (sorted lists,
 * fixed formatting), so --check is byte-stable.
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const require = createRequire(import.meta.url)
const VOCAB = require('./brand-voice-vocabulary.cjs')

const TS_PATH = join(repoRoot, 'lib/brand-voice/generated-vocabulary.ts')
const PY_PATH = join(repoRoot, 'scripts/_brand_voice_vocab_generated.py')

const GEN_NOTE = 'GENERATED — DO NOT EDIT. Source of truth: scripts/brand-voice-vocabulary.cjs'
const REGEN = 'Regenerate: node scripts/gen-brand-voice-consumers.mjs --write'

// Deterministic views of the canonical data.
//
// Note: VOCAB.BANNED_PATTERNS (the VOICE.md law regexes) is intentionally NOT
// mirrored into the generated artifacts. It has no W11.1 in-bundle consumer —
// pattern-scanning (check-brand-voice.mjs, _seo-prose-scan.mjs) requires the
// canonical .cjs directly via createRequire, which already sees BANNED_PATTERNS
// with zero drift risk. Emitting an export nothing imports would just be dead
// weight (see ci:reachable-exports). If a TS/JS consumer ever needs pattern
// scanning, add BANNED_PATTERNS back here and wire a real consumer.
const bannedStrings = [...VOCAB.BANNED_WORD_STRINGS] // already deduped/lowercased/sorted
const punctChars = VOCAB.PUNCTUATION.map((p) => p.char)
const bannedWords = [...VOCAB.BANNED_WORDS]
  .map(({ word, category }) => ({ word: word.toLowerCase(), category }))
  .sort((a, b) => a.word.localeCompare(b.word) || a.category.localeCompare(b.category))

const jsStr = (s) => JSON.stringify(s)

function renderTs() {
  const lines = []
  lines.push(`/* eslint-disable */`)
  lines.push(`// ${GEN_NOTE}`)
  lines.push(`// ${REGEN}`)
  lines.push(`//`)
  lines.push(`// The single in-bundle mirror of the canonical banned vocabulary. App-bundle`)
  lines.push(`// TS (voice checks, brief generation, GBP scan) imports THIS instead of`)
  lines.push(`// hand-typing a list — the ci:voice-vocab-parity gate fails on any drift.`)
  lines.push(``)
  lines.push(`export interface BannedWord { readonly word: string; readonly category: string }`)
  lines.push(``)
  lines.push(`/** Banned punctuation characters (em-dash, en-dash, semicolon, exclamation). */`)
  lines.push(`export const PUNCTUATION_CHARS: readonly string[] = [${punctChars.map(jsStr).join(', ')}]`)
  lines.push(``)
  lines.push(`/** Deduped, lowercased, sorted banned-word/phrase strings. */`)
  lines.push(`export const BANNED_WORD_STRINGS: readonly string[] = [`)
  for (const w of bannedStrings) lines.push(`  ${jsStr(w)},`)
  lines.push(`]`)
  lines.push(``)
  lines.push(`/** Banned words with their category, for richer violation messages. */`)
  lines.push(`export const BANNED_WORDS: readonly BannedWord[] = [`)
  for (const { word, category } of bannedWords) lines.push(`  { word: ${jsStr(word)}, category: ${jsStr(category)} },`)
  lines.push(`]`)
  lines.push(``)
  return lines.join('\n')
}

function renderPy() {
  const lines = []
  lines.push(`# ${GEN_NOTE}`)
  lines.push(`# ${REGEN}`)
  lines.push(`#`)
  lines.push(`# The single mirror of the canonical banned vocabulary for the build_*.py`)
  lines.push(`# producer fleet. Import from here (via scripts/_producer_lib.py) instead of`)
  lines.push(`# hand-typing a list — ci:voice-vocab-parity fails on any drift.`)
  lines.push(``)
  lines.push(`PUNCTUATION_CHARS = [${punctChars.map(jsStr).join(', ')}]`)
  lines.push(``)
  lines.push(`BANNED_WORD_STRINGS = [`)
  for (const w of bannedStrings) lines.push(`    ${jsStr(w)},`)
  lines.push(`]`)
  lines.push(``)
  lines.push(`BANNED_WORDS = [`)
  for (const { word, category } of bannedWords) lines.push(`    {"word": ${jsStr(word)}, "category": ${jsStr(category)}},`)
  lines.push(`]`)
  lines.push(``)
  return lines.join('\n')
}

const artifacts = [
  { path: TS_PATH, rel: 'lib/brand-voice/generated-vocabulary.ts', body: renderTs() },
  { path: PY_PATH, rel: 'scripts/_brand_voice_vocab_generated.py', body: renderPy() },
]

const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null
if (!mode) {
  console.error('Usage: node scripts/gen-brand-voice-consumers.mjs (--write | --check)')
  process.exit(2)
}

if (mode === 'write') {
  for (const a of artifacts) {
    writeFileSync(a.path, a.body)
    console.log(`✓ wrote ${a.rel} (${a.body.length} bytes)`)
  }
  process.exit(0)
}

// --check
const drift = []
for (const a of artifacts) {
  if (!existsSync(a.path)) {
    drift.push(`${a.rel}: MISSING — run --write`)
    continue
  }
  const onDisk = readFileSync(a.path, 'utf8')
  if (onDisk !== a.body) drift.push(`${a.rel}: STALE vs canonical .cjs — run --write and commit`)
}
console.log('Brand-voice generated-artifact freshness (gen-brand-voice-consumers --check)')
console.log('===========================================================================')
if (drift.length) {
  for (const d of drift) console.error(`  ✗ ${d}`)
  console.error(`\n\x1b[31m✗ generated vocabulary is stale/missing (${drift.length}).\x1b[0m`)
  process.exit(1)
}
console.log('✓ generated-vocabulary.ts and _brand_voice_vocab_generated.py match the canonical .cjs.')
process.exit(0)
