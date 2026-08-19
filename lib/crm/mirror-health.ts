/**
 * CRM mirror kill-switch health (Contact-360 Phase 0.5).
 *
 * The crm_* timeline mirror can be turned off with CRM_MIRROR_ENABLED=false
 * (lib/crm/mirror.ts). This module turns that silent state into a queryable,
 * alarmable status.
 *
 * `mirrorHealthStatus` is PURE — it reads only the passed env bag, never
 * process.env directly, never touches the network or the DB — so the
 * /admin/crm/health dashboard (and lib/crm/mirror.ts's loud-warn) can both
 * consume it deterministically. An explicit CRM_MIRROR_ENABLED=false is an
 * operator turning optional timeline copies off. Native lead capture is
 * independent of this switch.
 */

export type MirrorHealthLevel = 'ok' | 'alarm'

export interface MirrorHealthStatus {
  enabled: boolean
  level: MirrorHealthLevel
  message: string
}

/**
 * Derive the mirror kill-switch health from the environment.
 *
 * The kill switch matches lib/crm/mirror.ts's `mirrorEnabled()` semantics:
 * the mirror is ENABLED unless CRM_MIRROR_ENABLED is exactly the string
 * 'false'. Any other value (unset, 'true', '1', '') leaves the mirror on.
 *
 * @param env minimal env bag, e.g. `{ CRM_MIRROR_ENABLED: process.env.CRM_MIRROR_ENABLED }`
 */
export function mirrorHealthStatus(env: { CRM_MIRROR_ENABLED?: string }): MirrorHealthStatus {
  const disabled = env.CRM_MIRROR_ENABLED === 'false'
  if (disabled) {
    return {
      enabled: false,
      level: 'alarm',
      message:
        '[crm-mirror] DISABLED via CRM_MIRROR_ENABLED=false — site events are NOT copied into crm_timeline. Unset CRM_MIRROR_ENABLED (or set it to true) to restore.',
    }
  }
  return {
    enabled: true,
    level: 'ok',
    message: '[crm-mirror] enabled — site events copy into crm_timeline.',
  }
}
