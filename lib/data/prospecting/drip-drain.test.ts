/**
 * Drain gate: one successful send per tick; schedule refusal idles without peek.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getLastDripSentAt = vi.fn()
const peekOldestQueuedFirstTouch = vi.fn()
const hardSkipQueuedFirstTouch = vi.fn()
const verifyNotRelisted = vi.fn()
const verifyFsboStillActive = vi.fn()
const sendProspectingEmailIntro = vi.fn()

vi.mock('@/lib/data/prospecting/drip-queue', () => ({
  getLastDripSentAt: (...a: unknown[]) => getLastDripSentAt(...a),
  peekOldestQueuedFirstTouch: (...a: unknown[]) => peekOldestQueuedFirstTouch(...a),
  hardSkipQueuedFirstTouch: (...a: unknown[]) => hardSkipQueuedFirstTouch(...a),
}))

vi.mock('@/lib/data/prospecting/batch', () => ({
  verifyNotRelisted: (...a: unknown[]) => verifyNotRelisted(...a),
  verifyFsboStillActive: (...a: unknown[]) => verifyFsboStillActive(...a),
}))

vi.mock('@/app/actions/prospecting', () => ({
  sendProspectingEmailIntro: (...a: unknown[]) => sendProspectingEmailIntro(...a),
}))

import { drainProspectingFirstTouchDrip } from './drip-drain'

const THU_8AM_PT = new Date('2026-09-03T15:00:00.000Z')
const THU_8_02_PT = new Date('2026-09-03T15:02:00.000Z')

beforeEach(() => {
  getLastDripSentAt.mockReset()
  peekOldestQueuedFirstTouch.mockReset()
  hardSkipQueuedFirstTouch.mockReset()
  verifyNotRelisted.mockReset()
  verifyFsboStillActive.mockReset()
  sendProspectingEmailIntro.mockReset()
})

describe('drainProspectingFirstTouchDrip — one-at-a-time', () => {
  it('idles on spacing without peeking the queue', async () => {
    getLastDripSentAt.mockResolvedValue(THU_8AM_PT)
    const out = await drainProspectingFirstTouchDrip(THU_8_02_PT)
    expect(out).toEqual({ ok: true, action: 'idle', reason: 'spacing' })
    expect(peekOldestQueuedFirstTouch).not.toHaveBeenCalled()
    expect(sendProspectingEmailIntro).not.toHaveBeenCalled()
  })

  it('sends exactly one when the window is open and verify passes', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    peekOldestQueuedFirstTouch.mockResolvedValue({
      kind: 'expired',
      id: 'LK1',
      queuedAt: '2026-09-03T14:00:00.000Z',
      streetAddress: '123 Main St',
      city: 'Bend',
      expiredAt: '2026-08-01T00:00:00.000Z',
    })
    verifyNotRelisted.mockResolvedValue({ relisted: false, verifyFailed: false })
    sendProspectingEmailIntro.mockResolvedValue({
      ok: true,
      messageId: 'm1',
      personId: 1,
      sentAt: THU_8AM_PT.toISOString(),
      transport: 'gmail',
    })
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(out).toEqual({ ok: true, action: 'sent', kind: 'expired', id: 'LK1' })
    expect(sendProspectingEmailIntro).toHaveBeenCalledTimes(1)
    expect(sendProspectingEmailIntro).toHaveBeenCalledWith(
      'expired',
      'LK1',
      expect.objectContaining({ actor: 'drip-cron' }),
    )
  })

  it('hard-skips a relisted row fail-closed then continues to the next', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    peekOldestQueuedFirstTouch
      .mockResolvedValueOnce({
        kind: 'fsbo',
        id: 'https://fsbo.example/1',
        queuedAt: '2026-09-03T13:00:00.000Z',
        streetAddress: '9 Oak',
        city: 'Bend',
        expiredAt: '2026-08-15T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        kind: 'expired',
        id: 'LK2',
        queuedAt: '2026-09-03T13:30:00.000Z',
        streetAddress: '10 Oak',
        city: 'Bend',
        expiredAt: '2026-08-15T00:00:00.000Z',
      })
    verifyNotRelisted
      .mockResolvedValueOnce({ relisted: true, verifyFailed: false })
      .mockResolvedValueOnce({ relisted: false, verifyFailed: false })
    sendProspectingEmailIntro.mockResolvedValue({
      ok: true,
      messageId: 'm2',
      personId: 2,
      sentAt: THU_8AM_PT.toISOString(),
      transport: 'gmail',
    })
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(hardSkipQueuedFirstTouch).toHaveBeenCalledTimes(1)
    expect(out).toEqual({ ok: true, action: 'sent', kind: 'expired', id: 'LK2' })
    expect(sendProspectingEmailIntro).toHaveBeenCalledTimes(1)
  })
})
