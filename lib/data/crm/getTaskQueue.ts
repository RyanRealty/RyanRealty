import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getTaskQueue — the cross-contact task queue (Wave 7, Phase A read side).
 *
 * Returns open/completed crm_tasks across ALL contacts (the person name joined
 * from crm_people), filtered to one of four views, plus a count per view so the
 * queue UI (Phase B) can render the today/overdue/upcoming/completed tab badges
 * in one round trip.
 *
 * Views (all relative to "now", which the CALLER passes in — never new Date() at
 * render in a client component; the page/cron supplies a stable nowIso):
 *   - today     open, due_at within [startOfToday, endOfToday]
 *   - overdue   open, due_at < startOfToday (and not older than the stale floor —
 *               a task >31 days overdue is FUB import cruft, not real work, per
 *               Matt 2026-06-15, matching listCrmOpenTasks)
 *   - upcoming  open, due_at > endOfToday, OR no due date
 *   - completed completed within the trailing 30 days, newest first
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/. Uses the
 * service client (not the cached anon read) because the queue is a per-request,
 * scope-filtered admin surface — caching a broker-scoped result keyed only on the
 * view would leak one broker's tasks to another. getCrmTaskTypes (below) IS
 * cached: the type taxonomy is small and broker-independent.
 *
 * Scope: brokerScope is the result of scopeBroker(access) — null for a superuser
 * (sees every broker's tasks), a slug for a restricted broker (own tasks only).
 * The page computes it; this reader never widens past what it is given.
 *
 * Fails SOFT (empty rows, zero counts) on an unreadable table.
 */

export type TaskQueueView = 'today' | 'overdue' | 'upcoming' | 'completed'

export type TaskQueueRow = {
  id: number
  name: string
  type: string | null
  dueAt: string | null
  completedAt: string | null
  assignedBroker: string | null
  personId: number | null
  personName: string | null
  personStage: string | null
}

export type TaskQueueCounts = {
  today: number
  overdue: number
  upcoming: number
  completed: number
}

export type TaskQueueResult = {
  rows: TaskQueueRow[]
  counts: TaskQueueCounts
  view: TaskQueueView
}

/** A task >31 days overdue is import cruft, not real work (Matt 2026-06-15). */
const STALE_OVERDUE_DAYS = 31
/** Completed view shows the trailing window so it stays a useful "recently done". */
const COMPLETED_WINDOW_DAYS = 30
const PAGE_LIMIT = 300

const DAY_MS = 24 * 3600 * 1000

/**
 * The pure day-boundary helper. Given a reference instant, returns the ISO
 * bounds the four views need. Exported standalone so the view filtering is
 * unit-tested without a DB. Day boundaries are computed in UTC off the supplied
 * instant — the caller passes an instant that already represents "now" in their
 * intended zone, and the queue groups by the same calendar day the dashboard does.
 */
export function taskQueueBounds(now: Date): {
  startOfToday: string
  endOfToday: string
  staleFloor: string
  completedFloor: string
  nowIso: string
} {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  return {
    startOfToday: startOfToday.toISOString(),
    endOfToday: endOfToday.toISOString(),
    staleFloor: new Date(now.getTime() - STALE_OVERDUE_DAYS * DAY_MS).toISOString(),
    completedFloor: new Date(now.getTime() - COMPLETED_WINDOW_DAYS * DAY_MS).toISOString(),
    nowIso: now.toISOString(),
  }
}

/**
 * The pure view-classifier. Given a task's due/completed timestamps and the
 * bounds, decide which single view it belongs to (or none). Exported for the
 * unit test — the SQL builder below mirrors this exactly so the rendered count
 * and the rendered list always agree.
 */
export function classifyTaskView(
  task: { dueAt: string | null; completedAt: string | null },
  bounds: ReturnType<typeof taskQueueBounds>,
): TaskQueueView | null {
  if (task.completedAt) {
    return task.completedAt >= bounds.completedFloor ? 'completed' : null
  }
  // Open tasks below.
  if (task.dueAt == null) return 'upcoming'
  if (task.dueAt < bounds.startOfToday) {
    // Overdue, but drop import cruft older than the stale floor.
    return task.dueAt >= bounds.staleFloor ? 'overdue' : null
  }
  if (task.dueAt <= bounds.endOfToday) return 'today'
  return 'upcoming'
}

type RawQueueRow = {
  id: number
  name: string
  type: string | null
  due_at: string | null
  completed_at: string | null
  assigned_broker: string | null
  person_id: number | null
  crm_people: { name: string | null; stage: string } | Array<{ name: string | null; stage: string }> | null
}

function mapRow(r: RawQueueRow): TaskQueueRow {
  const p = Array.isArray(r.crm_people) ? r.crm_people[0] : r.crm_people
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    dueAt: r.due_at,
    completedAt: r.completed_at,
    assignedBroker: r.assigned_broker,
    personId: r.person_id,
    personName: p?.name ?? null,
    personStage: p?.stage ?? null,
  }
}

