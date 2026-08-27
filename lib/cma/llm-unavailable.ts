/**
 * Why an LLM stage (judge / adversarial audit) did not run — captured so the
 * stored note names the CAUSE instead of the shrug "no key or call failed".
 *
 * WHY. Measured 2026-08-27: 100% of production builds were skipping BOTH the
 * comparability judge and the adversarial audit. The stored note said "no key
 * or call failed"; the Vercel env HAS the key; the real error, reproduced with
 * that key, was "Your credit balance is too low to access the Anthropic API."
 * A quality gate had been dark on a BILLING failure for weeks and the swallow
 * hid it — the same class as the fabricated-zero ingestors. The fail-open
 * contract stays (a dead judge must never kill a build; needs_review is the
 * backstop), but the reason now rides on the row where a person reads it.
 *
 * Module-scope is safe here: builds run sequentially inside one worker
 * invocation, and the value is read immediately after the call that set it.
 */
let judgeReason: string | null = null
let auditReason: string | null = null

export function setJudgeUnavailableReason(reason: string | null): void {
  judgeReason = reason ? reason.slice(0, 300) : null
}
export function judgeUnavailableReason(): string | null {
  return judgeReason
}
export function setAuditUnavailableReason(reason: string | null): void {
  auditReason = reason ? reason.slice(0, 300) : null
}
export function auditUnavailableReason(): string | null {
  return auditReason
}
