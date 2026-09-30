import { describe, it, expect, vi } from 'vitest'
import {
  MARKET_REPORT_AUDIENCE_KINDS,
  ledgerRouteFor,
  newsletterAudienceValue,
  nextEmailSendWindow,
  outsideEmailSendWindow,
  parseMarketReportAudience,
} from './market-report-audience'
import { resolveMarketReportAudience, runMarketReportBulkSend, type BulkDeps } from './market-report-bulk'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'

/**
 * Contract test for the W8.6 seam: the AUDIENCE SELECTOR resolves every declared
 * kind, and BULK delivery is handed to the newsletter delivery ledger rather than
 * to a second send loop.
 *
 * The properties pinned here are the ones a refactor would silently break:
 *   1. preview writes NOTHING (no draft, no citations, no enqueue)
 *   2. queue refuses without an approver (silence is never approval)
 *   3. queue refuses outside the send window
 *   4. a segment audience goes through enqueueNewsletter, a list audience through
 *      enqueueNewsletterToEmails, and never the other one
 *   5. §0 — an area set with no verified absorption rate produces NO issue
 *   6. every kind in MARKET_REPORT_AUDIENCE_KINDS actually resolves
 */

// 12:00 UTC on a Wednesday is 05:00 Pacific — before the 08:00 window opens.
const BEFORE_WINDOW = new Date('2026-07-22T12:00:00.000Z')
// 18:00 UTC is 11:00 Pacific — inside the window.
const IN_WINDOW = new Date('2026-07-22T18:00:00.000Z')
// 04:00 UTC Thursday is 21:00 Pacific Wednesday — after the 20:00 close.
const AFTER_WINDOW = new Date('2026-07-23T04:00:00.000Z')

function block(slug: string, over: Partial<MarketReportAreaBlock> = {}): MarketReportAreaBlock {
  return {
    twelveMonthSource: 'market-truth',
    slug,
    areaLabel: slug === 'bend' ? 'Bend' : slug[0]!.toUpperCase() + slug.slice(1),
    geoType: 'city',
    medianPrice: 795000,
    activeListings: 400,
    soldLast12mo: 1200,
    monthsOfSupply: 4.0,
    marketVerdict: 'balanced',
    domMedian: 38,
    yoyPct: 2.1,
    marketHealthLabel: 'Warm',
    refreshedAt: '2026-07-22T00:00:00.000Z',
    source: 'market_metric',
    href: `/cities/${slug}/market-report`,
    ...over,
  }
}

/** Spy deps: every write is a spy so "wrote nothing" is a provable assertion. */
function makeDeps(over: Partial<BulkDeps> = {}) {
  const createDraft = vi.fn(async (_input: unknown) => ({ ok: true as const, id: 'nl-test-1' }))
  const setCitations = vi.fn(async () => ({ ok: true }))
  const enqueueAudience = vi.fn(async () => ({ ok: true as const, queued: 5334, brokerSplit: {}, large: true }))
  const enqueueList = vi.fn(async () => ({ ok: true, queued: 3 }))
  // The §0 Spark gate: every printed figure reconciled, unless a test says otherwise.
  type GateInput = { blocks: unknown[]; figures: Array<{ area: string; label: string }> }
  const sparkGate = vi.fn<(input: GateInput) => Promise<unknown>>(async () => ({
    verdict: 'ok' as const,
    rule: 'CLAUDE.md §0: any |delta| > 1% is a STOP',
    checkedAt: IN_WINDOW.toISOString(),
    since: null,
    checks: [{ area: 'bend', figure: 'months of supply', supabase: 4, spark: 4, deltaPct: 0, population: 'p', status: 'ok' as const }],
    queries: [],
    polygonGaps: [],
    error: null,
  }))
  const alert = vi.fn(async () => true)
  const deps = {
    fetchAreas: vi.fn(async () => [block('bend'), block('redmond')]),
    fetchReportSubscribers: vi.fn(async () => [subRow(1, 11, ['bend'], 'monthly'), subRow(2, 12, ['redmond'], 'weekly')]),
    resolvePersonEmail: vi.fn(async (id: number) => `person${id}@example.com`),
    fetchSegmentSubscribers: vi.fn(async () => [
      { id: 's1', email: 'Seg1@Example.com', name: null, crm_person_id: null, unsubscribe_token: 't1' },
      { id: 's2', email: 'seg2@example.com', name: null, crm_person_id: null, unsubscribe_token: 't2' },
    ]),
    fetchTaggedPeople: vi.fn(async () => ({
      people: [{ personId: 21, emails: ['tag1@example.com'] }],
      excludedSuppressed: 7,
      excludedRealtors: 2,
    })),
    createDraft,
    setCitations,
    enqueueAudience,
    enqueueList,
    sparkGate,
    alert,
    ...over,
  } as unknown as BulkDeps
  return { deps, createDraft, setCitations, enqueueAudience, enqueueList, sparkGate, alert }
}

