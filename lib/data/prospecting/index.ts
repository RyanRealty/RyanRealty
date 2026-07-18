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
  type ProspectComplianceInput,
} from './compliance'

export {
  getProspectEngagement,
  type ProspectEngagementKey,
  type ProspectEngagementMap,
} from './engagement'

export { getProspect, getProspectDetail } from './get'

export { listProspects } from './list'
