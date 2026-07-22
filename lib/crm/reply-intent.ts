/**
 * Inbound-reply intent classification for texted prospects (expired / FSBO).
 *
 * When a prospect we texted replies, the inbound-SMS webhook today creates a
 * generic "Reply to text" task and forwards the raw body. This module reads
 * the reply and returns { intent, confidence, recommendedReply } so the broker
 * can one-tap a suggested response instead of composing from scratch.
 *
 * Two stages:
 *   1. Deterministic pre-pass (no model call, no key needed):
 *      - STOP-adjacent phrasing or profanity  -> not_interested
 *      - explicit "wrong number" phrasing     -> wrong_number
 *      - empty body or a bare acknowledgement -> other (no suggested reply)
 *   2. Model call (Anthropic Messages API, haiku-class — same conventions as
 *      lib/marketing-brain/inbox-parser.ts: ANTHROPIC_API_KEY env, JSON-only
 *      output, fenced-JSON tolerated).
 *
 * FAIL-OPEN CONTRACT: any failure (kill switch, missing key, network error,
 * timeout, non-2xx, bad JSON, invalid intent) returns null. The caller treats
 * null as "no classification" and keeps today's behavior byte-for-byte.
 *
 * MERGE SAFETY (§0): recommendedReply may never state a number, price, or fact
 * the system did not provide. sanitizeRecommendedReply() enforces this
 * mechanically — any digit run or dollar sign in the drafted reply that does
 * not appear verbatim in the prospect's own message or the provided context
 * voids the suggestion (empty string). Banned punctuation (em/en dashes,
 * semicolons) is scrubbed.
 */

export type ReplyIntent =
  | 'interested'
  | 'question'
  | 'not_interested'
  | 'wrong_number'
  | 'later'
  | 'other'

const VALID_INTENTS: ReadonlySet<string> = new Set([
  'interested', 'question', 'not_interested', 'wrong_number', 'later', 'other',
])

/** Short human labels for task names / alert emails / timeline notes. */
export const REPLY_INTENT_LABELS: Record<ReplyIntent, string> = {
  interested: 'Interested',
  question: 'Asked a question',
  not_interested: 'Not interested',
  wrong_number: 'Wrong number',
  later: 'Follow up later',
  other: 'General reply',
}

export interface ReplyIntentContext {
  /** Which prospecting pipeline texted this person, when known. */
  kind?: 'expired' | 'fsbo' | null
  /** Prospect display name, when known (never invented by the model). */
  personName?: string | null
  /** Property street address from the outreach record, when known. */
  address?: string | null
}

export interface ClassifyInboundReplyInput {
  body: string
  context: ReplyIntentContext
}

export interface ReplyClassification {
  intent: ReplyIntent
  confidence: number
  /** 1–2 sentence draft the broker can send as-is. Empty string = no suggestion. */
  recommendedReply: string
  source: 'deterministic' | 'model'
  model?: string
}

// Same API conventions as lib/marketing-brain/inbox-parser.ts (kept local —
// that module does not export them).
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'
/** Twilio webhooks time out at 15s — cap the model call well under that. */
const MODEL_TIMEOUT_MS = 6000

// ---------------------------------------------------------------------------
// Deterministic pre-pass
// ---------------------------------------------------------------------------

