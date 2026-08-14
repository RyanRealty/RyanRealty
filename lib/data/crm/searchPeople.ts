/**
 * Narrow name/email search for attaching a CRM person to a TC deal.
 * Assigned-broker scope when brokerScope is set. Limit 8.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

export type PeopleSearchHit = {
  id: number
  name: string | null
  email: string | null
}

function escapeIlike(q: string): string {
  return q.replace(/[%_\\]/g, '\\$&')
}

export async function searchPeopleByName(input: {
  query: string
  brokerScope: string | null
  limit?: number
}): Promise<PeopleSearchHit[]> {
  const q = input.query.trim()
  if (q.length < 2) return []
  const sb = createServiceClient()
  const pattern = `%${escapeIlike(q)}%`
  let req = sb
    .from('crm_people')
    .select('id, name, emails')
    .eq('deleted', false)
    .ilike('name', pattern)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(input.limit ?? 8)
  if (input.brokerScope) req = req.eq('assigned_broker', input.brokerScope)
  const { data, error } = await req
  if (error) {
    console.error('[searchPeopleByName]', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const emails = row.emails as Array<{ value?: string; isPrimary?: number | boolean }> | null
    const primary = emails?.find((e) => e.isPrimary === 1 || e.isPrimary === true) ?? emails?.[0]
    return {
      id: Number(row.id),
      name: (row.name as string | null) ?? null,
      email: primary?.value ?? null,
    }
  })
}
