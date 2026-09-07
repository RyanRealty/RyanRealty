import type { ProspectKind } from './types'

/** Deep link to /admin/prospecting/<kind>/<id>. Single-encode the id (FSBO URLs). */
export function prospectDetailHref(kind: ProspectKind, id: string): string {
  return `/admin/prospecting/${kind}/${encodeURIComponent(id)}`
}

/**
 * Worklist sendable CTA — Review only (detail owns Send). Never "Review & send".
 * FSBO keeps the CMA noun so the desk does not confuse with expired audits.
 */
export function prospectQueueReviewLabel(kind: ProspectKind): string {
  return kind === 'fsbo' ? 'Review CMA' : 'Review'
}
