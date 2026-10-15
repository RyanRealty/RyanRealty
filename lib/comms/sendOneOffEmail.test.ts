import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendGovernedEmail = vi.fn()
const findExistingOneOffSend = vi.fn()

vi.mock('@/lib/comms/sendGovernedEmail', () => ({
  sendGovernedEmail: (...args: unknown[]) => sendGovernedEmail(...args),
}))
vi.mock('@/lib/data/email/one-off-send-state', () => ({
  findExistingOneOffSend: (...args: unknown[]) => findExistingOneOffSend(...args),
}))

import { oneOffEmailKey, sendOneOffEmail } from './sendOneOffEmail'

const base = {
  personId: 64825,
  to: 'elizemarais95@gmail.com',
  subject: 'Tetherow, Today: a snapshot for you',
  html: '<p><a href="https://ryan-realty.com/listing/1">Home</a><img src="https://cdn.example/map.png" alt="map"></p>',
  sendKey: 'oneoff:tetherow-elize',
  from: 'matt@ryan-realty.com',
}

describe('sendOneOffEmail', () => {
  beforeEach(() => {
    sendGovernedEmail.mockReset()
    findExistingOneOffSend.mockReset()
    findExistingOneOffSend.mockResolvedValue({ emailEventId: null, timelineId: null, messageId: null })
  })

  it('refuses a second send when a prior event or timeline row exists', async () => {
    findExistingOneOffSend.mockResolvedValue({ emailEventId: 9, timelineId: 11, messageId: 're_old' })
    const res = await sendOneOffEmail(base)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/Already sent/)
    expect(sendGovernedEmail).not.toHaveBeenCalled()
  })

  it('refuses HTML that still has a relative image src', async () => {
    const res = await sendOneOffEmail({ ...base, html: '<img src="tetherow-map-v2.png" alt="map">' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/tetherow-map-v2\.png/)
    expect(sendGovernedEmail).not.toHaveBeenCalled()
  })

  it('sends once through the governed Resend rail with tracking key', async () => {
    sendGovernedEmail.mockResolvedValue({ ok: true, providerId: 're_1' })
    const res = await sendOneOffEmail(base)
    expect(res).toEqual({
      ok: true,
      providerId: 're_1',
      emailKey: oneOffEmailKey(base.sendKey, base.personId),
    })
    expect(sendGovernedEmail).toHaveBeenCalledTimes(1)
    expect(sendGovernedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 64825,
        purpose: 'oneoff:tetherow-elize',
        idempotencyKey: 'oneoff:tetherow-elize',
        initiator: { kind: 'broker', broker: 'matt', source: 'one-off' },
        payload: expect.objectContaining({
          rail: 'resend',
          to: 'elizemarais95@gmail.com',
          subject: base.subject,
          from: '"Matt Ryan · Ryan Realty" <matt@ryan-realty.com>',
          replyTo: 'matt@ryan-realty.com',
        }),
      }),
    )
  })
})
