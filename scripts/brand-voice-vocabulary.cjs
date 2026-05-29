/**
 * scripts/brand-voice-vocabulary.cjs
 *
 * SINGLE SOURCE OF TRUTH for the brand-voice banned vocabulary used
 * by both:
 *   - eslint-rules/no-brand-voice-violations.js (editor + lint gate, G2)
 *   - scripts/check-brand-voice.mjs (ratcheted CI gate, G3)
 *
 * Canonical reference: CLAUDE.md §3 (Brand Voice — ABSOLUTE) +
 * marketing_brain_skills/brand-voice/voice_guidelines.md §6.
 *
 * CommonJS (`.cjs`) so the ESLint plugin (which loads as CJS) can
 * `require()` it. The .mjs CI script imports via dynamic
 * `createRequire`. A test in scripts/__tests__/brand-voice-vocabulary.test.cjs
 * asserts both consumers see identical sets.
 *
 * Edits to the banned lists land HERE and propagate to both gates.
 * Do NOT hand-edit the consumers.
 */

'use strict'

const PUNCTUATION = [
  { char: '—', label: 'em-dash (U+2014)', advice: 'Replace with a period or comma.' },
  { char: '–', label: 'en-dash (U+2013)', advice: 'Replace with a period or comma.' },
  { char: ';', label: 'semicolon', advice: 'Replace with a period.' },
  { char: '!', label: 'exclamation mark', advice: 'Drop or rephrase. Body prose is exclamation-free.' },
]

// Real-estate clichés — §6.2 (full canonical list from CLAUDE.md §3).
const CLICHES = [
  'stunning',
  'breathtaking',
  'gorgeous',
  'charming',
  'pristine',
  'nestled',
  'boasts',
  'must-see',
  'must see',
  'dream home',
  'meticulously maintained',
  "entertainer's dream",
  'tucked away',
  'hidden gem',
  'truly',
  'spacious',
  'cozy',
  'luxurious',
  'updated throughout',
  'turnkey',
  'immaculate',
  'captivating',
  'exquisite',
]

// AI filler — §6.2 (full canonical list).
const AI_FILLER = [
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
  'dynamic',
  'vibrant',
  'bustling',
  'eclectic',
  'curated',
  'bespoke',
  'foster',
]

// Vague qualifiers — §6.2 (full canonical list).
const VAGUE_QUALIFIERS = [
  'approximately',
  'roughly',
  'about',
  'around',
  'fairly',
  'somewhat',
]

// Marketing slop — §6.2 (full canonical list).
const MARKETING_SLOP = [
  'top producing',
  'top 1 percent',
  'white glove',
  'luxury concierge',
  'premier brokerage',
  'boutique brokerage',
  'your real estate journey',
  'we are passionate about',
  'we pride ourselves on',
  // D79 — self-describing tone filler. Let a specific fact carry the line.
  'honest guidance from a local team',
  'honest guidance from your local team',
  'guidance from a local team',
  'guidance from your local team',
  'from your local team',
  'trusted local team',
  'your trusted',
]

// Fake urgency — §6.2 (full canonical list).
const FAKE_URGENCY = [
  'act fast',
  "don't miss out",
  "won't last long",
  "won't last",
  'act now',
]

// Hype openings — flagged when they appear as full phrases.
const HYPE_OPENINGS = [
  'get ready to fall in love',
  "you won't believe",
  'stunning new listing',
]

// Pandering / talking down — full phrases.
const PANDERING = [
  'what a beautiful home',
  'you have great taste',
  'we will handle everything',
  'let me explain in simple terms',
  'i know this seems complicated',
]

// Flat banned list with category annotation, used by both consumers.
const BANNED_WORDS = [
  ...CLICHES.map((word) => ({ word, category: 'real-estate cliché' })),
  ...AI_FILLER.map((word) => ({ word, category: 'AI filler' })),
  ...VAGUE_QUALIFIERS.map((word) => ({ word, category: 'vague qualifier' })),
  ...MARKETING_SLOP.map((word) => ({ word, category: 'marketing slop' })),
  ...FAKE_URGENCY.map((word) => ({ word, category: 'fake urgency' })),
  ...HYPE_OPENINGS.map((word) => ({ word, category: 'hype opening' })),
  ...PANDERING.map((word) => ({ word, category: 'pandering' })),
]

// Plain-string list, sorted alphabetically — used by the CI script's
// grep-based scanner. Lowercase + de-duped.
const BANNED_WORD_STRINGS = [...new Set(BANNED_WORDS.map((b) => b.word.toLowerCase()))].sort()

module.exports = {
  PUNCTUATION,
  CLICHES,
  AI_FILLER,
  VAGUE_QUALIFIERS,
  MARKETING_SLOP,
  FAKE_URGENCY,
  HYPE_OPENINGS,
  PANDERING,
  BANNED_WORDS,
  BANNED_WORD_STRINGS,
}
