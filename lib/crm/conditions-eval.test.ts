/**
 * Unit tests for conditions-eval.ts
 *
 * Covers:
 *   - evaluateCondition: all field/op combinations
 *   - Case insensitivity
 *   - Null/missing person fields
 *   - Fail-safe on unknown field / unknown op
 *   - resolveConditionPath returns correct branch
 */

import { describe, it, expect } from 'vitest'
import { evaluateCondition, resolveConditionPath } from './conditions-eval'
import type { ConditionNode } from './sequence-step-schema'

function cond(field: ConditionNode['field'], op: ConditionNode['op'], value: string): ConditionNode {
  return { type: 'condition', field, op, value, truePath: [], falsePath: [] }
}

// ── stage field ───────────────────────────────────────────────────────────────

describe('evaluateCondition — stage field', () => {
  it('is: matches exact stage', () => {
    expect(evaluateCondition(cond('stage', 'is', 'qualified'), { stage: 'qualified' })).toBe(true)
  })

  it('is: does not match different stage', () => {
    expect(evaluateCondition(cond('stage', 'is', 'qualified'), { stage: 'new' })).toBe(false)
  })

  it('is: case-insensitive match', () => {
    expect(evaluateCondition(cond('stage', 'is', 'Qualified'), { stage: 'QUALIFIED' })).toBe(true)
  })

  it('is_not: true when stage differs', () => {
    expect(evaluateCondition(cond('stage', 'is_not', 'closed'), { stage: 'active' })).toBe(true)
  })

  it('is_not: false when stage matches', () => {
    expect(evaluateCondition(cond('stage', 'is_not', 'closed'), { stage: 'closed' })).toBe(false)
  })

  it('contains: true when stage contains substring', () => {
    expect(evaluateCondition(cond('stage', 'contains', 'qual'), { stage: 'qualified' })).toBe(true)
  })

  it('contains: false when stage does not contain substring', () => {
    expect(evaluateCondition(cond('stage', 'contains', 'xyz'), { stage: 'qualified' })).toBe(false)
  })

  it('null stage treated as empty string', () => {
    expect(evaluateCondition(cond('stage', 'is', 'new'), { stage: null })).toBe(false)
  })

  it('undefined stage treated as empty string', () => {
    expect(evaluateCondition(cond('stage', 'is', ''), {})).toBe(true)
  })
})

// ── source field ──────────────────────────────────────────────────────────────

describe('evaluateCondition — source field', () => {
  it('is: matches exact source', () => {
    expect(evaluateCondition(cond('source', 'is', 'zillow'), { source: 'zillow' })).toBe(true)
  })

  it('is: case-insensitive', () => {
    expect(evaluateCondition(cond('source', 'is', 'Zillow'), { source: 'zillow' })).toBe(true)
  })

  it('is_not: returns true when source differs', () => {
    expect(evaluateCondition(cond('source', 'is_not', 'zillow'), { source: 'realtor' })).toBe(true)
  })

  it('contains: true on substring', () => {
    expect(evaluateCondition(cond('source', 'contains', 'zill'), { source: 'zillow-lead' })).toBe(true)
  })

  it('null source treated as empty string', () => {
    expect(evaluateCondition(cond('source', 'is', 'zillow'), { source: null })).toBe(false)
  })
})

// ── tag field ─────────────────────────────────────────────────────────────────

describe('evaluateCondition — tag field', () => {
  const person = { tags: ['audience:buyer', 'intent:active', 'source:zillow'] }

  it('is: true when any tag exactly matches', () => {
    expect(evaluateCondition(cond('tag', 'is', 'audience:buyer'), person)).toBe(true)
  })

  it('is: false when no tag matches', () => {
    expect(evaluateCondition(cond('tag', 'is', 'audience:seller'), person)).toBe(false)
  })

  it('is: case-insensitive', () => {
    expect(evaluateCondition(cond('tag', 'is', 'AUDIENCE:BUYER'), person)).toBe(true)
  })

  it('is_not: true when no tag matches', () => {
    expect(evaluateCondition(cond('tag', 'is_not', 'audience:seller'), person)).toBe(true)
  })

  it('is_not: false when a tag matches', () => {
    expect(evaluateCondition(cond('tag', 'is_not', 'audience:buyer'), person)).toBe(false)
  })

  it('contains: true when any tag contains the substring', () => {
    expect(evaluateCondition(cond('tag', 'contains', 'zillow'), person)).toBe(true)
  })

  it('contains: false when no tag contains the substring', () => {
    expect(evaluateCondition(cond('tag', 'contains', 'facebook'), person)).toBe(false)
  })

  it('null tags treated as empty array', () => {
    expect(evaluateCondition(cond('tag', 'is', 'audience:buyer'), { tags: null })).toBe(false)
  })

  it('undefined tags treated as empty array', () => {
    expect(evaluateCondition(cond('tag', 'is', 'audience:buyer'), {})).toBe(false)
  })
})

// ── Fail-safe behavior ────────────────────────────────────────────────────────

describe('evaluateCondition — fail-safe', () => {
  it('returns false for an unknown field', () => {
    // Cast to bypass TS to simulate a malformed stored node
    const bad = { type: 'condition' as const, field: 'unknown_field' as ConditionNode['field'], op: 'is' as const, value: 'x', truePath: [], falsePath: [] }
    expect(evaluateCondition(bad, { stage: 'active' })).toBe(false)
  })

  it('returns false for an unknown op', () => {
    const bad = { type: 'condition' as const, field: 'stage' as const, op: 'greater_than' as ConditionNode['op'], value: 'x', truePath: [], falsePath: [] }
    expect(evaluateCondition(bad, { stage: 'x' })).toBe(false)
  })
})

// ── resolveConditionPath ──────────────────────────────────────────────────────

describe('resolveConditionPath', () => {
  const trueStep = { channel: 'email' as const, body: 'true path email' }
  const falseStep = { channel: 'task' as const, taskName: 'false path task' }

  const node: ConditionNode = {
    type: 'condition',
    field: 'stage',
    op: 'is',
    value: 'qualified',
    truePath: [trueStep],
    falsePath: [falseStep],
  }

  it('returns truePath when condition evaluates true', () => {
    const path = resolveConditionPath(node, { stage: 'qualified' })
    expect(path).toHaveLength(1)
    expect((path[0] as any).body).toBe('true path email')
  })

  it('returns falsePath when condition evaluates false', () => {
    const path = resolveConditionPath(node, { stage: 'new' })
    expect(path).toHaveLength(1)
    expect((path[0] as any).taskName).toBe('false path task')
  })

  it('returns empty truePath (no steps on that branch)', () => {
    const nodeNoTrue: ConditionNode = { ...node, truePath: [] }
    const path = resolveConditionPath(nodeNoTrue, { stage: 'qualified' })
    expect(path).toHaveLength(0)
  })
})
