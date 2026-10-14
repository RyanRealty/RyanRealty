import { describe, it, expect } from 'vitest'
import { findUnforwardedTexts, type TwilioMessageRow } from './inbound-forward-audit'
import { evaluateHealthRules, type HealthSignals } from './health-rules'

const now = new Date('2026-10-12T22:00:00Z')
const inbound = (sid: string, at: string): TwilioMessageRow => ({ sid, direction: 'inbound', to: '+15415023436', status: 'received', dateCreated: at })

describe('findUnforwardedTexts', () => {
  const logStartedAt = '2026-10-12T00:00:00Z'

  it('flags a received text the webhook never recorded', () => {
    const out = findUnforwardedTexts({ messages: [inbound('SM1', '2026-10-12T19:30:30Z')], log: [], logStartedAt, now })
    expect(out).toEqual([{ sid: 'SM1', to: '+15415023436', why: 'not processed' }])
  })

  it('flags a recorded forward failure and an undelivered forward', () => {
    const out = findUnforwardedTexts({
      messages: [
        inbound('SM1', '2026-10-12T19:00:00Z'),
        inbound('SM2', '2026-10-12T19:05:00Z'),
        { sid: 'SMF2', direction: 'outbound-api', to: '+15419776841', status: 'undelivered', dateCreated: '2026-10-12T19:05:01Z' },
      ],
      log: [
        { messageSid: 'SM1', outcome: 'forward_failed', forwardSid: null },
        { messageSid: 'SM2', outcome: 'forwarded', forwardSid: 'SMF2' },
      ],
      logStartedAt,
      now,
    })
    expect(out.map((o) => o.why)).toEqual(['forward failed', 'forward undelivered'])
  })

  it('does not flag deliberate drops, delivered forwards, texts inside the grace window, or texts before logging began', () => {
    const out = findUnforwardedTexts({
      messages: [
        inbound('SM1', '2026-10-12T19:00:00Z'),
        inbound('SM2', '2026-10-12T19:05:00Z'),
        { sid: 'SMF2', direction: 'outbound-api', to: '+15419776841', status: 'delivered', dateCreated: '2026-10-12T19:05:01Z' },
        inbound('SM3', '2026-10-12T21:55:00Z'),
        inbound('SM4', '2026-10-11T23:00:00Z'),
      ],
      log: [
        { messageSid: 'SM1', outcome: 'dropped', forwardSid: null },
        { messageSid: 'SM2', outcome: 'forwarded', forwardSid: 'SMF2' },
      ],
      logStartedAt,
      now,
    })
    expect(out).toEqual([])
  })

  it('judges nothing before the log has a first row', () => {
    expect(findUnforwardedTexts({ messages: [inbound('SM1', '2026-10-12T19:00:00Z')], log: [], logStartedAt: null, now })).toEqual([])
  })
})

describe('health rule: inbound text not forwarded', () => {
  const base: HealthSignals = {
    inboundWebhook: null,
    a2pStatus: null,
    smsSendAttempts24h: 0,
    newLeads48h: 5,
    twilioReachable: null,
    geoSmartLists: [],
    mvLagDays: null,
    mvRefreshAgeHours: null,
    unforwardedTexts: null,
  }

  it('pages critical on one miss', () => {
    const { alarms } = evaluateHealthRules({ ...base, unforwardedTexts: [{ sid: 'SM1', to: '+15415023436', why: 'not processed' }] })
    expect(alarms).toHaveLength(1)
    expect(alarms[0]).toMatchObject({ key: 'inbound-text-not-forwarded', severity: 'critical' })
    expect(alarms[0].message).toContain('+15415023436')
  })

  it('stays quiet with no misses or an unreadable signal', () => {
    expect(evaluateHealthRules({ ...base, unforwardedTexts: [] }).alarms).toEqual([])
    expect(evaluateHealthRules(base).alarms).toEqual([])
  })
})
