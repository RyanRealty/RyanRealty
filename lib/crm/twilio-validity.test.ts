import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A text sent under quiet hours carries validUntil (8:00pm local, from
 * smsWindowCloseAt). sendSms and sendSmsViaMessagingService turn it into
 * Twilio's ValidityPeriod, so a text still in Twilio's queue at 8pm is dropped
 * rather than delivered after Oregon's cutoff (ORS 646.563). Twilio accepts
 * 1 to 36,000 seconds and recommends more than 5.
 */

const h = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('@/lib/http/fetchJson', () => ({ resilientFetch: h.fetch }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/data/crm/getBrokerTelephony', () => ({ getBrokerTelephony: vi.fn() }))

import { sendSms, sendSmsViaMessagingService, validityPeriodSeconds } from './twilio'

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response

beforeEach(() => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC_test')
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'token')
  vi.stubEnv('TWILIO_MESSAGING_SERVICE_SID', 'MG_test')
  h.fetch.mockImplementation(async (url: string) =>
    url.includes('/Compliance/Usa2p')
      ? json({ compliance: [{ campaign_status: 'VERIFIED' }] })
      : json({ sid: 'SM1', status: 'queued' }),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

/** The form body of the Messages.json POST, or null when none was made. */
function postedForm(): URLSearchParams | null {
  const call = h.fetch.mock.calls.find(([url]) => String(url).endsWith('/Messages.json'))
  return call ? (call[1] as { body: URLSearchParams }).body : null
}

describe('validityPeriodSeconds', () => {
  const now = Date.parse('2026-06-25T02:55:00Z') // 7:55pm PDT
  it('is the whole seconds left until validUntil', () => {
    expect(validityPeriodSeconds(new Date('2026-06-25T03:00:00Z'), now)).toBe(300)
    expect(validityPeriodSeconds(new Date(now + 10_999), now)).toBe(10)
  })
  it('refuses when too little time is left for Twilio to send', () => {
    expect(validityPeriodSeconds(new Date(now + 5_999), now)).toBeNull()
    expect(validityPeriodSeconds(new Date(now - 1_000), now)).toBeNull()
  })
  it('caps at the 36,000 s Twilio accepts', () => {
    expect(validityPeriodSeconds(new Date(now + 20 * 3_600_000), now)).toBe(36_000)
  })
})

describe('sendSms / sendSmsViaMessagingService ValidityPeriod', () => {
  it('sets ValidityPeriod from validUntil on a broker-line send', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-24T19:00:00Z')) // noon PDT
    const res = await sendSms({ from: '+15415550000', to: '+15415551234', body: 'hi', validUntil: new Date('2026-06-25T03:00:00Z') })
    expect(res).toEqual({ ok: true, sid: 'SM1' })
    expect(postedForm()?.get('ValidityPeriod')).toBe(String(8 * 3600))
  })

  it('sets it on a messaging-service send too', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-25T02:50:00Z')) // 7:50pm PDT
    const res = await sendSmsViaMessagingService({ to: '+15415551234', body: 'hi', validUntil: new Date('2026-06-25T03:00:00Z') })
    expect(res).toEqual({ ok: true, sid: 'SM1' })
    expect(postedForm()?.get('ValidityPeriod')).toBe('600')
  })

  it('sends nothing when the window closes before Twilio could deliver', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-25T02:59:57Z')) // 7:59:57pm PDT
    const res = await sendSms({ from: '+15415550000', to: '+15415551234', body: 'hi', validUntil: new Date('2026-06-25T03:00:00Z') })
    expect(res.ok).toBe(false)
    expect(postedForm()).toBeNull()
  })

  it('leaves ValidityPeriod unset when no bound is passed (an override or an internal text)', async () => {
    const res = await sendSms({ from: '+15415550000', to: '+15415551234', body: 'hi' })
    expect(res).toEqual({ ok: true, sid: 'SM1' })
    expect(postedForm()?.has('ValidityPeriod')).toBe(false)
  })
})
