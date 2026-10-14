import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ga4UserIdAllowedAt, ga4UserIdForEmail, ga4UserIdForPerson } from './ga4-user-id'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

describe('ga4UserIdForPerson: one user id for the browser tag and the server', () => {
  it('is crm-<sha256 of the id>, the string /api/identity/me has always handed the browser', () => {
    expect(ga4UserIdForPerson(64115)).toBe(`crm-${sha('64115')}`)
  })

  it('carries no raw id', () => {
    expect(ga4UserIdForPerson(64115)).not.toContain('64115')
  })

  it.each([null, undefined, 0, -3, 1.5, Number.NaN])('is null for %s', (id) => {
    expect(ga4UserIdForPerson(id as number | null | undefined)).toBeNull()
  })
})

describe('ga4UserIdForEmail', () => {
  it('is em-<sha256 of the normalized email>', () => {
    expect(ga4UserIdForEmail('a@b.co')).toBe(`em-${sha('a@b.co')}`)
  })
})

describe('ga4UserIdAllowedAt: analytics tier or above only', () => {
  it.each([
    ['all', true],
    ['analytics', true],
    ['essential', false],
    ['declined', false],
    [null, false],
    [undefined, false],
  ] as const)('%s -> %s', (level, allowed) => {
    expect(ga4UserIdAllowedAt(level)).toBe(allowed)
  })
})
