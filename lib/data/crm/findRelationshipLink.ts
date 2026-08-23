/**
 * Pairwise CRM relationship lookup used before writing a reciprocal link.
 * Raw .from() stays here (G1). The insert lives in app/actions/crm-relationships.ts.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export async function relationshipLinkExists(
  fromPersonId: number,
  toPersonId: number,
): Promise<boolean> {
  const a = Number(fromPersonId)
  const b = Number(toPersonId)
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) return false
  const { data } = await createServiceClient()
    .from('crm_relationships')
    .select('id,person_id,related_person_id')
    .or(
      `and(person_id.eq.${a},related_person_id.eq.${b}),and(person_id.eq.${b},related_person_id.eq.${a})`,
    )
    .limit(2)
  return (data ?? []).length > 0
}

export async function getPersonNamesByIds(ids: readonly number[]): Promise<Map<number, string>> {
  const wanted = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))]
  const nameById = new Map<number, string>()
  if (!wanted.length) return nameById
  const { data } = await createServiceClient().from('crm_people').select('id,name').in('id', wanted)
  for (const p of data ?? []) {
    nameById.set(Number(p.id), String(p.name ?? '').trim() || `Person ${p.id}`)
  }
  return nameById
}
