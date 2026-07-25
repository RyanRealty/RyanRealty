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

function block(slug: string, over: Partial<MarketReportAreaBlock> = {}): MarketReportAreaBlock {
  return {
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
    source: 'market_pulse_live',
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
  const deps = {
    fetchAreas: vi.fn(async () => [block('bend'), block('redmond')]),
    fetchReportSubscribers: vi.fn(async () => [
      { subscriptionId: 1, personId: 11, personName: 'A', assignedBroker: 'matt', fubPersonId: null, areas: ['bend'], frequency: 'monthly' as const, isActive: true, lastSentAt: null, lastAttemptAt: null },
      { subscriptionId: 2, personId: 12, personName: 'B', assignedBroker: 'matt', fubPersonId: null, areas: ['redmond'], frequency: 'weekly' as const, isActive: true, lastSentAt: null, lastAttemptAt: null },
    ]),
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
    ...over,
  } as unknown as BulkDeps
  return { deps, createDraft, setCitations, enqueueAudience, enqueueList }
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
