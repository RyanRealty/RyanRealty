/**
 * A recommendation more than 15% under the last ask, or any amount above it,
 * is not approved onto a lane. It is not enqueued and it is not sent.
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

function row(over: Partial<CmaQueueRow> = {}): CmaQueueRow {
  return {
    id: 'id-1',
    slug: 'cma-test',
    docKind: 'cma',
    detailHref: '/admin/cmas/cma-test',
    docType: 'cma',
    status: 'draft',
    state: 'ready',
    origin: 'expired',
    sendMode: 'drip',
    address: '3759 45th',
    city: 'Redmond',
    subdivision: 'Redtail Ridge',
    subjectListingKey: null,
    contactName: 'Ada',
    contactEmail: 'ada@example.com',
    brokerSlug: 'matthew-ryan',
    recommendedList: 800_000,
    valueLow: 770_000,
    valueHigh: 850_000,
    compsCount: 5,
    theirPrice: 849_000,
    theirPriceLabel: 'Last ask',
    theirPriceDelta: null,
    offMarketAt: null,
    hasDocument: true,
    buildError: null,
    needsReview: false,
    auditVerdict: 'pass',
    reviewReason: null,
    auditSummary: null,
    auditCriticalCount: 0,
    createdAt: '2026-09-28T00:00:00.000Z',
    deliveredAt: null,
    queuedAt: null,
    emailSentAt: null,
    prospectKind: 'expired',
    prospectId: 'LK123',
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
  listQueuedFirstTouch.mockReset().mockResolvedValue([{ id: 'a' }])
  hardSkipQueuedFirstTouch.mockReset().mockResolvedValue({ ok: true })
})

describe('approveAndDeliverCma gap hold', () => {
  it('does not enqueue or send a recommendation more than 15% under the last ask', async () => {
    listCmaQueue.mockResolvedValue({
      rows: [row({ recommendedList: 618_000, theirPrice: 849_000 })],
      total: 1,
    })
    const res = await approveAndDeliverCma('cma-test')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/more than 15% under/)
    expect(approveCmaAction).not.toHaveBeenCalled()
    expect(enqueueProspectFirstTouchEmail).not.toHaveBeenCalled()
    expect(sendCmaToLeadAction).not.toHaveBeenCalled()
  })

  it('does not send a recommendation above the last ask', async () => {
    listCmaQueue.mockResolvedValue({
      rows: [row({ recommendedList: 1_050_000, theirPrice: 999_900, sendMode: 'now' })],
      total: 1,
    })
    const res = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/above the last ask/)
    expect(approveCmaAction).not.toHaveBeenCalled()
    expect(enqueueProspectFirstTouchEmail).not.toHaveBeenCalled()
    expect(sendCmaToLeadAction).not.toHaveBeenCalled()
  })

  it('still enqueues a recommendation inside the band when the other gates pass', async () => {
    listCmaQueue.mockResolvedValue({
      rows: [row({ recommendedList: 800_000, theirPrice: 849_000 })],
      total: 1,
    })
    const res = await approveAndDeliverCma('cma-test')
    expect(res).toEqual({ ok: true, outcome: 'queued', position: 1 })
    expect(enqueueProspectFirstTouchEmail).toHaveBeenCalledWith('expired', 'LK123')
    expect(sendCmaToLeadAction).not.toHaveBeenCalled()
  })

  it('still sends now when the recommendation is not a gap hold', async () => {
    listCmaQueue.mockResolvedValue({
      rows: [row({ recommendedList: 850_000, theirPrice: 1_000_000, sendMode: 'now' })],
      total: 1,
    })
    const res = await approveAndDeliverCma('cma-test', undefined, { delivery: 'now' })
    expect(res).toEqual({ ok: true, outcome: 'sent', transport: 'gmail' })
    expect(sendCmaToLeadAction).toHaveBeenCalled()
    expect(enqueueProspectFirstTouchEmail).not.toHaveBeenCalled()
  })
})
