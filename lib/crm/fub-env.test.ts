import { describe, it, expect, beforeEach } from 'vitest'
import { getFubApiKey, fubAuthHeader } from './fub-env'

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
