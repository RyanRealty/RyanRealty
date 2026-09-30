import { describe, it, expect, vi } from 'vitest'
import { deliverMarketReport, holdKey, type DeliverDeps, type DeliverReportInput } from './market-report-deliver'
import type { MarketReportAreaBlock, MarketReportProvenance } from '@/lib/data/crm/getMarketReportData'
import { verifyReportLinkToken } from '@/lib/email/report-link-token'

const NOW = new Date('2026-09-29T22:00:00.000Z')

function fresh(): MarketReportProvenance {
  const at = '2026-09-29T07:01:00.000Z'
  return {
    cache: { updatedAt: at, periodStart: '2025-09-29', periodEnd: '2026-09-28', soldCount: 61, methodologyVersion: 'v3-2026-05-07' },
    live: { table: 'market_pulse_live', computedAt: '2026-09-29T21:45:00.000Z', completeThrough: null },
    twelveMonth: null,
  }
}

function larkspur(over: Partial<MarketReportAreaBlock> = {}): MarketReportAreaBlock {
  return {
    slug: 'bend-larkspur',
    areaLabel: 'Larkspur',
    geoType: 'neighborhood',
    medianPrice: 612000,
    activeListings: 32,
    soldLast12mo: 61,
    monthsOfSupply: null,
    marketVerdict: null,
    domMedian: 30,
    yoyPct: 2.4,
    marketHealthLabel: null,
    refreshedAt: '2026-09-29T21:45:00.000Z',
    source: 'market_pulse_live',
    twelveMonthSource: 'market_stats_cache',
    href: '/cities/bend/bend-larkspur',
    trend: null,
    provenance: fresh(),
    ...over,
  } as MarketReportAreaBlock
}

type Mocks = { [K in keyof DeliverDeps]: ReturnType<typeof vi.fn> }

function deps(over: Partial<Mocks> = {}): Mocks {
  return {
    fetchAreas: vi.fn(async () => [larkspur()]),
    latestDeliveredAt: vi.fn(async () => null),
    isSuppressed: vi.fn(async () => ({ suppressed: false, reasons: [] })),
    insertSend: vi.fn(async () => ({ ok: true, inserted: true })),
    settleSend: vi.fn(async () => ({ ok: true })),
    sendOne: vi.fn(async () => ({ status: 'sent', messageId: 'msg-1', preparedHtml: '<p>prepared</p>', preparedText: 'prepared' })),
    timeline: vi.fn(async () => true),
    stampScheduled: vi.fn(async () => ({ ok: true })),
    stampManual: vi.fn(async () => true),
    ...over,
  }
}

function input(over: Partial<DeliverReportInput> = {}): DeliverReportInput {
  return {
    kind: 'scheduled',
    personId: 64138,
    contactName: 'Cheryl',
    to: 'cheryl@example.com',
    brokerSlug: 'matt',
    subscription: { id: 9016, frequency: 'monthly', areas: ['bend-larkspur'], lastSentAt: null },
    areaSlugs: ['bend-larkspur'],
    emailKey: 'market-report:run1:64138',
    now: NOW,
    ...over,
  }
}

describe('holdKey (one held row per reason per due cycle)', () => {
  it('keys a first send and a later cycle apart', () => {
    expect(holdKey('awaiting-approval', 9016, null)).toBe('market-report:held:awaiting-approval:9016:first')
    expect(holdKey('stale-data', 3, '2026-09-05T10:00:16.14+00:00')).toBe('market-report:held:stale-data:3:20260905100016')
  })
})

describe('deliverMarketReport: holds', () => {
  it('holds when no area has verified data, and records the hold once for the cycle', async () => {
    const d = deps({ fetchAreas: vi.fn(async () => []) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'held', reason: 'no-data' })
    expect(d.insertSend).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'held', holdReason: 'no-data', emailKey: 'market-report:held:no-data:9016:first' }),
    )
    expect(d.sendOne).not.toHaveBeenCalled()
  })

  it('holds on stale data and names the stale source', async () => {
    const stale = fresh()
    stale.cache!.updatedAt = '2026-09-28T07:01:00.000Z' // 39 hours before NOW
    const d = deps({ fetchAreas: vi.fn(async () => [larkspur({ provenance: stale })]) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'held', reason: 'stale-data' })
    if (out.status === 'held') expect(out.detail).toContain('bend-larkspur market_stats_cache')
    expect(d.sendOne).not.toHaveBeenCalled()
  })

  it('a scheduled send already received inside the window repairs the stamp instead of sending again', async () => {
    const d = deps({ latestDeliveredAt: vi.fn(async () => '2026-09-20T16:00:00.000Z') })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toEqual({ status: 'already-sent', sentAt: '2026-09-20T16:00:00.000Z' })
    expect(d.stampScheduled).toHaveBeenCalledWith(9016, new Date('2026-09-20T16:00:00.000Z'))
    expect(d.sendOne).not.toHaveBeenCalled()
  })

  it('a suppressed contact is held once per cycle, before any row is claimed', async () => {
    const d = deps({ isSuppressed: vi.fn(async () => ({ suppressed: true, reasons: ['email:unsubscribe'] })) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'held', reason: 'suppressed' })
    expect(d.insertSend).toHaveBeenCalledTimes(1)
    expect(d.insertSend.mock.calls[0][0]).toMatchObject({ status: 'held', holdReason: 'suppressed' })
    expect(d.sendOne).not.toHaveBeenCalled()
  })
})

