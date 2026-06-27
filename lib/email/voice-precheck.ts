/**
 * Newsletter pre-send brand-voice gate.
 *
 * The CI voice gate (scripts/check-brand-voice.mjs + brand-voice-vocabulary.cjs)
 * scopes to public `app/` copy and EXCLUDES `app/admin/`, so an admin-authored
 * newsletter body is never checked by it. A published newsletter is public copy,
 * so this is a focused runtime hard-fail check run right before send.
 *
 * It mirrors the HARD fails in CLAUDE.md §"Brand Voice" (banned punctuation +
 * the cliché / AI-filler word lists). It is intentionally a subset — the
 * unambiguous fails — not the full regex pattern set; the canonical source of
 * truth remains scripts/brand-voice-vocabulary.cjs.
 */

// Em-dash (U+2014) and en-dash (U+2013) are banned punctuation in body copy.
const BANNED_PUNCT: Array<{ label: string; test: (s: string) => boolean }> = [
  { label: 'em dash (—)', test: (s) => s.includes('—') },
  { label: 'en dash (–)', test: (s) => s.includes('–') },
  { label: 'semicolon (;)', test: (s) => /;/.test(s) },
]

// Real-estate clichés + AI filler + hype that hard-fail a published surface.
const BANNED_WORDS = [
  'stunning', 'breathtaking', 'gorgeous', 'charming', 'pristine', 'nestled',
  'boasts', 'must-see', 'must see', 'dream home', 'meticulously maintained',
  "entertainer's dream", 'tucked away', 'hidden gem', 'luxurious',
  'updated throughout', 'immaculate', 'captivating', 'exquisite',
  'delve', 'tapestry', 'robust', 'seamless', 'elevate', 'unlock', 'holistic',
  'bustling', 'eclectic', 'bespoke', 'act fast', "don't miss out",
  "won't last", 'white glove', 'premier brokerage',
]

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
  const text = [
    input.subject ?? '',
    input.bodyHtml ? htmlToText(input.bodyHtml) : '',
    input.bodyText ?? '',
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
