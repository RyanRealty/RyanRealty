import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

const PAGE = 1000
const IN_CHUNK = 200

/**
 * Latest visitor_sessions.last_seen_at per crm_people id.
 *
 * PostgREST caps a select at 1000 rows. A 200-person `.in()` can still overflow
 * that if those people have many sessions, so this pages and keeps the max.
 */
export async function readLastSiteByPerson(
  sb: ReturnType<typeof createServiceClient>,
  personIds: number[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  if (personIds.length === 0) return out
  for (let i = 0; i < personIds.length; i += IN_CHUNK) {
    const slice = personIds.slice(i, i + IN_CHUNK)
    const remaining = new Set(slice)
    for (let from = 0; from < 80_000 && remaining.size > 0; from += PAGE) {
      const { data, error } = await sb
        .from('visitor_sessions')
        .select('crm_person_id,last_seen_at')
        .in('crm_person_id', slice)
        .not('last_seen_at', 'is', null)
        .order('last_seen_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) break
      const page = (data ?? []) as Array<{ crm_person_id: number | null; last_seen_at: string | null }>
      for (const r of page) {
        const id = r.crm_person_id
        const at = r.last_seen_at
        if (id == null || !at || !remaining.has(id)) continue
        // Descending order: the first row we see for a person is their latest.
        if (!out.has(id)) out.set(id, at)
        remaining.delete(id)
      }
      if (page.length < PAGE) break
    }
  }
  return out
}
