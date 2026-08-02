/**
 * lib/agent/keywords.ts — deterministic keyword pre-pass for the broker SMS
 * agent (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R2.4).
 *
 * These six words are handled BEFORE any model call — lib/agent/runtime.ts
 * checks parseKeyword() first and only falls through to the Opus 5 tool loop
 * when it returns null. Matching is deliberately strict: the ENTIRE trimmed
 * message must be the keyword (optionally followed by a job handle number for
 * APPROVE/HOLD, optionally followed by trailing punctuation). "please approve
 * this" is a sentence for the model, not the literal APPROVE token — per the
 * plan, publishing requires the LITERAL token, never an inferred intent.
 */

export type ParsedKeywordName = 'STATUS' | 'RESET' | 'HELP' | 'PAUSE' | 'APPROVE' | 'HOLD'

export interface ParsedKeyword {
  keyword: ParsedKeywordName
  /** Job handle suffix ("APPROVE 2", "HOLD 3") — undefined when bare. */
  handle?: number
}

// APPROVE / HOLD may carry a job handle: "APPROVE", "APPROVE 2", "hold 3!".
const WITH_HANDLE_RE = /^(APPROVE|HOLD)(?:\s+(\d{1,4}))?\s*[.!?]*$/i

// STATUS / RESET / HELP / PAUSE never carry a handle — a trailing number
// means this was not actually a bare keyword message (e.g. "status 2" reads
// as a sentence, not the STATUS keyword), so it falls through to the model.
const BARE_RE = /^(STATUS|RESET|HELP|PAUSE)\s*[.!?]*$/i

export function parseKeyword(text: string): ParsedKeyword | null {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return null

  const withHandle = trimmed.match(WITH_HANDLE_RE)
  if (withHandle) {
    const keyword = withHandle[1].toUpperCase() as 'APPROVE' | 'HOLD'
    const handle = withHandle[2] !== undefined ? Number(withHandle[2]) : undefined
    return handle !== undefined ? { keyword, handle } : { keyword }
  }

  const bare = trimmed.match(BARE_RE)
  if (bare) {
    return { keyword: bare[1].toUpperCase() as 'STATUS' | 'RESET' | 'HELP' | 'PAUSE' }
  }

  return null
}
