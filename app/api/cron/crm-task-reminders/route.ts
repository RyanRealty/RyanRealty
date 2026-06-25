/**
 * /api/cron/crm-task-reminders — daily task reminder for each broker (Wave 7).
 *
 * Once a day this surfaces every broker's due-today + overdue open tasks and
 * texts the assigned broker a single rolled-up reminder so a follow-up never
 * slips. It reuses the EXISTING broker-alert path (queueBrokerAlert in
 * lib/crm/broker-alerts.ts): the alert is queued to crm_broker_alerts and the
 * mac-mini relay delivers it (iMessage today, Twilio once A2P verifies). No new
 * email/SMS sender is built here — the cron only QUEUES through the one path.
 *
 * Dedupe: queueBrokerAlert dedupes one alert per (kind, personId) via a
 * crm_timeline system row. We use a date-stamped kind `task-reminder:<YYYY-MM-DD>`
 * anchored to a STABLE per-broker representative task's person, so a re-run on the
 * same day is suppressed but the next day re-pages. A broker with no open tasks
 * gets nothing.
 *
 * Scope: this is an operational sweep across ALL brokers (it is not a per-user
 * request), so it reads every broker's tasks and routes each broker's reminder to
 * that broker. The 31-day stale-overdue floor matches getTaskQueue / the dashboard.
 *
 * G1-exempt: app/api/** is skipped by the DAL-boundary gate. The view math comes
 * from the pure helper taskQueueBounds (lib/data/crm/getTaskQueue.ts), so the
 * date logic stays unit-tested.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (isValidCronAuth).
 * Schedule: vercel.json — once daily (see the integrator note in the manifest).
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isValidCronAuth } from '@/lib/auth/cron-auth'
import { queueBrokerAlert } from '@/lib/crm/broker-alerts'
import { taskQueueBounds } from '@/lib/data/crm/getTaskQueue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type OpenTaskRow = {
  id: number
  name: string
  due_at: string | null
  assigned_broker: string | null
  person_id: number | null
}

export async function GET(request: Request) {
  if (!isValidCronAuth(request.headers.get('authorization'), process.env.CRON_SECRET?.trim())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  const now = new Date()
  const bounds = taskQueueBounds(now)
  const day = now.toISOString().slice(0, 10)
  const sb = createServiceClient()

  // Every open task due today OR overdue (within the 31-day stale floor), with a
  // person to hang the dedupe row off. A task with no person_id can't be deduped
  // (crm_timeline.person_id is NOT NULL) so it is excluded from the alert (it
  // still shows in the queue UI).
  const { data, error } = await sb
    .from('crm_tasks')
    .select('id,name,due_at,assigned_broker,person_id')
    .is('completed_at', null)
    .not('person_id', 'is', null)
    .lte('due_at', bounds.endOfToday)
    .gte('due_at', bounds.staleFloor)
    .order('due_at', { ascending: true })
    .limit(2000)

  if (error) {
    console.error('[crm-task-reminders]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by assigned broker; an unassigned task routes to Matt (queueBrokerAlert
  // already falls back to matt when the broker has no alert phone configured).
  const byBroker = new Map<string, OpenTaskRow[]>()
  for (const t of (data ?? []) as OpenTaskRow[]) {
    const broker = t.assigned_broker ?? 'matt'
    const list = byBroker.get(broker) ?? []
    list.push(t)
    byBroker.set(broker, list)
  }

  let queued = 0
  for (const [broker, tasks] of byBroker) {
    if (!tasks.length) continue
    const overdue = tasks.filter((t) => t.due_at != null && t.due_at < bounds.startOfToday).length
    const dueToday = tasks.length - overdue
    // Anchor the dedupe on the earliest-due task's person (stable across re-runs
    // because the ordering is deterministic). queueBrokerAlert's crm_timeline
    // dedupe key includes this personId + the date-stamped kind.
    const anchor = tasks[0]
    if (anchor.person_id == null) continue

    const parts = [
      `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} need attention today.`,
      overdue ? `${overdue} overdue` : null,
      dueToday ? `${dueToday} due today` : null,
    ].filter(Boolean)
    const body = [
      parts.join(overdue && dueToday ? ', ' : ' '),
      `Next: ${anchor.name.slice(0, 80)}`,
      'Open the queue: https://ryan-realty.com/admin/crm/tasks',
    ].join('\n')

    const ok = await queueBrokerAlert({
      broker,
      personId: anchor.person_id,
      kind: `task-reminder:${day}`,
      body,
    })
    if (ok) queued++
  }

  return NextResponse.json({
    ok: true,
    checked_at: now.toISOString(),
    brokers_with_tasks: byBroker.size,
    open_tasks: data?.length ?? 0,
    reminders_queued: queued,
    duration_ms: Date.now() - startMs,
  })
}
