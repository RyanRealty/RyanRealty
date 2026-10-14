/**
 * Batch-read tags + stage for bulk-audience industry exclusion.
 * DAL boundary (G1): the crm_people .from() lives here.
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

export type PersonAudienceFields = {
  id: number
  tags: unknown
  stage: string | null
}

const PAGE = 200

export async function getPeopleAudienceFields(
  sb: SupabaseClient,
  ids: readonly number[],
): Promise<{ fields: Map<number, PersonAudienceFields>; error: string | null }> {
  const clean = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))]
  const fields = new Map<number, PersonAudienceFields>()
  if (clean.length === 0) return { fields, error: null }

  for (let i = 0; i < clean.length; i += PAGE) {
    const chunk = clean.slice(i, i + PAGE)
    const { data, error } = await sb.from('crm_people').select('id,tags,stage').in('id', chunk)
    if (error) return { fields, error: error.message }
    for (const row of data ?? []) {
      const id = Number(row.id)
      if (!Number.isFinite(id)) continue
      fields.set(id, {
        id,
        tags: row.tags,
        stage: (row.stage as string | null) ?? null,
      })
    }
  }
  return { fields, error: null }
}

export async function readPersonAudienceFields(
  personId: number,
): Promise<{ fields: PersonAudienceFields | null; error: string | null }> {
  if (!Number.isInteger(personId) || personId <= 0) {
    return { fields: null, error: 'invalid-person' }
  }
  const sb = createServiceClient()
  const { fields, error } = await getPeopleAudienceFields(sb, [personId])
  if (error) return { fields: null, error }
  return { fields: fields.get(personId) ?? null, error: null }
}
