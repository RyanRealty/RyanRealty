import { describe, it, expect } from 'vitest'
import { nestedRate, isNestedSubset, clientVerdictTone } from './salesFunnelMath'

describe('nestedRate', () => {
  it('returns part / whole', () => {
    expect(nestedRate(25, 100)).toBe(0.25)
  })

  it('is null on a zero denominator, never 0%', () => {
    expect(nestedRate(0, 0)).toBeNull()
    expect(nestedRate(4, 0)).toBeNull()
  })

  it('clamps negative parts to 0', () => {
    expect(nestedRate(-1, 10)).toBe(0)
  })
})

describe('isNestedSubset', () => {
  it('is true when part is inside whole', () => {
    expect(isNestedSubset(3, 10)).toBe(true)
    expect(isNestedSubset(10, 10)).toBe(true)
    expect(isNestedSubset(11, 10)).toBe(false)
  })
})

describe('clientVerdictTone', () => {
  it('is attention when leads exist and none signed', () => {
    expect(clientVerdictTone({ leads: 12, clients: 0, clientUnmeasured: false })).toBe('attention')
  })

  it('is ok when the window has no leads', () => {
    expect(clientVerdictTone({ leads: 0, clients: 0, clientUnmeasured: false })).toBe('ok')
  })

  it('is ok when some of the cohort signed', () => {
    expect(clientVerdictTone({ leads: 12, clients: 1, clientUnmeasured: false })).toBe('ok')
  })

  it('does not treat an unmeasured buyer-rep hole as a signed-client failure', () => {
    expect(clientVerdictTone({ leads: 8, clients: null, clientUnmeasured: true })).toBe('ok')
  })
})
