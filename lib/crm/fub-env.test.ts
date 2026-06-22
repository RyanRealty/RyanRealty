import { describe, it, expect, beforeEach } from 'vitest'
import { getFubApiKey, fubAuthHeader, fubAuthHeaderTrimmed } from './fub-env'

beforeEach(() => {
  delete process.env.FOLLOWUPBOSS_API_KEY
  delete process.env.FUB_API_KEY
})

describe('getFubApiKey (audit p1.2 — either env name works)', () => {
  it('prefers FOLLOWUPBOSS_API_KEY', () => {
    process.env.FOLLOWUPBOSS_API_KEY = 'primary'
    process.env.FUB_API_KEY = 'secondary'
    expect(getFubApiKey()).toBe('primary')
  })
  it('falls back to FUB_API_KEY when FOLLOWUPBOSS_API_KEY is unset', () => {
    process.env.FUB_API_KEY = 'secondary'
    expect(getFubApiKey()).toBe('secondary')
  })
  it('is undefined when neither is set', () => {
    expect(getFubApiKey()).toBeUndefined()
  })
})

describe('fubAuthHeader', () => {
  it('builds the Basic-auth header from the key', () => {
    process.env.FOLLOWUPBOSS_API_KEY = 'abc'
    expect(fubAuthHeader()).toBe(`Basic ${Buffer.from('abc:').toString('base64')}`)
  })
  it('throws a clear error when no key is configured', () => {
    expect(() => fubAuthHeader()).toThrow(/FollowUpBoss API key not configured/)
  })
})

describe('fubAuthHeaderTrimmed (byte-identity guardrail for the deferred 3-client merge)', () => {
  // The exact construction the three hand-rolled FUB clients use today.
  const clientHeader = (raw: string) =>
    `Basic ${Buffer.from(`${raw.trim()}:`).toString('base64')}`

  it('equals each client header byte-for-byte for a clean key', () => {
    process.env.FOLLOWUPBOSS_API_KEY = 'abc'
    expect(fubAuthHeaderTrimmed()).toBe(clientHeader('abc'))
  })

  it('equals each client header byte-for-byte for a whitespace-padded key', () => {
    process.env.FOLLOWUPBOSS_API_KEY = '  abc  '
    expect(fubAuthHeaderTrimmed()).toBe(clientHeader('  abc  '))
    expect(fubAuthHeaderTrimmed()).toBe(`Basic ${Buffer.from('abc:').toString('base64')}`)
  })

  it('DIFFERS from the untrimmed fubAuthHeader on a padded key (the merge blocker)', () => {
    process.env.FOLLOWUPBOSS_API_KEY = '  abc  '
    expect(fubAuthHeader()).toBe(`Basic ${Buffer.from('  abc  :').toString('base64')}`)
    expect(fubAuthHeaderTrimmed()).not.toBe(fubAuthHeader())
  })

  it('agrees with fubAuthHeader when the key has no surrounding whitespace', () => {
    process.env.FOLLOWUPBOSS_API_KEY = 'abc'
    expect(fubAuthHeaderTrimmed()).toBe(fubAuthHeader())
  })

  it('throws when no key (or a whitespace-only key) is configured', () => {
    expect(() => fubAuthHeaderTrimmed()).toThrow(/FollowUpBoss API key not configured/)
    process.env.FOLLOWUPBOSS_API_KEY = '   '
    expect(() => fubAuthHeaderTrimmed()).toThrow(/FollowUpBoss API key not configured/)
  })
})
