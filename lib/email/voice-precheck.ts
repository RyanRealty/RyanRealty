/**
 * Newsletter pre-send brand-voice gate.
 *
 * The CI voice gate (scripts/check-brand-voice.mjs + brand-voice-vocabulary.cjs)
 * scopes to public `app/` copy and EXCLUDES `app/admin/`, so an admin-authored
 * newsletter body is never checked by it. A published newsletter is public copy,
 * so this is a focused runtime hard-fail check run right before send.
 *
 * It mirrors the HARD fails in CLAUDE.md §"Brand Voice" (banned punctuation +
 * the cliché / AI-filler word lists). The banned-word list is imported from
 * lib/brand-voice/generated-vocabulary.ts — the in-bundle mirror of the
 * canonical scripts/brand-voice-vocabulary.cjs (see scripts/gen-brand-voice-
 * consumers.mjs) — so this check can never drift from the canonical source.
 */

import { PUNCTUATION_CHARS, BANNED_WORD_STRINGS } from '@/lib/brand-voice/generated-vocabulary'

// Em-dash (U+2014) and en-dash (U+2013) are banned punctuation in body copy.
// The exclamation mark is intentionally excluded here: one exclamation per
// piece is allowed per voice_guidelines, so a blanket hard-fail would over-block.
const PUNCT_LABELS: Record<string, string> = {
  '—': 'em dash (—)',
  '–': 'en dash (–)',
  ';': 'semicolon (;)',
}
const BANNED_PUNCT: Array<{ label: string; test: (s: string) => boolean }> = PUNCTUATION_CHARS.filter(
  (ch) => ch !== '!',
).map((ch) => ({ label: PUNCT_LABELS[ch] ?? ch, test: (s: string) => s.includes(ch) }))

// Real-estate clichés + AI filler + marketing slop + hype that hard-fail a
// published surface. Canonical source: scripts/brand-voice-vocabulary.cjs.
const BANNED_WORDS: readonly string[] = BANNED_WORD_STRINGS

export interface VoicePrecheckResult {
  ok: boolean
  violations: string[]
}

/** Strip HTML tags + decode the few entities the shell emits, to text. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    // Remaining entities (&bull; &rarr; &#8226; ...) become a space BEFORE the
    // punctuation scan — otherwise the entity's own semicolon false-fails the
    // banned-punctuation check on every producer-authored body.
    .replace(/&#?[a-zA-Z0-9]{2,10};/g, ' ')
    .replace(/\s+/g, ' ')
}

/**
 * Check newsletter content (HTML body + optional plain text + subject) for hard
 * brand-voice fails. Returns every violation so the admin can fix before send.
 */
export function checkNewsletterVoice(input: {
  subject?: string | null
  bodyHtml?: string | null
  bodyText?: string | null
}): VoicePrecheckResult {
  // body_text can carry residual HTML entities when it was auto-generated from
  // the HTML body — treat entity tokens as the characters they encode, not as
  // literal ampersand-semicolon punctuation.
  const bodyTextClean = (input.bodyText ?? '').replace(/&#?[a-zA-Z0-9]{2,10};/g, ' ')
  const text = [
    input.subject ?? '',
    input.bodyHtml ? htmlToText(input.bodyHtml) : '',
    bodyTextClean,
  ].join(' \n ')
  const lower = text.toLowerCase()
  const violations: string[] = []

  for (const p of BANNED_PUNCT) {
    if (p.test(text)) violations.push(`banned punctuation: ${p.label}`)
  }
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(lower)) violations.push(`banned word: "${w}"`)
  }
  return { ok: violations.length === 0, violations }
}
