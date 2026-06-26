/**
 * conditions-eval — pure evaluator for ConditionNode predicates.
 *
 * Takes a ConditionNode and a minimal person snapshot and returns true/false.
 * Pure: no I/O, no DB, no side effects. Safe to unit-test and call from
 * the engine without worrying about latency or retry semantics.
 *
 * Person shape:
 *   stage?  — string (the crm_people.stage value at evaluation time)
 *   tags?   — string[] (crm_people.tags)
 *   source? — string (crm_people.source)
 *
 * Condition fields:
 *   'stage'   → person.stage
 *   'tag'     → person.tags[] membership
 *   'source'  → person.source
 *
 * Condition ops:
 *   'is'       → exact case-insensitive match (for tag: ANY tag equals value)
 *   'is_not'   → inverse of 'is'
 *   'contains' → case-insensitive substring (for tag: ANY tag contains value)
 */

import type { ConditionNode } from '@/lib/crm/sequence-step-schema'

export type ConditionPerson = {
  stage?: string | null
  tags?: string[] | null
  source?: string | null
}

/**
 * evaluateCondition — evaluate one ConditionNode against a person snapshot.
 * Returns true when the IF-branch should execute, false for the ELSE-branch.
 *
 * Fails SAFE (returns false) on any malformed input so an engine crash never
 * happens due to a bad condition in the steps jsonb.
 */
export function evaluateCondition(cond: ConditionNode, person: ConditionPerson): boolean {
  try {
    const { field, op, value: needle } = cond
    const n = (needle ?? '').trim().toLowerCase()

    switch (field) {
      case 'stage': {
        const actual = (person.stage ?? '').trim().toLowerCase()
        return applyOp(op, actual, n)
      }
      case 'source': {
        const actual = (person.source ?? '').trim().toLowerCase()
        return applyOp(op, actual, n)
      }
      case 'tag': {
        const tags = (person.tags ?? []).map((t) => t.trim().toLowerCase())
        // For tags, 'is' = any tag in the array exactly equals the needle.
        // 'contains' = any tag contains the needle as a substring.
        // 'is_not' = no tag exactly equals the needle.
        if (op === 'is') return tags.some((t) => t === n)
        if (op === 'is_not') return !tags.some((t) => t === n)
        if (op === 'contains') return tags.some((t) => t.includes(n))
        return false
      }
      default:
        // Unknown field → fail safe
        return false
    }
  } catch {
    // Any runtime error → fail safe (engine takes the false/else branch)
    return false
  }
}

function applyOp(op: string, actual: string, needle: string): boolean {
  switch (op) {
    case 'is':
      return actual === needle
    case 'is_not':
      return actual !== needle
    case 'contains':
      return actual.includes(needle)
    default:
      return false
  }
}

/**
 * resolveConditionPath — convenience wrapper used by the engine.
 * Returns the steps from truePath or falsePath based on the evaluation.
 */
export function resolveConditionPath(
  cond: ConditionNode,
  person: ConditionPerson,
): typeof cond.truePath {
  return evaluateCondition(cond, person) ? cond.truePath : cond.falsePath
}