export async function getTaskQueue(params: {
  brokerScope: string | null
  view: TaskQueueView
  type?: string | null
  now?: Date
}): Promise<TaskQueueResult> {
  const { brokerScope, view, type } = params
  const bounds = taskQueueBounds(params.now ?? new Date())
  const sb = createServiceClient()

  // Build the rows query for the requested view. Each branch mirrors
  // classifyTaskView exactly so the list and the count never disagree.
  const select =
    'id,name,type,due_at,completed_at,assigned_broker,person_id,crm_people(name,stage)'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from('crm_tasks').select(select)

  if (view === 'completed') {
    q = q
      .not('completed_at', 'is', null)
      .gte('completed_at', bounds.completedFloor)
      .order('completed_at', { ascending: false })
  } else if (view === 'overdue') {
    q = q
      .is('completed_at', null)
      .lt('due_at', bounds.startOfToday)
      .gte('due_at', bounds.staleFloor)
      .order('due_at', { ascending: true })
  } else if (view === 'today') {
    q = q
      .is('completed_at', null)
      .gte('due_at', bounds.startOfToday)
      .lte('due_at', bounds.endOfToday)
      .order('due_at', { ascending: true })
  } else {
    // upcoming: open and (due in the future OR no due date)
    q = q
      .is('completed_at', null)
      .or(`due_at.is.null,due_at.gt.${bounds.endOfToday}`)
      .order('due_at', { ascending: true, nullsFirst: false })
  }

  if (brokerScope) q = q.eq('assigned_broker', brokerScope)
  if (type) q = q.eq('type', type)
  q = q.limit(PAGE_LIMIT)

  // Counts per view, head-only, run in parallel. Each count applies the same
  // scope + type filter as the rows so the badges match the filtered list.
  const head = { count: 'exact' as const, head: true }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (b: any): any => {
    let x = b
    if (brokerScope) x = x.eq('assigned_broker', brokerScope)
    if (type) x = x.eq('type', type)
    return x
  }

  const [rowsRes, todayCount, overdueCount, upcomingCount, completedCount] = await Promise.all([
    q,
    scoped(sb.from('crm_tasks').select('id', head))
      .is('completed_at', null)
      .gte('due_at', bounds.startOfToday)
      .lte('due_at', bounds.endOfToday),
    scoped(sb.from('crm_tasks').select('id', head))
      .is('completed_at', null)
      .lt('due_at', bounds.startOfToday)
      .gte('due_at', bounds.staleFloor),
    scoped(sb.from('crm_tasks').select('id', head))
      .is('completed_at', null)
      .or(`due_at.is.null,due_at.gt.${bounds.endOfToday}`),
    scoped(sb.from('crm_tasks').select('id', head))
      .not('completed_at', 'is', null)
      .gte('completed_at', bounds.completedFloor),
  ])

  if (rowsRes.error) {
    console.error('[getTaskQueue]', rowsRes.error.message)
    return { rows: [], counts: { today: 0, overdue: 0, upcoming: 0, completed: 0 }, view }
  }

  return {
    rows: ((rowsRes.data ?? []) as RawQueueRow[]).map(mapRow),
    counts: {
      today: todayCount.count ?? 0,
      overdue: overdueCount.count ?? 0,
      upcoming: upcomingCount.count ?? 0,
      completed: completedCount.count ?? 0,
    },
    view,
  }
}

// ── Task types (the cached config-table read side) ──────────────────────────

export type CrmTaskType = {
  key: string
  label: string
  position: number
  isActive: boolean
  isProtected: boolean
}

/** The cache tag the task-type CRUD actions revalidate on write. */
export const CRM_TASK_TYPES_TAG = 'crm-task-types' as const

/**
 * getCrmTaskTypes — the cached read side of the crm_task_types config table.
 * Small + broker-independent, so it is safe to cache (unlike the per-broker
 * queue). The mutation actions (app/actions/crm-tasks.ts) revalidate the tag.
 * Fails SOFT (empty array) on an unreadable table.
 */
export const getCrmTaskTypes = unstable_cache(
  async (): Promise<CrmTaskType[]> => {
    // Service client: crm_task_types has RLS enabled with no anon policy, so
    // the anon read silently returned [] (found 2026-07-01 in the §09 slice —
    // the Filters dropdown had no type checkboxes and the old type-chip row
    // rendered nothing). Internal config table — service read is correct.
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_task_types')
      .select('key,label,position,is_active,is_protected')
      .order('position', { ascending: true })
      .order('key', { ascending: true })
    if (error || !data) {
      if (error) console.error('[getCrmTaskTypes]', error.message)
      return []
    }
    return (
      data as Array<{ key: string; label: string; position: number; is_active: boolean; is_protected: boolean }>
    ).map((r) => ({
      key: r.key,
      label: r.label,
      position: r.position,
      isActive: r.is_active,
      isProtected: r.is_protected,
    }))
  },
  ['crm-task-types-v1'],
  { revalidate: 300, tags: [CRM_TASK_TYPES_TAG] },
)
