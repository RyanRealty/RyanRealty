import { describe, expect, it } from 'vitest'

import { isWebhookErrorCode, misroutedNumbers, optOutStateFromInbound } from './twilio-line-health'

describe('optOutStateFromInbound', () => {
  it('is opted in with no keyword on record', () => {
    expect(optOutStateFromInbound([])).toEqual({ optedOut: false })
    expect(optOutStateFromInbound([{ body: 'Mario', dateCreated: 'Sun, 13 Sep 2026 18:25:57 +0000' }])).toEqual({ optedOut: false })
  })

  it('reads the 2026-09-13 case: "Stop" after a normal text opts the cell out', () => {
    expect(
      optOutStateFromInbound([
        { body: 'Mario', dateCreated: 'Sun, 13 Sep 2026 18:25:57 +0000' },
        { body: 'Stop', dateCreated: 'Sun, 13 Sep 2026 18:26:00 +0000' },
      ]),
    ).toEqual({ optedOut: true, since: '2026-09-13T18:26:00.000Z' })
  })

  it('the latest keyword wins, whatever order the list arrives in', () => {
    const stop = { body: 'STOP', dateCreated: '2026-09-13T18:26:00Z' }
    const start = { body: ' start ', dateCreated: '2026-09-25T15:00:00Z' }
    expect(optOutStateFromInbound([stop, start])).toEqual({ optedOut: false })
    expect(optOutStateFromInbound([start, stop])).toEqual({ optedOut: false })
    expect(optOutStateFromInbound([{ ...start, dateCreated: '2026-09-01T00:00:00Z' }, stop]).optedOut).toBe(true)
  })

  it('a keyword must be the whole message', () => {
    expect(optOutStateFromInbound([{ body: 'please stop the texts about the showing', dateCreated: '2026-09-13T18:26:00Z' }])).toEqual({
      optedOut: false,
    })
    expect(optOutStateFromInbound([{ body: 'Unsubscribe.', dateCreated: '2026-09-13T18:26:00Z' }]).optedOut).toBe(true)
  })
})

describe('isWebhookErrorCode', () => {
  it('matches HTTP retrieval and TwiML parse failures only', () => {
    for (const c of [11200, 11205, 11299, 12100, 12300, '11200']) expect(isWebhookErrorCode(c), String(c)).toBe(true)
    for (const c of [21610, 30006, 11199, 12400, null, undefined, 'x']) expect(isWebhookErrorCode(c), String(c)).toBe(false)
  })
})

describe('misroutedNumbers', () => {
  const origin = 'https://ryan-realty.com'
  it('passes lines that route to our twilio routes', () => {
    expect(
      misroutedNumbers(
        [{ phoneNumber: '+15412245025', smsUrl: `${origin}/api/twilio/inbound-sms`, voiceUrl: `${origin}/api/twilio/voice` }],
        origin,
      ),
    ).toEqual([])
  })
  it('flags a line whose sms or voice webhook points elsewhere or nowhere', () => {
    expect(
      misroutedNumbers(
        [
          { phoneNumber: '+1', smsUrl: 'https://demo.twilio.com/welcome/sms/reply', voiceUrl: `${origin}/api/twilio/voice` },
          { phoneNumber: '+2', smsUrl: `${origin}/api/twilio/inbound-sms`, voiceUrl: null },
          { phoneNumber: '+3', smsUrl: 'https://old-host.example/api/twilio/inbound-sms', voiceUrl: `${origin}/api/twilio/voice` },
        ],
        `${origin}/`,
      ),
    ).toEqual(['+1', '+2', '+3'])
  })
})
