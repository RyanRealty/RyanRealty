/**
 * Drain gate: one successful send per tick; schedule refusal idles without peek.
 * Plus the 2026-09-29 fixes: stuck sends are settled first, a fresh claim
 * anywhere makes the drain stand down (one drain at a time), and a claim held
 * by another run ('in-progress') is never read as "already sent".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getLastDripSentAt = vi.fn()
const peekOldestQueuedFirstTouch = vi.fn()
const hardSkipQueuedFirstTouch = vi.fn()
const findInFlightFirstTouchSend = vi.fn()
const recoverStuckFirstTouchSends = vi.fn()
const verifyNotRelisted = vi.fn()
const verifyFsboStillActive = vi.fn()
const sendProspectingEmailIntro = vi.fn()
const getProspect = vi.fn()
const loadCmaFirstContactOverride = vi.fn()

vi.mock('@/lib/data/prospecting/drip-queue', () => ({
  getLastDripSentAt: (...a: unknown[]) => getLastDripSentAt(...a),
  peekOldestQueuedFirstTouch: (...a: unknown[]) => peekOldestQueuedFirstTouch(...a),
  hardSkipQueuedFirstTouch: (...a: unknown[]) => hardSkipQueuedFirstTouch(...a),
  findInFlightFirstTouchSend: (...a: unknown[]) => findInFlightFirstTouchSend(...a),
}))

vi.mock('@/lib/data/prospecting/drip-recover', () => ({
  recoverStuckFirstTouchSends: (...a: unknown[]) => recoverStuckFirstTouchSends(...a),
}))

vi.mock('@/lib/data/prospecting/batch', () => ({
  verifyNotRelisted: (...a: unknown[]) => verifyNotRelisted(...a),
  verifyFsboStillActive: (...a: unknown[]) => verifyFsboStillActive(...a),
}))

vi.mock('@/app/actions/prospecting', () => ({
  sendProspectingEmailIntro: (...a: unknown[]) => sendProspectingEmailIntro(...a),
}))

vi.mock('@/lib/data', () => ({
  getProspect: (...a: unknown[]) => getProspect(...a),
}))

vi.mock('@/lib/cma/first-contact-override', () => ({
  loadCmaFirstContactOverride: (...a: unknown[]) => loadCmaFirstContactOverride(...a),
}))

import { DRIP_RECOVERY_SEND_BUDGET_MS, drainProspectingFirstTouchDrip } from './drip-drain'

const THU_8AM_PT = new Date('2026-09-03T15:00:00.000Z')
const THU_8_02_PT = new Date('2026-09-03T15:02:00.000Z')
const SAT_10AM_PT = new Date('2026-09-05T17:00:00.000Z')

const QUEUED_LK1 = {
  kind: 'expired' as const,
  id: 'LK1',
  queuedAt: '2026-09-03T14:00:00.000Z',
  streetAddress: '123 Main St',
  city: 'Bend',
  expiredAt: '2026-08-01T00:00:00.000Z',
}

const SENT_OK = {
  ok: true,
  messageId: 'm1',
  personId: 1,
  sentAt: THU_8AM_PT.toISOString(),
  transport: 'gmail',
}

beforeEach(() => {
  getLastDripSentAt.mockReset()
  peekOldestQueuedFirstTouch.mockReset()
  hardSkipQueuedFirstTouch.mockReset()
  findInFlightFirstTouchSend.mockReset()
  recoverStuckFirstTouchSends.mockReset()
  verifyNotRelisted.mockReset()
  verifyFsboStillActive.mockReset()
  sendProspectingEmailIntro.mockReset()
  getProspect.mockReset()
  loadCmaFirstContactOverride.mockReset()
  getProspect.mockResolvedValue(null)
  loadCmaFirstContactOverride.mockResolvedValue(null)
  recoverStuckFirstTouchSends.mockResolvedValue([])
  findInFlightFirstTouchSend.mockResolvedValue(null)
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
    peekOldestQueuedFirstTouch.mockResolvedValue(QUEUED_LK1)
    verifyNotRelisted.mockResolvedValue({ relisted: false, verifyFailed: false })
    sendProspectingEmailIntro.mockResolvedValue(SENT_OK)
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(out).toEqual({ ok: true, action: 'sent', kind: 'expired', id: 'LK1' })
    expect(sendProspectingEmailIntro).toHaveBeenCalledTimes(1)
    expect(sendProspectingEmailIntro).toHaveBeenCalledWith(
      'expired',
      'LK1',
      expect.objectContaining({
        actor: 'drip-cron',
        subjectOverride: null,
        bodyOverride: null,
      }),
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
    sendProspectingEmailIntro.mockResolvedValue({ ...SENT_OK, messageId: 'm2', personId: 2 })
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(hardSkipQueuedFirstTouch).toHaveBeenCalledTimes(1)
    expect(out).toEqual({ ok: true, action: 'sent', kind: 'expired', id: 'LK2' })
    expect(sendProspectingEmailIntro).toHaveBeenCalledTimes(1)
  })
})

describe('drainProspectingFirstTouchDrip — busy guard (B)', () => {
  it('stands down before peeking when a claim is still in flight', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    findInFlightFirstTouchSend.mockResolvedValue({
      kind: 'expired',
      id: 'LK9',
      claimAt: '2026-09-03T14:58:30.000Z',
    })
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(out).toEqual({
      ok: true,
      action: 'busy',
      reason: 'in-flight',
      kind: 'expired',
      id: 'LK9',
      claimAt: '2026-09-03T14:58:30.000Z',
    })
    expect(findInFlightFirstTouchSend).toHaveBeenCalledWith(THU_8AM_PT)
    expect(peekOldestQueuedFirstTouch).not.toHaveBeenCalled()
    expect(verifyNotRelisted).not.toHaveBeenCalled()
    expect(sendProspectingEmailIntro).not.toHaveBeenCalled()
    expect(hardSkipQueuedFirstTouch).not.toHaveBeenCalled()
  })

  it('fails closed (sends nothing) when the in-flight read fails', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    findInFlightFirstTouchSend.mockRejectedValue(new Error('in-flight read (expired) failed: boom'))
    await expect(drainProspectingFirstTouchDrip(THU_8AM_PT)).rejects.toThrow(/in-flight read/)
    expect(peekOldestQueuedFirstTouch).not.toHaveBeenCalled()
    expect(sendProspectingEmailIntro).not.toHaveBeenCalled()
  })

  it('does not read the in-flight claims outside the send window', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    const out = await drainProspectingFirstTouchDrip(SAT_10AM_PT)
    expect(out).toEqual({ ok: true, action: 'idle', reason: 'weekend' })
    expect(findInFlightFirstTouchSend).not.toHaveBeenCalled()
  })
})

describe("drainProspectingFirstTouchDrip — 'in-progress' is not 'already-sent' (C)", () => {
  it('stands down and leaves the row queued when another run holds the claim', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    peekOldestQueuedFirstTouch.mockResolvedValue(QUEUED_LK1)
    verifyNotRelisted.mockResolvedValue({ relisted: false, verifyFailed: false })
    sendProspectingEmailIntro.mockResolvedValue({
      ok: false,
      error: 'Another send to this owner is in progress. Check back in a few minutes before sending again.',
      code: 'in-progress',
    })
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(out).toEqual({ ok: true, action: 'busy', reason: 'claimed-elsewhere', kind: 'expired', id: 'LK1' })
    expect(hardSkipQueuedFirstTouch).not.toHaveBeenCalled()
    // Stood down on the first row: no second peek, no second send.
    expect(peekOldestQueuedFirstTouch).toHaveBeenCalledTimes(1)
    expect(sendProspectingEmailIntro).toHaveBeenCalledTimes(1)
  })

  it('still dequeues a real already-sent refusal', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    peekOldestQueuedFirstTouch.mockResolvedValueOnce(QUEUED_LK1).mockResolvedValueOnce(null)
    verifyNotRelisted.mockResolvedValue({ relisted: false, verifyFailed: false })
    sendProspectingEmailIntro.mockResolvedValue({
      ok: false,
      error: 'Intro already emailed to this owner.',
      code: 'already-sent',
    })
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(hardSkipQueuedFirstTouch).toHaveBeenCalledWith('expired', 'LK1', 'send-refused:already-sent')
    expect(out).toEqual({ ok: true, action: 'skipped-all', skipped: 1 })
  })

  it('leaves the row alone and reports the error on a send failure', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    peekOldestQueuedFirstTouch.mockResolvedValue(QUEUED_LK1)
    verifyNotRelisted.mockResolvedValue({ relisted: false, verifyFailed: false })
    sendProspectingEmailIntro.mockResolvedValue({ ok: false, error: 'PDF render failed: x', code: 'send-failed' })
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(out).toEqual({ ok: false, error: 'PDF render failed: x', kind: 'expired', id: 'LK1' })
    expect(hardSkipQueuedFirstTouch).not.toHaveBeenCalled()
  })
})

describe('drainProspectingFirstTouchDrip — stuck sends are settled first (D)', () => {
  it('stops after a recovery that changed a row, without sending', async () => {
    const recovered = [
      {
        kind: 'expired',
        id: '20260819192123649950000000',
        claimAt: '2026-09-29T22:55:27.279426+00:00',
        outcome: 'released',
        requeued: true,
      },
    ]
    recoverStuckFirstTouchSends.mockResolvedValue(recovered)
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(out).toEqual({ ok: true, action: 'recovered', recovered })
    expect(recoverStuckFirstTouchSends).toHaveBeenCalledWith(THU_8AM_PT)
    expect(getLastDripSentAt).not.toHaveBeenCalled()
    expect(peekOldestQueuedFirstTouch).not.toHaveBeenCalled()
    expect(sendProspectingEmailIntro).not.toHaveBeenCalled()
  })

  it('stops after finalizing a send that had left', async () => {
    recoverStuckFirstTouchSends.mockResolvedValue([
      { kind: 'fsbo', id: 'u', claimAt: 'c', outcome: 'finalized', via: 'gmail-sent', messageId: 'g1', sentAt: 's' },
    ])
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(out).toMatchObject({ ok: true, action: 'recovered' })
    expect(sendProspectingEmailIntro).not.toHaveBeenCalled()
  })

  it('does not start a send after a recovery phase that ran past its budget', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      recoverStuckFirstTouchSends.mockImplementation(async () => {
        vi.setSystemTime(Date.now() + DRIP_RECOVERY_SEND_BUDGET_MS + 1)
        return [{ kind: 'expired', id: 'STUCK', claimAt: 'c', outcome: 'unresolved', reason: 'Gmail timed out' }]
      })
      getLastDripSentAt.mockResolvedValue(null)
      const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
      expect(out).toMatchObject({ ok: true, action: 'recovered' })
      expect(getLastDripSentAt).not.toHaveBeenCalled()
      expect(sendProspectingEmailIntro).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('carries on to the next owner when a stuck row could only be left alone', async () => {
    recoverStuckFirstTouchSends.mockResolvedValue([
      { kind: 'expired', id: 'STUCK', claimAt: 'c', outcome: 'unresolved', reason: 'could not check Gmail Sent' },
      { kind: 'expired', id: 'MOVED', claimAt: 'c', outcome: 'changed' },
    ])
    getLastDripSentAt.mockResolvedValue(null)
    peekOldestQueuedFirstTouch.mockResolvedValue(QUEUED_LK1)
    verifyNotRelisted.mockResolvedValue({ relisted: false, verifyFailed: false })
    sendProspectingEmailIntro.mockResolvedValue(SENT_OK)
    const out = await drainProspectingFirstTouchDrip(THU_8AM_PT)
    expect(out).toEqual({ ok: true, action: 'sent', kind: 'expired', id: 'LK1' })
  })

  it('settles stuck sends outside the send window too (settling never emails anyone)', async () => {
    getLastDripSentAt.mockResolvedValue(null)
    const out = await drainProspectingFirstTouchDrip(SAT_10AM_PT)
    expect(recoverStuckFirstTouchSends).toHaveBeenCalledWith(SAT_10AM_PT)
    expect(out).toEqual({ ok: true, action: 'idle', reason: 'weekend' })
  })

  it('fails closed when the stuck-send read itself fails', async () => {
    recoverStuckFirstTouchSends.mockRejectedValue(new Error('stuck sends read (expired) failed: down'))
    await expect(drainProspectingFirstTouchDrip(THU_8AM_PT)).rejects.toThrow(/stuck sends read/)
    expect(sendProspectingEmailIntro).not.toHaveBeenCalled()
  })
})
