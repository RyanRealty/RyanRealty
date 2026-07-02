import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  sendGroupMms,
  groupShapeOf,
  parseConversationMedia,
  toE164,
  type ConversationParticipantInfo,
} from './twilio-conversations'

// Group SMS recording correctness (2026-07-02). Two locked behaviors:
// 1. sendGroupMms creates NATIVE group MMS — SMS members bound with Address
//    ONLY, the broker line as a standalone ProjectedAddress, message authored
//    by the projected address. The old Address+ProxyAddress shape silently
//    downgraded groups to per-person 1:1 proxy threads (nobody saw each other).
// 2. groupShapeOf separates group-MMS conversations (recorded by the
//    conversations-events webhook) from proxy/1:1 conversations (recorded by
//    the per-number inbound-sms webhook) — the double-write guard.

const ORIG_SID = process.env.TWILIO_ACCOUNT_SID
const ORIG_TOKEN = process.env.TWILIO_AUTH_TOKEN

beforeEach(() => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = 'test-token'
})
afterEach(() => {
  vi.unstubAllGlobals()
  if (ORIG_SID === undefined) delete process.env.TWILIO_ACCOUNT_SID
  else process.env.TWILIO_ACCOUNT_SID = ORIG_SID
  if (ORIG_TOKEN === undefined) delete process.env.TWILIO_AUTH_TOKEN
  else process.env.TWILIO_AUTH_TOKEN = ORIG_TOKEN
})

type Call = { url: string; body: URLSearchParams | null; method: string }

function mockTwilio(responses: Array<Record<string, unknown>>): Call[] {
  const calls: Call[] = []
  let i = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? new URLSearchParams(String(init.body)) : null,
    })
    const json = responses[Math.min(i, responses.length - 1)]
    i++
    return { ok: true, status: 200, json: async () => json } as Response
  }))
  return calls
}

