/**
 * Data access for the one-tap CMA kick-off (admin-rebuild v2, D8).
 *
 * Holds the two raw-table touches the kick-off core needs so the orchestration
 * logic in lib/crm/cma-kickoff.ts stays inside the G1 DAL boundary: a minimal
 * person read (identity + contact points + assignment) and the system timeline
 * stamp recording that a build was kicked off.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

type ContactPoint = { value?: string; isPrimary?: number | boolean }

export type PersonForCmaKickoff = {
  id: number
  name: string | null
  assignedBroker: string | null
  primaryEmail: string | null
  primaryPhone: string | null
}

function primary(points: ContactPoint[] | null | undefined): string | null {
  const list = (points ?? []).slice()
  list.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))
  return list[0]?.value?.trim() || null
}

export async function getPersonForCmaKickoff(personId: number): Promise<PersonForCmaKickoff | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id, name, assigned_broker, emails, phones')
    .eq('id', personId)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id as number,
    name: (data.name as string | null)?.trim() || null,
    assignedBroker: (data.assigned_broker as string | null) ?? null,
    primaryEmail: primary(data.emails as ContactPoint[] | null)?.toLowerCase() ?? null,
    primaryPhone: primary(data.phones as ContactPoint[] | null),
  }
}

/** Stamp the kick-off on the person timeline (kind 'system', deduped per attempt). */
export async function logCmaKickoffTimeline(entry: {
  personId: number
  title: string
  body: string
  broker: string | null
  dedupeKey: string
}): Promise<void> {
  try {
    const sb = createServiceClient()
    await sb.from('crm_timeline').insert({
      person_id: entry.personId,
      kind: 'system',
      title: entry.title,
      body: entry.body,
      broker: entry.broker,
      source: 'app',
      payload: {},
      dedupe_key: entry.dedupeKey,
    })
  } catch (e) {
    console.warn('[cmaKickoff] timeline stamp failed:', e instanceof Error ? e.message : String(e))
  }
}
