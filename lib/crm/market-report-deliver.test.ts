import { describe, it, expect, vi } from 'vitest'
import {
  deliverMarketReport,
  holdKey,
  scheduledSendKey,
  type DeliverDeps,
  type DeliverReportInput,
} from './market-report-deliver'
import type { MarketReportAreaBlock, MarketReportProvenance } from '@/lib/data/crm/getMarketReportData'
import type { ReportSubscriptionRecord } from '@/lib/data/crm/marketReportSubscription'
import type { SparkGateResult } from '@/lib/crm/market-report-spark-gate'
import { verifyReportLinkToken } from '@/lib/email/report-link-token'

const NOW = new Date('2026-09-29T22:00:00.000Z')

function fresh(): MarketReportProvenance {
  const at = '2026-09-29T07:01:00.000Z'
  return {
    cache: { updatedAt: at, periodStart: '2025-09-29', periodEnd: '2026-09-28', soldCount: 61, methodologyVersion: 'v3-2026-05-07' },
    live: { table: 'market_metric', computedAt: '2026-09-29T21:45:00.000Z', completeThrough: null },
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
    source: 'market_metric',
    twelveMonthSource: 'market_stats_cache',
    href: '/cities/bend/bend-larkspur',
    trend: null,
    provenance: fresh(),
    ...over,
  } as MarketReportAreaBlock
}

type Mocks = { [K in keyof DeliverDeps]: ReturnType<typeof vi.fn> }

function sparkResult(over: Partial<SparkGateResult> = {}): SparkGateResult {
  return {
    verdict: 'ok',
    rule: 'CLAUDE.md §0: any |delta| > 1% is a STOP',
    checkedAt: NOW.toISOString(),
    since: '2025-09-01',
    checks: [],
    queries: [{ kind: 'active', filter: "Spark v1 /listings _filter=City Eq 'Bend'", total_rows: 729, rows: 729, attempts: 1, fetched_at: NOW.toISOString() }],
    polygonGaps: [],
    error: null,
    ...over,
  }
}

const STOP_CHECK = {
  area: 'bend-larkspur',
  figure: 'homes for sale',
  supabase: 32,
  spark: 30,
  deltaPct: 6.67,
  population: "Market Truth neighborhood, StandardStatus 'Active'",
  status: 'STOP' as const,
}

function record(over: Partial<ReportSubscriptionRecord> = {}): ReportSubscriptionRecord {
  return {
    id: 9016,
    personId: 64138,
    areas: ['bend-larkspur'],
    frequency: 'monthly',
    isActive: true,
    lastSentAt: null,
    lastAttemptAt: null,
    createdAt: null,
    updatedAt: null,
    firstSendApprovedAt: '2026-09-29T15:00:00.000Z',
    firstSendApprovedBy: 'matt@ryan-realty.com',
    source: 'email-reply',
    requestedAt: null,
    consentNote: null,
    stoppedAt: null,
    stoppedVia: null,
    ...over,
  }
}

const LIVE_CONTACT = {
  personId: 64138,
  name: 'Cheryl Younger',
  firstName: 'Cheryl',
  primaryEmail: 'cheryl@example.com',
  assignedBroker: 'matt',
  deleted: false,
  mergedInto: null,
}

function deps(over: Partial<Mocks> = {}): Mocks {
  return {
    fetchAreas: vi.fn(async () => [larkspur()]),
    latestDelivered: vi.fn(async () => null),
    isSuppressed: vi.fn(async () => ({ suppressed: false, reasons: [] })),
    isSuppressedByEmail: vi.fn(async () => ({ suppressed: false, reasons: [] })),
    insertSend: vi.fn(async () => ({ ok: true, inserted: true })),
    claimSend: vi.fn(async () => ({ ok: true, claimed: true, takeover: false })),
    settleSend: vi.fn(async () => ({ ok: true })),
    sendOne: vi.fn(async () => ({ status: 'sent', messageId: 'msg-1', preparedHtml: '<p>prepared</p>', preparedText: 'prepared' })),
    timeline: vi.fn(async () => true),
    stampScheduled: vi.fn(async () => ({ ok: true })),
    stampManual: vi.fn(async () => true),
    sparkGate: vi.fn(async () => sparkResult()),
    readSubscription: vi.fn(async () => record()),
    readContact: vi.fn(async () => LIVE_CONTACT),
    alert: vi.fn(async () => true),
    ...over,
  }
}

