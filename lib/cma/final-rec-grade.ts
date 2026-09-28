/**
 * Accuracy checks are graded once before sitting actives can move the
 * recommendation. Re-grade onto the final list and rewrite any review
 * reason that still quotes the earlier dollars.
 */

import type { ContractCheck } from '@/lib/cma/contract'
import type { CmaAudit } from '@/lib/cma/audit'

export function replaceGradedChecks(args: {
  prior: readonly ContractCheck[]
  graded: readonly ContractCheck[]
  reviewReason: string | null
}): { checks: ContractCheck[]; reviewReason: string | null } {
  let reason = args.reviewReason ?? ''
  const priorById = new Map(args.prior.map((c) => [c.id, c.detail]))
  for (const check of args.graded) {
    const old = priorById.get(check.id)
    if (old && old !== check.detail && old.length > 0 && reason.includes(old)) {
      reason = reason.split(old).join(check.detail)
    }
  }
  const missing = args.graded
    .filter((c) => c.severity === 'review' && !c.pass && c.detail && !reason.includes(c.detail))
    .map((c) => c.detail)
  if (missing.length > 0) reason = [reason.trim(), ...missing].filter(Boolean).join(' ')
  const trimmed = reason.trim()
  return {
    checks: [...args.graded],
    reviewReason: trimmed.length > 0 ? trimmed : null,
  }
}

function quotedDollars(num: string, suffix: string | undefined): number {
  const v = Number(num.replace(/,/g, ''))
  if (!Number.isFinite(v)) return NaN
  if (suffix && /k/i.test(suffix)) return v * 1_000
  if (suffix && /m/i.test(suffix)) return v * 1_000_000
  return v
}

/**
 * Rewrite "recommended $X" (and the $Xk form) when X is the pre-final list.
 * Other dollars in the same sentence, including a band that happens to equal
 * that list, stay. The checker reads this shape.
 */
export function rebaseRecommendedQuotes(text: string, fromRec: number, toRec: number): string {
  const from = Math.round(fromRec)
  const to = Math.round(toRec)
  if (!(from > 0) || !(to > 0) || from === to) return text
  return text.replace(/([Rr]ecommended(?: list)?) \$([\d,.]+)\s*([kKmM])?\b/g, (full, label: string, num: string, suffix?: string) => {
    const v = quotedDollars(num, suffix)
    const tol = suffix ? 0.005 * from : 0
    if (Math.abs(v - from) > tol) return full
    return `${label} $${to.toLocaleString('en-US')}`
  })
}

/** The audit object the contract stores, pointed at the list that actually prints. */
export function rebaseAuditToFinalRec(audit: CmaAudit, fromRec: number, toRec: number): CmaAudit {
  if (Math.round(fromRec) === Math.round(toRec)) return audit
  const rewrite = (text: string) => rebaseRecommendedQuotes(text, fromRec, toRec)
  return {
    ...audit,
    summary: rewrite(audit.summary),
    findings: audit.findings.map((f) => ({
      ...f,
      claim: rewrite(f.claim),
      evidence: rewrite(f.evidence),
    })),
  }
}
