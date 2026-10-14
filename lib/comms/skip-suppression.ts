/**
 * How skipSuppression is allowed to work.
 *
 * A 1:1 admin compose may skip a soft gate (missing SMS consent, a marketing
 * opt-in row). It may not skip a real opt-out, a hard-stop, or a failed read.
 * Bulk, marketing, drip, and system paths cannot skip anything.
 */
import { isTrueOptOutSuppression } from '@/lib/crm/suppression-lifecycle'

const HARD_STOP_REASON = 'tag:compliance:hard-stop'

/** Purpose / source tokens that are never a 1:1 admin compose. */
const BULK_PURPOSE = /\b(drip|bulk|marketing|sequence|newsletter|cohort|broadcast|first-touch)\b/i

export type SkipSuppressionContext = {
  skipSuppression?: boolean
  initiatorKind?: 'broker' | 'system'
  source?: string
  purpose?: string
}

/** STOP, bounce, complaint, unsubscribe, GPC, hard-stop, or a failed read. */
export function suppressionReasonMustHold(reason: string): boolean {
  const r = reason.trim().toLowerCase()
  if (!r) return false
  if (r === HARD_STOP_REASON || r.includes('compliance:hard-stop')) return true
  if (r.includes('suppression-check-failed') || r.includes('tag-check-failed')) return true
  return isTrueOptOutSuppression({ reason: r, source: '' })
}

export function holdingSuppressionReasons(reasons: readonly string[]): string[] {
  return reasons.filter((reason) => suppressionReasonMustHold(reason))
}

/**
 * True only for a deliberate broker 1:1 (or group-thread) compose.
 * skipSuppression on a drip / sequence / marketing / system send is ignored.
 */
export function maySkipSoftSuppression(opts?: SkipSuppressionContext): boolean {
  if (!opts?.skipSuppression) return false
  if (opts.initiatorKind === 'system') return false
  const label = `${opts.source ?? ''} ${opts.purpose ?? ''}`.toLowerCase()
  if (BULK_PURPOSE.test(label)) return false
  return opts.initiatorKind === 'broker' || /\b(manual|admin|compose)\b/.test(label)
}
