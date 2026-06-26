import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'

/**
 * getLeadFlows — cached reader for lead_flows + their rules.
 *
 * Also exports getLeadFlowBySource for the routing engine (single-source
 * fast-path, tagged separately so source-level edits bust only that key).
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 */

export type LeadFlowCondition = {
  field: 'price' | 'area' | 'tag'
  op: 'gt' | 'lt' | 'eq' | 'contains'
  value: string
}

export type LeadFlowRule = {
  id: number
  flowId: number
  position: number
  conditionMatch: 'all' | 'any'
  conditions: LeadFlowCondition[]
  assignedBrokerSlug: string | null
  assignedGroupId: number | null
  assignedPondId: number | null
  automationId: string | null
}

export type LeadFlow = {
  id: number
  source: string
  displayName: string
  assignedBrokerSlug: string | null
  assignedGroupId: number | null
  assignedPondId: number | null
  automationId: string | null
  archived: boolean
  rules: LeadFlowRule[]
  createdAt: string
  updatedAt: string
}

type RawFlowRow = {
  id: number
  source: string
  display_name: string
  assigned_broker_slug: string | null
  assigned_group_id: number | null
  assigned_pond_id: number | null
  automation_id: string | null
  archived: boolean
  created_at: string
  updated_at: string
}

type RawRuleRow = {
  id: number
  flow_id: number
  position: number
  condition_match: string
  conditions: unknown
  assigned_broker_slug: string | null
  assigned_group_id: number | null
  assigned_pond_id: number | null
  automation_id: string | null
}

function mapRule(r: RawRuleRow): LeadFlowRule {
  const raw = Array.isArray(r.conditions) ? (r.conditions as LeadFlowCondition[]) : []
  return {
    id: r.id,
    flowId: r.flow_id,
    position: r.position ?? 0,
    conditionMatch: r.condition_match === 'any' ? 'any' : 'all',
    conditions: raw,
    assignedBrokerSlug: r.assigned_broker_slug ?? null,
    assignedGroupId: r.assigned_group_id ?? null,
    assignedPondId: r.assigned_pond_id ?? null,
    automationId: r.automation_id ?? null,
  }
}

function mapFlow(row: RawFlowRow, rules: RawRuleRow[]): LeadFlow {
  return {
    id: row.id,
    source: row.source,
    displayName: row.display_name || row.source,
    assignedBrokerSlug: row.assigned_broker_slug ?? null,
    assignedGroupId: row.assigned_group_id ?? null,
    assignedPondId: row.assigned_pond_id ?? null,
    automationId: row.automation_id ?? null,
    archived: row.archived ?? false,
    rules: rules
      .filter((r) => r.flow_id === row.id)
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map(mapRule),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** All non-archived lead flows with their rules. Used by the admin UI. */
export const getLeadFlows = unstable_cache(
  async (): Promise<LeadFlow[]> => {
    const sb = supabaseAnon()
    if (!sb) return []
    const [{ data: flows, error: fErr }, { data: rules, error: rErr }] = await Promise.all([
      sb
        .from('lead_flows')
        .select('id,source,display_name,assigned_broker_slug,assigned_group_id,assigned_pond_id,automation_id,archived,created_at,updated_at')
        .order('id'),
      sb
        .from('lead_flow_rules')
        .select('id,flow_id,position,condition_match,conditions,assigned_broker_slug,assigned_group_id,assigned_pond_id,automation_id')
        .order('position'),
    ])
    if (fErr) {
      console.error('[getLeadFlows]', fErr.message)
      return []
    }
    if (rErr) console.error('[getLeadFlows] rules', rErr.message)
    return ((flows as RawFlowRow[]) ?? []).map((f) => mapFlow(f, (rules as RawRuleRow[]) ?? []))
  },
  ['lead-flows-v1'],
  { revalidate: 300, tags: ['lead-flows'] },
)

/**
 * getLeadFlowBySource — fast-path single-source reader for the routing engine.
 * Returns the matching active flow (with its rules) or null when no flow exists
 * for this source.
 */
export const getLeadFlowBySource = unstable_cache(
  async (source: string): Promise<LeadFlow | null> => {
    const sb = supabaseAnon()
    if (!sb) return null
    const key = (source ?? '').trim()
    if (!key) return null
    const [{ data: flowRow, error: fErr }, { data: rules, error: rErr }] = await Promise.all([
      sb
        .from('lead_flows')
        .select('id,source,display_name,assigned_broker_slug,assigned_group_id,assigned_pond_id,automation_id,archived,created_at,updated_at')
        .eq('source', key)
        .eq('archived', false)
        .maybeSingle(),
      sb
        .from('lead_flow_rules')
        .select('id,flow_id,position,condition_match,conditions,assigned_broker_slug,assigned_group_id,assigned_pond_id,automation_id'),
    ])
    if (fErr) {
      console.error('[getLeadFlowBySource]', fErr.message)
      return null
    }
    if (!flowRow) return null
    const flow = flowRow as RawFlowRow
    const flowRules = ((rules as RawRuleRow[]) ?? []).filter((r) => r.flow_id === flow.id)
    if (rErr) console.error('[getLeadFlowBySource] rules', rErr.message)
    return mapFlow(flow, flowRules)
  },
  ['lead-flow-by-source-v1'],
  { revalidate: 300, tags: ['lead-flows'] },
)
