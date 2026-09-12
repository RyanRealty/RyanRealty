/**
 * taste-voice.mjs — voice is part of every public page pass.
 *
 * Matt 2026-09-12: the listing fold talked like an analyst briefing, and the
 * taste evaluator never had to read the words. VOICE.md is still the only
 * voice document (no banned-word commit gate — that retired 2026-09-07).
 * The separate evaluator must look at the sentences a visitor can read,
 * quote them, and record `tasteReview.voice`. ci:taste-canon refuses a
 * review dated 2026-09-12 or later that skipped it or failed it.
 *
 * This module is the shared brief, the named analyst tells (SITE-99 class),
 * and the receipt contract. `scripts/taste-evaluate.ts` and
 * `scripts/taste-table.mjs` inject the brief. `scripts/lib/taste-receipt.mjs`
 * runs the receipt check.
 */
import { existsSync, readFileSync } from 'node:fs'

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function isNonEmptyString(v, min = 1) {
  return typeof v === 'string' && v.trim().length >= min
}

/** Receipts evaluated on or after this date must carry `voice`. */
export const RECEIPT_VOICE_FROM = '2026-09-12'

export const VOICE_DOC = 'marketing_brain_skills/brand-voice/VOICE.md'

/**
 * Analyst-briefing tells. These are the SITE-99 class of line — a memo, not
 * a broker talking to a client. Not the retired banned-word list.
 */
export const ANALYST_VOICE_TELLS = Object.freeze([
  {
    id: 'times-the',
    re: /\b\d+(?:\.\d+)?\s+times the\b/i,
    label: 'ratio lecture ("N times the T")',
  },
  {
    id: 'leftover-membership',
    re: /leftover membership/i,
    label: 'internal leftover membership',
  },
  {
    id: 'leftover-hud',
    re: /leftover hud/i,
    label: 'internal leftover HUD',
  },
  {
    id: 'watch-by-email',
    re: /watch .{0,80} by email/i,
    label: 'Watch X by email',
  },
  {
    id: 'sits-pct',
    re: /\bsits \d+(?:\.\d+)?%\s+(?:under|over)\b/i,
    label: 'price "sits N% under/over"',
  },
  {
    id: 'what-to-do-about-this-house',
    re: /what to do about this house/i,
    label: 'What to do about this house',
  },
])

export function needsVoiceReceipt(tr) {
  return isPlainObject(tr) && String(tr.evaluatedAt ?? '') >= RECEIPT_VOICE_FROM
}

/** Named analyst tells found in visitor copy. Empty = none of this class. */
export function analystVoiceHits(text) {
  const src = typeof text === 'string' ? text : ''
  if (!src.trim()) return []
  return ANALYST_VOICE_TELLS.filter((t) => t.re.test(src)).map((t) => t.label)
}

export function loadVoiceHowWeSound(root = process.cwd()) {
  const abs = `${root}/${VOICE_DOC}`
  if (!existsSync(abs)) return ''
  const raw = readFileSync(abs, 'utf8')
  const start = raw.indexOf('## How we sound')
  if (start < 0) return raw.slice(0, 600)
  const rest = raw.slice(start)
  const end = rest.indexOf('\n## ', 3)
  return (end > 0 ? rest.slice(0, end) : rest).trim()
}

/**
 * Injected into taste-evaluate and taste-table. The judge must read the
 * words, not only the layout. Amboqia shots OCR poorly — quote sentences.
 */
