/**
 * Flagged CMAs can be approved and delivered only with an explicit
 * acknowledgement. Every other queue refusal stays closed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CmaQueueRow } from '@/lib/data/cma/unified-queue'

const checkAdminAction = vi.fn()
vi.mock('@/lib/admin/require-admin', () => ({
  checkAdminAction: (...args: unknown[]) => checkAdminAction(...args),
}))

const listCmaQueue = vi.fn()
vi.mock('@/lib/data', async () => {
  const actual = await import('@/lib/data/cma/unified-queue')
  return {
    listCmaQueue: (...args: unknown[]) => listCmaQueue(...args),
    isSendableQueueState: actual.isSendableQueueState,
  }
})

const approveCmaAction = vi.fn()
const sendCmaToLeadAction = vi.fn()
vi.mock('@/app/actions/cma-admin', () => ({
  approveCmaAction: (...args: unknown[]) => approveCmaAction(...args),
  sendCmaToLeadAction: (...args: unknown[]) => sendCmaToLeadAction(...args),
}))

const enqueueProspectFirstTouchEmail = vi.fn()
const listQueuedFirstTouch = vi.fn()
const hardSkipQueuedFirstTouch = vi.fn()
vi.mock('@/lib/data/prospecting/drip-queue', () => ({
  enqueueProspectFirstTouchEmail: (...args: unknown[]) => enqueueProspectFirstTouchEmail(...args),
  listQueuedFirstTouch: (...args: unknown[]) => listQueuedFirstTouch(...args),
  hardSkipQueuedFirstTouch: (...args: unknown[]) => hardSkipQueuedFirstTouch(...args),
  findProspectForCmaSlug: vi.fn(),
}))

vi.mock('@/lib/cma/first-contact-override', () => ({
  saveCmaFirstContactOverride: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}))

import { approveAndDeliverCma } from '@/app/actions/cma-queue'

const FLAG = 'Failed ask cap: recommended list was above the expired ask.'

function row(over: Partial<CmaQueueRow> = {}): CmaQueueRow {
  return {
    id: 'id-1',
    slug: 'cma-test',
    docKind: 'cma',
    detailHref: '/admin/cmas/cma-test',
    docType: 'cma',
    status: 'draft',
    state: 'flagged',
    origin: 'seller-valuation',
    sendMode: 'now',
    address: '1 Test Way',
    city: 'Bend',
    subdivision: null,
    subjectListingKey: null,
    contactName: 'Ada',
    contactEmail: 'ada@example.com',
    brokerSlug: 'matthew-ryan',
    recommendedList: 500000,
    valueLow: 480000,
    valueHigh: 520000,
    compsCount: 4,
    theirPrice: null,
    theirPriceLabel: null,
    theirPriceDelta: null,
    offMarketAt: null,
    hasDocument: true,
    buildError: null,
    needsReview: true,
    auditVerdict: 'pass',
    reviewReason: FLAG,
    auditSummary: null,
    auditCriticalCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    deliveredAt: null,
    queuedAt: null,
    emailSentAt: null,
    prospectKind: null,
    prospectId: null,
    holdKind: null,
    holdDecided: true,
    ...over,
  }
}

beforeEach(() => {
  checkAdminAction.mockReset().mockResolvedValue({ ok: true, ctx: { email: 'matt@ryan-realty.com' } })
  listCmaQueue.mockReset().mockResolvedValue({ rows: [row()], total: 1 })
  approveCmaAction.mockReset().mockResolvedValue({ error: null })
  sendCmaToLeadAction.mockReset().mockResolvedValue({
    data: { transport: 'gmail', mailbox: 'matt@ryan-realty.com' },
    error: null,
  })
  enqueueProspectFirstTouchEmail.mockReset().mockResolvedValue({ ok: true, already: false })
  listQueuedFirstTouch.mockReset().mockResolvedValue([])
  hardSkipQueuedFirstTouch.mockReset().mockResolvedValue({ ok: true })
})

describe('approveAndDeliverCma flagged acknowledgement', () => {
  it('refuses a flagged row without acknowledgement and does not approve or send', async () => {
    const res = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })
    expect(res).toEqual({
      ok: false,
      blocked: 'state',
      needsReviewAck: true,
      reviewReason: FLAG,
      error: 'It is flagged for review. Open it and clear the flag before sending.',
    })
    expect(approveCmaAction).not.toHaveBeenCalled()
    expect(sendCmaToLeadAction).not.toHaveBeenCalled()
    expect(enqueueProspectFirstTouchEmail).not.toHaveBeenCalled()
  })

  it('delivers now when acknowledgeReview is true and forwards the acknowledgement', async () => {
    const ov = { subject: 'Your home', bodyText: 'Here is the report.' }
    const res = await approveAndDeliverCma('cma-test', ov, { delivery: 'now', acknowledgeReview: true })
    expect(approveCmaAction).toHaveBeenCalledTimes(1)
    expect(approveCmaAction).toHaveBeenCalledWith('cma-test', { acknowledgeReview: true, flagReason: FLAG })
    expect(sendCmaToLeadAction).toHaveBeenCalledWith('cma-test', ov)
    expect(enqueueProspectFirstTouchEmail).not.toHaveBeenCalled()
    expect(res).toEqual({ ok: true, outcome: 'sent', transport: 'gmail' })
  })

  it('queues the drip when acknowledgeReview is true and does not send now', async () => {
    listCmaQueue.mockResolvedValue({
      rows: [
        row({
          origin: 'expired',
          sendMode: 'drip',
          prospectKind: 'expired',
          prospectId: 'LK123',
        }),
      ],
      total: 1,
    })
    listQueuedFirstTouch.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    const res = await approveAndDeliverCma('cma-test', undefined, {
      delivery: 'drip',
      acknowledgeReview: true,
    })
    expect(approveCmaAction).toHaveBeenCalledWith('cma-test', { acknowledgeReview: true, flagReason: FLAG })
    expect(enqueueProspectFirstTouchEmail).toHaveBeenCalledWith('expired', 'LK123')
    expect(sendCmaToLeadAction).not.toHaveBeenCalled()
    expect(res).toEqual({ ok: true, outcome: 'queued', position: 2 })
  })

  it.each([
    ['audit-failed', 'audit'],
    ['unvetted', 'state'],
    ['failed', 'state'],
    ['building', 'state'],
    ['sent', 'state'],
    ['archived', 'state'],
  ] as const)('still refuses %s when acknowledgeReview is true', async (state, blocked) => {
    listCmaQueue.mockResolvedValue({
      rows: [row({ state, needsReview: false, auditCriticalCount: state === 'audit-failed' ? 2 : 0 })],
      total: 1,
    })
    const res = await approveAndDeliverCma('cma-test', undefined, {
      delivery: 'now',
      acknowledgeReview: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.blocked).toBe(blocked)
      expect(res.needsReviewAck).toBeUndefined()
    }
    expect(approveCmaAction).not.toHaveBeenCalled()
    expect(sendCmaToLeadAction).not.toHaveBeenCalled()
    expect(enqueueProspectFirstTouchEmail).not.toHaveBeenCalled()
  })

  it('refuses an audit review verdict without acknowledgement, then sends and passes flagReason', async () => {
    const auditSummary = 'The narrative overstates what the comps support.'
    listCmaQueue.mockResolvedValue({
      rows: [
        row({
          needsReview: false,
          auditVerdict: 'review',
          reviewReason: null,
          auditSummary,
        }),
      ],
      total: 1,
    })
    const refused = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })
    expect(refused).toEqual({
      ok: false,
      blocked: 'state',
      needsReviewAck: true,
      reviewReason: auditSummary,
      error: 'It is flagged for review. Open it and clear the flag before sending.',
    })
    expect(approveCmaAction).not.toHaveBeenCalled()
    expect(sendCmaToLeadAction).not.toHaveBeenCalled()

    const sent = await approveAndDeliverCma('cma-test', undefined, {
      delivery: 'now',
      acknowledgeReview: true,
    })
    expect(approveCmaAction).toHaveBeenCalledWith('cma-test', {
      acknowledgeReview: true,
      flagReason: auditSummary,
    })
    expect(sendCmaToLeadAction).toHaveBeenCalled()
    expect(sent).toEqual({ ok: true, outcome: 'sent', transport: 'gmail' })
  })

  it('uses the review verdict sentence when a flagged row has no reason and no audit summary', async () => {
    listCmaQueue.mockResolvedValue({
      rows: [
        row({
          needsReview: false,
          auditVerdict: 'review',
          reviewReason: '   ',
          auditSummary: null,
        }),
      ],
      total: 1,
    })
    const refused = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })
    expect(refused).toMatchObject({
      ok: false,
      needsReviewAck: true,
      reviewReason: 'The adversarial audit returned a review verdict.',
    })
    await approveAndDeliverCma('cma-test', undefined, { delivery: 'now', acknowledgeReview: true })
    expect(approveCmaAction).toHaveBeenCalledWith('cma-test', {
      acknowledgeReview: true,
      flagReason: 'The adversarial audit returned a review verdict.',
    })
  })

  it('does not send when approve still requires an acknowledgement', async () => {
    approveCmaAction.mockResolvedValue({
      error: `Flagged for broker review: ${FLAG}`,
      needsReviewAck: true,
    })
    const res = await approveAndDeliverCma('cma-test', undefined, {
      delivery: 'now',
      acknowledgeReview: true,
    })
    expect(res).toEqual({
      ok: false,
      blocked: 'state',
      needsReviewAck: true,
      reviewReason: FLAG,
      error: `Flagged for broker review: ${FLAG}`,
    })
    expect(sendCmaToLeadAction).not.toHaveBeenCalled()
  })
})
