import { describe, expect, it } from 'vitest'
import {
  cmaConsentNeedsReset,
  planPersonChannelConsentEdit,
  readCmaConsent,
  readPersonChannelConsent,
  resetCmaConsentAllowed,
} from './person-channel-consent'

const DECLINED_CMA = { sms: false, email: false, slug: 'cma-test', consentVersion: 'a2p-2026-06' }

describe('readCmaConsent', () => {
  it('reads sms and email from custom.cmaConsent', () => {
    expect(readCmaConsent({ cmaConsent: DECLINED_CMA })).toMatchObject({ sms: false, email: false, slug: 'cma-test' })
    expect(readCmaConsent({ cmaConsent: { sms: true, email: true } })).toMatchObject({ sms: true, email: true })
    expect(readCmaConsent({})).toBeNull()
  })

  it('needs a reset only when a recorded CMA answer declined a channel', () => {
    expect(cmaConsentNeedsReset(readCmaConsent({ cmaConsent: DECLINED_CMA }))).toBe(true)
    expect(cmaConsentNeedsReset(resetCmaConsentAllowed({ ...DECLINED_CMA, sms: false, email: false }))).toBe(false)
    expect(cmaConsentNeedsReset(null)).toBe(false)
  })
})

describe('readPersonChannelConsent', () => {
  it('treats CMA sms:false and sms-consent:no as declined SMS', () => {
    const view = readPersonChannelConsent({
      tags: ['sms-consent:no', 'broker:matt'],
      custom: { cmaConsent: DECLINED_CMA },
      suppressions: [],
    })
    expect(view.sms.allowed).toBe(false)
    expect(view.email.allowed).toBe(false)
    expect(view.call.allowed).toBe(true)
    expect(view.sms.lockedReason).toBeNull()
  })

  it('locks SMS on STOP and email on unsubscribe', () => {
    const view = readPersonChannelConsent({
      tags: [],
      custom: { cmaConsent: { sms: true, email: true } },
      suppressions: [
        { channel: 'sms', reason: 'stop-keyword' },
        { channel: 'email', reason: 'unsubscribe' },
      ],
    })
    expect(view.sms.allowed).toBe(false)
    expect(view.sms.lockedReason).toBe('stop-keyword')
    expect(view.email.allowed).toBe(false)
    expect(view.email.lockedReason).toBe('unsubscribe')
  })
})

describe('planPersonChannelConsentEdit', () => {
  it('sets SMS and email CMA consent back to allowed and clears declined-SMS tags', () => {
    const out = planPersonChannelConsentEdit({
      channel: 'sms',
      allowed: true,
      tags: ['sms-consent:no', 'contact:do-not-text', 'broker:matt'],
      custom: { cmaConsent: DECLINED_CMA },
      suppressions: [{ id: 12, channel: 'sms', reason: 'no-sms-consent' }],
    })
    expect(out.action).toBe('apply')
    expect(out.nextCmaConsent).toMatchObject({ sms: true, email: false })
    expect(out.nextTags).toContain('sms-consent:yes')
    expect(out.nextTags).toContain('broker:matt')
    expect(out.nextTags).not.toContain('sms-consent:no')
    expect(out.nextTags).not.toContain('contact:do-not-text')
    expect(out.suppressionIdsToClear).toEqual([12])
    expect(out.noteTitle).toMatch(/SMS consent set to allowed/)
  })

  it('refuses to allow SMS when STOP is on file', () => {
    const out = planPersonChannelConsentEdit({
      channel: 'sms',
      allowed: true,
      tags: [],
      custom: { cmaConsent: { sms: false, email: true } },
      suppressions: [{ id: 9, channel: 'sms', reason: 'stop-keyword' }],
    })
    expect(out.action).toBe('refuse')
    if (out.action === 'refuse') expect(out.refuseReason).toBe('stop-keyword')
    expect(out.noteTitle).toBeNull()
  })

  it('declining call adds DNC and writes a timeline plan', () => {
    const out = planPersonChannelConsentEdit({
      channel: 'call',
      allowed: false,
      tags: ['broker:matt'],
      custom: {},
      suppressions: [],
    })
    expect(out.action).toBe('apply')
    expect(out.nextTags).toContain('contact:do-not-call')
    expect(out.addSuppression).toEqual({ channel: 'call', reason: 'do-not-call' })
    expect(out.noteTitle).toMatch(/Call consent set to declined/)
  })
})
