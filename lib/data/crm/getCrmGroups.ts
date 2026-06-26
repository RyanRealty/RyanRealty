import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'

/**
 * getCrmGroups — cached reader for crm_groups + their members.
 *
 * Used by the Lead Flow admin UI and the routing engine. The mutation actions
 * (app/actions/crm-groups.ts) revalidate the 'crm-groups' cache tag on every
 * change.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */

export type CrmGroupMember = {
  id: number
  groupId: number
  brokerSlug: string
  sortOrder: number
}

export type CrmGroup = {
  id: number
  name: string
  distributionType: 'round_robin' | 'first_to_claim'
  roundRobinIndex: number
  members: CrmGroupMember[]
  createdAt: string
  updatedAt: string
}

type RawGroupRow = {
  id: number
  name: string
  distribution_type: string
  round_robin_index: number
  created_at: string
  updated_at: string
}

type RawMemberRow = {
  id: number
  group_id: number
  broker_slug: string
  sort_order: number
}

function mapGroup(row: RawGroupRow, members: RawMemberRow[]): CrmGroup {
  return {
    id: row.id,
    name: row.name,
    distributionType: row.distribution_type === 'first_to_claim' ? 'first_to_claim' : 'round_robin',
    roundRobinIndex: row.round_robin_index ?? -1,
    members: members
      .filter((m) => m.group_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((m) => ({ id: m.id, groupId: m.group_id, brokerSlug: m.broker_slug, sortOrder: m.sort_order })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const getCrmGroups = unstable_cache(
  async (): Promise<CrmGroup[]> => {
    const sb = supabaseAnon()
    if (!sb) return []
    const [{ data: groups, error: gErr }, { data: members, error: mErr }] = await Promise.all([
      sb.from('crm_groups').select('id,name,distribution_type,round_robin_index,created_at,updated_at').order('id'),
      sb.from('crm_group_members').select('id,group_id,broker_slug,sort_order').order('sort_order'),
    ])
    if (gErr) {
      console.error('[getCrmGroups]', gErr.message)
      return []
    }
    if (mErr) console.error('[getCrmGroups] members', mErr.message)
    return ((groups as RawGroupRow[]) ?? []).map((g) => mapGroup(g, (members as RawMemberRow[]) ?? []))
  },
  ['crm-groups-v1'],
  { revalidate: 300, tags: ['crm-groups'] },
)
