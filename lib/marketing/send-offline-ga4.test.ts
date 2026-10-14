import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  fireGa4Event: vi.fn(),
  withSendIdempotency: vi.fn(async (_args: unknown, run: () => Promise<unknown>) => run()),
}))

vi.mock('@/lib/ga4-measurement-protocol', () => ({
  fireGa4Event: (args: unknown) => h.fireGa4Event(args),
}))
vi.mock('@/lib/crm/idempotency', () => ({
  withSendIdempotency: (args: unknown, run: () => Promise<unknown>) => h.withSendIdempotency(args, run),
}))

import { sendOfflineGa4Conversion } from './send-offline-ga4'

const EVENT = { eventName: 'qualify_lead' as const, leadType: 'buyer_contract', stageKey: 'buyer-contract' }

beforeEach(() => {
  h.fireGa4Event.mockReset()
  h.fireGa4Event.mockResolvedValue({ ok: true, clientId: '123.456', status: 204 })
  h.withSendIdempotency.mockClear()
})

describe('sendOfflineGa4Conversion', () => {
  it('fires qualify_lead with lead_type and the stored client_id, no value or currency', async () => {
    const res = await sendOfflineGa4Conversion({
      personId: 64115,
      event: EVENT,
      clientId: '123.456',
    })
    expect(res).toEqual({ ok: true, eventId: 'person:64115:buyer-contract' })
    expect(h.fireGa4Event).toHaveBeenCalledWith({
      eventName: 'qualify_lead',
      clientId: '123.456',
      eventParams: { lead_type: 'buyer_contract' },
    })
    const params = h.fireGa4Event.mock.calls[0][0].eventParams
    expect(params).not.toHaveProperty('value')
    expect(params).not.toHaveProperty('currency')
  })

  it('fires close_convert_lead for Closed', async () => {
    await sendOfflineGa4Conversion({
      personId: 10,
      event: { eventName: 'close_convert_lead', leadType: 'closed', stageKey: 'closed' },
      clientId: '1.2',
    })
    expect(h.fireGa4Event).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'close_convert_lead', clientId: '1.2' }),
    )
  })

  it('dry run sends nothing', async () => {
    const res = await sendOfflineGa4Conversion({
      personId: 64115,
      event: EVENT,
      clientId: '123.456',
      dryRun: true,
    })
    expect(res).toEqual({ ok: true, eventId: 'person:64115:buyer-contract', dryRun: true })
    expect(h.fireGa4Event).not.toHaveBeenCalled()
    expect(h.withSendIdempotency).not.toHaveBeenCalled()
  })

  it('keys the ledger person+stage so a retry does not resend', async () => {
    await sendOfflineGa4Conversion({ personId: 7, event: EVENT, clientId: '1.2' })
    expect(h.withSendIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'person:7:buyer-contract',
        scope: 'ga4_offline_conversion',
      }),
      expect.any(Function),
    )
  })

  it('returns the helper error when Measurement Protocol fails', async () => {
    h.fireGa4Event.mockResolvedValue({ ok: false, error: 'GA4_API_SECRET_MISSING' })
    const res = await sendOfflineGa4Conversion({ personId: 7, event: EVENT, clientId: '1.2' })
    expect(res).toEqual({
      ok: false,
      eventId: 'person:7:buyer-contract',
      error: 'GA4_API_SECRET_MISSING',
    })
  })
})
