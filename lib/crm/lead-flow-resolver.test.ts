/**
 * Tests for lead-flow-resolver — pure unit tests, no DB.
 */

import { describe, it, expect } from 'vitest'
import {
  evalCondition,
  ruleMatches,
  resolveLeadFlow,
  type DistributionTarget,
} from './lead-flow-resolver'
import type { LeadFlow, LeadFlowRule } from '@/lib/data/crm/getLeadFlow'

// ── evalCondition ────────────────────────────────────────────────────────────

describe('evalCondition — price', () => {
  it('gt: passes when price exceeds threshold', () => {
    expect(evalCondition({ field: 'price', op: 'gt', value: '1000000' }, { price: 1500000 })).toBe(true)
  })
  it('gt: fails when price equals threshold', () => {
    expect(evalCondition({ field: 'price', op: 'gt', value: '1000000' }, { price: 1000000 })).toBe(false)
  })
  it('lt: passes when price is below threshold', () => {
    expect(evalCondition({ field: 'price', op: 'lt', value: '500000' }, { price: 400000 })).toBe(true)
  })
  it('eq: passes when price matches exactly', () => {
    expect(evalCondition({ field: 'price', op: 'eq', value: '750000' }, { price: 750000 })).toBe(true)
  })
  it('returns false when price is null', () => {
    expect(evalCondition({ field: 'price', op: 'gt', value: '0' }, { price: null })).toBe(false)
  })
})

describe('evalCondition — area', () => {
  it('eq: matches case-insensitively', () => {
    expect(evalCondition({ field: 'area', op: 'eq', value: 'Bend' }, { area: 'bend' })).toBe(true)
  })
  it('contains: partial match', () => {
    expect(evalCondition({ field: 'area', op: 'contains', value: 'en' }, { area: 'Bend' })).toBe(true)
  })
  it('eq: fails on mismatch', () => {
    expect(evalCondition({ field: 'area', op: 'eq', value: 'Sisters' }, { area: 'Bend' })).toBe(false)
  })
})

describe('evalCondition — tag', () => {
  it('contains: matches when tag is present', () => {
    expect(evalCondition({ field: 'tag', op: 'contains', value: 'seller' }, { tags: ['audience:seller', 'source:meta'] })).toBe(true)
  })
  it('eq: fails when tag not present', () => {
    expect(evalCondition({ field: 'tag', op: 'eq', value: 'buyer' }, { tags: ['audience:seller'] })).toBe(false)
  })
  it('returns false on empty tags', () => {
    expect(evalCondition({ field: 'tag', op: 'contains', value: 'seller' }, {})).toBe(false)
  })
})

// ── ruleMatches ──────────────────────────────────────────────────────────────

const makeRule = (overrides: Partial<LeadFlowRule> = {}): LeadFlowRule => ({
  id: 1,
  flowId: 1,
  position: 0,
  conditionMatch: 'all',
  conditions: [],
  assignedBrokerSlug: 'matt',
  assignedGroupId: null,
  assignedPondId: null,
  automationId: null,
  ...overrides,
})

describe('ruleMatches', () => {
  it('empty conditions = always match', () => {
    expect(ruleMatches(makeRule({ conditions: [] }), {})).toBe(true)
  })
  it('all: fails when one condition fails', () => {
    const rule = makeRule({
      conditionMatch: 'all',
      conditions: [
        { field: 'price', op: 'gt', value: '1000000' },
        { field: 'area', op: 'eq', value: 'Bend' },
      ],
    })
    expect(ruleMatches(rule, { price: 1500000, area: 'Sisters' })).toBe(false)
  })
  it('any: passes when one condition passes', () => {
    const rule = makeRule({
      conditionMatch: 'any',
      conditions: [
        { field: 'price', op: 'gt', value: '1000000' },
        { field: 'area', op: 'eq', value: 'Bend' },
      ],
    })
    expect(ruleMatches(rule, { price: 500000, area: 'Bend' })).toBe(true)
  })
})

// ── resolveLeadFlow ──────────────────────────────────────────────────────────

