/**
 * scripts/brand-voice-vocabulary.cjs
 *
 * The machine-readable WORD list of marketing_brain_skills/brand-voice/VOICE.md.
 *
 * REBUILT FROM ZERO 2026-08-05 (Matt: "remove any existing rules that were
 * already in place for the voice. Any banned words, any whatever, all of it
 * gets nuked, and we replace it with this new voice"). Every category that
 * existed before this date is gone. Nothing was merged forward. A word is
 * banned here ONLY because VOICE.md bans it, and the canon is the place to
 * argue about it.
 *
 * The SHAPES a word list cannot catch (coined maxims, a sentence explaining
 * the sentence before it, sermon clauses) live in scripts/voice-constructions.cjs.
 * Words here, sentences there, canon above both.
 *
 * Consumed by eslint-rules/no-brand-voice-violations.js, scripts/check-brand-voice.mjs,
 * and (via generated mirrors) lib/brand-voice/generated-vocabulary.ts and the
 * Python build fleet. Export names are load-bearing: keep them.
 */

'use strict'

// VOICE.md > Mechanics. Em/en dashes, semicolons, and exclamation marks do not
// appear in prose a reader sees.
const PUNCTUATION = [
  { char: '—', label: 'em-dash (U+2014)', advice: 'Replace with a period or comma.' },
  { char: '–', label: 'en-dash (U+2013)', advice: 'Replace with a period or comma.' },
  { char: ';', label: 'semicolon', advice: 'Replace with a period.' },
  { char: '!', label: 'exclamation mark', advice: 'Drop or rephrase. Market-data copy is exclamation-free.' },
]

// Every phrase below is quoted from VOICE.md > "Banned constructions". This
// file inherits NOTHING from the pre-2026-08-05 vocabulary: no cliche list, no
// AI-filler list, no marketing-slop list, no hype-openings list. If a phrase is
// not named in the canon, it is not banned. Add it to the canon first.

// VOICE.md > Banned constructions > Pandering.
const PANDERING = [
  'great question',
  'you have great taste',
  'we will handle everything',
  'let me explain in simple terms',
  'buying a home is a big decision',
]

// VOICE.md > Banned constructions > Fake urgency.
const FAKE_URGENCY = ['act fast', "don't miss out", 'dont miss out', "won't last long", 'wont last long']

// VOICE.md > Banned constructions > Self-praise.
// Scoped to US, because that is how the canon means them. "Boutique brokerage"
// is NOT here: Matt 2026-08-05, "We are a boutique brokerage." It is an
// accurate description of the firm, not a virtue we are claiming.
const SELF_PRAISE = ['your local experts', 'premier brokerage', 'top producing']

// VOICE.md > Banned constructions > Category and headcount as position.
const CATEGORY_POSITIONING = [
  'independent brokerage by design',
  'full-service brokerage',
  'licensed and active brokers',
  'three brokers',
  'small team',
]

// Retired category names, kept as empty exports because consumers import them.
// The lists they held are deleted, not merged forward.
const CLICHES = []
const AI_FILLER = []
const VAGUE_QUALIFIERS = []
const MARKETING_SLOP = []
const SMALLNESS_POSITIONING = []
const HYPE_OPENINGS = []

const BANNED_WORDS = [
  ...PANDERING.map((word) => ({ word, category: 'pandering' })),
  ...FAKE_URGENCY.map((word) => ({ word, category: 'fake-urgency' })),
  ...SELF_PRAISE.map((word) => ({ word, category: 'self-praise' })),
  ...CATEGORY_POSITIONING.map((word) => ({ word, category: 'category-positioning' })),
]

// No word-level regexes. The shapes the old ones approximated are rules now,
// enforced sentence-by-sentence in scripts/voice-constructions.cjs.
const BANNED_PATTERNS = []

const BANNED_WORD_STRINGS = [...new Set(BANNED_WORDS.map((b) => b.word.toLowerCase()))].sort()

// ─────────────────────────────────────────────────────────────────────────────
// BANNED MOVES — the VOICE.md laws, hard-coded (added 2026-06-13).
//
// The word lists above police VOCABULARY. These regex patterns police the
// MOVES vocabulary can't catch — a sentence that brags, panders, or names the
// category breaks a law with zero banned words ("the standard every home gets,"
// "we're honest," "independent brokerage serving Bend"). Each pattern is tied
// to a VOICE.md law. `source` is a JS RegExp source string; the gate runs it
// case-insensitively against each user-facing string literal.
//
// Precision over recall: patterns are deliberately specific to avoid false-
// positive floods. The gate is baseline-ratcheted, so existing site copy that
// trips a pattern is captured as the burn-down queue (allowed, must only
// decrease); NEW violations fail the commit.
// ─────────────────────────────────────────────────────────────────────────────
// VOICE.md sentence-level word rules. These catch phrasings with no single
// banned word. Keyed to the canon's rule numbers, not the retired "Five Laws".
// The larger shape patterns (coined maxims, meaning-narration, sermon clauses)
// live in scripts/voice-constructions.cjs and run in the same gates.
module.exports = {
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
