/**
 * lead-flow-resolver — pure, unit-testable resolver for Lead Flow routing (FUB §8.3).
 *
 * resolveLeadFlow(flow, rules, context) walks the ordered rules and returns the
 * first matching DistributionTarget. If no rule matches (or there are no rules),
 * it falls back to the flow's own default target.
 *
 * Condition evaluation:
 *   - 'all' — every condition in the rule must pass
 *   - 'any' — at least one condition must pass
 *   - empty conditions array — always matches (unconditional rule)
 *
 * The caller is responsible for resolving a DistributionTarget to an actual
 * broker slug (e.g. calling the DB RPC for groups, setting pond_id for ponds).
 *
 * Pure — no DB, no imports from lib/data/ or lib/supabase/.
 */

import type { LeadFlow, LeadFlowRule, LeadFlowCondition } from '@/lib/data/crm/getLeadFlow'

/** What the resolver returns: which distribution mechanism to use. */
export type DistributionTarget =
  | { kind: 'broker'; slug: string }
  | { kind: 'group'; groupId: number }
  | { kind: 'pond'; pondId: number }
  | { kind: 'none' }  // flow exists but has no configured target

export type LeadContext = {
  /** Numeric price from the lead (e.g. crm_people.price). */
  price?: number | null
  /** Area / geo string from the lead (e.g. 'Bend' or a zip). */
  area?: string | null
  /** Tags already on the lead. */
  tags?: string[]
}

/** Evaluate a single condition against the lead context. Pure. */
export function evalCondition(cond: LeadFlowCondition, ctx: LeadContext): boolean {
  const { field, op, value } = cond
  switch (field) {
    case 'price': {
      const p = ctx.price
      if (p == null || !Number.isFinite(p)) return false
      const v = parseFloat(value)
      if (!Number.isFinite(v)) return false
      switch (op) {
        case 'gt': return p > v
        case 'lt': return p < v
        case 'eq': return p === v
        default: return false
      }
    }
    case 'area': {
      const a = (ctx.area ?? '').toLowerCase().trim()
      const v = value.toLowerCase().trim()
      switch (op) {
        case 'eq': return a === v
        case 'contains': return a.includes(v)
        default: return false
      }
    }
    case 'tag': {
      const tags = (ctx.tags ?? []).map((t) => t.toLowerCase())
      const v = value.toLowerCase().trim()
      switch (op) {
        case 'eq':
        case 'contains': return tags.some((t) => t.includes(v))
        default: return false
      }
    }
    default:
      return false
  }
}

/** Does this rule match the given lead context? Pure. */
export function ruleMatches(rule: LeadFlowRule, ctx: LeadContext): boolean {
  const conds = rule.conditions
  if (!conds || conds.length === 0) return true  // unconditional
  if (rule.conditionMatch === 'any') {
    return conds.some((c) => evalCondition(c, ctx))
  }
  // 'all'
  return conds.every((c) => evalCondition(c, ctx))
}

/** Extract a DistributionTarget from a rule or flow default. Pure. */
function extractTarget(
  brokerSlug: string | null,
  groupId: number | null,
  pondId: number | null,
): DistributionTarget {
  if (brokerSlug) return { kind: 'broker', slug: brokerSlug }
  if (groupId != null) return { kind: 'group', groupId }
  if (pondId != null) return { kind: 'pond', pondId }
  return { kind: 'none' }
}

/**
 * Walk the ordered rules and return the first matching DistributionTarget.
 * Falls back to the flow-level default when no rule matches.
 *
 * @param flow   The parent LeadFlow (carries the default distribution target).
 * @param rules  The ordered LeadFlowRule[] (pre-sorted by position asc).
 * @param ctx    Lead context used to evaluate conditions.
 */
export function resolveLeadFlow(
  flow: LeadFlow,
  rules: LeadFlowRule[],
  ctx: LeadContext,
): DistributionTarget {
  // Walk rules in order; first match wins.
  for (const rule of rules) {
    if (ruleMatches(rule, ctx)) {
      return extractTarget(rule.assignedBrokerSlug, rule.assignedGroupId, rule.assignedPondId)
    }
  }
  // No rule matched — use the flow-level default.
  return extractTarget(flow.assignedBrokerSlug, flow.assignedGroupId, flow.assignedPondId)
}
