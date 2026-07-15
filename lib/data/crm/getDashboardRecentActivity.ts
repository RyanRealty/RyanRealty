import 'server-only'
import { createServiceClient } from '@/lib/data/client'

/**
 * Recent-activity table rows for the FUB-style desktop dashboard. One row per
 * recently-active contact: name, email, phone, their most recent activity event,
 * time, stage, and assigned broker — the exact columns FUB's dashboard shows.
 *
 * Raw .from() lives here per the DAL boundary (G1). Uncached: the dashboard is a
 * force-dynamic surface and this reflects live activity.
 */
export type DashboardActivityRow = {
  personId: number
  name: string | null
  pictureUrl: string | null
  email: string | null
  phone: string | null
  lastActivityKind: string | null
  lastActivityTitle: string | null
  lastActivityAt: string | null
  stage: string | null
  assignedBroker: string | null
}

export async function getDashboardRecentActivity(
  brokerSlug: string | null,
  limit = 12,
): Promise<DashboardActivityRow[]> {
  const sb = createServiceClient()
  let q = sb
    .from('crm_people')
    .select('id,name,picture_url,stage,assigned_broker,last_activity_at')
    // Merged/trashed contacts are soft-deleted with last_activity_at still set —
    // the deleted=false baseline keeps them out (buildCrmPeopleQuery invariant).
    .eq('deleted', false)
    .not('last_activity_at', 'is', null)
    .order('last_activity_at', { ascending: false })
    .limit(limit)
  if (brokerSlug) q = q.eq('assigned_broker', brokerSlug)

  const { data: people, error } = await q
  if (error || !people || people.length === 0) return []

  const ids = people.map((p) => p.id as number)

  // Latest timeline event + primary contact points for the surfaced people only.
  // The latest event is one .limit(1) read per person (a dozen tiny indexed
  // queries in one flight) — a single .in() read has no per-person limit, so a
  // hyper-active contact's history can push another person's newest event past
  // the PostgREST 1000-row response cap and mislabel them.
  const [eventResults, { data: points }] = await Promise.all([
    Promise.all(
      ids.map((id) =>
        sb
          .from('crm_timeline')
          .select('person_id,kind,title,ts')
          .eq('person_id', id)
          .order('ts', { ascending: false })
          .limit(1),
      ),
    ),
    sb.from('crm_contact_points').select('person_id,kind,value,is_primary').in('person_id', ids),
  ])

  const lastEvent = new Map<number, { kind: string; title: string | null }>()
  for (const res of eventResults) {
    const e = (res.data ?? [])[0]
    if (!e) continue
    const pid = e.person_id as number
    if (!lastEvent.has(pid)) lastEvent.set(pid, { kind: String(e.kind), title: (e.title as string | null) ?? null })
  }
  const emailOf = new Map<number, string>()
  const phoneOf = new Map<number, string>()
  for (const c of points ?? []) {
    const pid = c.person_id as number
    const val = String(c.value)
    if (c.kind === 'email' && (!emailOf.has(pid) || c.is_primary)) emailOf.set(pid, val)
    if (c.kind === 'phone' && (!phoneOf.has(pid) || c.is_primary)) phoneOf.set(pid, val)
  }

  return people.map((p) => {
    const ev = lastEvent.get(p.id as number)
    return {
      personId: p.id as number,
      name: (p.name as string | null) ?? null,
      pictureUrl: (p.picture_url as string | null) ?? null,
      email: emailOf.get(p.id as number) ?? null,
      phone: phoneOf.get(p.id as number) ?? null,
      lastActivityKind: ev?.kind ?? null,
      lastActivityTitle: ev?.title ?? null,
      lastActivityAt: (p.last_activity_at as string | null) ?? null,
      stage: (p.stage as string | null) ?? null,
      assignedBroker: (p.assigned_broker as string | null) ?? null,
    }
  })
}
