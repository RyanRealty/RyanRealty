/**
 * searchCrmPeople — the People destination's search-first read (P9 roll:people,
 * IA lock 2026-08-05: People is a LOOKUP TOOL, not a worklist).
 *
 * Two-step search: the term first resolves through crm_contact_points (the
 * identity index — phone/email fragments hit it), then people match on
 * name ilike OR membership in those ids. The compiler's `q` node is NOT used:
 * its jsonb `::text` casts fail to parse inside a PostgREST or() tree (latent
 * defect found 2026-08-05 — flagged; nothing else exercises that branch).
 * Invariants replicated from buildCrmPeopleQuery: deleted=false baseline +
 * assigned_broker scope clamp.
 */
import { createServiceClient } from '@/lib/supabase/service'

export type CrmPersonHit = {
  id: number
  name: string | null
  stage: string | null
  assigned_broker: string | null
  emails: Array<{ value: string }> | null
  phones: Array<{ value: string }> | null
  updated_at: string | null
}

const SELECT = 'id,name,stage,assigned_broker,emails,phones,updated_at'

export async function searchCrmPeople(params: {
  q: string | null
  brokerScope: string | null
  limit?: number
}): Promise<CrmPersonHit[]> {
  try {
    const q = (params.q ?? '').trim()
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100)
    const sb = createServiceClient()

    let query = sb.from('crm_people').select(SELECT).eq('deleted', false)
    if (params.brokerScope) query = query.eq('assigned_broker', params.brokerScope)

    if (q) {
      const escaped = q.replace(/[%_,()]/g, ' ').trim()
      if (!escaped) return []
      // Step 1 — contact-point index. Phones are stored digits-normalized, so a
      // dashed/spaced fragment searches by its digits; emails by the raw term.
      const digits = q.replace(/\D/g, '')
      const [byValue, byDigits] = await Promise.all([
        sb.from('crm_contact_points').select('person_id').ilike('value', `%${escaped}%`).limit(200),
        digits.length >= 4
          ? sb.from('crm_contact_points').select('person_id').ilike('value', `%${digits}%`).limit(200)
          : Promise.resolve({ data: [] as Array<{ person_id: number }> }),
      ])
      const ids = [
        ...new Set([...(byValue.data ?? []), ...(byDigits.data ?? [])].map((p) => p.person_id as number)),
      ]
      // Step 2 — name OR resolved ids.
      query = ids.length
        ? query.or(`name.ilike.%${escaped}%,id.in.(${ids.join(',')})`)
        : query.ilike('name', `%${escaped}%`)
    }

    const { data, error } = await query.order('updated_at', { ascending: false }).limit(limit)
    if (error) {
      console.error('[searchCrmPeople] read failed:', error.message)
      return []
    }
    return (data ?? []) as CrmPersonHit[]
  } catch (err) {
    console.error('[searchCrmPeople]', err)
    return []
  }
}