const KEY = scheduledSendKey(9016, null)

function input(over: Partial<DeliverReportInput> = {}): DeliverReportInput {
  return {
    kind: 'scheduled',
    personId: 64138,
    contactName: 'Cheryl',
    to: 'cheryl@example.com',
    contactEmail: 'cheryl@example.com',
    brokerSlug: 'matt',
    subscription: { id: 9016, frequency: 'monthly', areas: ['bend-larkspur'], lastSentAt: null },
    areaSlugs: ['bend-larkspur'],
    emailKey: KEY,
    now: NOW,
    ...over,
  }
}

describe('holdKey and scheduledSendKey (one row per due cycle)', () => {
  it('keys a first send and a later cycle apart', () => {
    expect(holdKey('awaiting-approval', 9016, null)).toBe('market-report:held:awaiting-approval:9016:first')
    expect(holdKey('stale-data', 3, '2026-09-05T10:00:16.14+00:00')).toBe('market-report:held:stale-data:3:20260905100016')
    expect(scheduledSendKey(9016, null)).toBe('market-report:scheduled:9016:first')
    expect(scheduledSendKey(3, '2026-09-05T10:00:16.14+00:00')).toBe('market-report:scheduled:3:20260905100016')
  })
})

describe('deliverMarketReport: holds', () => {
  it('holds when no area has verified data, and records the hold once for the cycle', async () => {
    const d = deps({ fetchAreas: vi.fn(async () => []) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'held', reason: 'no-data' })
    expect(d.insertSend.mock.calls[0][0]).toMatchObject({
      status: 'held',
      holdReason: 'no-data',
      emailKey: 'market-report:held:no-data:9016:first',
    })
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
    const d = deps({ latestDelivered: vi.fn(async () => ({ at: '2026-09-20T16:00:00.000Z', inFlight: false })) })
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
    expect(d.claimSend).not.toHaveBeenCalled()
    expect(d.sendOne).not.toHaveBeenCalled()
  })

  it('an address-only suppression (the newsletter\'s) holds her too', async () => {
    const d = deps({ isSuppressedByEmail: vi.fn(async () => ({ suppressed: true, reasons: ['email:email:unsubscribe'] })) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'held', reason: 'suppressed', detail: 'email:email:unsubscribe' })
    expect(d.isSuppressedByEmail).toHaveBeenCalledWith('cheryl@example.com', 'email')
    expect(d.sendOne).not.toHaveBeenCalled()
  })

  it('an attempt still in flight counts as delivered for the cadence backstop', async () => {
    // Another process claimed it 30 seconds ago: never sent twice, and the
    // stamp is left alone so a failure there can still be retried next tick.
    const live = deps({ latestDelivered: vi.fn(async () => ({ at: '2026-09-29T21:59:30.000Z', inFlight: true })) })
    expect(await deliverMarketReport(input(), live as unknown as DeliverDeps)).toEqual({ status: 'already-sent', sentAt: '2026-09-29T21:59:30.000Z' })
    expect(live.sendOne).not.toHaveBeenCalled()
    expect(live.stampScheduled).not.toHaveBeenCalled()
    // Left by a process that died six hours ago: treated as delivered, and the cadence moves on.
    const dead = deps({ latestDelivered: vi.fn(async () => ({ at: '2026-09-29T16:00:00.000Z', inFlight: true })) })
    expect(await deliverMarketReport(input(), dead as unknown as DeliverDeps)).toEqual({ status: 'already-sent', sentAt: '2026-09-29T16:00:00.000Z' })
    expect(dead.sendOne).not.toHaveBeenCalled()
    expect(dead.stampScheduled).toHaveBeenCalledWith(9016, new Date('2026-09-29T16:00:00.000Z'))
  })
})

