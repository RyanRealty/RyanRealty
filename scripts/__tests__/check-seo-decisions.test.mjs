import { describe, expect, it } from 'vitest'
import { changedDecisions, shapeProblems } from '../check-seo-decisions.mjs'

const d = (id, path, expect_) => ({ id, path, expect: expect_, decided: 'Matt', why: 'x' })
const before = { decisions: [d('a', '/cities/sunriver', { status: 301 }), d('b', '/', { title: '^Ryan' })] }

describe('changedDecisions', () => {
  it('lets an entry be added freely', () => {
    expect(changedDecisions(before, { decisions: [...before.decisions, d('c', '/x', { status: 200 })] })).toEqual([])
  })
  it('flags a removed entry and a loosened one', () => {
    const after = { decisions: [d('b', '/', { title: '.*' })] }
    expect(changedDecisions(before, after)).toEqual(['a: removed', 'b: changed'])
  })
})

describe('shapeProblems', () => {
  it('passes the real file shape and fails a duplicate id', () => {
    expect(shapeProblems(before)).toEqual([])
    expect(shapeProblems({ decisions: [d('a', '/', { status: 200 }), d('a', '/y', { status: 200 })] })[0]).toMatch(/duplicate/)
  })
})
