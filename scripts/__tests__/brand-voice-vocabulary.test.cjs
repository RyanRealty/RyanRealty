/**
 * Parity test for the brand-voice vocabulary single source of truth.
 *
 * Asserts that BOTH consumers — the ESLint plugin
 * (eslint-rules/no-brand-voice-violations.js) and the CI script
 * (scripts/check-brand-voice.mjs) — load the SAME banned-vocabulary
 * module and see identical sets.
 *
 * Closes GAP-7 from out/guardrail-inventory-2026-05-28.md: ESLint and
 * CI brand-voice lists used to diverge silently. If this test passes
 * the two gates enforce the same vocabulary.
 *
 * Run via:
 *   node scripts/__tests__/brand-voice-vocabulary.test.cjs
 */

'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const { execSync } = require('node:child_process')

const VOCAB = require('../brand-voice-vocabulary.cjs')

// 1. The vocabulary module exports the expected shape.
assert.ok(Array.isArray(VOCAB.PUNCTUATION) && VOCAB.PUNCTUATION.length === 4,
  'PUNCTUATION must export 4 banned characters (em-dash, en-dash, semicolon, exclamation)')
assert.ok(Array.isArray(VOCAB.BANNED_WORDS) && VOCAB.BANNED_WORDS.length > 50,
  'BANNED_WORDS must carry > 50 entries (clichés + AI filler + qualifiers + slop + urgency + hype + pandering)')
assert.ok(Array.isArray(VOCAB.BANNED_WORD_STRINGS) && VOCAB.BANNED_WORD_STRINGS.length > 0,
  'BANNED_WORD_STRINGS must carry the deduped lowercase string list')

// 2. The ESLint plugin requires the same module and exposes the same totals.
const pluginPath = path.join(__dirname, '..', '..', 'eslint-rules/no-brand-voice-violations.js')
const pluginSrc = require('fs').readFileSync(pluginPath, 'utf8')
assert.ok(
  pluginSrc.includes("require('../scripts/brand-voice-vocabulary.cjs')"),
  'ESLint plugin must require the shared vocabulary module — found a different require path',
)

// 3. The CI script imports the same module too.
const ciScriptPath = path.join(__dirname, '..', 'check-brand-voice.mjs')
const ciScriptSrc = require('fs').readFileSync(ciScriptPath, 'utf8')
assert.ok(
  ciScriptSrc.includes("require('./brand-voice-vocabulary.cjs')"),
  'CI script must require the shared vocabulary module — found a different require path',
)
assert.ok(
  ciScriptSrc.includes('VOCAB.BANNED_WORD_STRINGS'),
  'CI script must use VOCAB.BANNED_WORD_STRINGS as its banned list',
)

// 4. Every word in BANNED_WORDS appears in BANNED_WORD_STRINGS (the deduped list).
for (const { word } of VOCAB.BANNED_WORDS) {
  assert.ok(
    VOCAB.BANNED_WORD_STRINGS.includes(word.toLowerCase()),
    `BANNED_WORDS entry "${word}" missing from BANNED_WORD_STRINGS`,
  )
}

// 5. Every word in BANNED_WORD_STRINGS is non-empty and lowercase.
for (const w of VOCAB.BANNED_WORD_STRINGS) {
  assert.ok(w.length > 0, 'empty string in BANNED_WORD_STRINGS')
  assert.equal(w, w.toLowerCase(), `"${w}" should be lowercase in BANNED_WORD_STRINGS`)
}

// 6. Punctuation entries each have a char + label + advice string.
for (const p of VOCAB.PUNCTUATION) {
  assert.equal(typeof p.char, 'string', 'PUNCTUATION entry missing char')
  assert.equal(typeof p.label, 'string', 'PUNCTUATION entry missing label')
  assert.equal(typeof p.advice, 'string', 'PUNCTUATION entry missing advice')
  assert.equal(p.char.length, 1, `PUNCTUATION char "${p.char}" must be a single character`)
}

console.log(`brand-voice-vocabulary: parity test OK`)
console.log(`  PUNCTUATION         ${VOCAB.PUNCTUATION.length}`)
console.log(`  CLICHES             ${VOCAB.CLICHES.length}`)
console.log(`  AI_FILLER           ${VOCAB.AI_FILLER.length}`)
console.log(`  VAGUE_QUALIFIERS    ${VOCAB.VAGUE_QUALIFIERS.length}`)
console.log(`  MARKETING_SLOP      ${VOCAB.MARKETING_SLOP.length}`)
console.log(`  FAKE_URGENCY        ${VOCAB.FAKE_URGENCY.length}`)
console.log(`  HYPE_OPENINGS       ${VOCAB.HYPE_OPENINGS.length}`)
console.log(`  PANDERING           ${VOCAB.PANDERING.length}`)
console.log(`  BANNED_WORDS total  ${VOCAB.BANNED_WORDS.length}`)
console.log(`  BANNED_WORD_STRINGS ${VOCAB.BANNED_WORD_STRINGS.length} (deduped, lowercase, sorted)`)
