/**
 * scripts/brand-voice-vocabulary.cjs
 *
 * Machine-readable WORD list of marketing_brain_skills/brand-voice/VOICE.md
 * (D11). The mechanical gate is tiny: punctuation + invented quotes +
 * Value my home. Invented quotes live in scripts/voice-constructions.cjs.
 * Do not grow a novel of regex.
 *
 * Consumed by eslint-rules/no-brand-voice-violations.js,
 * scripts/check-brand-voice.mjs, and (via generated mirrors)
 * lib/brand-voice/generated-vocabulary.ts and the Python build fleet.
 * Export names are load-bearing: keep them.
 */

'use strict'

// VOICE.md > Punctuation. Em/en dashes, semicolons, and exclamation marks
// do not appear in prose a reader sees.
const PUNCTUATION = [
  { char: '—', label: 'em-dash (U+2014)', advice: 'Replace with a period or comma.' },
  { char: '–', label: 'en-dash (U+2013)', advice: 'Replace with a period or comma.' },
  { char: ';', label: 'semicolon', advice: 'Replace with a period.' },
  { char: '!', label: 'exclamation mark', advice: 'Drop or rephrase. Public prose is exclamation-free.' },
]

// VOICE.md > Value my home. Never on a CTA we would tap.
const WORTH_CTA = [
  "what's my home worth",
  'whats my home worth',
  'what is my home worth',
  "what's your home worth",
  'whats your home worth',
  'what is your home worth',
]

// Every CTA phrase the canon names, and the substring of WORTH_CTA that
// carries it. check-brand-voice.mjs asserts each one is covered.
const PROJECTION_REQUIRED = [
  { canon: "what's my home worth", covered: "what's my home worth" },
  { canon: 'what is your home worth', covered: 'what is your home worth' },
]

// Retired category names, kept as empty exports because consumers import them.
const TRADING_LANGUAGE = []
const PANDERING = []
const FAKE_URGENCY = []
const SELF_PRAISE = []
const CATEGORY_POSITIONING = []
const CLICHES = []
const AI_FILLER = []
const VAGUE_QUALIFIERS = []
const MARKETING_SLOP = []
const SMALLNESS_POSITIONING = []
const HYPE_OPENINGS = []

const BANNED_WORDS = [
  ...WORTH_CTA.map((word) => ({ word, category: 'worth-cta' })),
]

const BANNED_PATTERNS = []

const BANNED_WORD_STRINGS = [...new Set(BANNED_WORDS.map((b) => b.word.toLowerCase()))].sort()

module.exports = {
  PROJECTION_REQUIRED,
  PUNCTUATION,
  CLICHES,
  AI_FILLER,
  VAGUE_QUALIFIERS,
  MARKETING_SLOP,
  FAKE_URGENCY,
  SMALLNESS_POSITIONING,
  HYPE_OPENINGS,
  PANDERING,
  BANNED_WORDS,
  BANNED_WORD_STRINGS,
  BANNED_PATTERNS,
}
