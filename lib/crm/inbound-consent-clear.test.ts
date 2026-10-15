import { describe, expect, it } from 'vitest'
import {
  isSmsStopKeyword,
  isClearableContactTag,
  isClearablePhoneSuppression,
  isBrokerFlagTag,
  planInboundConsentClear,
  inboundConsentDedupeKey,
  type InboundConsentEvent,
  type InboundConsentSuppression,
} from './inbound-consent-clear'

const DNC_TAGS = ['contact:do-not-call', 'contact:do-not-text', 'broker:matt', 'unsubscribed']
const DNC_SUPPRESSIONS: InboundConsentSuppression[] = [
  { id: 11, channel: 'call', reason: 'contact:do-not-call' },
  { id: 12, channel: 'sms', reason: 'no-sms-consent' },
  { id: 13, channel: 'email', reason: 'unsubscribe' },
  { id: 14, channel: 'sms', reason: 'stop-keyword' },
]

function plan(over: {
  event: InboundConsentEvent
  smsBody?: string | null
  hasTrackedSend?: boolean
  tags?: string[]
  suppressions?: InboundConsentSuppression[]
  eventId?: string | null
  custom?: unknown
}) {
  return planInboundConsentClear({
    event: over.event,
    smsBody: over.smsBody ?? null,
    hasTrackedSend: over.hasTrackedSend ?? true,
    tags: over.tags ?? DNC_TAGS,
    suppressions: over.suppressions ?? DNC_SUPPRESSIONS,
    eventId: over.eventId ?? 'evt-1',
    custom: over.custom,
  })
}

describe('isSmsStopKeyword', () => {
  it.each(['STOP', 'stopall', 'UNSUBSCRIBE', 'Cancel', 'END', 'QUIT', 'STOP ALL'])(
    'treats %s as a TCPA opt-out',
    (body) => {
      expect(isSmsStopKeyword(body)).toBe(true)
    },
  )

  it('does not treat a normal reply as STOP', () => {
    expect(isSmsStopKeyword('Please call me about the CMA')).toBe(false)
    expect(isSmsStopKeyword('')).toBe(false)
    expect(isSmsStopKeyword(null)).toBe(false)
  })
})

describe('clearable vs protected flags', () => {
  it('clears DNC / no-SMS contact tags and leaves broker + email unsubscribe', () => {
    expect(isClearableContactTag('contact:do-not-call')).toBe(true)
    expect(isClearableContactTag('contact:do-not-text')).toBe(true)
    expect(isClearableContactTag('compliance:dnc-registry')).toBe(true)
    expect(isClearableContactTag('sms-consent:no')).toBe(true)
    expect(isClearableContactTag('broker:matt')).toBe(false)
    expect(isClearableContactTag('unsubscribed')).toBe(false)
    expect(isClearableContactTag('compliance:hard-stop')).toBe(false)
    expect(isBrokerFlagTag('broker:rebecca')).toBe(true)
  })

  it('clears phone DNC / no-SMS suppressions and never email unsubscribe or STOP', () => {
    expect(isClearablePhoneSuppression({ channel: 'sms', reason: 'no-sms-consent' })).toBe(true)
    expect(isClearablePhoneSuppression({ channel: 'call', reason: 'contact:do-not-call' })).toBe(true)
    expect(isClearablePhoneSuppression({ channel: 'email', reason: 'unsubscribe' })).toBe(false)
    expect(isClearablePhoneSuppression({ channel: 'sms', reason: 'stop-keyword' })).toBe(false)
    expect(isClearablePhoneSuppression({ channel: 'all', reason: 'compliance:hard-stop' })).toBe(false)
  })
})

