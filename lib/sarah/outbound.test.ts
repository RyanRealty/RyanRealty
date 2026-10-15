import { describe, expect, it } from 'vitest'
import {
  BANNED_LEAD_SOURCES,
  BLOCKED_STATE_AREA_CODES,
  MAX_ATTEMPTS_PER_24H,
  MAX_ATTEMPTS_PER_7D,
  YES_FLOW_TEXT,
  evaluateOutboundDial,
  inOutboundCallingWindow,
  isBannedLeadSource,
  outboundStopWords,
  sarahOutboundEnabled,
  type OutboundConsentRecord,
  type OutboundDialInput,
} from './outbound'

const ON_ENV = { SARAH_OUTBOUND_ENABLED: 'true' }
const TEXT_CONSENT: OutboundConsentRecord = {
  kind: 'inbound-text',
  sourceText: 'What is the HOA fee on that listing?',
  capturedAt: '2026-10-14T18:00:00.000Z',
  phone: '+15415550100',
  topic: 'HOA fee',
}
const YES_CONSENT: OutboundConsentRecord = {
  kind: 'yes-reply',
  sourceText: 'YES',
  capturedAt: '2026-10-01T18:00:00.000Z',
  phone: '+13055550100',
  topic: 'listing info',
}

function dial(over: Partial<OutboundDialInput> = {}): ReturnType<typeof evaluateOutboundDial> {
  return evaluateOutboundDial({
    phone: '+15415550100',
    consent: TEXT_CONSENT,
    internalDnc: false,
    nationalDnc: false,
    attemptsLast24h: 0,
    attemptsLast7d: 0,
    unansweredStreak: 0,
    timeZone: 'America/Los_Angeles',
    now: new Date('2026-10-15T18:00:00.000Z'),
    env: ON_ENV,
    ...over,
  })
}

describe('sarahOutboundEnabled', () => {
  it('is off unless SARAH_OUTBOUND_ENABLED=true', () => {
    expect(sarahOutboundEnabled({})).toBe(false)
    expect(sarahOutboundEnabled({ SARAH_OUTBOUND_ENABLED: 'true' })).toBe(true)
    expect(sarahOutboundEnabled({ SARAH_OUTBOUND_ENABLED: 'true', SARAH_OUTBOUND_KILL_SWITCH: 'true' })).toBe(false)
  })
})

describe('evaluateOutboundDial', () => {
  it('refuses when the flag is off', () => {
    const d = dial({ env: {} })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toBe('flag-off')
  })

  it('refuses with no consent record', () => {
    const d = dial({ consent: null })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toBe('no-consent')
  })

  it.each([...BANNED_LEAD_SOURCES])('never AI-calls banned source %s', (source) => {
    expect(isBannedLeadSource(source)).toBe(true)
    const d = dial({ leadSource: source })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toBe('banned-lead-source')
  })

  it('blocks a pitch on inbound-text consent', () => {
    const d = dial({ wantsPitch: true })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toBe('inbound-text-not-written-for-pitch')
  })

  it('expires inbound-text consent after 30 days', () => {
    const d = dial({ now: new Date('2026-11-20T18:00:00.000Z') })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toBe('inbound-text-consent-expired')
  })

  it('blocks FL, OK, and WA area codes without written consent', () => {
    expect(BLOCKED_STATE_AREA_CODES.has('305')).toBe(true)
    expect(BLOCKED_STATE_AREA_CODES.has('405')).toBe(true)
    expect(BLOCKED_STATE_AREA_CODES.has('206')).toBe(true)
    expect(dial({ phone: '+13055550100' }).ok).toBe(false)
    expect(dial({ phone: '+14055550100' }).ok).toBe(false)
    expect(dial({ phone: '+12065550100' }).ok).toBe(false)
    expect(dial({ phone: '+13055550100', consent: YES_CONSENT }).ok).toBe(true)
  })

  it('caps attempts at 2 per 24h and 3 per 7d', () => {
    expect(MAX_ATTEMPTS_PER_24H).toBe(2)
    expect(MAX_ATTEMPTS_PER_7D).toBe(3)
    expect(dial({ attemptsLast24h: 2 }).ok).toBe(false)
    expect(dial({ attemptsLast7d: 3 }).ok).toBe(false)
  })

  it('stops after 3 unanswered attempts', () => {
    expect(dial({ unansweredStreak: 3 }).ok).toBe(false)
  })

  it('honors internal DNC and the opt-out kill switch', () => {
    expect(dial({ internalDnc: true }).ok).toBe(false)
    expect(dial({ optOutFailedToLog: true }).ok).toBe(false)
  })

  it('allows an informational Bend callback inside the window', () => {
    const d = dial()
    expect(d.ok).toBe(true)
    if (d.ok) {
      expect(d.opener).toMatch(/say stop or press 9/)
      expect(d.opener).toMatch(/AI assistant/)
      expect(d.voicemail).toMatch(/541-703-3095/)
      expect(d.voicemail).not.toMatch(/showing|valuation|listing services/i)
    }
  })
})

describe('calling hours', () => {
  it('is 9:00 to 7:30 local', () => {
    const tz = 'America/Los_Angeles'
    expect(inOutboundCallingWindow(new Date('2026-10-15T16:00:00.000Z'), tz)).toBe(true)
    expect(inOutboundCallingWindow(new Date('2026-10-15T15:59:00.000Z'), tz)).toBe(false)
    expect(inOutboundCallingWindow(new Date('2026-10-16T02:30:00.000Z'), tz)).toBe(true)
    expect(inOutboundCallingWindow(new Date('2026-10-16T02:31:00.000Z'), tz)).toBe(false)
  })
})

describe('YES flow and STOP', () => {
  it('uses Counsel YES wording', () => {
    expect(YES_FLOW_TEXT).toMatch(/Reply YES/)
    expect(YES_FLOW_TEXT).toMatch(/AI or prerecorded voice/)
    expect(YES_FLOW_TEXT).toMatch(/including marketing calls/)
    expect(YES_FLOW_TEXT).toMatch(/Reply STOP/)
  })

  it('treats spoken stop and press 9 as opt-out', () => {
    expect(outboundStopWords('please stop calling')).toBe(true)
    expect(outboundStopWords('9')).toBe(true)
    expect(outboundStopWords('tell me the HOA fee')).toBe(false)
  })
})
