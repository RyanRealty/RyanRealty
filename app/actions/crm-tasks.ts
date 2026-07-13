'use server'

/**
 * CRM task lifecycle actions (Wave 7) — the mutation surface over crm_tasks for
 * the cross-contact task queue, plus the task-type config-table CRUD.
 *
 * Create + complete already live in app/actions/crm.ts (addCrmTaskAction /
 * completeCrmTaskAction) and are NOT duplicated here. This file adds the rest of
 * the lifecycle: edit, reassign, snooze, delete, and bulk-complete.
 *
 * Access + scope: every mutation calls requireCrmAccess() first, then enforces
 * task ownership the same way completeCrmTaskAction does — a non-superuser broker
 * may only touch a task whose assigned_broker equals their own slug. Reassign is
 * an OWNER-only operation (only a superuser moves a task between brokers), mirroring
 * assignCrmBrokerAction's lead-reassignment guard so no one can steal work.
 *
 * The pure decision helpers (canActOnTask, addDaysToDue) live in
 * lib/crm/task-lifecycle.ts (a plain module, since a 'use server' file may only
 * export async functions) and are unit-tested there without a DB.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import {
  requireCrmAccess,
  type CrmActionResult,
  type CrmAccess,
} from '@/app/actions/crm'
import { CRM_BROKERS, type CrmBrokerSlug } from '@/lib/crm/constants'
import { scopeBroker } from '@/lib/crm/scope'
import { makeConfigTable, type ConfigResult } from '@/lib/crm/config-table'
import { CRM_TASK_TYPES_TAG } from '@/lib/data/crm/getTaskQueue'
import { canActOnTask, addDaysToDue } from '@/lib/crm/task-lifecycle'

// ── Internal: load a task's owner + guard the caller ────────────────────────

async function requireTaskAccess(
  taskId: number,
): Promise<
  | { ok: true; access: CrmAccess; assignedBroker: string | null }
  | { ok: false; error: string }
> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const sb = createServiceClient()
  const { data: task } = await sb
    .from('crm_tasks')
    .select('id,assigned_broker')
    .eq('id', taskId)
    .maybeSingle()
  if (!task) return { ok: false, error: 'Task not found' }
  const assignedBroker = (task.assigned_broker as string | null) ?? null
  if (!canActOnTask(access.access, assignedBroker)) {
    return { ok: false, error: 'Not authorized for this task' }
  }
  return { ok: true, access: access.access, assignedBroker }
}

/** Revalidate the surfaces a task change touches. */
function revalidateTasks(personId?: number | null) {
  revalidatePath('/admin/crm/tasks')
  revalidatePath('/admin/crm')
  if (personId) revalidatePath(`/admin/crm/${personId}`)
}

// ── Lifecycle mutations ─────────────────────────────────────────────────────

/** Edit a task's name, type, and/or due date. Only supplied fields change. */
export async function updateCrmTaskAction(input: {
  id: number
  name?: string
  type?: string
  dueAt?: string | null
}): Promise<CrmActionResult> {
  const id = Number(input.id)
  if (!id) return { ok: false, error: 'Task id required' }
  const guard = await requireTaskAccess(id)
  if (!guard.ok) return guard

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { ok: false, error: 'Task name cannot be empty' }
    patch.name = name
  }
  if (input.type !== undefined) {
    const type = input.type.trim()
    if (!type) return { ok: false, error: 'Task type cannot be empty' }
    patch.type = type
  }
  if (input.dueAt !== undefined) {
    if (input.dueAt === null) {
      patch.due_at = null
    } else {
      const d = new Date(input.dueAt)
      if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid due date' }
      patch.due_at = d.toISOString()
    }
  }

  const sb = createServiceClient()
  const { data: row, error } = await sb
    .from('crm_tasks')
    .update(patch)
    .eq('id', id)
    .select('person_id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  revalidateTasks((row?.person_id as number | null) ?? null)
  return { ok: true }
}

