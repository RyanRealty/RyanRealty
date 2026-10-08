/**
 * Send now from the queue, with the owner's email slot behind it.
 *
 * sendCmaToLead now claims the owner's prospect row (lib/cma/prospect-send-claim.ts).
 * That must not disturb approveAndDeliverCma: a row already waiting in the
 * weekday drip can still be sent now, the drip dequeue still runs after a send
 * that went out, and a send the claim refused leaves the queue exactly as it was.
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

const order: string[] = []
const approveCmaAction = vi.fn()
const sendCmaToLeadAction = vi.fn()
vi.mock('@/app/actions/cma-admin', () => ({
  approveCmaAction: (...args: unknown[]) => approveCmaAction(...args),
  sendCmaToLeadAction: (...args: unknown[]) => sendCmaToLeadAction(...args),
}))

const hardSkipQueuedFirstTouch = vi.fn()
vi.mock('@/lib/data/prospecting/drip-queue', () => ({
  enqueueProspectFirstTouchEmail: vi.fn(),
  listQueuedFirstTouch: vi.fn(),
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

function row(over: Partial<CmaQueueRow> = {}): CmaQueueRow {
  return {
    id: 'id-1',
    slug: 'cma-test',
    docKind: 'cma',
    detailHref: '/admin/cmas/cma-test',
    docType: 'cma',
    status: 'finalized',
    state: 'queued',
    origin: 'expired',
    sendMode: 'drip',
    address: '1 Test Way',
    city: 'Bend',
    subdivision: null,
    subjectListingKey: 'LK123',
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
    needsReview: false,
    auditVerdict: 'pass',
    reviewReason: null,
    auditSummary: null,
    auditCriticalCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    deliveredAt: null,
    queuedAt: '2026-09-28T15:00:00.000Z',
    emailSentAt: null,
    prospectKind: 'expired',
    prospectId: 'LK123',
    holdKind: null,
    holdDecided: true,
    ...over,
  }
}

beforeEach(() => {
  order.length = 0
  checkAdminAction.mockReset().mockResolvedValue({ ok: true, ctx: { email: 'matt@ryan-realty.com' } })
  listCmaQueue.mockReset().mockResolvedValue({ rows: [row()], total: 1 })
  approveCmaAction.mockReset().mockResolvedValue({ error: null })
  sendCmaToLeadAction.mockReset().mockImplementation(async () => {
    order.push('send')
    return { data: { transport: 'gmail', mailbox: 'matt@ryan-realty.com' }, error: null }
  })
  hardSkipQueuedFirstTouch.mockReset().mockImplementation(async () => {
    order.push('hard-skip')
  })
})

describe('approveAndDeliverCma: Send now on a row already waiting in the drip', () => {
  it('sends without re-approving, then runs the drip dequeue after the send', async () => {
    const res = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })

    expect(res).toEqual({ ok: true, outcome: 'sent', transport: 'gmail' })
    expect(approveCmaAction).not.toHaveBeenCalled()
    expect(sendCmaToLeadAction).toHaveBeenCalledWith('cma-test', undefined)
    expect(hardSkipQueuedFirstTouch).toHaveBeenCalledWith('expired', 'LK123', 'manual-send-now')
    expect(order).toEqual(['send', 'hard-skip'])
  })

  it('leaves the queue untouched when the owner claim refuses the send', async () => {
    sendCmaToLeadAction.mockResolvedValue({
      data: null,
      error: 'Not sent. This owner was already emailed for this home, so a second first-contact email is blocked.',
    })
    const res = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })

    expect(res).toEqual({
      ok: false,
      error: 'Send failed: Not sent. This owner was already emailed for this home, so a second first-contact email is blocked.',
    })
    expect(hardSkipQueuedFirstTouch).not.toHaveBeenCalled()
  })
})

describe('approveAndDeliverCma: Send now on a draft already in the drip', () => {
  it('finalizes the draft before the send', async () => {
    listCmaQueue.mockResolvedValue({
      rows: [row({ status: 'draft', state: 'queued' })],
      total: 1,
    })
    const res = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })
    expect(res).toEqual({ ok: true, outcome: 'sent', transport: 'gmail' })
    expect(approveCmaAction).toHaveBeenCalledTimes(1)
    expect(sendCmaToLeadAction).toHaveBeenCalledWith('cma-test', undefined)
  })
})

describe('approveAndDeliverCma: Send now on a row that was Ready', () => {
  it('approves, sends, then dequeues; a refusal is reported after the approval', async () => {
    listCmaQueue.mockResolvedValue({
      rows: [row({ state: 'ready', queuedAt: null, sendMode: 'now', origin: 'expired' })],
      total: 1,
    })
    sendCmaToLeadAction.mockResolvedValueOnce({
      data: null,
      error: 'Not sent. Another send to this owner is in progress right now (the weekday drip or another tab).',
    })
    const refused = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })
    expect(refused).toEqual({
      ok: false,
      error: 'Approved, but the send failed: Not sent. Another send to this owner is in progress right now (the weekday drip or another tab).',
    })
    expect(approveCmaAction).toHaveBeenCalledTimes(1)
    expect(hardSkipQueuedFirstTouch).not.toHaveBeenCalled()

    const sent = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })
    expect(sent).toEqual({ ok: true, outcome: 'sent', transport: 'gmail' })
    expect(hardSkipQueuedFirstTouch).toHaveBeenCalledWith('expired', 'LK123', 'manual-send-now')
  })
})
