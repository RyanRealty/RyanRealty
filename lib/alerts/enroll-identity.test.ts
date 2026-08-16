import { describe, expect, it } from 'vitest'
import { nativeCrmPersonId } from '@/lib/alerts/enroll-identity'

describe('nativeCrmPersonId', () => {
  it('accepts a positive integer crm_people.id', () => {
    expect(nativeCrmPersonId(61854)).toBe(61854)
  })

  it('rejects zero, negative, non-integer, and empty', () => {
    expect(nativeCrmPersonId(0)).toBeNull()
    expect(nativeCrmPersonId(-1)).toBeNull()
    expect(nativeCrmPersonId(1.5)).toBeNull()
    expect(nativeCrmPersonId(null)).toBeNull()
    expect(nativeCrmPersonId(undefined)).toBeNull()
  })
})
