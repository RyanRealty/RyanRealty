/**
 * checkBrandVoice — the ONE shared runtime brand-voice hard-fail scanner.
 *
 * W11.2 (docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json): before this
 * module, two separate self-contained runtime voice checks existed with their
 * own scanning logic — lib/email/voice-precheck.ts (checkNewsletterVoice) and
 * lib/crm/templateVoiceCheck.ts (checkTemplateVoice/scanTemplateField). Both
 * already imported the canonical banned-word/punctuation source (W11.1), but
 * each still hand-rolled its OWN scan loop, its own HTML handling, and its own
 * violation shape — so a fix to the scanning logic itself (a regex bug, a
 * missing entity case) had to land twice, and every new send path had to
 * choose which of the two shapes to imitate.
 *
 * This module is the single scanner both of those now adapt over (see the
 * thin-adapter comments in each file), and the one every NEW send path calls
 * directly: app/actions/blog.ts (saveBlogPost), lib/cma/build.ts (buildCma),
 * lib/bpo/build.ts (buildBpo), app/api/social/publish/route.ts
 * (resolveCaption). scripts/check-voice-send-paths.mjs (ci:voice-send-paths)
 * mechanically asserts every one of those paths calls this (or
 * checkTemplateVoice, which now delegates here) AND gates the send on the
 * result — see that file for the enforced list.
 *
 * Design:
 *   - The banned core (words + punctuation) is imported from
 *     lib/brand-voice/generated-vocabulary.ts — the in-bundle mirror of the
 *     canonical scripts/brand-voice-vocabulary.cjs (scripts/gen-brand-voice-
 *     consumers.mjs). Never hand-typed here. ci:voice-vocab-parity guards it.
 *   - Punctuation: em-dash / en-dash / semicolon are ALWAYS banned. '!' is
 *     banned only when `opts.allowExclamation` is false (the default) —
 *     voice_guidelines allows one exclamation per piece, so callers whose
 *     surface tolerates that (a template body, a social caption) opt in.
 *   - Word matching uses the `(^|[^a-z0-9])word([^a-z0-9]|$)` boundary style
 *     from templateVoiceCheck.ts's scanTemplateField — more robust than `\b`
 *     (a plain `\b` treats `_` as a word char, so e.g. a snake_case token
 *     could dodge or false-trigger a boundary; this style does not).
 *   - HTML handling mirrors voice-precheck.ts: a `bodyHtml` field is ALWAYS
 *     run through the tag-strip + entity-decode pass (that is what the field
 *     name means), independent of `opts.stripHtml`. Every other field gets a
 *     light entity clean-up (turns residual `&amp;`-style tokens from an
 *     HTML-templated source into a space) always, plus the full tag-strip
 *     pass too when `opts.stripHtml` is set — for a caller (like
 *     saveBlogPost) that hands the WHOLE object HTML-flavored content under a
 *     non-`bodyHtml` key (e.g. its `subject` bucket is a plain join of
 *     title/excerpt, but the caller marks the whole call `stripHtml: true`
 *     defensively — harmless on already-plain text since the tag-strip pass
 *     is a no-op with no tags present).
 *   - Pure, synchronous, no I/O, no import of scripts/*.cjs at runtime (that
 *     stays scripts-side; the app bundle only ever sees the generated .ts
 *     mirror).
 */
import { PUNCTUATION_CHARS, BANNED_WORD_STRINGS } from '@/lib/brand-voice/generated-vocabulary'

/** A single brand-voice violation. `field` is set only for object-input calls. */
export type VoiceViolation = {
  /** The offending punctuation char or banned word/phrase (lowercase for words). */
  term: string
  /** Human-readable category. */
  kind: 'punctuation' | 'word'
  /** Which input field carried the violation (object-input calls only). */
  field?: string
}

export interface VoiceCheckResult {
  ok: boolean
  violations: VoiceViolation[]
}

/** The named fields a caller may hand in instead of a single string. */
export interface CheckBrandVoiceFields {
  subject?: string | null
  body?: string | null
  /** Always HTML — tag-stripped + entity-decoded regardless of `stripHtml`. */
  bodyHtml?: string | null
  /** Plain text that may still carry residual HTML entities (e.g. auto- generated from an HTML body); entities are cleaned, tags are not stripped. */
  bodyText?: string | null
}