/** An active report subscription: approved and live unless a test says otherwise. */
function subRow(
  subscriptionId: number,
  personId: number,
  areas: string[] = ['bend'],
  frequency: 'weekly' | 'monthly' | 'quarterly' = 'monthly',
  over: { firstSendApprovedAt?: string | null; personDeleted?: boolean } = {},
) {
  return {
    subscriptionId,
    personId,
    personName: `P${personId}`,
    assignedBroker: 'matt',
    fubPersonId: null,
    areas,
    frequency,
    isActive: true,
    lastSentAt: null,
    lastAttemptAt: null,
    firstSendApprovedAt: 'firstSendApprovedAt' in over ? over.firstSendApprovedAt : '2026-07-01T17:00:00.000Z',
    personDeleted: over.personDeleted ?? false,
  }
}

const AREAS = ['bend', 'redmond']

describe('audience descriptor (pure)', () => {
  it('rejects an unknown kind and an empty audience, fail-closed', () => {
    expect(parseMarketReportAudience({ kind: 'everyone' })).toBeNull()
    expect(parseMarketReportAudience({ kind: 'crm-tag', tag: '  ' })).toBeNull()
    expect(parseMarketReportAudience({ kind: 'explicit', emails: [] })).toBeNull()
    expect(parseMarketReportAudience({ kind: 'newsletter-segment', segment: 'nope' })).toBeNull()
    expect(parseMarketReportAudience(null)).toBeNull()
  })

  it('normalizes an explicit list (lowercase, de-duped, @-checked)', () => {
    const a = parseMarketReportAudience({ kind: 'explicit', emails: ['A@x.com', 'a@x.com', 'nope', 'b@x.com'] })
    expect(a).toEqual({ kind: 'explicit', emails: ['a@x.com', 'b@x.com'] })
  })

  it('routes exactly one kind to the segment entrypoint, the rest to the list entrypoint', () => {
    const routes = MARKET_REPORT_AUDIENCE_KINDS.map((k) => [k, ledgerRouteFor(k)] as const)
    expect(routes).toEqual([
      ['report-subscribers', 'email-list'],
      ['newsletter-segment', 'audience-segment'],
      ['crm-tag', 'email-list'],
      ['explicit', 'email-list'],
    ])
  })

  it('writes the exact segment string enqueueNewsletter parses', () => {
    expect(newsletterAudienceValue({ kind: 'newsletter-segment', segment: 'buyer' })).toBe('segment:buyer')
    expect(newsletterAudienceValue({ kind: 'crm-tag', tag: 'past-client' })).toBe('market-report:crm-tag')
  })

  it('send window closes overnight and reopens after 08:00 market time', () => {
    expect(outsideEmailSendWindow(BEFORE_WINDOW)).toBe(true)
    expect(outsideEmailSendWindow(IN_WINDOW)).toBe(false)
    const next = nextEmailSendWindow(BEFORE_WINDOW)
    expect(next.getTime()).toBeGreaterThan(BEFORE_WINDOW.getTime())
    expect(outsideEmailSendWindow(next)).toBe(false)
  })

  it('an evening send reopens the NEXT morning, not the one after', () => {
    // 21:00 PDT is already 04:00Z the next UTC day, so 16:05Z that day (09:05 PDT) is next.
    expect(outsideEmailSendWindow(AFTER_WINDOW)).toBe(true)
    expect(nextEmailSendWindow(AFTER_WINDOW).toISOString()).toBe('2026-07-23T16:05:00.000Z')
    // 23:00 PDT Wednesday → 09:05 PDT Thursday
    expect(nextEmailSendWindow(new Date('2026-07-23T06:00:00.000Z')).toISOString()).toBe('2026-07-23T16:05:00.000Z')
    // 20:00 PST in winter → 08:05 PST the next morning
    expect(nextEmailSendWindow(new Date('2026-12-11T04:00:00.000Z')).toISOString()).toBe('2026-12-11T16:05:00.000Z')
  })

  it('a pre-dawn send reopens the same morning', () => {
    // 05:00 PDT → 09:05 PDT the same day
    expect(nextEmailSendWindow(BEFORE_WINDOW).toISOString()).toBe('2026-07-22T16:05:00.000Z')
  })
})

