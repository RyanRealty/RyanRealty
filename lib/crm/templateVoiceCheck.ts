/**
 * templateVoiceCheck — the brand-voice hard-fail gate for CRM templates.
 *
 * Email + SMS templates are user-facing copy that fires unattended from the
 * sequence engine. CLAUDE.md §3 (Brand Voice — ABSOLUTE) bans em-dashes,
 * en-dashes, semicolons, and a fixed vocabulary in any public-facing copy. The
 * commit-time gate (scripts/check-brand-voice.mjs) only scans source files, so
 * a template stored in the DB would bypass it entirely. This module is the
 * runtime equivalent: every template save (createTemplateAction /
 * updateTemplateAction) runs subject + body through checkTemplateVoice and
 * refuses to persist a hard fail.
 *
 * This is a SELF-CONTAINED runtime list (no dependency on scripts/*.cjs, which
 * is outside the app bundle). The canonical source of truth remains
 * scripts/brand-voice-vocabulary.cjs; templateVoiceCheck.test.ts loads that
 * canonical module and asserts every punctuation hard-fail + banned word it
 * declares is also covered here, so the two can never silently drift.
 *
 * Pure module — no I/O, no DB, fully unit-tested.
 */

/** A single brand-voice violation found in a template field. */
export type VoiceViolation = {
  /** Which field carried the violation. */
  field: 'subject' | 'body'
  /** The offending punctuation char or banned word/phrase. */
  term: string
  /** Human-readable category for the surfaced error. */
  kind: 'punctuation' | 'word'
}

export type VoiceCheckResult =
  | { ok: true }
  | { ok: false; error: string; violations: VoiceViolation[] }

/**
 * Punctuation that hard-fails a save. Mirrors PUNCTUATION in
 * scripts/brand-voice-vocabulary.cjs. The exclamation mark is NOT a hard fail
 * here: voice_guidelines allows one exclamation per piece, and a single "!" in
 * a short SMS is legitimate, so the gate would over-block. Em/en-dash and
 * semicolon are unconditional hard fails per CLAUDE.md §3.
 */
export const TEMPLATE_BANNED_PUNCTUATION: readonly string[] = ['—', '–', ';']

/**
 * Banned words/phrases that hard-fail a save. Mirrors the hard-fail vocabulary
 * in scripts/brand-voice-vocabulary.cjs (BANNED_WORD_STRINGS). Kept lowercase;
 * matching is case-insensitive and word-boundary aware so "boastsworth" or a
 * substring inside an unrelated word does not false-trigger.
 *
 * The parity test asserts this list is a SUPERSET of the canonical
 * BANNED_WORD_STRINGS, so adding a word to the canonical list and not here
 * fails CI.
 */
export const TEMPLATE_BANNED_WORDS: readonly string[] = [
  // real-estate clichés
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
  // AI filler
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
  // marketing slop
  'top producing',
  'top 1 percent',
  'white glove',
  'white-glove',
  'luxury concierge',
  'premier',
  'premier brokerage',
  'boutique brokerage',
  'your real estate journey',
  'we are passionate about',
  'we pride ourselves on',
  // fake urgency
  'act fast',
  'act now',
  "don't miss out",
  'do not miss out',
  "won't last long",
  "won't last",
  'will not last',
  // hype openings
  'get ready to fall in love',
  "you won't believe",
  'you will not believe',
  'introducing',
  'stunning new listing',
  // smallness / headcount positioning
  'small brokerage',
  'small team',
  'small business like ours',
  'boutique',
  'three brokers',
  'team of three',
  'just the three of us',
  // local-team filler positioning
  'from your local team',
  'guidance from a local team',
  'guidance from your local team',
  'honest guidance from a local team',
  'honest guidance from your local team',
  'trusted local team',
  'your trusted',
  // pandering
  'what a beautiful home',
  'you have great taste',
  'let me explain in simple terms',
  'i know this seems complicated',
  'we will handle everything',
]

/** Escape a string for safe inclusion in a RegExp source. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Scan a single field for hard-fail punctuation and banned words.
 * Returns every distinct violation found (the action surfaces all of them so
 * the author fixes the whole field in one pass).
 */
export function scanTemplateField(
  field: 'subject' | 'body',
  text: string | null | undefined,
): VoiceViolation[] {
  const value = (text ?? '').toString()
  if (!value) return []
  const violations: VoiceViolation[] = []
  const seen = new Set<string>()

  for (const ch of TEMPLATE_BANNED_PUNCTUATION) {
    if (value.includes(ch) && !seen.has(`p:${ch}`)) {
      seen.add(`p:${ch}`)
      violations.push({ field, term: ch, kind: 'punctuation' })
    }
  }

  const lower = value.toLowerCase()
  for (const word of TEMPLATE_BANNED_WORDS) {
    if (seen.has(`w:${word}`)) continue
    // Word-boundary match. \b works for alphanumeric edges; for multi-word and
    // apostrophe/hyphen phrases we anchor on non-letter boundaries.
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`, 'i')
    if (pattern.test(lower)) {
      seen.add(`w:${word}`)
      violations.push({ field, term: word, kind: 'word' })
    }
  }

  return violations
}

/**
 * The full template brand-voice gate. Runs subject (email only) + body through
 * scanTemplateField. ok:false carries every violation plus a single
 * human-readable error string the action returns verbatim.
 */
export function checkTemplateVoice(input: {
  subject?: string | null
  body: string
}): VoiceCheckResult {
  const violations = [
    ...scanTemplateField('subject', input.subject),
    ...scanTemplateField('body', input.body),
  ]
  if (violations.length === 0) return { ok: true }

  const punct = violations.filter((v) => v.kind === 'punctuation').map((v) => describePunct(v.term))
  const words = violations.filter((v) => v.kind === 'word').map((v) => `"${v.term}"`)
  const parts: string[] = []
  if (punct.length > 0) parts.push(`banned punctuation (${[...new Set(punct)].join(', ')})`)
  if (words.length > 0) parts.push(`banned wording (${[...new Set(words)].join(', ')})`)
  const error = `This template fails the brand voice check. Remove ${parts.join(' and ')} before saving.`
  return { ok: false, error, violations }
}

function describePunct(ch: string): string {
  if (ch === '—') return 'em-dash'
  if (ch === '–') return 'en-dash'
  if (ch === ';') return 'semicolon'
  return ch
}
