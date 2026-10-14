/**
 * Which rule a refusal sentence is (classify.ts): the first enforced rule whose
 * fixtureMatch matches, in file order, on whatever rule list it is handed.
 */
import { describe, expect, it } from 'vitest'
import { classify, ruleFor } from './classify'
import type { Rule } from './rules'

const rule = (over: Partial<Rule> & { id: string }): Rule => ({
  title: 't', source: 's', appliesTo: ['video'], step: 'brief', status: 'enforced',
  enforcer: { module: 'lib/m.ts', export: 'f' }, fixture: 'lib/content/process/fixtures/x.json', fixtureMatch: 'x', ...over,
}) as Rule

describe('ruleFor and classify on the real rules', () => {
  it('names the rule a refusal sentence is, with its check', () => {
    const c = classify('runs 41s, over 30s, with no length_reason in the brief')
    expect(c.rule).toBe('R-015')
    expect(typeof c.check).toBe('number')
  })

  it('leaves a sentence no rule names untagged, and keeps the check it was given', () => {
    expect(classify('something nobody wrote a rule for', 7)).toEqual({ problem: 'something nobody wrote a rule for', check: 7 })
    expect(classify('something nobody wrote a rule for')).toEqual({ problem: 'something nobody wrote a rule for' })
  })
})

describe('ruleFor on a custom rule list', () => {
  it('takes the first enforced rule that matches, ignoring case, planned rules and rules with no pattern', () => {
    const rules = [
      rule({ id: 'R-001', status: 'planned', fixtureMatch: 'boom' }),
      rule({ id: 'R-002', fixtureMatch: undefined }),
      rule({ id: 'R-003', fixtureMatch: 'BOOM' }),
      rule({ id: 'R-004', fixtureMatch: 'boom' }),
    ]
    expect(ruleFor('a Boom happened', rules)?.id).toBe('R-003')
    expect(ruleFor('nothing', rules)).toBeUndefined()
  })

  it('does not let a rule id stand for the first pattern it was ever given', () => {
    // Two rule lists that reuse an id for different patterns (a test's list, a rules file under review).
    // A cache keyed by id answered the second list with the first list's pattern.
    const first = [rule({ id: 'R-900', fixtureMatch: 'alpha' })]
    const second = [rule({ id: 'R-900', fixtureMatch: 'beta' })]
    expect(ruleFor('alpha is wrong', first)?.id).toBe('R-900')
    expect(ruleFor('beta is wrong', second)?.id).toBe('R-900')
    expect(ruleFor('alpha is wrong', second)).toBeUndefined()
    expect(ruleFor('beta is wrong', first)).toBeUndefined()
  })

  it('follows a pattern edited on the same rule object', () => {
    const r = rule({ id: 'R-901', fixtureMatch: 'old wording' })
    expect(ruleFor('old wording', [r])?.id).toBe('R-901')
    const edited = { ...r, fixtureMatch: 'new wording' }
    expect(ruleFor('old wording', [edited])).toBeUndefined()
    expect(ruleFor('new wording', [edited])?.id).toBe('R-901')
  })
})
