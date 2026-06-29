import { describe, it, expect } from 'vitest'
import { dealInScope } from './deal-scope'

describe('dealInScope — deal mutation broker-scope guard', () => {
  it('owner / superuser (null scope) may touch any deal', () => {
    expect(dealInScope(null, 'paul', null)).toBe(true)
    expect(dealInScope(null, null, 'rebecca')).toBe(true)
    expect(dealInScope(null, null, null)).toBe(true)
  })

  it('a restricted broker may mutate a deal assigned directly to them', () => {
    expect(dealInScope('paul', 'paul', null)).toBe(true)
  })

  it('a restricted broker may mutate a deal whose linked person is theirs', () => {
    expect(dealInScope('paul', null, 'paul')).toBe(true)
  })

  it('a restricted broker is REFUSED another broker’s deal (financials protected)', () => {
    expect(dealInScope('rebecca', 'paul', null)).toBe(false)
    expect(dealInScope('rebecca', null, 'paul')).toBe(false)
    expect(dealInScope('rebecca', 'paul', 'paul')).toBe(false)
  })

  it('a restricted broker is refused an unowned deal (no deal broker, no person)', () => {
    expect(dealInScope('paul', null, null)).toBe(false)
  })
})
