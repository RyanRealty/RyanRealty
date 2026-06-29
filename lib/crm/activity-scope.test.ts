import { describe, it, expect } from 'vitest'
import { resolveActivityScope } from './activity-scope'

describe('resolveActivityScope — Activity feed broker scope', () => {
  it('a restricted broker is locked to their own leads regardless of request', () => {
    expect(resolveActivityScope('paul', 'all')).toBe('paul')
    expect(resolveActivityScope('paul', 'rebecca')).toBe('paul')
    expect(resolveActivityScope('paul', null)).toBe('paul')
    expect(resolveActivityScope('paul', undefined)).toBe('paul')
  })

  it('the owner honors a valid broker filter', () => {
    expect(resolveActivityScope(null, 'matt')).toBe('matt')
    expect(resolveActivityScope(null, 'rebecca')).toBe('rebecca')
  })

  it('the owner sees everyone for all / empty / unknown requests', () => {
    expect(resolveActivityScope(null, 'all')).toBe(null)
    expect(resolveActivityScope(null, null)).toBe(null)
    expect(resolveActivityScope(null, undefined)).toBe(null)
    expect(resolveActivityScope(null, 'not-a-broker')).toBe(null)
  })
})
