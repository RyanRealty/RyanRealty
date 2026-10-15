import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ga4UserIdAllowedAt, ga4UserIdFor, ga4UserIdForEmail, ga4UserIdForPerson } from './ga4-user-id'

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

describe('ga4UserIdFor: the one decision fireGa4Event applies', () => {
  it('is the hashed id at the analytics tier or above, else null', () => {
    expect(ga4UserIdFor(64115, 'analytics')).toBe(ga4UserIdForPerson(64115))
    expect(ga4UserIdFor(64115, 'all')).toBe(ga4UserIdForPerson(64115))
    expect(ga4UserIdFor(64115, 'essential')).toBeNull()
    expect(ga4UserIdFor(64115, 'declined')).toBeNull()
    expect(ga4UserIdFor(null, 'all')).toBeNull()
  })
})

describe('every server sender of a known contact\'s event passes knownContact (decision known-contact-user-id-server-events)', () => {
  it.each([
    ['app/api/visitors/track/route.ts', /knownContact: \{ personId: knownPersonId, trackingLevel: consent \}/],
    ['lib/lead-tracking.ts', /knownContact: ga4KnownContact\(ctx,/],
    ['app/actions/identity-bridge.ts', /knownContact: ga4KnownContact\(ga4\.ctx, id\)/],
    ['lib/cma-request.ts', /knownContact: ga4KnownContact\(ga4\.ctx, linkedPersonId\)/],
  ])('%s', async (file, re) => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync(file, 'utf8')).toMatch(re)
  })

  it('no caller builds a user_id itself: only fireGa4Event derives it', async () => {
    const { readFileSync } = await import('node:fs')
    for (const file of ['app/api/visitors/track/route.ts', 'lib/lead-tracking.ts', 'app/actions/identity-bridge.ts', 'lib/cma-request.ts']) {
      const calls = readFileSync(file, 'utf8').split('fireGa4Event(').slice(1)
      expect(calls.length).toBeGreaterThan(0)
      // the argument object of each call: its first 40 lines
      for (const call of calls) expect(call.split('\n').slice(0, 40).join('\n')).not.toMatch(/\buser_?[iI]d\s*:/)
    }
  })
})
