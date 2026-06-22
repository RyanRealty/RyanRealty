import { describe, it, expect } from 'vitest'
import { isSuperuserAdmin } from './admin'

// isSuperuserAdmin gates /admin + the admin-role mutations (audit p0.2d). Must be
// exact + case/whitespace tolerant on the verified session email. Audit p3.2.
describe('isSuperuserAdmin (auth gate)', () => {
  it('matches the superuser email case-insensitively + trimmed', () => {
    expect(isSuperuserAdmin('matt@ryan-realty.com')).toBe(true)
    expect(isSuperuserAdmin('MATT@Ryan-Realty.com')).toBe(true)
    expect(isSuperuserAdmin('  matt@ryan-realty.com  ')).toBe(true)
  })
  it('rejects everyone else + non-strings/empty', () => {
    expect(isSuperuserAdmin('rebecca@ryan-realty.com')).toBe(false)
    expect(isSuperuserAdmin(null)).toBe(false)
    expect(isSuperuserAdmin(undefined)).toBe(false)
    expect(isSuperuserAdmin('')).toBe(false)
    expect(isSuperuserAdmin(123 as unknown as string)).toBe(false)
  })
})
