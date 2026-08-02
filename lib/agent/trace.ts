/**
 * lib/agent/trace.ts — the §0 mechanical enforcement for the broker SMS agent.
 *
 * Generalizes lib/crm/reply-intent.ts's sanitizeRecommendedReply() — that
 * function VOIDS an entire suggestion on the first untraced digit. This one
 * instead lists every offending figure, because lib/agent/runtime.ts uses the
 * violation list to build a corrective retry nudge ("rewrite without these
 * figures") before falling back to a safe generic message. Same underlying
 * rule, better recovery.
 *
 * THE RULE (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R2.3): every digit-run
 * of 2+ digits, and every $-amount regardless of digit count, in an outbound
 * reply must appear — after normalization (strip $, commas, whitespace) —
 * somewhere in the tool-result corpus from the SAME turn. Same for every
 * ORS/OAR statute citation (normalized on whitespace only, since a citation
 * is not a number). A figure the model did not just fetch is a figure it
 * does not get to say, full stop.
 *
 * ALLOWLIST (figures that never need a trace):
 *   - Single-digit numbers (1-9) that are NOT a $-amount — job handles
 *     ("1: CMA Awbrey Glen · 2: IG post Tumalo"), a bare bed/bath count, etc.
 *     These never reach the "2+ digit run" threshold in the first place, so
 *     no special-case code exists for them beyond that threshold.
 *   - Duration/ETA phrasing the templates write themselves ("20s", "4h",
 *     "15 min", "13 min later") — a render-time estimate, not a database
 *     figure, and not something any tool call could trace.
 *   - The known Ryan Realty brand phone numbers, written dotted
 *     (541.213.6706 / 541.703.3095 / 541.224.5025) — a signature line the
 *     agent may write from the brand constants, not a fetched fact.
 *
 * EXPLICITLY NOT ALLOWLISTED: a bare year (e.g. "2026"). A year is a number
 * like any other and must trace to something the agent actually fetched this
 * turn — do NOT add an exception for it. (Amendment R2.9/R2.10, Matt
 * 2026-07-31: "ZIP-less years alone are NOT allowed, a year is a number.")
 */

/** Known Ryan Realty phone numbers (digits only) — see CLAUDE.md §2. */
const KNOWN_BRAND_PHONES = new Set(['5412136706', '5417033095', '5412245025'])

/** xxx.xxx.xxxx or xxx-xxx-xxxx, e.g. "541.213.6706". */
const PHONE_RE = /\b\d{3}[.-]\d{3}[.-]\d{4}\b/g

/** "20s", "4h", "15 min", "13 minutes" — process-timing words only, never
 *  "days" (a real DOM/market stat unit that MUST trace). */
const DURATION_RE = /\b\d{1,4}\s?(?:s|secs?|seconds?|mins?|minutes?|h|hrs?|hours?)\b/gi

/**
 * "ORS 696.820", "OAR 863-015-0215". The numeric core is `\d+(?:\.\d+)*` (not
 * a raw `[\d.]+` blob) so a sentence-ending period after the citation ("...
 * per ORS 105.464.") is never swallowed into the match — `(?:\.\d+)*` only
 * consumes a period when a digit follows it. The trailing `[\w-]*` covers
 * OAR's hyphenated rule numbers (863-015-0215) without needing periods.
 */
const ORS_OAR_RE = /\b(ORS|OAR)\s+\d+(?:\.\d+)*[\w-]*/gi

/** A $-amount or a bare digit run, optionally with thousands commas, a
 *  decimal, or a trailing percent sign. */
const FIGURE_RE = /\$?\d[\d,]*(?:\.\d+)?%?/g

function normalizeNumeric(s: string): string {
  return s.replace(/[$,%\s]/g, '')
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length
}

export interface TraceCheck {
  ok: boolean
  /** The offending substrings, exactly as they appeared in replyText. */
  violations: string[]
}

/**
 * Verify every traceable figure and statute citation in `replyText` appears
 * in `toolResultCorpus` (in practice: JSON.stringify of every tool result
 * returned this turn, concatenated). Returns the offending substrings so the
 * caller can name them in a corrective retry nudge.
 */
export function verifyReplyTrace(replyText: string, toolResultCorpus: string): TraceCheck {
  const text = replyText ?? ''
  const corpus = toolResultCorpus ?? ''
  const corpusNormalized = normalizeNumeric(corpus)
  const corpusCollapsed = collapseWs(corpus)
  const violations: string[] = []

  // Mask allowlisted spans in order, so neither the citation pass nor the
  // figure pass below ever sees them.
  let masked = text
  masked = masked.replace(PHONE_RE, (m) =>
    KNOWN_BRAND_PHONES.has(m.replace(/[.-]/g, '')) ? ' '.repeat(m.length) : m,
  )
  masked = masked.replace(DURATION_RE, (m) => ' '.repeat(m.length))

  // ORS / OAR statute citations — whitespace-normalized only (not a number).
  const citationMatches = masked.match(ORS_OAR_RE) ?? []
  for (const raw of citationMatches) {
    const normalized = collapseWs(raw)
    if (!corpus.includes(normalized) && !corpusCollapsed.includes(normalized)) {
      violations.push(raw)
    }
  }
  masked = masked.replace(ORS_OAR_RE, (m) => ' '.repeat(m.length))

  // Digit-run / $-amount figures.
  const figureMatches = masked.match(FIGURE_RE) ?? []
  for (const raw of figureMatches) {
    const isDollar = raw.startsWith('$')
    if (!isDollar && digitCount(raw) < 2) continue // bare single digit — allowed untraced
    const normalized = normalizeNumeric(raw)
    if (!normalized) continue
    if (!corpusNormalized.includes(normalized)) {
      violations.push(raw)
    }
  }

  return { ok: violations.length === 0, violations }
}