export function evaluatorVoiceBrief({ visitorCopy = '' } = {}) {
  const how = loadVoiceHowWeSound()
  const hits = analystVoiceHits(visitorCopy)
  const copyBlock = visitorCopy.trim()
    ? [
        '',
        'Visitor copy extracted from the rendered page (Amboqia shots OCR poorly — read these words):',
        visitorCopy.trim().slice(0, 4000),
        hits.length
          ? `Analyst-briefing tells already present in that copy: ${hits.join('; ')}. voice.pass must be false until those lines are rewritten.`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  return [
    '## Voice (blocking — every page, not listing-only)',
    '',
    'Voice is part of this pass the same way catalog demoMatch is. A page that looks',
    'fine and talks like a briefing has failed. The only voice document is',
    `${VOICE_DOC}. Copy is judged by one question: does it sound like a person who`,
    'knows Central Oregon and wants to help.',
    '',
    how,
    '',
    'Passing: warm, direct, you/we, how a Bend broker talks to a client. Specific',
    'beats generic. Numbers stay real and traceable.',
    '',
    'Failing (name these if you see them): analyst briefing; "N times the T"; leftover',
    'membership / leftover HUD; "Watch {address} by email"; "sits 38.7% under";',
    '"What to do about this house"; KPI jargon as the sentence; Talk to a broker as',
    'the card headline; first ask as the visitor heading. Do not invent a banned-word',
    'list. If a line would embarrass you to read aloud to a client, it fails.',
    '',
    'You MUST look at the words. Quote at least two visitor sentences you actually',
    'read. Do not pass a page whose words you did not read.',
    '',
    'Return this object on every response:',
    '{"voice":{"pass":true,"lines":["exact sentence one","exact sentence two"],"findings":[]}}',
    'voice.pass false is blocking. findings names the brutal line and the rewrite a',
    'broker would say. Empty findings only when pass is true.',
    copyBlock,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/**
 * After the evaluator returns. Missing voice, unread words, or a pass over
 * known analyst tells is a failed evaluate — the item is not done.
 */
export function evaluateVoiceResult(voice, visitorCopy = '') {
  const p = []
  if (!isPlainObject(voice)) {
    p.push('voice is missing. Every page evaluate records voice (VOICE.md). Look at the words.')
    return p
  }
  if (typeof voice.pass !== 'boolean') {
    p.push('voice.pass must be true or false.')
  }
  const lines = Array.isArray(voice.lines) ? voice.lines.filter((s) => isNonEmptyString(s, 8)) : []
  if (lines.length < 2) {
    p.push('voice.lines must quote at least two visitor sentences the evaluator actually read.')
  }
  const hits = analystVoiceHits(visitorCopy)
  if (hits.length) {
    p.push(`visitor copy still has analyst-briefing voice: ${hits.join('; ')}. Rewrite those lines (VOICE.md).`)
  }
  if (voice.pass === false) {
    p.push('voice.pass is false. Rewrite the visitor copy before the item is done (VOICE.md).')
  }
  if (voice.pass === true && hits.length) {
    p.push('voice.pass cannot be true while analyst-briefing tells remain in the visitor copy.')
  }
  return p
}

/**
 * Receipt contract for ci:taste-canon. Old receipts (before RECEIPT_VOICE_FROM)
 * stay valid until their next evaluate. A new-dated review that skipped voice
 * or failed it cannot ship.
 */
export function voiceReceiptProblems(tr) {
  if (!needsVoiceReceipt(tr)) return []
  const v = tr.voice
  if (!isPlainObject(v)) {
    return [
      `voice is missing. Reviews dated ${RECEIPT_VOICE_FROM} or later must record voice (VOICE.md). Look at the words on the page.`,
    ]
  }
  if (typeof v.pass !== 'boolean') {
    return ['voice.pass must be true or false.']
  }
  const lines = Array.isArray(v.lines) ? v.lines.filter((s) => isNonEmptyString(s, 8)) : []
  if (lines.length < 2) {
    return ['voice.lines must quote at least two visitor sentences the evaluator actually read.']
  }
  if (v.pass === false) {
    return ['voice.pass is false. Rewrite the visitor copy before the item is done (VOICE.md).']
  }
  return []
}

/** Strip tags from rendered HTML so the evaluator can read the words. */
export function visitorCopyFromHtml(html) {
  if (typeof html !== 'string' || !html.trim()) return ''
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