describe('deliverMarketReport: a real send', () => {
  it('claims the row with the clean copy and figures BEFORE the wire, then settles it', async () => {
    const order: string[] = []
    const d = deps({
      insertSend: vi.fn(async () => {
        order.push('claim')
        return { ok: true, inserted: true }
      }),
      sendOne: vi.fn(async () => {
        order.push('send')
        return { status: 'sent', messageId: 'msg-9', preparedHtml: '<p>prepared</p>', preparedText: 'prepared' }
      }),
      settleSend: vi.fn(async () => {
        order.push('settle')
        return { ok: true }
      }),
    })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'sent', messageId: 'msg-9' })
    expect(order).toEqual(['claim', 'send', 'settle'])

    const claim = d.insertSend.mock.calls[0][0]
    expect(claim).toMatchObject({
      personId: 64138,
      subscriptionId: 9016,
      emailKey: 'market-report:run1:64138',
      kind: 'scheduled',
      status: 'failed',
      error: 'sending',
      recipientEmail: 'cheryl@example.com',
      areas: ['bend-larkspur'],
    })
    expect(claim.html).toContain('Larkspur')
    expect(claim.html).not.toContain('/api/track/e/')
    expect(claim.figures.length).toBeGreaterThan(3)

    // The links it sent are signed for Cheryl, her subscription and this report.
    const one = d.sendOne.mock.calls[0][0]
    const t = decodeURIComponent(new URL(one.oneClickUrl).searchParams.get('t') ?? '')
    expect(verifyReportLinkToken(t)).toMatchObject({ personId: 64138, subscriptionId: 9016, purpose: 'stop', emailKey: 'market-report:run1:64138', preview: false })
    expect(one.unsubscribeUrl).toContain('/email-preferences?t=')
    expect(one.unsubscribeUrl).toContain('&stop=1')

    expect(d.settleSend).toHaveBeenCalledWith(
      'market-report:run1:64138',
      expect.objectContaining({ status: 'sent', messageId: 'msg-9', html: '<p>prepared</p>' }),
    )
    // (k) the thread shows the report with its message id.
    expect(d.timeline).toHaveBeenCalledWith(
      64138,
      expect.objectContaining({
        kind: 'email_out',
        dedupeKey: 'market-report:market-report:run1:64138',
        payload: expect.objectContaining({ messageId: 'msg-9', to: 'cheryl@example.com' }),
      }),
    )
    expect(d.stampScheduled).toHaveBeenCalledWith(9016, NOW)
    expect(d.stampManual).not.toHaveBeenCalled()
  })

  it('refuses to send when the row cannot be claimed (no trace, no ship)', async () => {
    const d = deps({ insertSend: vi.fn(async () => ({ ok: false, error: 'relation does not exist' })) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out.status).toBe('failed')
    expect(d.sendOne).not.toHaveBeenCalled()
    const dup = deps({ insertSend: vi.fn(async () => ({ ok: true, inserted: false })) })
    expect((await deliverMarketReport(input(), dup as unknown as DeliverDeps)).status).toBe('failed')
    expect(dup.sendOne).not.toHaveBeenCalled()
  })

  it('settles a provider failure as failed with the error and the prepared copy', async () => {
    const d = deps({
      sendOne: vi.fn(async () => ({ status: 'failed', detail: 'Resend 500', preparedHtml: '<p>p</p>', preparedText: 'p' })),
    })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toEqual({ status: 'failed', detail: 'Resend 500' })
    expect(d.settleSend).toHaveBeenCalledWith('market-report:run1:64138', expect.objectContaining({ status: 'failed', error: 'Resend 500' }))
    expect(d.timeline).not.toHaveBeenCalled()
    expect(d.stampScheduled).not.toHaveBeenCalled()
  })

  it('a manual send stamps last_sent_at on her subscription (no double send after "Send now + subscribe")', async () => {
    const d = deps()
    const out = await deliverMarketReport(input({ kind: 'manual', emailKey: 'market-report:manual:64138:1' }), d as unknown as DeliverDeps)
    expect(out.status).toBe('sent')
    expect(d.stampManual).toHaveBeenCalledWith(64138, expect.any(String))
    expect(d.stampScheduled).not.toHaveBeenCalled()
    // A manual send never short-circuits on the cadence backstop.
    expect(d.latestDeliveredAt).not.toHaveBeenCalled()
  })

  it('a preview goes to the broker, says [Preview], writes a system note and stamps nothing', async () => {
    const d = deps()
    const out = await deliverMarketReport(
      input({ kind: 'preview', to: 'matt@ryan-realty.com', emailKey: 'market-report:preview:64138:1' }),
      d as unknown as DeliverDeps,
    )
    expect(out.status).toBe('sent')
    if (out.status === 'sent') expect(out.subject.startsWith('[Preview] ')).toBe(true)
    const one = d.sendOne.mock.calls[0][0]
    expect(one.kind).toBe('preview')
    expect(one.to).toBe('matt@ryan-realty.com')
    const t = decodeURIComponent(new URL(one.oneClickUrl).searchParams.get('t') ?? '')
    expect(verifyReportLinkToken(t)?.preview).toBe(true)
    expect(d.timeline).toHaveBeenCalledWith(64138, expect.objectContaining({ kind: 'system', title: 'Market report preview sent to matt@ryan-realty.com' }))
    expect(d.stampScheduled).not.toHaveBeenCalled()
    expect(d.stampManual).not.toHaveBeenCalled()
    expect(d.insertSend.mock.calls[0][0]).toMatchObject({ kind: 'preview', frequency: 'monthly', areas: ['bend-larkspur'] })
  })
})