/** STOP-adjacent phrasing that the exact-keyword STOP handler upstream misses. */
const STOP_ADJACENT_RE =
  /\b(stop|unsubscribe|remove me|take me off|opt (?:me )?out|do ?n[o']?t (?:text|call|message|contact)|no more (?:texts|messages|calls)|leave me alone|lose my number|quit (?:texting|calling|messaging)|stop (?:texting|calling|messaging|contacting))\b/i

const PROFANITY_RE =
  /\b(fuck\w*|shit\w*|bitch\w*|asshole\w*|piss off|screw (?:you|off))\b/i

const WRONG_NUMBER_RE =
  /\b(wrong number|wrong person|you have the wrong|not the owner|never owned)\b/i

/** Bare acknowledgements that carry no intent signal. */
const ACK_TOKENS: ReadonlySet<string> = new Set([
  'ok', 'okay', 'k', 'kk', 'thanks', 'thank you', 'thx', 'ty', 'got it',
  'sounds good', 'will do', 'no problem', 'np', 'cool', 'alright', 'all right',
])

const NOT_INTERESTED_REPLY = 'Understood, I will not text you again.'
const WRONG_NUMBER_REPLY = 'Apologies for the mix-up. I will remove this number from my list.'

/**
 * Deterministic classification. Returns null when no deterministic rule fires
 * (the model decides). Exported for direct testing.
 */
export function deterministicReplyIntent(body: string): ReplyClassification | null {
  const trimmed = (body ?? '').trim()

  if (!trimmed) {
    return { intent: 'other', confidence: 1, recommendedReply: '', source: 'deterministic' }
  }

  if (STOP_ADJACENT_RE.test(trimmed) || PROFANITY_RE.test(trimmed)) {
    return {
      intent: 'not_interested',
      confidence: 0.95,
      recommendedReply: NOT_INTERESTED_REPLY,
      source: 'deterministic',
    }
  }

  if (WRONG_NUMBER_RE.test(trimmed)) {
    return {
      intent: 'wrong_number',
      confidence: 0.9,
      recommendedReply: WRONG_NUMBER_REPLY,
      source: 'deterministic',
    }
  }

  const normalized = trimmed.toLowerCase().replace(/[.!?\u{1F44D}\u{1F64F}]+\s*$/u, '').trim()
  if (normalized.length <= 12 && ACK_TOKENS.has(normalized)) {
    return { intent: 'other', confidence: 0.85, recommendedReply: '', source: 'deterministic' }
  }

  return null
}

// ---------------------------------------------------------------------------
// Merge-safe reply sanitizer (§0)
// ---------------------------------------------------------------------------

/**
 * Scrub a model-drafted reply so it can never ship an invented number or the
 * banned punctuation. `allowedText` is everything the system actually knows
 * (the prospect's own message + provided context) — any digit run in the reply
 * that is not present verbatim there voids the whole suggestion, as does any
 * dollar sign or percent the source text lacks. Exported for direct testing.
 */
export function sanitizeRecommendedReply(reply: string, allowedText: string): string {
  let out = (reply ?? '')
    .replace(/[—–]/g, ', ')
    .replace(/;/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!out) return ''

  const allowed = allowedText ?? ''
  if ((out.includes('$') && !allowed.includes('$')) || (out.includes('%') && !allowed.includes('%'))) {
    return ''
  }
  const digitRuns = out.match(/\d[\d,.]*/g) ?? []
  for (const run of digitRuns) {
    if (!allowed.includes(run)) return ''
  }

  if (out.length > 300) out = out.slice(0, 300).trim()
  return out
}

// ---------------------------------------------------------------------------
// Model prompt (exported so tests can snapshot construction without network)
// ---------------------------------------------------------------------------

function kindDescription(kind: ReplyIntentContext['kind']): string {
  if (kind === 'expired') return 'Owner of a listing that expired off the MLS. We texted offering help after the listing expired.'
  if (kind === 'fsbo') return 'Owner selling their home without an agent (FSBO). We texted offering help.'
  return 'A homeowner prospect we previously texted.'
}

export function buildReplyIntentPrompt(input: ClassifyInboundReplyInput): { system: string; user: string } {
  const system = `You classify an inbound SMS reply from a homeowner prospect that Ryan Realty (a real-estate brokerage in Bend, Oregon) previously texted. Output a SINGLE JSON object and nothing else:

{
  "intent": "<one of: interested | question | not_interested | wrong_number | later | other>",
  "confidence": <number between 0.0 and 1.0>,
  "recommended_reply": "<1-2 sentence draft the broker can send back as-is, or empty string>"
}

INTENT definitions:
  - interested: they want to talk, meet, hear more, or asked us to call.
  - question: they asked something that needs an answer before anything else.
  - not_interested: they declined, asked us to stop, or are hostile.
  - wrong_number: they say we reached the wrong person or they do not own the property.
  - later: not now, but open to it down the road ("maybe in the spring", "check back later").
  - other: none of the above (small talk, acknowledgement, unclear).

RECOMMENDED_REPLY rules (hard):
  - Written in first person as the broker. Plain, professional, warm. 1-2 short sentences.
  - NEVER invent facts. NEVER state a price, valuation, percentage, date, or any number that does not appear verbatim in the prospect's message or the context.
  - No em dashes, no semicolons, no exclamation marks, no emoji, no marketing cliches.
  - If intent is not_interested or wrong_number: one polite closing sentence, nothing more.
  - If intent is question and answering would require facts you do not have, acknowledge and offer a call instead of guessing.
  - If nothing useful can be suggested, return an empty string.

Output JSON only. No prose. No markdown fences.`

  const ctx = input.context ?? {}
  const user = `Context:
- Prospect: ${kindDescription(ctx.kind)}
- Prospect name: ${ctx.personName?.trim() || 'unknown'}
- Property: ${ctx.address?.trim() || 'unknown'}

Their reply:
"""
${(input.body ?? '').slice(0, 500)}
"""`

  return { system, user }
}

// ---------------------------------------------------------------------------
// Classifier entry point
// ---------------------------------------------------------------------------

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>
}

/**
 * Classify an inbound prospect reply. Deterministic pre-pass first, then a
 * haiku-class model call. Returns null whenever classification cannot run —
 * the caller must treat null as "keep existing behavior exactly".
 */
export async function classifyInboundReply(
  input: ClassifyInboundReplyInput,
): Promise<ReplyClassification | null> {
  // Kill switch: disabling the classifier restores pre-classifier behavior.
  if (process.env.CRM_REPLY_INTENT_DISABLED === '1') return null

  const deterministic = deterministicReplyIntent(input.body)
  if (deterministic) return deterministic

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const { system, user } = buildReplyIntentPrompt(input)

  let response: Response
  try {
    response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 300,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  let textBlock: string
  try {
    const data = (await response.json()) as AnthropicResponse
    textBlock = data.content?.find((b) => b.type === 'text')?.text ?? ''
  } catch {
    return null
  }

  const cleaned = textBlock
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    return null
  }

  const intent = typeof parsed.intent === 'string' ? parsed.intent : ''
  if (!VALID_INTENTS.has(intent)) return null

  const rawConfidence = Number(parsed.confidence)
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0

  const ctx = input.context ?? {}
  const allowedText = [input.body, ctx.personName ?? '', ctx.address ?? ''].join('\n')
  const recommendedReply = sanitizeRecommendedReply(
    typeof parsed.recommended_reply === 'string' ? parsed.recommended_reply : '',
    allowedText,
  )

  return {
    intent: intent as ReplyIntent,
    confidence,
    recommendedReply,
    source: 'model',
    model: HAIKU_MODEL,
  }
}
