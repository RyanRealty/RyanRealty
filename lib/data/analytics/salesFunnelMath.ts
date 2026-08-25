/**
 * Pure cohort math for the sales funnel. Counts are unique people on the
 * spine and events on doors. Conversion is only defined when the later
 * stage is a true subset of the earlier one.
 */

export type CountKind = 'people' | 'sessions' | 'events'

export type FunnelStageId =
  | 'visited'
  | 'engaged'
  | 'identified'
  | 'lead'
  | 'working'
  | 'client'

/** Nested conversion. Null when the denominator is 0 (do not render 0%). */
export function nestedRate(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null
  if (part < 0) return 0
  return part / whole
}

export function isNestedSubset(part: number, whole: number): boolean {
  return Number.isFinite(part) && Number.isFinite(whole) && part <= whole && whole >= 0
}

export type VerdictTone = 'ok' | 'attention'

/**
 * Attention when we captured inbound leads and none of the cohort reached CLIENT.
 * Zero leads is not a failure of follow-up, so that stays ok (empty window).
 */
export function clientVerdictTone(opts: {
  leads: number
  clients: number | null
  clientUnmeasured: boolean
}): VerdictTone {
  if (opts.clientUnmeasured) {
    return opts.leads > 0 && opts.clients === 0 ? 'attention' : 'ok'
  }
  if (opts.leads > 0 && (opts.clients ?? 0) === 0) return 'attention'
  return 'ok'
}

export const SELLER_CLIENT_STAGES = ['Listed', 'Offer', 'Pending', 'Closed'] as const

export const WORKING_TIMELINE_KINDS = [
  'call',
  'voicemail',
  'sms_out',
  'sms_in',
  'email_out',
  'appointment',
] as const

export const ENGAGED_SCORE_MIN = 20

export const FUNNEL_MEMBER_CAP = 100
