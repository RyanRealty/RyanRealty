/**
 * Newsletter pre-send brand-voice gate.
 *
 * The CI voice gate (scripts/check-brand-voice.mjs + brand-voice-vocabulary.cjs)
 * scopes to public `app/` copy and EXCLUDES `app/admin/`, so an admin-authored
 * newsletter body is never checked by it. A published newsletter is public copy,
 * so this is a focused runtime hard-fail check run right before send.
 *
 * It mirrors the HARD fails in CLAUDE.md §"Brand Voice" (banned punctuation +
 * the cliché / AI-filler word lists). THIN ADAPTER (W11.2): the actual scan
 * (word-boundary matching, HTML handling, the canonical banned core) lives in
 * the ONE shared lib/voice/check.ts checkBrandVoice() — this module just maps
 * its structured VoiceViolation[] back onto the historical
 * `{ ok, violations: string[] }` shape every caller here already expects
 * (app/actions/newsletter.ts, app/actions/contact-newsletter.ts,
 * app/admin/(protected)/newsletters/actions.ts), so none of them change.
 *
 * PUNCTUATION_CHARS is imported directly (not just transitively through
 * lib/voice/check.ts) to build the human-readable violation labels below —
 * scripts/check-voice-vocab-parity.mjs's CONSUMER_MANIFEST requires this file
 * to import + use the canonical vocabulary source directly, so this can never
 * drift from lib/brand-voice/generated-vocabulary.ts (the in-bundle mirror of
 * the canonical scripts/brand-voice-vocabulary.cjs).
 */

import { checkBrandVoice, type VoiceViolation as SharedVoiceViolation } from '@/lib/voice/check'
import { PUNCTUATION_CHARS } from '@/lib/brand-voice/generated-vocabulary'

// Human-readable labels for the hard-fail punctuation chars. Built by
// iterating the canonical PUNCTUATION_CHARS (rather than hand-listing them)
// so a future addition to the canonical set gets a sane fallback label ("the
// char itself") automatically, with no code change required here.
const PUNCT_LABEL_OVERRIDES: Record<string, string> = {
  '—': 'em dash (—)',
  '–': 'en dash (–)',
  ';': 'semicolon (;)',
}
const PUNCT_LABELS: Record<string, string> = Object.fromEntries(
  PUNCTUATION_CHARS.map((ch) => [ch, PUNCT_LABEL_OVERRIDES[ch] ?? ch]),
)

export interface VoicePrecheckResult {
  ok: boolean
  violations: string[]
}

/**
 * Check newsletter content (HTML body + optional plain text + subject) for hard
 * brand-voice fails. Returns every violation so the admin can fix before send.
 *
 * The exclamation mark is intentionally allowed here (allowExclamation: true):
 * one exclamation per piece is allowed per VOICE.md, so a blanket
 * hard-fail would over-block. bodyHtml is tag-stripped + entity-decoded;
 * subject/bodyText get the lighter entity clean-up only (matches the prior
 * behavior, which never ran subject/bodyText through htmlToText).
 */
export function checkNewsletterVoice(input: {
  subject?: string | null
  bodyHtml?: string | null
  bodyText?: string | null
}): VoicePrecheckResult {
  const shared = checkBrandVoice(
    { subject: input.subject, bodyHtml: input.bodyHtml, bodyText: input.bodyText },
    { allowExclamation: true },
  )
  const describe = (v: SharedVoiceViolation): string =>
    v.kind === 'punctuation' ? `banned punctuation: ${PUNCT_LABELS[v.term] ?? v.term}` : `banned word: "${v.term}"`
  // Dedupe across fields — the prior implementation scanned one combined
  // string, so the same offending term never appeared twice in the list even
  // if it occurred in both the subject and the body.
  const violations = [...new Set(shared.violations.map(describe))]
  return { ok: violations.length === 0, violations }
}