export type CheckBrandVoiceInput = string | CheckBrandVoiceFields

export interface CheckBrandVoiceOptions {
  /** Run every field (or the plain-string input) through the HTML tag-strip
   *  pass, not just entity clean-up. `bodyHtml` gets this treatment always,
   *  with or without this flag. Default false. */
  stripHtml?: boolean
  /** Allow a bare "!" — do not hard-fail on it. Default false (banned), per
   *  the canonical punctuation set. */
  allowExclamation?: boolean
}

/** Strip HTML tags + decode the handful of entities the shell emits, to text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    // Remaining entities (&bull; &rarr; &#8226; ...) become a space BEFORE the
    // punctuation scan — otherwise the entity's own semicolon false-fails the
    // banned-punctuation check.
    .replace(/&#?[a-zA-Z0-9]{2,10};/g, ' ')
    .replace(/\s+/g, ' ')
}

/** Turn residual HTML-entity tokens into a space without stripping tags. */
function cleanEntities(text: string): string {
  return text.replace(/&#?[a-zA-Z0-9]{2,10};/g, ' ')
}

/** Escape a string for safe inclusion in a RegExp source. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Scan one already-prepared text blob for hard-fail punctuation + banned
 * words. Dedupes within this call (one violation per distinct term).
 */
function scanText(text: string, field: string | undefined, punctuationChars: readonly string[]): VoiceViolation[] {
  const violations: VoiceViolation[] = []
  const seen = new Set<string>()

  for (const ch of punctuationChars) {
    if (text.includes(ch) && !seen.has(`p:${ch}`)) {
      seen.add(`p:${ch}`)
      violations.push(field !== undefined ? { term: ch, kind: 'punctuation', field } : { term: ch, kind: 'punctuation' })
    }
  }

  const lower = text.toLowerCase()
  for (const word of BANNED_WORD_STRINGS) {
    if (seen.has(`w:${word}`)) continue
    // Word-boundary match. \b works for alphanumeric edges; for multi-word and
    // apostrophe/hyphen phrases we anchor on non-letter boundaries instead.
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`, 'i')
    if (pattern.test(lower)) {
      seen.add(`w:${word}`)
      violations.push(field !== undefined ? { term: word, kind: 'word', field } : { term: word, kind: 'word' })
    }
  }

  return violations
}

/**
 * The one shared brand-voice hard-fail gate. Accepts either a plain string
 * (already-composed prose — a CMA rationale, a BPO rationale, a social
 * caption) or an object of named fields (a blog post's title/excerpt/SEO
 * fields as `subject` + its HTML body as `bodyHtml`, a newsletter's
 * subject/bodyHtml/bodyText, a template's subject/body). Every violation
 * found is returned; `ok` is true only when the list is empty.
 */
export function checkBrandVoice(input: CheckBrandVoiceInput, opts: CheckBrandVoiceOptions = {}): VoiceCheckResult {
  const allowExclamation = opts.allowExclamation ?? false
  const stripHtml = opts.stripHtml ?? false
  const punctuationChars = allowExclamation ? PUNCTUATION_CHARS.filter((ch) => ch !== '!') : PUNCTUATION_CHARS

  if (typeof input === 'string') {
    if (!input) return { ok: true, violations: [] }
    const text = stripHtml ? htmlToText(input) : cleanEntities(input)
    const violations = scanText(text, undefined, punctuationChars)
    return { ok: violations.length === 0, violations }
  }

  const violations: VoiceViolation[] = []
  const fields: Array<[string, string | null | undefined, boolean]> = [
    ['subject', input.subject, stripHtml],
    ['body', input.body, stripHtml],
    ['bodyHtml', input.bodyHtml, true],
    ['bodyText', input.bodyText, stripHtml],
  ]
  for (const [field, raw, asHtml] of fields) {
    if (raw == null) continue
    const value = raw.toString()
    if (!value) continue
    const text = asHtml ? htmlToText(value) : cleanEntities(value)
    violations.push(...scanText(text, field, punctuationChars))
  }
  return { ok: violations.length === 0, violations }
}
