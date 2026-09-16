import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  sendGroupMms,
  groupShapeOf,
  parseConversationMedia,
  parseExistingGroupConversationSid,
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
    expect(res).toEqual({ ok: true, conversationSid: 'CH1', messageSid: 'IM1', chatServiceSid: null, media: [] })

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

  // Media (2026-07-09): before this, group sends silently DROPPED attachments —
  // the caller uploaded media but sendGroupMms had no way to carry it.
  it('uploads media to MCS (chat service from the conversation) and attaches MediaSid to the message', async () => {
    const calls = mockTwilio([
      { sid: 'CH1', chat_service_sid: 'IS_chat' }, // create conversation
      { sid: 'MB1' }, // participant 1
      { sid: 'MB2' }, // participant 2
      { sid: 'MB3' }, // projected participant
      { sid: 'ME' + 'a'.repeat(32) },              // MCS media upload
      { sid: 'IM1' },                               // body message (with MediaSid)
    ])
    const res = await sendGroupMms({
      projectedAddress: '5417033095',
      participants: ['7143376028', '9093430531'],
      body: 'photo attached',
      media: [{ content: Buffer.from('fakebytes'), contentType: 'image/jpeg', filename: 'house.jpg' }],
    })
    expect(res).toEqual({
      ok: true, conversationSid: 'CH1', messageSid: 'IM1', chatServiceSid: 'IS_chat',
      media: [{ mediaSid: 'ME' + 'a'.repeat(32), contentType: 'image/jpeg' }],
    })
    const mcsCall = calls.find((c) => c.url.includes('mcs.us1.twilio.com'))
    expect(mcsCall?.url).toBe('https://mcs.us1.twilio.com/v1/Services/IS_chat/Media')
    const msgCall = calls.find((c) => c.url.includes('/Messages'))
    expect(msgCall?.body?.get('MediaSid')).toBe('ME' + 'a'.repeat(32))
    expect(msgCall?.body?.get('Body')).toBe('photo attached')
  })

  it('fails closed (and cleans up) when media is requested but the conversation has no chat service', async () => {
    const calls = mockTwilio([
      { sid: 'CH1' }, // create conversation — NO chat_service_sid
      { sid: 'MB1' }, { sid: 'MB2' }, { sid: 'MB3' },
      {},
    ])
    const res = await sendGroupMms({
      projectedAddress: '+15417033095',
      participants: ['7143376028', '9093430531'],
      body: 'x',
      media: [{ content: Buffer.from('y'), contentType: 'image/png' }],
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('chat service')
    const del = calls.find((c) => c.method === 'DELETE')
    expect(del?.url).toContain('/Conversations/CH1')
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

// One number group = one Conversation (2026-09-16). Twilio refuses a second
// group for the same participant set and NAMES the existing one. Found on the
// Hogan thread: the group formed once on Jul 31 (CHaf1f40…); every group text
// after that hit this refusal, the half-built conversation was deleted, and
// the composer fell back to one text per person for six weeks. The message
// belongs in the existing conversation.
const EXISTING = 'CHaf1f40233b2944ec944df877e7c57ce9'
const REFUSAL = {
  code: 50438,
  message: `Group MMS with given participant list already exists as Conversation ${EXISTING}`,
}
const OUR_LINE = '+15417033095'
const PARTICIPANTS_WITH_LINE = {
  participants: [
    { messaging_binding: { projected_address: OUR_LINE } },
    { messaging_binding: { address: '+17143376028' } },
    { messaging_binding: { address: '+19093430531' } },
  ],
}

describe('parseExistingGroupConversationSid', () => {
  it('reads the conversation Twilio names in the refusal', () => {
    expect(parseExistingGroupConversationSid(REFUSAL.message)).toBe(EXISTING)
  })
  it('is null for every other error and for nothing', () => {
    expect(parseExistingGroupConversationSid('Address rejected')).toBeNull()
    expect(parseExistingGroupConversationSid(undefined)).toBeNull()
    expect(parseExistingGroupConversationSid('already exists as Conversation CHnope')).toBeNull()
  })
})

describe('sendGroupMms — posts into the group Twilio already holds', () => {
  const send = () =>
    sendGroupMms({
      projectedAddress: OUR_LINE,
      participants: ['7143376028', '9093430531'],
      body: 'Just sent an email with the counteroffer language.',
      friendlyName: 'Group · Tanya Hogan',
    })

  it('reuses the existing active conversation when the projected line completes a known number group', async () => {
    const calls = mockTwilio([
      { sid: 'CH2', chat_service_sid: 'IS2' }, // create (the one that will be torn down)
      { sid: 'MB1' },
      { sid: 'MB2' },
      REFUSAL, // adding our line completes the number group → Twilio names CHaf1f…
      {}, // DELETE CH2
      { sid: EXISTING, state: 'active', chat_service_sid: 'IS1' }, // GET existing
      PARTICIPANTS_WITH_LINE, // GET its participants
      { sid: 'IM9' }, // POST message into the existing conversation
    ])
    const res = await send()
    expect(res).toEqual({
      ok: true,
      conversationSid: EXISTING,
      messageSid: 'IM9',
      chatServiceSid: 'IS1',
      media: [],
      reused: true,
    })
    // The half-built conversation is deleted; the existing one never is.
    const dels = calls.filter((c) => c.method === 'DELETE')
    expect(dels).toHaveLength(1)
    expect(dels[0].url).toContain('/Conversations/CH2')
    expect(dels.some((c) => c.url.includes(EXISTING))).toBe(false)
    // The message goes into the existing conversation, authored by our line.
    const msg = calls.find((c) => c.method === 'POST' && c.url.endsWith(`/Conversations/${EXISTING}/Messages`))
    expect(msg?.body?.get('Author')).toBe(OUR_LINE)
    expect(msg?.body?.get('Body')).toBe('Just sent an email with the counteroffer language.')
    // An active conversation is not poked.
    expect(calls.some((c) => c.body?.get('State') === 'active')).toBe(false)
  })

  it('also reuses when the refusal lands on a member add, not the projected line', async () => {
    const calls = mockTwilio([
      { sid: 'CH2' },
      { sid: 'MB1' },
      REFUSAL, // second member completes the group in Twilio's eyes
      {}, // DELETE CH2
      { sid: EXISTING, state: 'active', chat_service_sid: 'IS1' },
      PARTICIPANTS_WITH_LINE,
      { sid: 'IM9' },
    ])
    const res = await send()
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.conversationSid).toBe(EXISTING)
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual([expect.stringContaining('/Conversations/CH2')])
  })

  it('wakes an inactive existing conversation before posting', async () => {
    const calls = mockTwilio([
      { sid: 'CH2' },
      { sid: 'MB1' },
      { sid: 'MB2' },
      REFUSAL,
      {}, // DELETE CH2
      { sid: EXISTING, state: 'inactive', chat_service_sid: 'IS1' },
      { sid: EXISTING, state: 'active', chat_service_sid: 'IS1' }, // POST State=active
      PARTICIPANTS_WITH_LINE,
      { sid: 'IM10' },
    ])
    const res = await send()
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.messageSid).toBe('IM10')
    const wake = calls.find((c) => c.method === 'POST' && c.url.endsWith(`/Conversations/${EXISTING}`))
    expect(wake?.body?.get('State')).toBe('active')
    const msgIdx = calls.findIndex((c) => c.url.endsWith(`/Conversations/${EXISTING}/Messages`))
    expect(calls.indexOf(wake!)).toBeLessThan(msgIdx)
  })

  it('refuses honestly when the existing conversation is closed — nothing posted, nothing deleted on it', async () => {
    const calls = mockTwilio([
      { sid: 'CH2' },
      { sid: 'MB1' },
      { sid: 'MB2' },
      REFUSAL,
      {}, // DELETE CH2
      { sid: EXISTING, state: 'closed', chat_service_sid: 'IS1' },
    ])
    const res = await send()
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain(`${EXISTING} is closed`)
    expect(calls.some((c) => c.url.includes(`/Conversations/${EXISTING}/Messages`))).toBe(false)
    expect(calls.filter((c) => c.method === 'DELETE').some((c) => c.url.includes(EXISTING))).toBe(false)
  })

  it('refuses when our line is no longer projected into the existing group', async () => {
    mockTwilio([
      { sid: 'CH2' },
      { sid: 'MB1' },
      { sid: 'MB2' },
      REFUSAL,
      {},
      { sid: EXISTING, state: 'active', chat_service_sid: 'IS1' },
      { participants: [{ messaging_binding: { address: '+17143376028' } }, { messaging_binding: { address: '+19093430531' } }] },
    ])
    const res = await send()
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain(`does not carry our line ${OUR_LINE}`)
  })

  it('still fails a plain participant rejection the old way (no reuse without a named conversation)', async () => {
    const calls = mockTwilio([{ sid: 'CH1' }, { sid: 'MB1' }, { message: 'Address rejected' }, {}])
    const res = await sendGroupMms({ projectedAddress: OUR_LINE, participants: ['7143376028', '9093430531'], body: 'x' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('Address rejected')
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual([expect.stringContaining('/Conversations/CH1')])
  })
})
