/**
 * reviewProse — advisory Orwell-rules LLM pass over long-form prose (W11.3).
 *
 * docs/plans/PROGRAM_2026-07-21/COMPLETION-LEDGER.json row W11.3: "Orwell
 * reviewer — advisory LLM pass on long-form (violations list + rewrite,
 * facts unchanged), non-blocking."
 *
 * This is NOT a second deterministic hard-fail gate — lib/voice/check.ts
 * (checkBrandVoice, W11.2) stays the ONE thing that can block a send. This
 * module is a style pass on top of that floor: it reviews prose against
 * George Orwell's "Politics and the English Language" rules (cut clichés and
 * stale phrases, prefer a short word to a long one, cut every word you can,
 * prefer the active voice) plus a pandering/self-praise check, and offers a
 * violations list + a full rewrite. It NEVER throws and NEVER blocks a build
 * — every call site attaches (or logs) the result and moves on regardless of
 * what it returns.
 *
 * Same Anthropic pattern as lib/cma/judge.ts (judgeComps): a Claude tool call
 * that must return through a fixed tool schema, wrapped in try/catch,
 * degrading to a fixed "unavailable" shape on any error or missing key.
 *
 * §0 FACT-PRESERVATION GUARD — the safety-critical mechanism. The LLM is never
 * trusted to preserve a NUMERIC fact on its own. `factsPreserved()` is a pure,
 * exported function that extracts every numeric fact token from the ORIGINAL
 * (currency, percentages, bare numbers, 4-digit years) and checks each survives
 * as an EXACT extracted fact of the rewrite (set membership, so magnitude
 * inflation like $1,200 -> $1,200,000 is caught, not just an outright drop).
 * Only when every numeric fact survives does the rewrite ship; otherwise
 * `rewrite` is nulled and `factsPreserved` is false, but the violations list
 * still surfaces. Proper nouns (street/place/broker names) are instructed to the
 * model but NOT machine-verified here — the output is advisory, human-reviewed,
 * never auto-applied, so the numeric floor is the hard guard.
 */

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-5'

export type VoiceReviewViolationKind = 'stale-phrase' | 'long-word' | 'cuttable' | 'passive'

export interface VoiceReviewViolation {
  kind: VoiceReviewViolationKind
  /** The exact offending span from the original text. */
  span: string
  /** A concrete replacement or fix. */
  suggestion: string
}

export interface VoiceReview {
  /** False when the reviewer never ran (no key, empty text, or the call failed). */
  ran: boolean
  violations: VoiceReviewViolation[]
  /** Full rewritten prose, or null when unavailable or the fact-guard rejected it. */
  rewrite: string | null
  /** True when `rewrite` (if present) is verified to carry every fact from the original. */
  factsPreserved: boolean
}

const DEGRADED: VoiceReview = { ran: false, violations: [], rewrite: null, factsPreserved: true }

/**
 * Extract every FACT token from `text`: currency figures ($725,000), bare
 * numbers and percentages (38, 2.1%), and 4-digit years (2022). Pure, no I/O.
 * Exported so the gate script and tests can exercise it directly.
 */
function extractFacts(text: string): string[] {
  const facts: string[] = []
  const currency = text.match(/\$[\d,]+(?:\.\d+)?/g)
  if (currency) facts.push(...currency)
  // Bare numbers + percentages. No trailing \b so the trailing % is captured
  // ("2.1%" -> "2.1%", not "2.1" — dropping the unit is a fact change).
  const numbers = text.match(/\b\d[\d,]*(?:\.\d+)?%?/g)
  if (numbers) facts.push(...numbers)
  const years = text.match(/\b(?:19|20)\d{2}\b/g)
  if (years) facts.push(...years)
  return facts
}

/**
 * The fact-preservation guard. Returns false unless every NUMERIC fact token
 * extracted from `original` (currency, bare number, percentage, 4-digit year)
 * appears as an EXACT extracted fact of `rewrite` — a SET-membership check, not
 * a substring one, so "$1,200" no longer "survives" inside "$1,200,000" and
 * "38" no longer survives inside "380" (magnitude inflation is caught). A
 * rewrite that dropped, rounded, reformatted, or inflated any number fails.
 *
 * Scope note (§0): this verifies NUMBERS only. Proper nouns (street/place/broker
 * names) are instructed to the model in the prompt but are NOT machine-verified
 * here — reliable proper-noun extraction is noisy, and the reviewer output is
 * advisory (human-reviewed, never auto-applied), so the numeric floor is the
 * hard guard. If a rewrite here ever became auto-applied, widen this first.
 */