describe('planInboundConsentClear — Matt 2026-10-14 inbound consent', () => {
  it('call clears DNC / no-SMS flags after a tracked send and leaves broker + unsubscribe', () => {
    const out = plan({ event: 'call', eventId: 'CA123' })
    expect(out.action).toBe('clear')
    expect(out.tagsToRemove).toEqual(['contact:do-not-call', 'contact:do-not-text'])
    expect(out.nextTags).toEqual(['broker:matt', 'unsubscribed'])
    expect(out.suppressionIdsToClear.sort()).toEqual([11, 12])
    expect(out.noteTitle).toMatch(/inbound call/i)
    expect(out.noteBody).toContain('contact:do-not-call')
    expect(out.noteBody).toContain('CA123')
    expect(out.noteBody).toContain('Broker flags and the email unsubscribe flag were left in place')
  })

  it('voicemail clears the same flags after a tracked send', () => {
    const out = plan({ event: 'voicemail', eventId: 'CAvm' })
    expect(out.action).toBe('clear')
    expect(out.tagsToRemove).toEqual(['contact:do-not-call', 'contact:do-not-text'])
    expect(out.suppressionIdsToClear.sort()).toEqual([11, 12])
    expect(out.noteTitle).toMatch(/voicemail/i)
  })

  it('SMS clears the same flags after a tracked send', () => {
    const out = plan({ event: 'sms', smsBody: 'Can you call me?', eventId: 'SMhi' })
    expect(out.action).toBe('clear')
    expect(out.tagsToRemove).toEqual(['contact:do-not-call', 'contact:do-not-text'])
    expect(out.suppressionIdsToClear.sort()).toEqual([11, 12])
    expect(out.noteTitle).toMatch(/inbound SMS/i)
  })

  it('email reply clears the same flags after a tracked send', () => {
    const out = plan({ event: 'email', eventId: 'msg-9' })
    expect(out.action).toBe('clear')
    expect(out.tagsToRemove).toEqual(['contact:do-not-call', 'contact:do-not-text'])
    expect(out.nextTags).toContain('unsubscribed')
    expect(out.nextTags).toContain('broker:matt')
    expect(out.suppressionIdsToClear).not.toContain(13)
    expect(out.noteTitle).toMatch(/email reply/i)
  })

  it('STOP keeps every flag and never plans a clear', () => {
    const out = plan({ event: 'sms', smsBody: 'STOP' })
    expect(out.action).toBe('skip-stop')
    expect(out.tagsToRemove).toEqual([])
    expect(out.nextTags).toEqual(DNC_TAGS)
    expect(out.suppressionIdsToClear).toEqual([])
    expect(out.noteTitle).toBeNull()
  })

  it('a contact with no prior tracked send is not cleared', () => {
    const out = plan({
      event: 'call',
      hasTrackedSend: false,
      custom: { cmaConsent: { sms: false, email: false } },
    })
    expect(out.action).toBe('skip-no-send')
    expect(out.tagsToRemove).toEqual([])
    expect(out.nextTags).toEqual(DNC_TAGS)
    expect(out.suppressionIdsToClear).toEqual([])
    expect(out.cmaConsentReset).toBe(false)
  })

  it('resets CMA consent and declined-SMS state after a tracked send', () => {
    const out = plan({
      event: 'call',
      tags: ['sms-consent:no', 'broker:matt'],
      suppressions: [],
      custom: { cmaConsent: { sms: false, email: false, slug: 'cma-x' } },
    })
    expect(out.action).toBe('clear')
    expect(out.cmaConsentReset).toBe(true)
    expect(out.nextCmaConsent).toMatchObject({ sms: true, email: true, slug: 'cma-x' })
    expect(out.tagsToRemove).toEqual(['sms-consent:no'])
    expect(out.nextTags).toEqual(['broker:matt', 'sms-consent:yes'])
    expect(out.noteBody).toMatch(/Reset CMA consent/)
  })

  it('STOP never resets CMA consent', () => {
    const out = plan({
      event: 'sms',
      smsBody: 'STOP',
      custom: { cmaConsent: { sms: false, email: false } },
    })
    expect(out.action).toBe('skip-stop')
    expect(out.cmaConsentReset).toBe(false)
    expect(out.nextCmaConsent).toMatchObject({ sms: false, email: false })
  })
})

describe('inboundConsentDedupeKey', () => {
  it('is stable per person + event + sid', () => {
    expect(inboundConsentDedupeKey({ personId: 57526, event: 'call', eventId: 'CA1' })).toBe(
      'inbound-consent-clear:call:CA1:p57526',
    )
  })
})