describe('resolveMarketReportAudience', () => {
  it('resolves EVERY declared audience kind (no kind is a dead option)', async () => {
    const { deps } = makeDeps()
    const samples = {
      'report-subscribers': { kind: 'report-subscribers', cadence: 'any', areaSlug: null },
      'newsletter-segment': { kind: 'newsletter-segment', segment: 'general' },
      'crm-tag': { kind: 'crm-tag', tag: 'past-client' },
      explicit: { kind: 'explicit', emails: ['x@y.com'] },
    } as const
    for (const kind of MARKET_REPORT_AUDIENCE_KINDS) {
      const parsed = parseMarketReportAudience(samples[kind])
      expect(parsed, `${kind} must parse`).not.toBeNull()
      const r = await resolveMarketReportAudience(parsed!, deps)
      expect(r.kind, `${kind} must resolve`).toBe(kind)
      expect(r.emails.length, `${kind} must produce recipients`).toBeGreaterThan(0)
      expect(r.trace.length).toBeGreaterThan(0)
    }
  })

  it('applies the cadence filter on the report-subscribers audience', async () => {
    const { deps } = makeDeps()
    const weekly = await resolveMarketReportAudience({ kind: 'report-subscribers', cadence: 'weekly', areaSlug: null }, deps)
    expect(weekly.emails).toEqual(['person12@example.com'])
    const byArea = await resolveMarketReportAudience({ kind: 'report-subscribers', cadence: 'any', areaSlug: 'bend' }, deps)
    expect(byArea.emails).toEqual(['person11@example.com'])
  })

  it('lowercases and de-dupes resolved addresses', async () => {
    const { deps } = makeDeps()
    const seg = await resolveMarketReportAudience({ kind: 'newsletter-segment', segment: 'general' }, deps)
    expect(seg.emails).toEqual(['seg1@example.com', 'seg2@example.com'])
  })
})

describe('runMarketReportBulkSend — preview writes nothing', () => {
  it('returns the rendered issue + audience count and touches NO writer', async () => {
    const { deps, createDraft, setCitations, enqueueAudience, enqueueList } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'explicit', emails: ['a@x.com', 'b@x.com', 'c@x.com'] },
      areas: AREAS,
      mode: 'preview',
      now: IN_WINDOW,
      deps,
    })
    expect(r.ok).toBe(true)
    if (!r.ok || r.mode !== 'preview') throw new Error('expected a preview result')
    expect(r.recipientCount).toBe(3)
    expect(r.sample).toEqual(['a@x.com', 'b@x.com', 'c@x.com'])
    expect(r.subject).toContain('market report')
    expect(r.bodyHtml.length).toBeGreaterThan(100)
    expect(r.citations.length).toBeGreaterThan(0)
    expect(r.renderedAreas).toEqual(['bend', 'redmond'])
    expect(createDraft).not.toHaveBeenCalled()
    expect(setCitations).not.toHaveBeenCalled()
    expect(enqueueAudience).not.toHaveBeenCalled()
    expect(enqueueList).not.toHaveBeenCalled()
  })

  it('previews outside the window and reports when it opens', async () => {
    const { deps } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'explicit', emails: ['a@x.com'] },
      areas: AREAS,
      mode: 'preview',
      now: BEFORE_WINDOW,
      deps,
    })
    if (!r.ok || r.mode !== 'preview') throw new Error('expected a preview result')
    expect(r.windowOpensAt).not.toBeNull()
  })
})

