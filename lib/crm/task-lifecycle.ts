/**
 * Pure task-lifecycle decision helpers (Wave 7).
 *
 * These live in a plain module (NOT the 'use server' action file) because
 * Next.js requires every export of a 'use server' module to be an async function.
 * The actions in app/actions/crm-tasks.ts import these directly; the unit test
 * imports them here. Same pattern as lib/crm/scope.ts.
 */

/** The minimal access shape the ownership rule needs. */
export type TaskAccess = {
  role: 'superuser' | 'broker' | 'report_viewer'
  brokerSlug: string | null
}

/**
 * The task-ownership rule. A superuser may act on any task. A restricted broker
 * may act only on a task assigned to their own slug. Mirrors
 * completeCrmTaskAction's inline check so the five lifecycle actions share ONE rule.
 */
export function canActOnTask(
  access: TaskAccess,
  taskAssignedBroker: string | null | undefined,
): boolean {
  if (access.role === 'superuser') return true
  if (!access.brokerSlug) return false
  return (taskAssignedBroker ?? null) === access.brokerSlug
}

/**
 * Snooze math: push a due date forward by N whole days. Pure. When the task has
 * no due date, snooze anchors off `from` (now) so a dateless task becomes dated.
 * Days < 1 or non-finite clamp to 1 (a snooze always moves a task LATER).
 */
export function addDaysToDue(currentDueIso: string | null, days: number, from: Date): string {
  const safeDays = Number.isFinite(days) && days >= 1 ? Math.floor(days) : 1
  const base = currentDueIso ? new Date(currentDueIso) : from
  const anchor = Number.isNaN(base.getTime()) ? from : base
  return new Date(anchor.getTime() + safeDays * 24 * 3600 * 1000).toISOString()
}
