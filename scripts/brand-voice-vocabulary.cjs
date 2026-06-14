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

// Real-estate clichés — §6.2.
// Realism pass 2026-06-02: removed 'spacious' + 'cozy' (a room genuinely can be
// spacious or cozy — accurate description, not hype) and 'turnkey' (precise term
// for move-in-ready). The empty-hype clichés stay.
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
  'luxurious',
  'updated throughout',
  'immaculate',
  'captivating',
  'exquisite',
]

// AI filler — §6.2.
// Realism pass 2026-06-02: removed 'leverage' (legit "leverage equity"),
// 'navigate' (plain English; the cliché "navigate your real estate journey" is
// still banned as a phrase), 'comprehensive' (a market analysis genuinely can
// be), and 'foster' (plain verb — foster community/relationships). The true
// AI-slop tells (delve, tapestry, seamless, robust, elevate, unlock, etc.) stay.
const AI_FILLER = [
  'delve',
  'tapestry',
  'robust',
  'seamless',
  'elevate',
  'unlock',
  'holistic',
  'dynamic',
  'vibrant',
  'bustling',
  'eclectic',
  'curated',
  'bespoke',
]

// Vague qualifiers — relaxed to empty 2026-06-02 (realism pass). A bare whole-word
// ban on about/around/approximately/roughly/fairly/somewhat blocked legitimate
// plain English ("questions about buying", "homes around Bend") and honest
// measurement hedges (acreage, drive times). The data-accuracy discipline — never
// substitute "about/roughly/approximately" for a pulled STAT — remains enforced as
// a CLAUDE.md §0 principle (verification trace per figure), not a blunt prose ban.
const VAGUE_QUALIFIERS = []

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

// Smallness positioning — BANNED on all site/marketing copy (Matt directive
// 2026-06-10: "is that going to position us, our intent is to grow"). Headcount
// is not a position; capability is. The brokerage positions on its standard,
// its data, and direct-broker accountability — never on being small. ("a small
// business like ours" remains allowed ONLY in Matt's personal 1:1
// correspondence voice, e.g. review replies — not on site surfaces.)
const SMALLNESS_POSITIONING = [
  'three brokers',
  'small brokerage',
  'small team',
  'small business like ours',
  'boutique brokerage',
  'just the three of us',
  'team of three',
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
  ...SMALLNESS_POSITIONING.map((word) => ({ word, category: 'smallness positioning' })),
  ...HYPE_OPENINGS.map((word) => ({ word, category: 'hype opening' })),
  ...PANDERING.map((word) => ({ word, category: 'pandering' })),
]

// Plain-string list, sorted alphabetically — used by the CI script's
// grep-based scanner. Lowercase + de-duped.
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
const BANNED_PATTERNS = [
  // Law 1 — Show it, don't say it. Self-applied virtue.
  { law: 1, label: 'self-virtue ("we are <virtue>")',
    source: "\\b(we(?:'re| are)|our team is|the team is)\\s+(?:a\\s+|the\\s+|your\\s+|most\\s+|very\\s+|truly\\s+)*(honest|trusted|trustworthy|experts?|dedicated|passionate|transparent|professional|knowledgeable|reliable|dependable|experienced|committed|caring)\\b" },
  { law: 1, label: 'self-virtue (honest/trusted guidance)',
    source: "\\b(honest|trusted|expert|local|personalized) (guidance|advice|service|expertise|insight)\\b" },
  { law: 1, label: 'self-virtue (experts you can trust)',
    source: "\\b(experts? you can trust|trusted (local|name|partner|advisor|broker|expert)s?|your trusted)\\b" },

  // Law 2 — A number beats an adjective. Empty superlatives.
  { law: 2, label: 'empty superlative',
    source: "\\b(exceptional|world.?class|top.?notch|cutting.?edge|state.?of.?the.?art|unparalleled|best.?in.?class|second to none|unmatched)\\b" },

  // Law 3 — Talk to a smart adult. Warmth/comfort filler + the obvious.
  { law: 3, label: 'warmth filler',
    source: "\\bwe(?:'re| are)\\s+(here (to help|for you)|happy to help|ready to help)\\b" },
  { law: 3, label: 'warmth filler (we would love to)',
    source: "\\bwe(?:'d| would|d)? love to (help|hear|learn|work)\\b" },
  { law: 3, label: "warmth filler (don't hesitate / feel free)",
    source: "\\b(don'?t hesitate|feel free) to (reach out|contact|call|ask)\\b" },
  { law: 3, label: 'states the obvious',
    source: "\\b(buying|selling) a home is (a big|one of the biggest|an important)\\b" },
  { law: 3, label: 'talking down',
    source: "\\b(let (us|me) (help|guide|explain|walk you)|we'?ll handle everything|we'?ll take care of everything|in simple terms)\\b" },

  // Law 4 — The category is not a claim. Category / credential self-naming.
  { law: 4, label: 'category self-naming',
    source: "\\b(independent|boutique|full.?service|premier|leading|trusted) brokerage\\b" },
  { law: 4, label: 'category self-naming (brokerage serving)',
    source: "\\bbrokerage (serving|that serves|in bend)\\b" },
  { law: 4, label: 'credential as position',
    source: "\\blicensed (and active )?brokers?\\b" },
]

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
