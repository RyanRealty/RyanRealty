/**
 * Slim notes read for person-detail first paint.
 * Do not go through getCrmPersonFull (timeline + visitors + geo).
 */
import { createServiceClient } from '@/lib/supabase/service'

export type PersonNoteRow = {
  id: number
  ts: string
  body: string
  broker: string | null
}

export async function getPersonNotes(personId: number, limit = 20): Promise<PersonNoteRow[]> {
  if (!Number.isFinite(personId) || personId <= 0) return []
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_timeline')
    .select('id,ts,body,broker')
    .eq('person_id', personId)
    .eq('kind', 'note')
    .order('ts', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[getPersonNotes]', error.message)
    return []
  }
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    ts: String(row.ts ?? ''),
    body: String(row.body ?? ''),
    broker: row.broker == null ? null : String(row.broker),
  }))
}
