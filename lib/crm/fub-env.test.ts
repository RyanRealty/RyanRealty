import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getFubApiKey } from './fub-env'

// FUB DECOMMISSIONED (cutover 2026-06-24): getFubApiKey returns undefined
// unconditionally so every FollowUp Boss API path no-ops. This test locks that
// kill-switch behavior. (The always-throwing auth-header builders were deleted
// 2026-07-14 — dead code with zero non-test callers.)
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
