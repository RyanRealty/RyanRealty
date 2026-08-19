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

// VOICE.md > Never name the virtues. VERBATIM from the canon: "Do not call
// ourselves authentic, genuine, honest, simple, transparent, trusted,
// dedicated, or any other virtue." Plus `exceptional`, which the About-mission
// paragraph names in the same breath ("Nowhere else uses authentic /
// exceptional as a claim about us").
//
// WHY THIS EXISTS AGAIN, 2026-08-19. This is the second recurrence of one
// defect. On 2026-08-06 four of the canon's self-praise terms were unprojected
// and `lead="Honest answers to the questions Bend buyers and sellers ask us"`
// shipped live on /faq against a green gate; PROJECTION_REQUIRED was built that
// day to make the drift mechanical. The D11 rewrite (0ad6a0c2) then emptied
// this list AND narrowed PROJECTION_REQUIRED to the two CTA phrases in the same
// commit, so the guard no longer guarded anything and the canon's virtue ban
// went back to being enforced by nobody. A guard edited alongside the thing it
// guards is not a guard, so the check in check-brand-voice.mjs now parses this
// list out of VOICE.md itself.
//
// SCOPE, and what D11 CHANGED. These are phrasings that claim the virtue FOR
// US, not the bare adjectives: "an honest empty state" in a docstring is not a
// brag. D11 also un-banned terms the pre-D11 list carried — the canon now says
// "Other true facts may stay (boutique, premier, full-service if true)" — so
// `premier`, `full-service`, `top producing` and `your local experts` are
// deliberately NOT here. Only the words the D11 canon names are dead.
const SELF_PRAISE = [
  'authentic relationships',
  'authentic approach',
  'genuine care',
  'genuinely care',
  'honest answers',
  'honest advice',
  'honest broker',
  'honest brokerage',
  'we are honest',
  "we're honest",
  'we keep it simple',
  'simple and honest',
  'fully transparent',
  'radically transparent',
  'transparent process',
  'transparent approach',
  'trusted advisor',
  'trusted partner',
  'trusted name',
  'trusted brokerage',
  'most trusted',
  'dedicated team',
  'dedicated agent',
  'dedicated broker',
  'dedicated to your',
  'exceptional customer service',
  'exceptional service',
  'exceptional results',
]

// VOICE.md > "About mission (the one exception)." The canon permits this exact
// sentence on About and nowhere else. Stored verbatim so the scanner can carve
// it out; check-brand-voice.mjs asserts this string still appears in VOICE.md,
// so the carve-out cannot outlive the exception that justifies it.
const ABOUT_MISSION_SENTENCE =
  'We are a boutique real estate brokerage in Bend, Oregon, committed to building community through authentic relationships and exceptional customer service.'

// Retired category names, kept as empty exports because consumers import them.
const TRADING_LANGUAGE = []
const PANDERING = []
const FAKE_URGENCY = []
const CATEGORY_POSITIONING = []
const CLICHES = []
const AI_FILLER = []
const VAGUE_QUALIFIERS = []
const MARKETING_SLOP = []
const SMALLNESS_POSITIONING = []
const HYPE_OPENINGS = []

// WHY SELF_PRAISE IS NOT FOLDED IN HERE. BANNED_WORDS is mirrored by
// scripts/gen-brand-voice-consumers.mjs into lib/brand-voice/generated-
// vocabulary.ts, which lib/voice/check.ts reads to HARD-FAIL live send paths
// (blog save, CMA, BPO, newsletter, CRM templates, social captions). Folding
// the virtue phrasings in there would change runtime send behaviour against
// stored copy this pass cannot read, which is a different blast radius than a
// file gate and belongs to whoever can measure the DB copy. The virtue ban is
// enforced on the FILE surface by check-brand-voice.mjs, which reads
// SELF_PRAISE directly — that is the surface the /faq leak shipped on.
const BANNED_WORDS = [
  ...WORTH_CTA.map((word) => ({ word, category: 'worth-cta' })),
]

const BANNED_PATTERNS = []

const BANNED_WORD_STRINGS = [...new Set(BANNED_WORDS.map((b) => b.word.toLowerCase()))].sort()

module.exports = {
  PROJECTION_REQUIRED,
  PUNCTUATION,
  SELF_PRAISE,
  ABOUT_MISSION_SENTENCE,
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
