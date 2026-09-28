import { CMA_BOUNCED_LABEL, readCmaDeliveryStatus } from '@/lib/cma/delivery-status'

/**
 * Deliberate build outcomes vs a crash.
 *
 * A comp shortage (under the 3-comp floor) and a split judge (JUDGE_UNSTABLE)
 * are decisions, not crashes. The failure write stores a code on
 * build_summary.build_error_code. Rows that failed before that write have
 * only the prose in cmas.build_error, so the classifier also reads the
 * message. No backfill.
 */

export const DELIBERATE_BUILD_ERROR_CODES = ['COMP_SHORTAGE', 'JUDGE_UNSTABLE'] as const

export type DeliberateBuildErrorCode = (typeof DELIBERATE_BUILD_ERROR_CODES)[number]

/** Words the admin list, queue, and detail badge already show. */
export const DELIBERATE_BUILD_LABEL: Record<DeliberateBuildErrorCode, string> = {
  COMP_SHORTAGE: 'Comp shortage',
  JUDGE_UNSTABLE: 'Comps unstable',
}

const COMP_SHORTAGE_MESSAGE: readonly RegExp[] = [
  // brokerCompRefusal, including the pre-2026-09-07 rows that appended the trace.
  /closed sales this home needs to be priced/i,
  // Judgment kept fewer than the floor (lib/cma/build.ts gated.shortage).
  /not enough sales of the same product type to price this home/i,
  /not enough comparable sales the review would keep/i,
  // Facts ladder under the floor, when that sentence was stored on the row.
  /facts path: only \d+ apples-to-apples sale/i,
  // diagnoseStarvation, the prose stored before the one-sentence refusal.
  /no comparable sales on record/i,
  /no comp search could run for this subject/i,
  /no closed sale anywhere in the database matched the search/i,
]

export function buildErrorCodeFromMessage(
  buildError: string | null | undefined,
): DeliberateBuildErrorCode | null {
  const text = (buildError ?? '').trim()
  if (!text) return null
  if (text.startsWith('JUDGE_UNSTABLE')) return 'JUDGE_UNSTABLE'
  if (COMP_SHORTAGE_MESSAGE.some((re) => re.test(text))) return 'COMP_SHORTAGE'
  return null
}

function storedBuildErrorCode(buildSummary: unknown): DeliberateBuildErrorCode | null {
  if (!buildSummary || typeof buildSummary !== 'object' || Array.isArray(buildSummary)) return null
  const code = (buildSummary as Record<string, unknown>).build_error_code
  if (code === 'COMP_SHORTAGE' || code === 'JUDGE_UNSTABLE') return code
  return null
}

/**
 * Stored code wins when it is one of the two deliberate outcomes. Otherwise
 * the message is enough, which is how a row written before the code existed
 * still classifies.
 */
export function classifyBuildError(
  buildError: string | null | undefined,
  buildSummary: unknown,
): DeliberateBuildErrorCode | null {
  return storedBuildErrorCode(buildSummary) ?? buildErrorCodeFromMessage(buildError)
}

/**
 * Copy build_summary and set build_error_code. Every other key stays.
 * A real crash stores null so an older shortage code cannot outlive the new error.
 * Does not touch html_path or any other column. The caller merges this object
 * onto the row; it does not replace the row.
 */
export function mergeBuildErrorCode(
  current: Record<string, unknown>,
  code: DeliberateBuildErrorCode | null,
): Record<string, unknown> {
  return { ...current, build_error_code: code }
}

/** Detail-page status word. A sent row keeps its status. A deliberate failure replaces it. */
export function cmaDetailBadgeLabel(args: {
  status: string
  buildError: string | null
  buildSummary: unknown
  deliveredAt: string | null
}): string {
  if (readCmaDeliveryStatus(args.buildSummary, args.deliveredAt) === 'bounced') return CMA_BOUNCED_LABEL
  const statusNorm = args.status.trim().toLowerCase()
  const sent = Boolean(args.deliveredAt) || statusNorm === 'delivered'
  if (!sent && args.buildError) {
    const code = classifyBuildError(args.buildError, args.buildSummary)
    if (code) return DELIBERATE_BUILD_LABEL[code]
  }
  return args.status
}

/** Lead-in for the failure paragraph. Crashes stay on the old sentence. */
export function cmaBuildFailureLead(
  buildError: string | null | undefined,
  buildSummary: unknown,
): string {
  const code = classifyBuildError(buildError, buildSummary)
  if (code) return DELIBERATE_BUILD_LABEL[code]
  return 'last build failed'
}
