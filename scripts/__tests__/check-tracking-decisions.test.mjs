import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { changedDecisions, shapeProblems } from '../check-tracking-decisions.mjs'

const live = (id, fact, equals) => ({ id, decided: 'Matt', why: 'x', check: { fact, equals } })
const before = {
  decisions: [live('a', 'gtm.pageViewOwner', 'GA4 - page_view'), { id: 'b', decided: 'Matt', why: 'x', manual: 'GTM Admin' }],
}

describe('changedDecisions', () => {
  it('lets an entry be added freely', () => {
    const after = { decisions: [...before.decisions, live('c', 'ga4.signals', 'GOOGLE_SIGNALS_ENABLED')] }
    expect(changedDecisions(before, after)).toEqual([])
  })
  it('allows rewording why, and flags a removed or loosened entry', () => {
    expect(changedDecisions(before, { decisions: [{ ...before.decisions[0], why: 'clearer' }, before.decisions[1]] })).toEqual([])
    const after = { decisions: [live('a', 'gtm.pageViewOwner', 'google tag')] }
    expect(changedDecisions(before, after)).toEqual(['a: changed', 'b: removed'])
  })
})

describe('shapeProblems', () => {
  it('passes the committed file', () => {
    expect(shapeProblems(JSON.parse(readFileSync('data/analytics/decisions.json', 'utf8')))).toEqual([])
  })
  it('fails a duplicate id, an entry with two holds, and a code path that does not exist', () => {
    expect(shapeProblems({ decisions: [before.decisions[0], before.decisions[0]] })[0]).toMatch(/duplicate/)
    expect(shapeProblems({ decisions: [{ ...before.decisions[0], manual: 'x' }] })[0]).toMatch(/exactly one of check, code or manual/)
    expect(shapeProblems({ decisions: [{ id: 'c', decided: 'Matt', why: 'x', code: 'no/such/file.ts' }] })[0]).toMatch(/must name a file/)
  })
})