/**
 * Reassign a task to a different broker. OWNER-only (a superuser): a restricted
 * broker is refused outright so no one can move work off another broker (mirrors
 * assignCrmBrokerAction). The target broker must be a known slug.
 */
export async function reassignCrmTaskAction(id: number, broker: string): Promise<CrmActionResult> {
  const taskId = Number(id)
  if (!taskId) return { ok: false, error: 'Task id required' }
  const access = await requireCrmAccess()
  if (!access.ok) return access
  if (scopeBroker(access.access) !== null) {
    return { ok: false, error: 'Not authorized. Only an owner can reassign a task.' }
  }
  const slug = String(broker ?? '').trim() as CrmBrokerSlug
  if (!(CRM_BROKERS as readonly string[]).includes(slug)) {
    return { ok: false, error: 'Broker required' }
  }
  const sb = createServiceClient()
  const { data: row, error } = await sb
    .from('crm_tasks')
    .update({ assigned_broker: slug, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('person_id')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: 'Task not found' }
  revalidateTasks((row.person_id as number | null) ?? null)
  return { ok: true }
}

/** Snooze a task — push its due date forward by N days (default 1). */
export async function snoozeCrmTaskAction(id: number, days: number): Promise<CrmActionResult> {
  const taskId = Number(id)
  if (!taskId) return { ok: false, error: 'Task id required' }
  const guard = await requireTaskAccess(taskId)
  if (!guard.ok) return guard

  const sb = createServiceClient()
  const { data: task } = await sb
    .from('crm_tasks')
    .select('due_at,person_id')
    .eq('id', taskId)
    .maybeSingle()
  if (!task) return { ok: false, error: 'Task not found' }

  const nextDue = addDaysToDue((task.due_at as string | null) ?? null, Number(days), new Date())
  const { error } = await sb
    .from('crm_tasks')
    .update({ due_at: nextDue, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  revalidateTasks((task.person_id as number | null) ?? null)
  return { ok: true }
}

/** Delete a task outright (hard delete — crm_tasks has no soft-delete column). */
export async function deleteCrmTaskAction(id: number): Promise<CrmActionResult> {
  const taskId = Number(id)
  if (!taskId) return { ok: false, error: 'Task id required' }
  const guard = await requireTaskAccess(taskId)
  if (!guard.ok) return guard
  const sb = createServiceClient()
  const { data: task } = await sb.from('crm_tasks').select('person_id').eq('id', taskId).maybeSingle()
  const { error } = await sb.from('crm_tasks').delete().eq('id', taskId)
  if (error) return { ok: false, error: error.message }
  revalidateTasks((task?.person_id as number | null) ?? null)
  return { ok: true }
}

/**
 * Bulk-complete tasks. Each id is independently ownership-checked — a restricted
 * broker can only complete their own; ids they cannot touch are skipped (not a
 * hard failure for the whole batch). Returns the number actually completed.
 */
export async function bulkCompleteTasksAction(
  ids: number[],
): Promise<CrmActionResult & { completed?: number }> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const clean = Array.from(new Set((ids ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)))
  if (!clean.length) return { ok: false, error: 'No tasks selected' }

  const sb = createServiceClient()
  const { data: tasks } = await sb
    .from('crm_tasks')
    .select('id,assigned_broker,person_id,completed_at')
    .in('id', clean)
  const allowed = (tasks ?? []).filter(
    (t) => !t.completed_at && canActOnTask(access.access, (t.assigned_broker as string | null) ?? null),
  )
  if (!allowed.length) return { ok: false, error: 'No tasks you can complete were selected' }

  const nowIso = new Date().toISOString()
  const { error } = await sb
    .from('crm_tasks')
    .update({ completed_at: nowIso, updated_at: nowIso })
    .in(
      'id',
      allowed.map((t) => t.id as number),
    )
  if (error) return { ok: false, error: error.message }

  const touched = new Set<number>()
  for (const t of allowed) {
    const pid = t.person_id as number | null
    if (pid && !touched.has(pid)) {
      touched.add(pid)
      revalidatePath(`/admin/crm/${pid}`)
    }
  }
  revalidatePath('/admin/crm/tasks')
  revalidatePath('/admin/crm')
  return { ok: true, completed: allowed.length }
}

/**
 * "Clear My Overdue Tasks" (§09 §1.5.1) — bulk-completes every OPEN overdue
 * task assigned to the CALLER. Per the spec restriction this never clears
 * another agent's tasks, even when a superuser has the view scoped to someone
 * else. Uses the same overdue definition as getTaskQueue (due before today,
 * newer than the 31-day stale floor) so the cleared count matches the badge.
 */
export async function clearMyOverdueTasksAction(): Promise<CrmActionResult & { cleared?: number }> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const ownSlug = access.access.brokerSlug ?? scopeBroker(access.access)
  if (!ownSlug) return { ok: false, error: 'Could not resolve your broker slug' }

  const { taskQueueBounds } = await import('@/lib/data/crm/getTaskQueue')
  const bounds = taskQueueBounds(new Date())

  const sb = createServiceClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await sb
    .from('crm_tasks')
    .update({ completed_at: nowIso, updated_at: nowIso })
    .is('completed_at', null)
    .lt('due_at', bounds.startOfToday)
    .gte('due_at', bounds.staleFloor)
    .eq('assigned_broker', ownSlug)
    .select('id')
  if (error) return { ok: false, error: error.message }

  revalidateTasks()
  return { ok: true, cleared: (data ?? []).length }
}

// ── Task-type config-table CRUD ─────────────────────────────────────────────

const TASK_TYPES = makeConfigTable({
  table: 'crm_task_types',
  revalidatePaths: ['/admin/crm/tasks', '/admin/crm/settings'],
})

/** Drop the cached getCrmTaskTypes result after any mutation. */
function bustTaskTypeCache() {
  revalidateTag(CRM_TASK_TYPES_TAG, 'max')
}

export async function createCrmTaskTypeAction(formData: FormData): Promise<ConfigResult> {
  const label = String(formData.get('label') ?? '').trim()
  const key = String(formData.get('key') ?? label).trim()
  if (!label) return { ok: false, error: 'Label is required' }
  const res = await TASK_TYPES.create({ key, label })
  if (res.ok) bustTaskTypeCache()
  return res
}

export async function renameCrmTaskTypeAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  const label = String(formData.get('label') ?? '').trim()
  if (!id || !label) return { ok: false, error: 'Task type and label are required' }
  const res = await TASK_TYPES.rename(id, label)
  if (res.ok) bustTaskTypeCache()
  return res
}

/**
 * Delete a task type. Protected types (Follow Up) are refused by the factory.
 * crm_tasks.type is a free text value (not an FK), so existing tasks of a deleted
 * type keep their value — no reassign callback needed.
 */
export async function deleteCrmTaskTypeAction(formData: FormData): Promise<ConfigResult> {
  const id = Number(formData.get('id'))
  if (!id) return { ok: false, error: 'Task type required' }
  const res = await TASK_TYPES.remove(id)
  if (res.ok) bustTaskTypeCache()
  return res
}

// ── Contact search for the NewTaskDialog contact picker (D2 fix) ─────────────

export type ContactSearchHit = { id: number; name: string }

export async function searchCrmContactsAction(
  q: string,
): Promise<{ ok: true; results: ContactSearchHit[] } | { ok: false; error: string }> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  if (!q.trim()) return { ok: true, results: [] }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id,name')
    .ilike('name', `%${q.trim()}%`)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(10)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    results: (data ?? []).map((r) => ({ id: r.id as number, name: (r.name as string | null) ?? `#${r.id}` })),
  }
}
