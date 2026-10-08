import { describe, expect, it } from 'vitest'
import { streetKey } from '@/lib/pricing/price-anchor'

describe('streetKey keeps every word that names the street', () => {
  it('drops the number, directional, suffix and city tail', () => {
    expect(streetKey('23 Benaiah')).toBe('benaiah')
    expect(streetKey('23 NW Benaiah Ave')).toBe('benaiah')
    expect(streetKey('3062 NW Kelly Hill, Bend, OR 97703')).toBe('kelly hill')
    expect(streetKey('3080 Kelly Hill Dr.')).toBe('kelly hill')
  })

  it('never makes two streets one because they share a first word', () => {
    expect(streetKey('20886 King David Ave')).not.toBe(streetKey('61325 King Josiah Pl'))
    expect(streetKey('20877 King Hezekiah Way')).not.toBe(streetKey('20886 King David Ave'))
    expect(streetKey('2068 NW Cascade View Dr')).not.toBe(streetKey('1500 Cascade Ave'))
  })

  it('ignores a unit designator', () => {
    expect(streetKey('1600 SW Mt Washington Dr Unit 4')).toBe('mt washington')
    expect(streetKey('1600 Mt Washington Dr #12')).toBe('mt washington')
  })

  it('returns null for a blank address', () => {
    expect(streetKey('')).toBeNull()
    expect(streetKey(null)).toBeNull()
  })
})
