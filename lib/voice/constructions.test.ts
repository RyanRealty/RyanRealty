/**
 * The runtime construction gate. D11: the mechanical gate is punctuation,
 * invented quotes, and Value my home. Taste is named exemplars, not regex.
 */
import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from './check'

describe('runtime construction gate', () => {
  it('blocks an invented quote under a name', () => {
    const r = checkBrandVoice(
      '"This is the most room buyers have had in years," said Matt Ryan, principal broker.',
    )
    expect(r.ok).toBe(false)
    expect(r.violations.some((v) => v.kind === 'construction')).toBe(true)
    expect(r.violations.some((v) => /invented-attribution/.test(v.term))).toBe(true)
  })

  it('passes a short judgment in our voice with no invented quote', () => {
    const r = checkBrandVoice(
      'The second listing succeeds by correcting the first ask, not defending it.',
    )
    expect(r.ok).toBe(true)
  })

  it('passes clean canon-compliant copy', () => {
    const r = checkBrandVoice(
      '131 homes are for sale in Bend between $504,000 and $616,000. The median one has been listed 53 days. 68 more are pending in the same band.',
    )
    expect(r.ok).toBe(true)
  })

  it('passes a plain report sentence with a number and its source', () => {
    const r = checkBrandVoice(
      'April homes went pending in 9 days. December homes took 39. Based on 7,205 sales closed in Bend since August 2023.',
    )
    expect(r.ok).toBe(true)
  })

  it('names the rule and the fix so the writer knows what to do', () => {
    const r = checkBrandVoice(
      '"Price it to the comps," said Matt Ryan, principal broker.',
    )
    const hit = r.violations.find((v) => v.kind === 'construction')
    expect(hit?.term).toMatch(/rule \d/)
  })
})