const makeFlow = (overrides: Partial<LeadFlow> = {}): LeadFlow => ({
  id: 1,
  source: 'seller-lp',
  displayName: 'Seller LP',
  assignedBrokerSlug: 'matt',
  assignedGroupId: null,
  assignedPondId: null,
  automationId: null,
  archived: false,
  rules: [],
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

describe('resolveLeadFlow', () => {
  it('no rules → returns flow default broker', () => {
    const result = resolveLeadFlow(makeFlow({ assignedBrokerSlug: 'rebecca' }), [], {})
    expect(result).toEqual<DistributionTarget>({ kind: 'broker', slug: 'rebecca' })
  })

  it('no rules → returns group when flow targets a group', () => {
    const flow = makeFlow({ assignedBrokerSlug: null, assignedGroupId: 7 })
    expect(resolveLeadFlow(flow, [], {})).toEqual<DistributionTarget>({ kind: 'group', groupId: 7 })
  })

  it('no rules → returns pond when flow targets a pond', () => {
    const flow = makeFlow({ assignedBrokerSlug: null, assignedPondId: 3 })
    expect(resolveLeadFlow(flow, [], {})).toEqual<DistributionTarget>({ kind: 'pond', pondId: 3 })
  })

  it('first matching rule wins', () => {
    const flow = makeFlow({ assignedBrokerSlug: 'matt' })
    const rules: LeadFlowRule[] = [
      makeRule({ id: 1, position: 0, conditions: [{ field: 'price', op: 'gt', value: '1000000' }], assignedBrokerSlug: 'paul' }),
      makeRule({ id: 2, position: 1, conditions: [{ field: 'area', op: 'eq', value: 'Bend' }], assignedBrokerSlug: 'rebecca' }),
    ]
    // price=1.5M matches first rule → paul
    expect(resolveLeadFlow(flow, rules, { price: 1500000 })).toEqual<DistributionTarget>({ kind: 'broker', slug: 'paul' })
  })

  it('skips non-matching rules and uses second match', () => {
    const flow = makeFlow({ assignedBrokerSlug: 'matt' })
    const rules: LeadFlowRule[] = [
      makeRule({ id: 1, position: 0, conditions: [{ field: 'price', op: 'gt', value: '1000000' }], assignedBrokerSlug: 'paul' }),
      makeRule({ id: 2, position: 1, conditions: [{ field: 'area', op: 'eq', value: 'Bend' }], assignedBrokerSlug: 'rebecca' }),
    ]
    // price=400k misses first rule; area=Bend matches second → rebecca
    expect(resolveLeadFlow(flow, rules, { price: 400000, area: 'Bend' })).toEqual<DistributionTarget>({ kind: 'broker', slug: 'rebecca' })
  })

  it('no matching rule → falls back to flow default', () => {
    const flow = makeFlow({ assignedBrokerSlug: 'matt' })
    const rules: LeadFlowRule[] = [
      makeRule({ id: 1, position: 0, conditions: [{ field: 'price', op: 'gt', value: '1000000' }], assignedBrokerSlug: 'paul' }),
    ]
    // price=400k → no match → matt (flow default)
    expect(resolveLeadFlow(flow, rules, { price: 400000 })).toEqual<DistributionTarget>({ kind: 'broker', slug: 'matt' })
  })

  it('unconditional rule always matches regardless of context', () => {
    const flow = makeFlow({ assignedBrokerSlug: 'matt' })
    const rules: LeadFlowRule[] = [
      makeRule({ id: 1, position: 0, conditions: [], assignedBrokerSlug: 'paul' }),
    ]
    expect(resolveLeadFlow(flow, rules, { price: 400000 })).toEqual<DistributionTarget>({ kind: 'broker', slug: 'paul' })
  })

  it('rule targeting a group returns group kind', () => {
    const flow = makeFlow({ assignedBrokerSlug: 'matt' })
    const rules: LeadFlowRule[] = [
      makeRule({ id: 1, position: 0, conditions: [], assignedBrokerSlug: null, assignedGroupId: 5 }),
    ]
    expect(resolveLeadFlow(flow, rules, {})).toEqual<DistributionTarget>({ kind: 'group', groupId: 5 })
  })

  it('rule targeting a pond returns pond kind', () => {
    const flow = makeFlow({ assignedBrokerSlug: 'matt' })
    const rules: LeadFlowRule[] = [
      makeRule({ id: 1, position: 0, conditions: [], assignedBrokerSlug: null, assignedPondId: 2 }),
    ]
    expect(resolveLeadFlow(flow, rules, {})).toEqual<DistributionTarget>({ kind: 'pond', pondId: 2 })
  })
})
