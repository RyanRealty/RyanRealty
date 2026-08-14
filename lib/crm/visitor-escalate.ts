/**
 * Hot-visitor escalation merged into broker-alert.
 *
 * Identified looking-at already wakes on Today. The cron may still create a
 * 5-minute call task. It must not send a second email rail to Matt.
 */

export function visitorEscalateEmailEnabled(): boolean {
  return false
}
