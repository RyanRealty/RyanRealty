import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getFubApiKey, fubAuthHeader, fubAuthHeaderTrimmed } from './fub-env'

// FUB DECOMMISSIONED (cutover 2026-06-24): getFubApiKey returns undefined
// unconditionally so every FollowUp Boss API path no-ops. The auth-header
// builders therefore always throw. These tests lock that kill-switch behavior.
const ORIG = { fb: process.env.FOLLOWUPBOSS_API_KEY, fub: process.env.FUB_API_KEY }
beforeEach(() => {
  process.env.FOLLOWUPBOSS_API_KEY = 'whatever-it-is-ignored'
  process.env.FUB_API_KEY = 'also-ignored'
})
afterEach(() => {
  if (ORIG.fb === undefined) delete process.env.FOLLOWUPBOSS_API_KEY
  else process.env.FOLLOWUPBOSS_API_KEY = ORIG.fb
  if (ORIG.fub === undefined) delete process.env.FUB_API_KEY
  else process.env.FUB_API_KEY = ORIG.fub
})

describe('getFubApiKey — decommissioned', () => {
  it('returns undefined even when env keys are set (FUB is off)', () => {
    expect(getFubApiKey()).toBeUndefined()
  })
})

describe('fub auth headers — always throw post-decommission', () => {
  it('fubAuthHeader throws (no key)', () => {
    expect(() => fubAuthHeader()).toThrow(/FollowUpBoss API key not configured/)
  })
  it('fubAuthHeaderTrimmed throws (no key)', () => {
    expect(() => fubAuthHeaderTrimmed()).toThrow(/FollowUpBoss API key not configured/)
  })
})
