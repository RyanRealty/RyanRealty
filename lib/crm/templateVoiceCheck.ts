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
 * THIN ADAPTER (W11.2): the actual scan (word-boundary matching, the
 * canonical banned core) delegates to the ONE shared lib/voice/check.ts
 * checkBrandVoice() — this module layers the template-specific LOCAL_EXTRAS
 * (hyphenated/negated variants + terms not in the canonical set) on top, and
 * maps the result back onto the historical `VoiceViolation` /
 * `VoiceCheckResult` shapes every caller here already expects
 * (lib/crm/templateValidation.ts, lib/crm/compose-audience.ts).
 * templateVoiceCheck.test.ts asserts this module's exported banned lists stay
 * a superset of the canonical vocabulary, so the two can never silently
 * drift.
 *
 * PUNCTUATION_CHARS + BANNED_WORD_STRINGS are imported directly (not just
 * transitively through lib/voice/check.ts) — scripts/check-voice-vocab-
 * parity.mjs's CONSUMER_MANIFEST requires this file to import + use the
 * canonical vocabulary source directly.
 *
 * Pure module — no I/O, no DB, fully unit-tested.
 */

import { checkBrandVoice } from '@/lib/voice/check'
import { PUNCTUATION_CHARS, BANNED_WORD_STRINGS } from '@/lib/brand-voice/generated-vocabulary'

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
 * Punctuation that hard-fails a save. Derived from the canonical
 * PUNCTUATION_CHARS. The exclamation mark is NOT a hard fail here:
 * VOICE.md allows one exclamation per piece, and a single "!" in
 * a short SMS is legitimate, so the gate would over-block. Em/en-dash and
 * semicolon are unconditional hard fails per CLAUDE.md §3.
 */
export const TEMPLATE_BANNED_PUNCTUATION: readonly string[] = PUNCTUATION_CHARS.filter((ch) => ch !== '!')

/**
 * Template-specific extras layered on top of the canonical banned-word list:
 * hyphenated/negated variants and terms not covered by the canonical set but
 * that fire on template copy in practice (SMS/email specific phrasing).
 */
const LOCAL_EXTRAS: readonly string[] = [
  'white-glove',
  'do not miss out',
  'will not last',
  'you will not believe',
  'introducing',
  'boutique',
]

/**
 * Banned words/phrases that hard-fail a save. Core list is the canonical
 * BANNED_WORD_STRINGS from lib/brand-voice/generated-vocabulary.ts (mirrors
 * scripts/brand-voice-vocabulary.cjs), layered with LOCAL_EXTRAS above. Kept
 * lowercase; matching is case-insensitive and word-boundary aware so
 * "boastsworth" or a substring inside an unrelated word does not false-trigger.
 *
 * The parity test asserts this list is a SUPERSET of the canonical
 * BANNED_WORD_STRINGS, so adding a word to the canonical list and not here
 * fails CI.
 */
export const TEMPLATE_BANNED_WORDS: readonly string[] = [...BANNED_WORD_STRINGS, ...LOCAL_EXTRAS]

/** Escape a string for safe inclusion in a RegExp source. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Scan a single field for hard-fail punctuation and banned words.
 * Returns every distinct violation found (the action surfaces all of them so
 * the author fixes the whole field in one pass).
 *
 * The canonical core (punctuation + BANNED_WORD_STRINGS) runs through the
 * shared checkBrandVoice() scanner (allowExclamation:true, matching
 * TEMPLATE_BANNED_PUNCTUATION's exclusion of "!"); LOCAL_EXTRAS are then
 * layered on with the same word-boundary matcher.
 */
export function scanTemplateField(
  field: 'subject' | 'body',
  text: string | null | undefined,
): VoiceViolation[] {
  const value = (text ?? '').toString()
  if (!value) return []

  const shared = checkBrandVoice(value, { allowExclamation: true })
  const violations: VoiceViolation[] = shared.violations.map((v) => ({ field, term: v.term, kind: v.kind }))

  const seenWords = new Set(violations.filter((v) => v.kind === 'word').map((v) => v.term))
  const lower = value.toLowerCase()
  for (const word of LOCAL_EXTRAS) {
    if (seenWords.has(word)) continue
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`, 'i')
    if (pattern.test(lower)) {
      seenWords.add(word)
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
