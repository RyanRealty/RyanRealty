/**
 * lib/content/process/classify.ts - which rule a refusal is.
 *
 * The factory's evaluators report problems as plain sentences. Each enforced
 * rule carries `fixtureMatch`, a regex its refusal sentence must match, so the
 * same regex names the rule in a stamp: the first enforced rule (in file order,
 * so a specific rule sits before a general one) whose regex matches the
 * sentence. rules.test.ts holds every rule's own fixture to be named by itself.
 */
import { RULES, type Rule } from './rules'
import type { StampProblem } from './stamp'

/**
 * Compiled patterns, by the pattern's own text. A rule's id is not the key: a
 * custom rule list (a test's, a rules file under review) may give two different
 * patterns the same id, and a cache keyed by id would answer with the first.
 */
const compiled = new Map<string, RegExp>()

function regexOf(rule: Rule): RegExp | null {
  if (!rule.fixtureMatch) return null
  let re = compiled.get(rule.fixtureMatch)
  if (!re) {
    re = new RegExp(rule.fixtureMatch, 'i')
    compiled.set(rule.fixtureMatch, re)
  }
  return re
}

/** The enforced rule a problem sentence names, or undefined when none of them does. */
export function ruleFor(problem: string, rules: readonly Rule[] = RULES): Rule | undefined {
  return rules.find((r) => r.status === 'enforced' && regexOf(r)?.test(problem))
}

/** A problem with its rule id (and the rule's check number when the problem has none). */
export function classify(problem: string, check?: number, rules: readonly Rule[] = RULES): StampProblem {
  const rule = ruleFor(problem, rules)
  const out: StampProblem = { problem }
  if (rule) out.rule = rule.id
  const c = check ?? rule?.check
  if (c !== undefined) out.check = c
  return out
}
