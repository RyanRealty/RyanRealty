/**
 * Every status a crm_sequence_enrollments row may hold: the table's status
 * CHECK, as the code must know it. enrollment-status.test.ts holds this list
 * equal to the newest migration that defines crm_sequence_enrollments_status_check,
 * and holds every status the engine writes and every "live" list the CRM reads
 * to it.
 *
 * Why it exists (2026-09-24): the engine wrote 'awaiting_broker_next' from
 * 2026-06-13 while the CHECK (20260612134500) did not allow it, and nothing
 * compared the two. Migration 20260924052000 added it.
 *
 *   awaiting_broker       new enrollment waiting for the broker to approve it
 *   awaiting_broker_next  parked before a confirm:true step for one-click send
 *   running               the engine processes it when next_run_at is due
 *   paused                a broker paused it (or a stop_other_plans step did)
 *   paused_reply          the contact replied
 *   completed             ran past its last step
 *   stopped               ended for a reason the engine logged
 *   suppressed            the contact is suppressed on the step's channel
 */
export const ENROLLMENT_STATUSES = [
  'awaiting_broker',
  'awaiting_broker_next',
  'running',
  'paused',
  'paused_reply',
  'completed',
  'stopped',
  'suppressed',
] as const

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

export function isEnrollmentStatus(value: unknown): value is EnrollmentStatus {
  return typeof value === 'string' && (ENROLLMENT_STATUSES as readonly string[]).includes(value)
}