describe('deliverMarketReport: the §0 Spark gate runs before EVERY send', () => {
  it('a STOP holds the scheduled report: one refreshed row per cycle with both values, the delta and the queries; Matt is paged', async () => {
    const spark = sparkResult({ verdict: 'STOP', checks: [STOP_CHECK] })
    const d = deps({ sparkGate: vi.fn(async () => spark) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'held', reason: 'spark-stop' })
    if (out.status === 'held') {
      expect(out.detail).toContain('bend-larkspur homes for sale: printed 32, Spark 30, delta 6.67%')
    }
    expect(d.claimSend).not.toHaveBeenCalled()
    expect(d.sendOne).not.toHaveBeenCalled()
    expect(d.insertSend).toHaveBeenCalledTimes(1)
    const [row, opts] = d.insertSend.mock.calls[0]
    expect(row).toMatchObject({
      emailKey: 'market-report:held:spark-stop:9016:first',
      status: 'held',
      holdReason: 'spark-stop',
      kind: 'scheduled',
      sparkCheck: spark,
    })
    expect(row.html).toContain('Larkspur')
    expect(row.figures.length).toBeGreaterThan(3)
    expect(opts).toEqual({ refresh: true })
    expect(d.alert).toHaveBeenCalledWith(expect.objectContaining({ key: 'market-report-send:spark-hold:s9016' }))
    expect(d.alert.mock.calls[0][0].body).toContain('/admin/people/64138#market-report')
  })

  it('a figure Spark cannot rebuild, or a check that cannot run, holds as not reconciled', async () => {
    const d = deps({ sparkGate: vi.fn(async () => sparkResult({ verdict: 'not-reconciled', error: 'SPARK_API_KEY is not set', queries: [] })) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'held', reason: 'spark-unreconciled' })
    if (out.status === 'held') expect(out.detail).toContain('SPARK_API_KEY is not set')
    expect(d.sendOne).not.toHaveBeenCalled()
    // A gate that throws is not a pass either.
    const t = deps({ sparkGate: vi.fn(async () => { throw new Error('boom') }) })
    expect(await deliverMarketReport(input(), t as unknown as DeliverDeps)).toMatchObject({ status: 'held', reason: 'spark-unreconciled' })
    expect(t.sendOne).not.toHaveBeenCalled()
  })

  it('a broker\'s manual send and preview are held too, under their own keys', async () => {
    for (const kind of ['manual', 'preview'] as const) {
      const d = deps({ sparkGate: vi.fn(async () => sparkResult({ verdict: 'STOP', checks: [STOP_CHECK] })) })
      const key = `market-report:${kind}:64138:1`
      const out = await deliverMarketReport(
        input({ kind, emailKey: key, to: kind === 'preview' ? 'matt@ryan-realty.com' : 'cheryl@example.com' }),
        d as unknown as DeliverDeps,
      )
      expect(out).toMatchObject({ status: 'held', reason: 'spark-stop' })
      expect(d.insertSend.mock.calls[0][0]).toMatchObject({ emailKey: key, kind, holdReason: 'spark-stop' })
      expect(d.insertSend.mock.calls[0][1]).toEqual({ refresh: false })
      expect(d.sendOne).not.toHaveBeenCalled()
    }
  })

  it('a reconciled report carries its Spark check onto the claimed row', async () => {
    const spark = sparkResult()
    const d = deps({ sparkGate: vi.fn(async () => spark) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out.status).toBe('sent')
    expect(d.claimSend.mock.calls[0][0].sparkCheck).toBe(spark)
  })
})

describe('deliverMarketReport: re-read just before the wire', () => {
  it('a stop made while the report was being built cancels it', async () => {
    for (const fresh of [record({ isActive: false, stoppedAt: '2026-09-29T21:59:00Z', stoppedVia: 'one-click' }), record({ isActive: false }), null]) {
      const d = deps({ readSubscription: vi.fn(async () => fresh) })
      const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
      expect(out).toMatchObject({ status: 'cancelled', reason: 'stopped' })
      expect(d.claimSend).not.toHaveBeenCalled()
      expect(d.sendOne).not.toHaveBeenCalled()
    }
  })

  it('another run\'s send during this one is already-sent; a change of areas is cancelled; a deleted contact is cancelled', async () => {
    let d = deps({ readSubscription: vi.fn(async () => record({ lastSentAt: '2026-09-29T21:58:00.000Z' })) })
    expect(await deliverMarketReport(input(), d as unknown as DeliverDeps)).toEqual({ status: 'already-sent', sentAt: '2026-09-29T21:58:00.000Z' })
    expect(d.sendOne).not.toHaveBeenCalled()
    d = deps({ readSubscription: vi.fn(async () => record({ areas: ['bend-larkspur', 'bend'] })) })
    expect(await deliverMarketReport(input(), d as unknown as DeliverDeps)).toMatchObject({ status: 'cancelled', reason: 'changed' })
    d = deps({ readContact: vi.fn(async () => ({ ...LIVE_CONTACT, deleted: true })) })
    expect(await deliverMarketReport(input(), d as unknown as DeliverDeps)).toMatchObject({ status: 'cancelled', reason: 'contact-deleted' })
    expect(d.sendOne).not.toHaveBeenCalled()
  })

  it('a manual send is refused when she stopped the reports herself meanwhile', async () => {
    const d = deps({ readSubscription: vi.fn(async () => record({ isActive: false, stoppedAt: '2026-09-29T21:59:00Z', stoppedVia: 'email-link' })) })
    const out = await deliverMarketReport(input({ kind: 'manual', emailKey: 'market-report:manual:64138:1' }), d as unknown as DeliverDeps)
    expect(out).toMatchObject({ status: 'cancelled', reason: 'stopped' })
    expect(d.sendOne).not.toHaveBeenCalled()
  })

  it('a read failure fails closed: nothing is sent', async () => {
    const d = deps({ readSubscription: vi.fn(async () => { throw new Error('timeout') }) })
    expect((await deliverMarketReport(input(), d as unknown as DeliverDeps)).status).toBe('failed')
    expect(d.sendOne).not.toHaveBeenCalled()
  })
})

describe('deliverMarketReport: one claim per subscription per cycle', () => {
  it('a key already sent, or still in flight, is treated as delivered and never sent again', async () => {
    const cases = [
      // Sent (its stamp failed): repair the stamp.
      { existing: { status: 'sent', error: null, sentAt: '2026-09-29T16:00:05.000Z', attemptedAt: '2026-09-29T16:00:00.000Z', holdReason: null }, stamps: true },
      // An overlapping run's live attempt: leave its stamp to it.
      { existing: { status: 'failed', error: 'sending', sentAt: null, attemptedAt: '2026-09-29T21:59:30.000Z', holdReason: null }, stamps: false },
      // Abandoned by a process that died: the cadence moves on.
      { existing: { status: 'failed', error: 'sending', sentAt: null, attemptedAt: '2026-09-29T16:00:00.000Z', holdReason: null }, stamps: true },
    ]
    for (const { existing, stamps } of cases) {
      const d = deps({ claimSend: vi.fn(async () => ({ ok: true, claimed: false, existing })) })
      const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
      expect(out).toEqual({ status: 'already-sent', sentAt: existing.sentAt ?? existing.attemptedAt })
      expect(d.sendOne).not.toHaveBeenCalled()
      if (stamps) expect(d.stampScheduled).toHaveBeenCalledWith(9016, new Date(existing.sentAt ?? existing.attemptedAt))
      else expect(d.stampScheduled).not.toHaveBeenCalled()
    }
  })

  it('a held key is not sent over', async () => {
    const d = deps({
      claimSend: vi.fn(async () => ({
        ok: true,
        claimed: false,
        existing: { status: 'held', error: 'email:unsubscribe', sentAt: null, attemptedAt: '2026-09-29T16:00:00.000Z', holdReason: 'suppressed' },
      })),
    })
    expect((await deliverMarketReport(input(), d as unknown as DeliverDeps)).status).toBe('failed')
    expect(d.sendOne).not.toHaveBeenCalled()
  })
})

describe('deliverMarketReport: a real send', () => {
  it('claims the row with the clean copy and figures BEFORE the wire, then settles it', async () => {
    const order: string[] = []
    const d = deps({
      claimSend: vi.fn(async () => {
        order.push('claim')
        return { ok: true, claimed: true, takeover: false }
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

    const claim = d.claimSend.mock.calls[0][0]
    expect(claim).toMatchObject({
      personId: 64138,
      subscriptionId: 9016,
      emailKey: KEY,
      kind: 'scheduled',
      recipientEmail: 'cheryl@example.com',
      areas: ['bend-larkspur'],
    })
    expect(d.insertSend).not.toHaveBeenCalled()
    expect(claim.html).toContain('Larkspur')
    expect(claim.html).not.toContain('/api/track/e/')
    expect(claim.figures.length).toBeGreaterThan(3)

    // The links it sent are signed for Cheryl, her subscription and this report.
    const one = d.sendOne.mock.calls[0][0]
    const t = decodeURIComponent(new URL(one.oneClickUrl).searchParams.get('t') ?? '')
    expect(verifyReportLinkToken(t)).toMatchObject({ personId: 64138, subscriptionId: 9016, purpose: 'stop', emailKey: KEY, preview: false })
    // Her address rides to the leaf, which checks it against address-keyed suppression.
    expect(one.contactEmail).toBe('cheryl@example.com')
    expect(one.unsubscribeUrl).toContain('/email-preferences?t=')
    expect(one.unsubscribeUrl).toContain('&stop=1')

    expect(d.settleSend).toHaveBeenCalledWith(KEY, expect.objectContaining({ status: 'sent', messageId: 'msg-9', html: '<p>prepared</p>' }))
    // (k) the thread shows the report with its message id.
    expect(d.timeline).toHaveBeenCalledWith(
      64138,
      expect.objectContaining({
        kind: 'email_out',
        dedupeKey: `market-report:${KEY}`,
        payload: expect.objectContaining({ messageId: 'msg-9', to: 'cheryl@example.com' }),
      }),
    )
    expect(d.stampScheduled).toHaveBeenCalledWith(9016, NOW)
    expect(d.stampManual).not.toHaveBeenCalled()
  })

  it('refuses to send when the row cannot be claimed (no trace, no ship)', async () => {
    const d = deps({ claimSend: vi.fn(async () => ({ ok: false, error: 'relation does not exist' })) })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out.status).toBe('failed')
    expect(d.sendOne).not.toHaveBeenCalled()
  })

  it('settles a provider failure as failed with the error and the prepared copy', async () => {
    const d = deps({
      sendOne: vi.fn(async () => ({ status: 'failed', detail: 'Resend 500', preparedHtml: '<p>p</p>', preparedText: 'p' })),
    })
    const out = await deliverMarketReport(input(), d as unknown as DeliverDeps)
    expect(out).toEqual({ status: 'failed', detail: 'Resend 500' })
    expect(d.settleSend).toHaveBeenCalledWith(KEY, expect.objectContaining({ status: 'failed', error: 'Resend 500' }))
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
    expect(d.latestDelivered).not.toHaveBeenCalled()
  })

  it('a preview goes to the broker, says [Preview], writes a system note and stamps nothing', async () => {
    const d = deps()
    const out = await deliverMarketReport(
      input({ kind: 'preview', to: 'matt@ryan-realty.com', emailKey: 'market-report:preview:64138:1' }),
      d as unknown as DeliverDeps,
    )
    // A preview goes to the broker: no re-read of her subscription.
    expect(d.readSubscription).not.toHaveBeenCalled()
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
    expect(d.claimSend.mock.calls[0][0]).toMatchObject({ kind: 'preview', frequency: 'monthly', areas: ['bend-larkspur'] })
    // Her address still rides to the leaf's suppression check.
    expect(one.contactEmail).toBe('cheryl@example.com')
  })
})
