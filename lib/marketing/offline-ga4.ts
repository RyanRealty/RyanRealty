/**
 * Deal stage → GA4 Measurement Protocol offline event.
 *
 * WHY THIS EXISTS. The daily offline-conversion cron already uploads buyer
 * milestones to Meta (Buyer Contract → Lead, Pending → StartTrial, Closed →
 * Purchase). This mapping is the GA4 half of the same loop: qualify_lead on
 * Buyer Contract and Pending, close_convert_lead on Closed. generate_lead stays
 * the form-fill event (lib/lead-tracking.ts). These two recommended events are
 * the later funnel steps.
 *
 * Pure: stage in, event out. No I/O. The cron looks up a stored `_ga` client_id
 * (crm_people.custom.gaClientId, written by fireLeadGenerated) and skips the
 * contact when that key is missing — fireGa4Event would mint a random uuid and
 * the conversion would never stitch to the visitor.
 *
 * Matt 2026-10-08: no dollar amounts on leads. These events carry lead_type only.
 * Destination is the same GA4 property generate_lead uses (fireGa4Event).
 */
export const GA4_OFFLINE_SCOPE = 'ga4_offline_conversion'

export type Ga4OfflineEventName = 'qualify_lead' | 'close_convert_lead'

export type Ga4OfflineEvent = {
  eventName: Ga4OfflineEventName
  leadType: string
  stageKey: string
}

const BUYER_STAGE_TO_GA4: Record<string, Ga4OfflineEvent> = {
  'buyer contract': {
    eventName: 'qualify_lead',
    leadType: 'buyer_contract',
    stageKey: 'buyer-contract',
  },
  pending: {
    eventName: 'qualify_lead',
    leadType: 'pending',
    stageKey: 'pending',
  },
  closed: {
    eventName: 'close_convert_lead',
    leadType: 'closed',
    stageKey: 'closed',
  },
}

export function ga4EventForBuyerStage(stage: string | null | undefined): Ga4OfflineEvent | null {
  if (!stage) return null
  return BUYER_STAGE_TO_GA4[stage.trim().toLowerCase()] ?? null
}

/**
 * Event params for the MP payload. lead_type only — same rule as generate_lead
 * (no dollar amount, no ISO money code).
 */
export function offlineGa4EventParams(leadType: string): { lead_type: string } {
  return { lead_type: leadType }
}

/** One send per contact per stage. A retry or a second deal at the same stage is a no-op. */
export function ga4OfflineIdempotencyKey(personId: number, stageKey: string): string {
  return `person:${personId}:${stageKey}`
}
