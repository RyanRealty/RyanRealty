import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * lib/agent/send.ts — the ONLY sender the broker SMS agent uses. Locks the
 * hard whitelist (docs/plans/BROKER_SMS_AGENT_2026-07-31.md R1.2, DONE item 6,
 * lib/agent/types.ts invariant): the agent is mechanically incapable of
 * texting a non-broker number. No live DB — lib/crm/twilio and
 * lib/data/crm/getBrokerTelephony are mocked at the module boundary (int
 * tests write to production, forbidden per repo policy).
 */

const h = vi.hoisted(() => ({
  sendSms: vi.fn(),
  getBrokerTelephony: vi.fn(),
}))

vi.mock('@/lib/crm/twilio', () => ({
  sendSms: h.sendSms,
  MARKETING_NUMBER: '+15412245025',
}))
vi.mock('@/lib/data/crm/getBrokerTelephony', () => ({
  getBrokerTelephony: h.getBrokerTelephony,
}))

import { sendAgentSms, isBrokerCell, getBrokerCellWhitelist } from './send'

const EMPTY_TELEPHONY = { bySlug: {}, byTwilioLast10: {} }

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  // This shell's real env may export TWILIO_FORWARD_MATT/REBECCA/PAUL for
  // local scripts (a live-wiring repo — see docs/plans/BROKER_SMS_AGENT_2026-07-31.md
  // baseline). Force all three to empty so exact-whitelist-size assertions are
  // deterministic; individual tests re-stub the ones they care about.
  vi.stubEnv('TWILIO_FORWARD_MATT', '')
  vi.stubEnv('TWILIO_FORWARD_REBECCA', '')
  vi.stubEnv('TWILIO_FORWARD_PAUL', '')
  h.getBrokerTelephony.mockResolvedValue(EMPTY_TELEPHONY)
  h.sendSms.mockResolvedValue({ ok: true, sid: 'SM_TEST' })
})

describe('isBrokerCell', () => {
  it('matches on last-10 digits regardless of formatting', () => {
    const whitelist = new Set(['5417033095'])
    expect(isBrokerCell('+15417033095', whitelist)).toBe(true)
    expect(isBrokerCell('15417033095', whitelist)).toBe(true)
    expect(isBrokerCell('541-703-3095', whitelist)).toBe(true)
  })

  it('rejects a number not in the whitelist', () => {
    const whitelist = new Set(['5417033095'])
    expect(isBrokerCell('+15035559999', whitelist)).toBe(false)
  })

  it('rejects null/empty/short input', () => {
    const whitelist = new Set(['5417033095'])
    expect(isBrokerCell(null, whitelist)).toBe(false)
    expect(isBrokerCell('', whitelist)).toBe(false)
    expect(isBrokerCell('12345', whitelist)).toBe(false)
  })
})

describe('getBrokerCellWhitelist', () => {
  it('unions DB forward_to_cell with TWILIO_FORWARD_* env vars', async () => {
    h.getBrokerTelephony.mockResolvedValue({
      bySlug: {
        matt: { twilioNumber: '+15417033095', forwardToCell: '+15417033095', smsOptIn: true },
        rebecca: { twilioNumber: null, forwardToCell: null, smsOptIn: false },
      },
      byTwilioLast10: {},
    })
    vi.stubEnv('TWILIO_FORWARD_PAUL', '+15415023436')
    const whitelist = await getBrokerCellWhitelist()
    expect(whitelist.has('5417033095')).toBe(true)
    expect(whitelist.has('5415023436')).toBe(true)
    expect(whitelist.size).toBe(2)
  })

  it('falls back to env alone when the DB read throws', async () => {
    h.getBrokerTelephony.mockRejectedValue(new Error('supabase down'))
    vi.stubEnv('TWILIO_FORWARD_MATT', '+15417033095')
    const whitelist = await getBrokerCellWhitelist()
    expect(whitelist.has('5417033095')).toBe(true)
    expect(whitelist.size).toBe(1)
  })

  it('is empty when neither the DB nor env has any broker cells', async () => {
    const whitelist = await getBrokerCellWhitelist()
    expect(whitelist.size).toBe(0)
  })
})

describe('sendAgentSms — hard whitelist', () => {
  it('throws for a number that is not a registered broker cell (empty DB + env)', async () => {
    await expect(sendAgentSms({ to: '+15035559999', body: 'hello' })).rejects.toThrow(/not a registered broker cell/)
    expect(h.sendSms).not.toHaveBeenCalled()
  })

  it('throws for a plausible-but-unregistered 10-digit number even with other brokers registered', async () => {
    h.getBrokerTelephony.mockResolvedValue({
      bySlug: { matt: { twilioNumber: '+15417033095', forwardToCell: '+15417033095', smsOptIn: true } },
      byTwilioLast10: {},
    })
    await expect(sendAgentSms({ to: '+15035559999', body: 'hello' })).rejects.toThrow()
    expect(h.sendSms).not.toHaveBeenCalled()
  })

  it('sends to a broker cell resolved via the DB, from = the marketing line', async () => {
    h.getBrokerTelephony.mockResolvedValue({
      bySlug: { rebecca: { twilioNumber: '+15415551111', forwardToCell: '+15415552222', smsOptIn: true } },
      byTwilioLast10: {},
    })
    const res = await sendAgentSms({ to: '+15415552222', body: 'CMA draft ready' })
    expect(res).toEqual({ ok: true, sid: 'SM_TEST' })
    expect(h.sendSms).toHaveBeenCalledWith({
      from: '+15412245025',
      to: '+15415552222',
      body: 'CMA draft ready',
      mediaUrls: undefined,
    })
  })

  it('sends to a broker cell resolved via env fallback alone (DB unreachable)', async () => {
    h.getBrokerTelephony.mockRejectedValue(new Error('supabase down'))
    vi.stubEnv('TWILIO_FORWARD_PAUL', '+15415023436')
    const res = await sendAgentSms({ to: '+15415023436', body: 'inventory update' })
    expect(res).toEqual({ ok: true, sid: 'SM_TEST' })
    expect(h.sendSms).toHaveBeenCalledWith({
      from: '+15412245025',
      to: '+15415023436',
      body: 'inventory update',
      mediaUrls: undefined,
    })
  })

  it('passes mediaUrls through to sendSms untouched', async () => {
    h.getBrokerTelephony.mockResolvedValue({
      bySlug: { matt: { twilioNumber: '+15417033095', forwardToCell: '+15417033095', smsOptIn: true } },
      byTwilioLast10: {},
    })
    await sendAgentSms({ to: '+15417033095', body: 'draft', mediaUrls: ['https://ryan-realty.com/x.jpg'] })
    expect(h.sendSms).toHaveBeenCalledWith({
      from: '+15412245025',
      to: '+15417033095',
      body: 'draft',
      mediaUrls: ['https://ryan-realty.com/x.jpg'],
    })
  })

  it('propagates a provider-level failure from sendSms without masking it as a whitelist rejection', async () => {
    h.getBrokerTelephony.mockResolvedValue({
      bySlug: { matt: { twilioNumber: '+15417033095', forwardToCell: '+15417033095', smsOptIn: true } },
      byTwilioLast10: {},
    })
    h.sendSms.mockResolvedValue({ ok: false, error: 'twilio down' })
    const res = await sendAgentSms({ to: '+15417033095', body: 'draft' })
    expect(res).toEqual({ ok: false, error: 'twilio down' })
  })
})
