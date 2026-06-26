import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'

/**
 * getCrmPonds — cached reader for crm_ponds + their members.
 *
 * Used by the Lead Flow admin UI and the routing engine. The mutation actions
 * (app/actions/crm-ponds.ts) revalidate the 'crm-ponds' cache tag on every
 * change.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */

export type CrmPondMember = {
  id: number
  pondId: number
  brokerSlug: string
}

export type CrmPond = {
  id: number
  name: string
  pondLeadSlug: string
  members: CrmPondMember[]
  createdAt: string
  updatedAt: string
}

type RawPondRow = {
  id: number
  name: string
  pond_lead_slug: string
  created_at: string
  updated_at: string
}

type RawPondMemberRow = {
  id: number
  pond_id: number
  broker_slug: string
}

function mapPond(row: RawPondRow, members: RawPondMemberRow[]): CrmPond {
  return {
    id: row.id,
    name: row.name,
    pondLeadSlug: row.pond_lead_slug ?? '',
    members: members
      .filter((m) => m.pond_id === row.id)
      .sort((a, b) => a.id - b.id)
      .map((m) => ({ id: m.id, pondId: m.pond_id, brokerSlug: m.broker_slug })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const getCrmPonds = unstable_cache(
  async (): Promise<CrmPond[]> => {
    const sb = supabaseAnon()
    if (!sb) return []
    const [{ data: ponds, error: pErr }, { data: members, error: mErr }] = await Promise.all([
      sb.from('crm_ponds').select('id,name,pond_lead_slug,created_at,updated_at').order('id'),
      sb.from('crm_pond_members').select('id,pond_id,broker_slug').order('id'),
    ])
    if (pErr) {
      console.error('[getCrmPonds]', pErr.message)
      return []
    }
    if (mErr) console.error('[getCrmPonds] members', mErr.message)
    return ((ponds as RawPondRow[]) ?? []).map((p) => mapPond(p, (members as RawPondMemberRow[]) ?? []))
  },
  ['crm-ponds-v1'],
  { revalidate: 300, tags: ['crm-ponds'] },
)
