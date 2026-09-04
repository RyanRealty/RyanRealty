/**
 * Prospecting hub DAL barrel (spec 07). Re-exports the shared contract
 * (types.ts) plus the read functions from docs/compliance/engagement/get/list.
 *
 * Writes (sendProspectingIntro, buildProspectDoc, the send-claim trio) are
 * owned by app/actions/prospecting.ts (spec §5) — not this module.
 */

export * from './types'

export { getBuiltDocForProspect, type ProspectDocInput } from './docs'

export {
  getProspectHardStop,
  isRelistedNow,
  isFsboRelistedNow,
  resolveComplianceState,
  expiredOutreachListingHits,
  normalizeParcelNumber,
  parcelFromEnrichmentNotes,
  type ProspectComplianceInput,
} from './compliance'

export {
  getProspectEngagement,
  type ProspectEngagementKey,
  type ProspectEngagementMap,
} from './engagement'

export { getProspect, getProspectDetail } from './get'

export {
  dripIntentTagFor,
  getProspectDripState,
  resolveDripSequenceForKind,
  type DripSequence,
} from './drip'

export { listProspects, classifyProspect, type ProspectBucket } from './list'

export {
  DRIP_SPACING_MINUTES,
  DRIP_TIMEZONE,
  DRIP_WEEKDAY_START_MINUTES,
  canSendDripNow,
  isDripWeekday,
  isDripWindowOpen,
} from './drip-schedule'