describe('sendGroupMms — native group MMS shape', () => {
  it('binds SMS members with Address ONLY, adds the broker line as ProjectedAddress, authors as the line', async () => {
    const calls = mockTwilio([
      { sid: 'CH1' }, // create conversation
      { sid: 'MB1' }, // participant 1
      { sid: 'MB2' }, // participant 2
      { sid: 'MB3' }, // projected participant
      { sid: 'IM1' }, // message
    ])
    const res = await sendGroupMms({
      projectedAddress: '5417033095',
      participants: ['7143376028', '(909) 343-0531'],
      body: 'hello group',
      friendlyName: 'Group · Test',
    })
    expect(res).toEqual({ ok: true, conversationSid: 'CH1', messageSid: 'IM1' })

    const partCalls = calls.filter((c) => c.url.includes('/Participants'))
    expect(partCalls).toHaveLength(3)
    // SMS members: Address only — NEVER a ProxyAddress (the 1:1 downgrade bug).
    for (const c of partCalls.slice(0, 2)) {
      expect(c.body?.get('MessagingBinding.Address')).toMatch(/^\+1\d{10}$/)
      expect(c.body?.has('MessagingBinding.ProxyAddress')).toBe(false)
      expect(c.body?.has('MessagingBinding.ProjectedAddress')).toBe(false)
    }
    // Broker line: standalone projected address.
    expect(partCalls[2].body?.get('MessagingBinding.ProjectedAddress')).toBe('+15417033095')
    expect(partCalls[2].body?.has('MessagingBinding.Address')).toBe(false)
    // Message authored by the projected line.
    const msgCall = calls.find((c) => c.url.includes('/Messages'))
    expect(msgCall?.body?.get('Author')).toBe('+15417033095')
    expect(msgCall?.body?.get('Body')).toBe('hello group')
  })

  it('cleans up the conversation and fails when a participant is rejected', async () => {
    const calls = mockTwilio([
      { sid: 'CH1' },
      { sid: 'MB1' },
      { message: 'Address rejected' }, // second participant fails
      {},
    ])
    const res = await sendGroupMms({
      projectedAddress: '+15417033095',
      participants: ['7143376028', '9093430531'],
      body: 'x',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('Address rejected')
    const del = calls.find((c) => c.method === 'DELETE')
    expect(del?.url).toContain('/Conversations/CH1')
  })

  it('requires 2+ distinct valid participants (dedupes + drops the broker line itself)', async () => {
    mockTwilio([{}])
    expect((await sendGroupMms({ projectedAddress: '+15417033095', participants: ['7143376028'], body: 'x' })).ok).toBe(false)
    expect((await sendGroupMms({ projectedAddress: '+15417033095', participants: ['714-337-6028', '7143376028'], body: 'x' })).ok).toBe(false)
    // The broker line sneaking in as a "participant" must not count as a member.
    expect((await sendGroupMms({ projectedAddress: '+15417033095', participants: ['5417033095', '7143376028'], body: 'x' })).ok).toBe(false)
  })

  it('enforces the 10-address group MMS ceiling', async () => {
    mockTwilio([{}])
    const many = Array.from({ length: 10 }, (_, i) => `503555${String(1000 + i)}`)
    const res = await sendGroupMms({ projectedAddress: '+15417033095', participants: many, body: 'x' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('at most')
  })
})

describe('groupShapeOf — webhook double-write guard', () => {
  const p = (o: Partial<ConversationParticipantInfo>): ConversationParticipantInfo => ({
    address: null, proxyAddress: null, projectedAddress: null, ...o,
  })

  it('classifies a native group (address-only members + projected line) as group MMS', () => {
    const shape = groupShapeOf([
      p({ address: '+17143376028' }),
      p({ address: '+19093430531' }),
      p({ projectedAddress: '+15417033095' }),
    ])
    expect(shape.isGroupMms).toBe(true)
    expect(shape.smsAddresses).toEqual(['+17143376028', '+19093430531'])
    expect(shape.projectedAddresses).toEqual(['+15417033095'])
  })

  it('classifies proxy-bound conversations (1:1 or legacy proxy groups) as NOT group MMS', () => {
    // 1:1 autocreated conversation: one number pair.
    expect(groupShapeOf([p({ address: '+17143376028', proxyAddress: '+15417033095' })]).isGroupMms).toBe(false)
    // Legacy proxy "group" (pre-2026-07-02 sendGroupMms): every member paired.
    expect(groupShapeOf([
      p({ address: '+15412136706', proxyAddress: '+15412245025' }),
      p({ address: '+15416109091', proxyAddress: '+15412245025' }),
    ]).isGroupMms).toBe(false)
  })

  it('needs 2+ address-only members to count as a group', () => {
    expect(groupShapeOf([p({ address: '+17143376028' }), p({ projectedAddress: '+15417033095' })]).isGroupMms).toBe(false)
  })
})

describe('parseConversationMedia', () => {
  it('maps Twilio Media JSON to {mediaSid, contentType}', () => {
    const json = JSON.stringify([
      { Sid: 'ME' + 'a'.repeat(32), ContentType: 'image/jpeg', Filename: 'house.jpg', Size: 123 },
      { Sid: 'ME' + 'b'.repeat(32) },
    ])
    expect(parseConversationMedia(json)).toEqual([
      { mediaSid: 'ME' + 'a'.repeat(32), contentType: 'image/jpeg' },
      { mediaSid: 'ME' + 'b'.repeat(32), contentType: 'application/octet-stream' },
    ])
  })
  it('returns [] for missing/malformed input', () => {
    expect(parseConversationMedia(undefined)).toEqual([])
    expect(parseConversationMedia('')).toEqual([])
    expect(parseConversationMedia('not json')).toEqual([])
    expect(parseConversationMedia('{"Sid":"x"}')).toEqual([])
  })
})

describe('toE164', () => {
  it('normalizes bare 10-digit and formatted numbers; rejects short ones', () => {
    expect(toE164('5416109091')).toBe('+15416109091')
    expect(toE164('(714) 337-6028')).toBe('+17143376028')
    expect(toE164('+15417033095')).toBe('+15417033095')
    expect(toE164('12345')).toBeNull()
  })
})