describe('runMarketReportBulkSend — queue routes through the ledger', () => {
  it('refuses without an approver and writes nothing', async () => {
    const { deps, createDraft, enqueueList } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'explicit', emails: ['a@x.com'] },
      areas: AREAS,
      mode: 'queue',
      now: IN_WINDOW,
      deps,
    })
    expect(r).toMatchObject({ ok: false, error: 'approval_required' })
    expect(createDraft).not.toHaveBeenCalled()
    expect(enqueueList).not.toHaveBeenCalled()
  })

  it('refuses outside the send window and writes nothing', async () => {
    const { deps, createDraft, enqueueList } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'explicit', emails: ['a@x.com'] },
      areas: AREAS,
      mode: 'queue',
      approvedBy: 'matt@ryan-realty.com',
      now: BEFORE_WINDOW,
      deps,
    })
    expect(r).toMatchObject({ ok: false, error: 'outside_send_window' })
    expect(createDraft).not.toHaveBeenCalled()
    expect(enqueueList).not.toHaveBeenCalled()
  })

  it('a LIST audience is handed to enqueueNewsletterToEmails, never the audience enqueue', async () => {
    const { deps, createDraft, setCitations, enqueueAudience, enqueueList } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'crm-tag', tag: 'past-client' },
      areas: AREAS,
      mode: 'queue',
      approvedBy: 'matt@ryan-realty.com',
      now: IN_WINDOW,
      deps,
    })
    expect(r.ok).toBe(true)
    if (!r.ok || r.mode !== 'queue') throw new Error('expected a queue result')
    expect(r.newsletterId).toBe('nl-test-1')
    expect(enqueueList).toHaveBeenCalledWith('nl-test-1', ['tag1@example.com'])
    expect(enqueueAudience).not.toHaveBeenCalled()
    expect(setCitations).toHaveBeenCalled()
    expect(createDraft.mock.calls[0]![0]).toMatchObject({ audience: 'market-report:crm-tag', created_by: 'matt@ryan-realty.com' })
  })

  it('a SEGMENT audience is handed to enqueueNewsletter with a segment: audience string', async () => {
    const { deps, createDraft, enqueueAudience, enqueueList } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'newsletter-segment', segment: 'seller' },
      areas: AREAS,
      mode: 'queue',
      approvedBy: 'matt@ryan-realty.com',
      now: IN_WINDOW,
      deps,
    })
    expect(r.ok).toBe(true)
    expect(enqueueAudience).toHaveBeenCalledWith('nl-test-1')
    expect(enqueueList).not.toHaveBeenCalled()
    expect(createDraft.mock.calls[0]![0]).toMatchObject({ audience: 'segment:seller' })
  })

  it('refuses when the audience grew since the approver previewed it', async () => {
    const { deps, createDraft, enqueueList } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'explicit', emails: ['a@x.com', 'b@x.com'] },
      areas: AREAS,
      mode: 'queue',
      approvedBy: 'matt@ryan-realty.com',
      expectedRecipientCount: 1,
      now: IN_WINDOW,
      deps,
    })
    expect(r).toMatchObject({ ok: false, error: 'count_changed' })
    expect(createDraft).not.toHaveBeenCalled()
    expect(enqueueList).not.toHaveBeenCalled()
  })

  it('over the list cap it refuses before writing a draft', async () => {
    const many = Array.from({ length: 5001 }, (_, i) => `p${i}@example.com`)
    const { deps, createDraft } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'explicit', emails: many },
      areas: AREAS,
      mode: 'queue',
      approvedBy: 'matt@ryan-realty.com',
      now: IN_WINDOW,
      deps,
    })
    expect(r).toMatchObject({ ok: false, error: 'too_many_recipients' })
    expect(createDraft).not.toHaveBeenCalled()
  })
})

describe('runMarketReportBulkSend — §0 data accuracy', () => {
  it('no verified absorption rate means NO issue, not an empty one', async () => {
    const { deps, createDraft, enqueueList } = makeDeps({
      // Both areas resolve without a months-of-supply figure.
      fetchAreas: vi.fn(async () => [
        block('bend', { monthsOfSupply: null, marketVerdict: null }),
        block('redmond', { monthsOfSupply: null, marketVerdict: null }),
      ]),
    } as unknown as Partial<BulkDeps>)
    const r = await runMarketReportBulkSend({
      audience: { kind: 'explicit', emails: ['a@x.com'] },
      areas: AREAS,
      mode: 'queue',
      approvedBy: 'matt@ryan-realty.com',
      now: IN_WINDOW,
      deps,
    })
    expect(r).toMatchObject({ ok: false, error: 'no_market_data' })
    expect(createDraft).not.toHaveBeenCalled()
    expect(enqueueList).not.toHaveBeenCalled()
  })

  it('an area with no cache data is reported as omitted, never filled', async () => {
    const { deps } = makeDeps({
      fetchAreas: vi.fn(async () => [block('bend')]),
    } as unknown as Partial<BulkDeps>)
    const r = await runMarketReportBulkSend({
      audience: { kind: 'explicit', emails: ['a@x.com'] },
      areas: ['bend', 'sisters'],
      mode: 'preview',
      now: IN_WINDOW,
      deps,
    })
    if (!r.ok || r.mode !== 'preview') throw new Error('expected a preview result')
    expect(r.renderedAreas).toEqual(['bend'])
    expect(r.omittedAreas).toEqual(['sisters'])
  })

  it('an invalid audience is refused before any data is fetched', async () => {
    const { deps } = makeDeps()
    const r = await runMarketReportBulkSend({
      audience: { kind: 'everyone' },
      areas: AREAS,
      mode: 'queue',
      approvedBy: 'matt@ryan-realty.com',
      now: IN_WINDOW,
      deps,
    })
    expect(r).toMatchObject({ ok: false, error: 'invalid_audience' })
    expect(deps.fetchAreas).not.toHaveBeenCalled()
  })
})

