/**
 * PURE suppression lifecycle helpers.
 *
 * Active rows are cleared_at IS NULL. Real opt-outs (STOP, bounce, complaint,
 * one-click unsubscribe, GPC) are never auto-cleared. Import hard-stops and
 * other non-opt-out rows may be marked cleared on inbound SMS or broker reclass.
 */

export type SuppressionLifecycleRow = {
  reason?: string | null
  source?: string | null
}

/**
 * Reasons that are a real opt-out / bounce / complaint / GPC. Matched as an
 * exact token or a substring so variants (unsubscribed, email-unsubscribe)
 * stay protected. tcpa-hard-stop does not contain these tokens.
 */
export const TRUE_OPT_OUT_REASON_MARKERS: readonly string[] = [
  'stop-keyword',
  'twilio-opt-out',
  'unsubscribe',
  'unsubscribed',
  'bounce',
  'bounced',
  'complaint',
  'complained',
  'opt-out',
  'optout',
  'opt_out',
  'gpc-opt-out',
  'gpc',
]

export function isTrueOptOutSuppression(row: SuppressionLifecycleRow): boolean {
  const reason = (row.reason ?? '').trim().toLowerCase()
  if (!reason) return false
  return TRUE_OPT_OUT_REASON_MARKERS.some((m) => reason === m || reason.includes(m))
}

/** Constrain a PostgREST query to active (not-cleared) suppression rows. */
export function whereActiveSuppression<T extends { is: (column: string, value: null) => T }>(
  query: T,
): T {
  return query.is('cleared_at', null)
}

export const BROKER_RECLASS_CLEARED_REASON = 'broker reclass' as const
