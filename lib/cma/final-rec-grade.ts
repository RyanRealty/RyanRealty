/**
 * Accuracy checks are graded once before sitting actives can move the
 * recommendation. Re-grade onto the final list and rewrite any review
 * reason that still quotes the earlier dollars.
 */

import type { ContractCheck } from '@/lib/cma/contract'

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