describe('report subscribers get only what the scheduled path would send (review 2026-09-30)', () => {
  it('skips a deleted contact and a subscription waiting on its first-send approval, and says so in the trace', async () => {
    const { deps } = makeDeps({
      fetchReportSubscribers: vi.fn(async () => [
        subRow(1, 11),
        subRow(2, 12, ['bend'], 'monthly', { personDeleted: true }),
        subRow(3, 13, ['bend'], 'monthly', { firstSendApprovedAt: null }),
      ]) as never,
    })
    const r = await resolveMarketReportAudience({ kind: 'report-subscribers', cadence: 'any', areaSlug: null }, deps)
    expect(r.emails).toEqual(['person11@example.com'])
    expect(r.trace).toContain('1 deleted contact skipped')
    expect(r.trace).toContain('1 awaiting first-send approval skipped')
    expect(deps.resolvePersonEmail).toHaveBeenCalledTimes(1)
  })
})

describe('the §0 Spark gate runs before a bulk issue is queued (review 2026-09-30)', () => {
  const queue = (deps: BulkDeps) =>
    runMarketReportBulkSend({
      audience: { kind: 'crm-tag', tag: 'past-client' },
      areas: AREAS,
      mode: 'queue',
      approvedBy: 'matt@ryan-realty.com',
      now: IN_WINDOW,
      deps,
    })

  it('checks every figure the issue prints: months of supply and the verdict for each area, and the median it names', async () => {
    const { deps, sparkGate } = makeDeps()
    const r = await queue(deps)
    expect(r.ok).toBe(true)
    expect(sparkGate).toHaveBeenCalledTimes(1)
    const figures = sparkGate.mock.calls[0]![0].figures.map((f) => `${f.area} ${f.label}`)
    expect(figures).toEqual([
      'bend months of supply',
      'bend market verdict',
      'redmond months of supply',
      'redmond market verdict',
      'bend median sale price, last 12 months',
    ])
  })

  it('a STOP holds the whole issue: no draft, no queue, and Matt is paged with both values', async () => {
    const stop = vi.fn(async () => ({
      verdict: 'STOP' as const,
      rule: 'CLAUDE.md §0: any |delta| > 1% is a STOP',
      checkedAt: IN_WINDOW.toISOString(),
      since: null,
      checks: [{ area: 'redmond', figure: 'months of supply', supabase: 4, spark: 4.4, deltaPct: -9.09, population: 'Market Truth city', status: 'STOP' as const }],
      queries: [],
      polygonGaps: [],
      error: null,
    }))
    const { deps, createDraft, enqueueList, alert } = makeDeps({ sparkGate: stop as never })
    const r = await queue(deps)
    expect(r).toMatchObject({ ok: false, error: 'spark_hold' })
    expect((r as { detail?: string }).detail).toContain('redmond months of supply: printed 4, Spark 4.4, delta -9.09%')
    expect(createDraft).not.toHaveBeenCalled()
    expect(enqueueList).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledTimes(1)
  })

  it('a figure the gate could not verify, or a gate that threw, holds the issue too', async () => {
    for (const sparkGate of [
      vi.fn(async () => ({ verdict: 'not-reconciled' as const, rule: 'r', checkedAt: 'x', since: null, checks: [], queries: [], polygonGaps: [], error: 'Spark API error 503' })),
      vi.fn(async () => {
        throw new Error('socket hang up')
      }),
    ]) {
      const { deps, createDraft } = makeDeps({ sparkGate: sparkGate as never })
      const r = await queue(deps)
      expect(r).toMatchObject({ ok: false, error: 'spark_hold' })
      expect(createDraft).not.toHaveBeenCalled()
    }
  })
})

