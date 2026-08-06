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

// VOICE.md > rule 4 > "Homes sell. They do not trade." Scoped to the phrasings
// that describe a sale, so a trade-off sentence and a tradesman survive.
const TRADING_LANGUAGE = ['homes traded', 'homes trade', 'home traded', 'actually traded', 'trades at a', 'has traded', 'have traded']

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
//
// The canon (VOICE.md line 178) bans six: "Honest," "trusted," "dedicated,"
// "your local experts," "premier," "top producing." Four of them went
// unprojected until 2026-08-06, which is why `lead="Honest answers to the
// questions Bend buyers and sellers ask us"` shipped on /faq against a green
// gate. They are listed as the self-praise PHRASINGS rather than as bare words:
// the canon bans claiming the virtue, not the adjective. "An honest empty
// state" in a docstring is not a brag, and PROJECTION_REQUIRED below is what
// mechanically proves each canon term reached this list.
const SELF_PRAISE = [
  'your local experts',
  'premier brokerage',
  'top producing',
  'honest answers',
  'honest advice',
  'honest broker',
  'we are honest',
  "we're honest",
  'trusted advisor',
  'trusted partner',
  'trusted name',
  'trusted brokerage',
  'most trusted',
  'dedicated team',
  'dedicated agent',
  'dedicated broker',
  'dedicated to your',
  'premier real estate',
  'premier agent',
  'premier destination',
]

// Every self-praise term the canon names, and the substring of SELF_PRAISE that
// carries it. check-brand-voice.mjs asserts each one is covered, so a term
// bolded in VOICE.md can never again be absent from the machine list — the
// failure class that produced the /faq leak. Adding a term to VOICE.md without
// a phrasing here fails the gate.
const PROJECTION_REQUIRED = [
  { canon: 'honest', covered: 'honest answers' },
  { canon: 'trusted', covered: 'trusted advisor' },
  { canon: 'dedicated', covered: 'dedicated team' },
  { canon: 'your local experts', covered: 'your local experts' },
  { canon: 'premier', covered: 'premier brokerage' },
  { canon: 'top producing', covered: 'top producing' },
]

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
  ...TRADING_LANGUAGE.map((word) => ({ word, category: 'trading-language' })),
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
