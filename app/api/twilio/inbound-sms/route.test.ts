/**
 * A broker's own cell texting a business line (Matt 2026-10-12: texts from
 * Matt's cell to Paul's and Rebecca's lines never reached their phones).
 *   1. Broker cell → a colleague's line relays to that colleague's cell, from
 *      the colleague's line, and creates no lead.
 *   2. Broker cell → their own line stays dropped (reply-loop guard).
 *   3. Broker cell → the shared marketing line stays dropped (agent off).
 *   4. A client text still forwards to the dialed line's broker.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { CELLS, LINES, MARKETING, sendSms, findOrCreatePersonByPhone, ten, upserts, clearNonOptOutSuppressions, applyInboundConsentClear, addSuppression } = vi.hoisted(() => ({
  upserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  CELLS: { matt: '+15410000001', paul: '+15410000002', rebecca: '+15410000003' },
  LINES: { matt: '+15419990001', paul: '+15419990002', rebecca: '+15419990003' },
  MARKETING: '+15419990000',
  sendSms: vi.fn(async (_p: { from: string; to: string; body: string }) => ({ ok: true as const, sid: 'SM1' })),
  findOrCreatePersonByPhone: vi.fn(async () => ({
    match: { personId: 7, name: 'Client', broker: 'paul' },
    created: false,
  })),
  addSuppression: vi.fn(async () => {}),
  clearNonOptOutSuppressions: vi.fn(async () => ({ cleared: 0 })),
  applyInboundConsentClear: vi.fn(async () => ({
    ok: true, applied: false, personId: 7, skipped: 'nothing-to-clear', tagsRemoved: [], suppressionsCleared: 0, timelineId: null,
  })),
  ten: (v: string | null | undefined) => {
    const d = String(v ?? '').replace(/\D/g, '')
    return d.length >= 10 ? d.slice(-10) : d || null
  },
}))

vi.mock('@/lib/crm/twilio', () => ({
  DEFAULT_DESK_BROKER: 'matt',
  MARKETING_NUMBER: MARKETING,
  normalizeTo10: ten,
  verifiedTwilioParams: async (request: Request) => {
    const form = await request.formData()
    const params: Record<string, string> = {}
    for (const [k, v] of form.entries()) params[k] = String(v)
    return { ok: true, params }
  },
  brokerForTwilioNumber: async (to: string) =>
    (Object.entries(LINES).find(([, n]) => ten(n) === ten(to))?.[0] as string | undefined) ?? null,
  forwardCellForBroker: async (slug: keyof typeof CELLS) => CELLS[slug] ?? null,
  brokerTwilioNumber: async (slug: keyof typeof LINES) => LINES[slug] ?? null,
  sendSms: (p: { from: string; to: string; body: string }) => sendSms(p),
}))
vi.mock('@/lib/data/crm/getBrokerTelephony', () => ({
  getBrokerTelephony: async () => ({
    bySlug: Object.fromEntries(
      Object.keys(CELLS).map((s) => [s, { forwardToCell: CELLS[s as keyof typeof CELLS], twilioNumber: LINES[s as keyof typeof LINES], smsOptIn: false }]),
    ),
    byTwilioLast10: {},
  }),
}))
vi.mock('@/lib/data/crm/getBlockedNumber', () => ({ isNumberBlocked: async () => false }))
vi.mock('@/lib/data/crm/findOrCreatePersonByPhone', () => ({ findOrCreatePersonByPhone: () => findOrCreatePersonByPhone() }))
vi.mock('@/app/actions/crm-inbox', () => ({ markConversationUnreadOnInbound: async () => {} }))
vi.mock('@/lib/crm/suppressions', () => ({
  addSuppression,
  removeSuppression: async () => {},
  clearNonOptOutSuppressions,
}))
vi.mock('@/lib/crm/broker-alerts', () => ({ newLeadAlertBody: () => '', queueBrokerAlert: async () => {} }))
vi.mock('@/lib/crm/gmail', () => ({ sendCrmEmail: async () => {} }))
vi.mock('@/lib/data/brokers/directory', () => ({ mailboxForSlug: async () => ({ email: 'desk@example.com' }) }))
vi.mock('@/lib/crm/reply-intent', () => ({ classifyInboundReply: async () => null, REPLY_INTENT_LABELS: {} }))
vi.mock('@/lib/crm/prospect-context', () => ({ prospectOutreachContext: async () => null }))
vi.mock('@/components/admin/crm/composer-preload', () => ({ buildSuggestedReplyLink: (u: string) => u }))
vi.mock('@/lib/agent/ingress', () => ({ handleAgentInbound: vi.fn(), processAfterDebounce: vi.fn() }))
vi.mock('@/lib/data/agent/broker-agent-flags', () => ({ isBrokerSmsAgentEnvEnabled: () => false }))
vi.mock('@/lib/crm/record-message', () => ({ recordConversationMessage: async () => {} }))
vi.mock('@/lib/crm/on-reply', () => ({ handleInboundReply: async () => {} }))
vi.mock('@/lib/tc/file-comms', () => ({ pdfMmsParts: () => [] }))
vi.mock('@/lib/tc/file-comms-write', () => ({ fileCommsToVault: async () => {} }))
vi.mock('@/lib/data/crm/applyInboundMessageEnrichment', () => ({
  applyInboundMessageEnrichment: async () => ({ ok: true, applied: false, personId: 7 }),
}))
vi.mock('@/lib/data/crm/applyInboundConsentClear', () => ({
  applyInboundConsentClear,
}))
vi.mock('@/lib/supabase/service', () => {
  const chain: Record<string, unknown> = {}
  const resolved = Promise.resolve({ data: null, error: null })
  for (const k of ['select', 'eq', 'insert', 'update']) chain[k] = () => chain
  chain.maybeSingle = () => resolved
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => resolved.then(res, rej)
  return {
    createServiceClient: () => ({
      from: (table: string) => ({ ...chain, upsert: (row: Record<string, unknown>) => { upserts.push({ table, row }); return chain } }),
    }),
  }
})

import { POST } from './route'

function inbound(from: string, to: string, body: string): Request {
  const form = new URLSearchParams({ From: from, To: to, Body: body, MessageSid: 'SMtest' })
  return new Request('https://ryan-realty.com/api/twilio/inbound-sms', {
    method: 'POST',
    body: form,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

describe('inbound-sms broker cell routing', () => {
  beforeEach(() => {
    sendSms.mockClear()
    findOrCreatePersonByPhone.mockClear()
    upserts.length = 0
    clearNonOptOutSuppressions.mockClear()
    applyInboundConsentClear.mockClear()
    addSuppression.mockClear()
  })

  it("relays a broker's text on a colleague's line to the colleague's cell", async () => {
    const res = await POST(inbound(CELLS.matt, LINES.paul, 'Hey Paul, it is Matt'))
    expect(res.status).toBe(200)
    expect(sendSms).toHaveBeenCalledTimes(1)
    const sent = sendSms.mock.calls[0][0]
    expect(sent.from).toBe(LINES.paul)
    expect(sent.to).toBe(CELLS.paul)
    expect(sent.body).toContain('Text from Matt Ryan')
    expect(sent.body).toContain('Hey Paul, it is Matt')
    expect(findOrCreatePersonByPhone).not.toHaveBeenCalled()
  })

  it("drops a broker's text on their own line", async () => {
    await POST(inbound(CELLS.paul, LINES.paul, 'reply in thread'))
    expect(sendSms).not.toHaveBeenCalled()
    expect(findOrCreatePersonByPhone).not.toHaveBeenCalled()
    expect(upserts.find((u) => u.table === 'crm_sms_inbound_log')?.row).toMatchObject({
      outcome: 'dropped',
      reason: 'paul texted own business line',
    })
  })

  it("drops a broker's text on the shared marketing line", async () => {
    await POST(inbound(CELLS.rebecca, MARKETING, 'hello'))
    expect(sendSms).not.toHaveBeenCalled()
    expect(findOrCreatePersonByPhone).not.toHaveBeenCalled()
  })

  it("forwards a client's text to the dialed line's broker", async () => {
    await POST(inbound('+15035550123', LINES.paul, 'Is the house still available?'))
    expect(findOrCreatePersonByPhone).toHaveBeenCalledTimes(1)
    expect(sendSms).toHaveBeenCalledTimes(1)
    expect(sendSms.mock.calls[0][0]).toMatchObject({ from: LINES.paul, to: CELLS.paul })
    expect(upserts.find((u) => u.table === 'crm_sms_inbound_log')?.row).toMatchObject({ outcome: 'forwarded', forward_sid: 'SM1' })
    expect(clearNonOptOutSuppressions).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 7, clearedBy: 'inbound-sms', clearedReason: expect.stringMatching(/^inbound sms_in /) }),
    )
    expect(applyInboundConsentClear).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 7, event: 'sms', smsBody: 'Is the house still available?' }),
    )
  })

  it('keeps and sets SMS opt-out on STOP and never clears flags', async () => {
    await POST(inbound('+15035550123', LINES.paul, 'STOP'))
    expect(clearNonOptOutSuppressions).not.toHaveBeenCalled()
    expect(applyInboundConsentClear).not.toHaveBeenCalled()
    expect(addSuppression).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 7, channel: 'sms', reason: 'stop-keyword' }),
    )
  })

  it('does not clear suppressions for a broker-cell drop', async () => {
    await POST(inbound(CELLS.paul, LINES.paul, 'reply in thread'))
    expect(clearNonOptOutSuppressions).not.toHaveBeenCalled()
  })
})