export function factsPreserved(original: string, rewrite: string): boolean {
  const rewriteFacts = new Set(extractFacts(rewrite))
  return extractFacts(original).every((fact) => rewriteFacts.has(fact))
}

const REVIEW_TOOL: Anthropic.Tool = {
  name: 'record_prose_review',
  description: 'Record the Orwell-rules voice review of the given prose: every violation found, and a full rewrite.',
  input_schema: {
    type: 'object',
    properties: {
      violations: {
        type: 'array',
        description: 'Every voice violation found in the original prose.',
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['stale-phrase', 'long-word', 'cuttable', 'passive'],
              description:
                'stale-phrase = a cliche or dead metaphor. long-word = a long/Latinate word where a short one would do. cuttable = a word or phrase that can be cut outright with no loss. passive = passive-voice construction that should be active.',
            },
            span: { type: 'string', description: 'The exact offending text as it appears in the original.' },
            suggestion: { type: 'string', description: 'A concrete replacement or fix for this span.' },
          },
          required: ['kind', 'span', 'suggestion'],
        },
      },
      rewrite: {
        type: 'string',
        description:
          'The full prose, rewritten to fix every violation. MUST preserve every number, price, percent, date, street name, place name, and proper noun from the original EXACTLY as written — change only wording, never a fact.',
      },
    },
    required: ['violations', 'rewrite'],
  },
}

const SYSTEM =
  "You are reviewing real-estate brokerage prose against George Orwell's rules from " +
  '"Politics and the English Language": never use a metaphor, simile, or other figure of ' +
  'speech you are used to seeing in print (cut cliches and stale phrases); never use a long ' +
  'word where a short one will do; if it is possible to cut a word out, always cut it out; ' +
  'never use the passive where you can use the active. In addition, flag any pandering or ' +
  'self-praise (bragging about the brokerage, complimenting the reader, false humility). Do ' +
  'NOT flag factual statements, prices, statistics, or plain factual sentences as violations. ' +
  'Then write a full rewrite that fixes every violation. The rewrite MUST preserve every ' +
  'number, price, percent, date, street name, place name, and proper noun from the original ' +
  'EXACTLY as written, character for character. Change only wording and structure, never a ' +
  'fact. Return your review only through the record_prose_review tool.'

/**
 * Advisory Orwell-rules review of `text`. Fails OPEN: returns the degraded
 * `{ran:false,...}` shape (never throws) when ANTHROPIC_API_KEY is absent,
 * `text` is empty/whitespace, or the API call errors. Callers attach or log
 * the result — this function never gates anything.
 */
export async function reviewProse(text: string, opts?: { context?: string }): Promise<VoiceReview> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !text.trim()) return DEGRADED

  try {
    const client = new Anthropic({ apiKey })
    const user = opts?.context
      ? `Context: ${opts.context}\n\nPROSE TO REVIEW:\n${text}`
      : `PROSE TO REVIEW:\n${text}`
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [REVIEW_TOOL],
      tool_choice: { type: 'tool', name: 'record_prose_review' },
      messages: [{ role: 'user', content: user }],
    })
    const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!block) return DEGRADED
    const out = block.input as {
      violations?: Array<{ kind?: string; span?: string; suggestion?: string }>
      rewrite?: string
    }
    const VALID_KINDS: VoiceReviewViolationKind[] = ['stale-phrase', 'long-word', 'cuttable', 'passive']
    const violations: VoiceReviewViolation[] = (out.violations ?? [])
      .filter((v) => v.span && v.suggestion)
      .map((v) => ({
        kind: (VALID_KINDS.includes(v.kind as VoiceReviewViolationKind) ? v.kind : 'cuttable') as VoiceReviewViolationKind,
        span: (v.span ?? '').trim(),
        suggestion: (v.suggestion ?? '').trim(),
      }))

    const rawRewrite = (out.rewrite ?? '').trim()
    // §0 fact-preservation guard: never surface a rewrite that dropped, altered,
    // or rounded a fact. The guard is mandatory, not optional — a rewrite that
    // fails it degrades to violations-only.
    const safe = rawRewrite ? factsPreserved(text, rawRewrite) : false

    return {
      ran: true,
      violations,
      rewrite: safe ? rawRewrite : null,
      factsPreserved: safe,
    }
  } catch (err) {
    console.warn('[voice/reviewer] advisory prose review failed, degrading silently:', err instanceof Error ? err.message : String(err))
    return DEGRADED
  }
}
