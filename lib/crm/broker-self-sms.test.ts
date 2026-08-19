import { afterEach, describe, expect, it, vi } from 'vitest'
import { last10 } from '@/lib/crm/alert-drain-core'

const CLIENT = '+15417030001'

vi.mock('@/lib/data/crm/getBrokerTelephony', () => ({
  getBrokerTelephony: vi.fn(async () => ({
    bySlug: {
      matt: { twilioNumber: '+15417033095', forwardToCell: '+15415551234', smsOptIn: false },
    },
    byTwilioLast10: {},
  })),
}))

vi.mock('@/lib/data/crm/brokerSelfAlert', () => ({
  insertBrokerSelfAlert: vi.fn(async () => undefined),
}))

describe('sendCmaReviewLinkToBroker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('sends the review link to the broker cell and never to the CMA client phone', async () => {
    vi.stubEnv('TWILIO_FORWARD_MATT', '+15415551234')
    vi.stubEnv('TWILIO_FORWARD_REBECCA', '+15415552345')
    vi.stubEnv('TWILIO_FORWARD_PAUL', '+15415553456')
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest')
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token')
    vi.stubEnv('TWILIO_MESSAGING_SERVICE_SID', 'MGtest')

    const posted: Array<{ to: string; body: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const params = new URLSearchParams(String(init?.body ?? ''))
        posted.push({ to: params.get('To') ?? '', body: params.get('Body') ?? '' })
        return {
          ok: true,
          status: 201,
          json: async () => ({ sid: 'SMtest' }),
        }
      }),
    )

    const { sendCmaReviewLinkToBroker } = await import('@/lib/crm/broker-self-sms')
    const res = await sendCmaReviewLinkToBroker({
      slug: '648-se-douglas-bend-97702',
      subjectAddress: '648 SE Douglas Ave, Bend',
      broker: 'matt',
      clientPhones: [CLIENT, '541-703-0002'],
    })

    expect(res).toEqual({ error: null })
    expect(posted).toHaveLength(1)
    expect(posted[0].to).toBe('+15415551234')
    expect(last10(posted[0].to)).not.toBe(last10(CLIENT))
    expect(posted[0].body).toContain('https://ryan-realty.com/admin/cmas/648-se-douglas-bend-97702')
    expect(posted[0].body).not.toContain(CLIENT)
    expect(posted[0].body).not.toMatch(/Jane|Odessa|Nealon/i)
  })

  it('refuses to POST when the resolved number is not a broker line', async () => {
    vi.stubEnv('TWILIO_FORWARD_MATT', '+15415551234')
    vi.stubEnv('TWILIO_FORWARD_REBECCA', '+15415552345')
    vi.stubEnv('TWILIO_FORWARD_PAUL', '+15415553456')
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest')
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'token')
    vi.stubEnv('TWILIO_MESSAGING_SERVICE_SID', 'MGtest')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { sendWhitelistedBrokerSms } = await import('@/lib/crm/broker-self-sms')
    const res = await sendWhitelistedBrokerSms({ to: CLIENT, body: 'hi' })
    expect(res.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
