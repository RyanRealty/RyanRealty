/**
 * Regression locks for the Conversations group-text webhook (Matt 2026-07-02:
 * "this group message fix needs to work for all past and future"). Five locked
 * behaviors, each of which silently lost client messages when broken before:
 *   1. Group inbound → a timeline row on EVERY mapped member (author + passive).
 *   2. Unknown author → lead find-or-create + new-lead alert.
 *   3. Replay protection → rows upsert on dedupe_key with ignoreDuplicates.
 *   4. STOP from the author → sms suppression (compliance chokepoint).
 *   5. Proxy/1:1 conversations → NO writes here (inbound-sms owns them; writing
 *      both would double-record every 1:1).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const upserts: Array<{ table: string; row: Record<string, unknown>; opts: Record<string, unknown> }> = []
const inserts: Array<{ table: string; row: Record<string, unknown> }> = []

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>, opts: Record<string, unknown>) => {
        upserts.push({ table, row, opts })
        return Promise.resolve({ data: null, error: null })
      },
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row })
        return Promise.resolve({ data: null, error: null })
      },
    }),
  }),
}))

const brokerForTwilioNumber = vi.fn(async (n: string) => (String(n).includes('5417033095') ? 'matt' : null))
const lookupPersonByPhone = vi.fn(async (phone: string) => {
  if (String(phone).includes('7143376028')) return { personId: 12967, name: 'Mary Bowman', broker: 'matt' }
  return null
})
vi.mock('@/lib/crm/twilio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm/twilio')>()
  return {
    ...actual,
    brokerForTwilioNumber: (n: string) => brokerForTwilioNumber(n),
    lookupPersonByPhone: (p: string) => lookupPersonByPhone(p),
  }
})

const fetchConversationParticipants = vi.fn()
vi.mock('@/lib/crm/twilio-conversations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm/twilio-conversations')>()
  return { ...actual, fetchConversationParticipants: () => fetchConversationParticipants() }
})

const findOrCreatePersonByPhone = vi.fn(async (_p: unknown) => ({ match: { personId: 52283, name: 'Yahson Terry', broker: 'matt' }, created: false }))
vi.mock('@/lib/data/crm/findOrCreatePersonByPhone', () => ({
  findOrCreatePersonByPhone: (p: unknown) => findOrCreatePersonByPhone(p),
}))

const markUnread = vi.fn(async (_id: number) => {})
vi.mock('@/app/actions/crm-inbox', () => ({ markConversationUnreadOnInbound: (id: number) => markUnread(id) }))

const addSuppression = vi.fn(async (_p: unknown) => {})
const removeSuppression = vi.fn(async (_p: unknown) => {})
vi.mock('@/lib/crm/suppressions', () => ({
  addSuppression: (p: unknown) => addSuppression(p),
  removeSuppression: (p: unknown) => removeSuppression(p),
}))

const queueBrokerAlert = vi.fn(async (_p: unknown) => {})
vi.mock('@/lib/crm/broker-alerts', () => ({
  queueBrokerAlert: (p: unknown) => queueBrokerAlert(p),
  newLeadAlertBody: () => 'alert-body',
}))

vi.mock('@/lib/data/crm/getBlockedNumber', () => ({ isNumberBlocked: async () => false }))

const sendCrmEmail = vi.fn((_p: unknown) => Promise.resolve({ ok: true }))
vi.mock('@/lib/crm/gmail', () => ({
  CRM_MAILBOXES: [{ slug: 'matt', email: 'matt@ryan-realty.com' }],
  sendCrmEmail: (p: unknown) => sendCrmEmail(p),
}))

import { POST } from './route'

const GROUP_PARTICIPANTS = [
  { address: '+19093430531', proxyAddress: null, projectedAddress: null },
  { address: '+17143376028', proxyAddress: null, projectedAddress: null },
  { address: null, proxyAddress: null, projectedAddress: '+15417033095' },
]

function request(params: Record<string, string>): Request {
  return new Request('https://ryan-realty.com/api/twilio/conversations-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      EventType: 'onMessageAdded',
      ConversationSid: 'CH' + 'a'.repeat(32),
      MessageSid: 'IM' + 'b'.repeat(32),
      Body: 'hello from the group',
      Author: '+19093430531',
      ChatServiceSid: 'IS' + 'c'.repeat(32),
      Source: 'SMS',
      ...params,
    }),
  })
}

const ORIG_ENV = { skip: process.env.TWILIO_SKIP_SIG_CHECK, token: process.env.TWILIO_AUTH_TOKEN }

beforeEach(() => {
  upserts.length = 0
  inserts.length = 0
  vi.clearAllMocks()
  fetchConversationParticipants.mockResolvedValue(GROUP_PARTICIPANTS)
  findOrCreatePersonByPhone.mockResolvedValue({ match: { personId: 52283, name: 'Yahson Terry', broker: 'matt' }, created: false })
  process.env.TWILIO_SKIP_SIG_CHECK = '1'
})
afterEach(() => {
  if (ORIG_ENV.skip === undefined) delete process.env.TWILIO_SKIP_SIG_CHECK
  else process.env.TWILIO_SKIP_SIG_CHECK = ORIG_ENV.skip
  if (ORIG_ENV.token === undefined) delete process.env.TWILIO_AUTH_TOKEN
  else process.env.TWILIO_AUTH_TOKEN = ORIG_ENV.token
})

describe('conversations-events — group inbound recording', () => {
  it('LOCK 1: writes a group-context sms_in row for EVERY mapped member (author + passive)', async () => {
    const res = await POST(request({}))
    expect(res.status).toBe(200)
    const rows = upserts.filter((u) => u.table === 'crm_timeline')
    expect(rows.map((r) => r.row.person_id).sort()).toEqual([12967, 52283])
    for (const r of rows) {
      expect(r.row.kind).toBe('sms_in')
      expect(r.row.title).toBe('Group text received')
      const payload = r.row.payload as Record<string, unknown>
      expect(payload.group).toBe(true)
      expect(payload.fromNumber).toBe('+19093430531')
      expect(payload.groupMembers).toEqual(['+19093430531', '+17143376028', '+15417033095'])
      expect(payload.conversationSid).toBe('CH' + 'a'.repeat(32))
    }
    expect(markUnread).toHaveBeenCalledWith(52283)
    // Broker follow-up: reply task on the author's contact.
    expect(inserts.some((i) => i.table === 'crm_tasks')).toBe(true)
  })

  it('LOCK 2: unknown author → find-or-create as a lead + new-lead alert on a real create', async () => {
    findOrCreatePersonByPhone.mockResolvedValueOnce({ match: { personId: 999, name: 'Text lead 9093430531', broker: 'matt' }, created: true })
    await POST(request({}))
    expect(findOrCreatePersonByPhone).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+19093430531', source: 'inbound-sms', assignBroker: 'matt' }),
    )
    expect(queueBrokerAlert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'new-lead', personId: 999 }))
  })

  it('LOCK 3: rows carry a per-person dedupe key and upsert with ignoreDuplicates (replay-safe)', async () => {
    await POST(request({}))
    const rows = upserts.filter((u) => u.table === 'crm_timeline')
    expect(rows.map((r) => r.row.dedupe_key).sort()).toEqual([
      `twilio:IM${'b'.repeat(32)}:p12967`,
      `twilio:IM${'b'.repeat(32)}:p52283`,
    ])
    for (const r of rows) expect(r.opts).toEqual({ onConflict: 'dedupe_key', ignoreDuplicates: true })
  })

  it('LOCK 4: STOP from the author hits the sms suppression chokepoint (and skips the reply task)', async () => {
    await POST(request({ Body: 'STOP' }))
    expect(addSuppression).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 52283, channel: 'sms', reason: 'stop-keyword' }),
    )
    expect(inserts.some((i) => i.table === 'crm_tasks')).toBe(false)
    // START clears it again.
    await POST(request({ Body: 'START' }))
    expect(removeSuppression).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 52283, channel: 'sms', reason: 'stop-keyword' }),
    )
  })

  it('LOCK 5: proxy/1:1 conversations are NOT recorded here (inbound-sms owns them — no double rows)', async () => {
    fetchConversationParticipants.mockResolvedValue([
      { address: '+19093430531', proxyAddress: '+15417033095', projectedAddress: null },
    ])
    await POST(request({}))
    expect(upserts).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })

  it('skips our own outbound (author = a broker line) without writing', async () => {
    await POST(request({ Author: '+15417033095' }))
    expect(upserts).toHaveLength(0)
  })

  it('rejects an unsigned request when signature enforcement is on', async () => {
    delete process.env.TWILIO_SKIP_SIG_CHECK
    process.env.TWILIO_AUTH_TOKEN = 'enforce-token'
    const res = await POST(request({}))
    expect(res.status).toBe(403)
    expect(upserts).toHaveLength(0)
  })
})
