import { describe, expect, it } from 'vitest'
import { mapBpoQueueRow, resolveCmaQueueState, readCmaAuditVerdict } from '@/lib/data/cma/unified-queue'

/**
 * BPOs are the fourth lane Matt named, and they are the one lane that does NOT
 * live in `cmas` — they are rows in `broker_price_opinions`, built by the same
 * engine through lib/bpo/build.ts. The queue unions them in so a broker sees
 * every document in one list; nothing about the data moves.
 *
 * The two rules these tests hold: a BPO row carries no client email (the table
 * has no client_email column — the only human on it is the broker who asked and
 * an optional CRM person link), so no send path in the queue can ever address
 * one; and its detail link goes to /admin/bpo, not /admin/cmas.
 */

function bpoRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'b1',
    slug: 'bpo-123-main-bend',
    subject_address: '123 Main St, Bend, OR 97701',
    subject_city: 'Bend',
    subject_subdivision: null,
    opinion_value: 640000,
    value_low: 620000,
    value_high: 665000,
    comps_count: 6,
    broker_slug: 'matt',
    purpose: 'listing appointment',
    status: 'draft',
    requested_by: 'matt@ryan-realty.com',
    person_id: null,
    last_sent_at: null,
    sent_count: 0,
    created_at: '2026-09-01T10:00:00.000Z',
    finalized_at: null,
    archived_at: null,
    build_error: null,
    html_path: 'db:broker_price_opinions.html_content:bpo-123-main-bend',
    build_summary: {
      needs_review: false,
      audit: { used_llm: true, verdict: 'pass', summary: 'Every figure traced.', findings: [] },
    },
    ...over,
  }
}

describe('mapBpoQueueRow', () => {
  it('lands a clean, audited BPO in the bpo lane as ready', () => {
    const r = mapBpoQueueRow(bpoRow())
    expect(r.origin).toBe('bpo')
    expect(r.docKind).toBe('bpo')
    expect(r.state).toBe('ready')
    expect(r.recommendedList).toBe(640000)
    expect(r.compsCount).toBe(6)
  })

  it('points at the BPO detail page, never the CMA one', () => {
    // Both surfaces are slug-routed; sending a broker to /admin/cmas/bpo-… is a
    // 404 at best and someone else's document at worst.
    expect(mapBpoQueueRow(bpoRow()).detailHref).toBe('/admin/bpo/bpo-123-main-bend')
  })

  it('names the broker who asked and carries NO email', () => {
    // broker_price_opinions has no client_email column. Leaving contactEmail
    // null is what keeps every send guard in the queue closed on a BPO row —
    // the BPO send path lives on its own page and needs a linked CRM person.
    const r = mapBpoQueueRow(bpoRow())
    expect(r.contactName).toBe('matt@ryan-realty.com')
    expect(r.contactEmail).toBeNull()
  })

  it('has no asking price of its own to compare against', () => {
    const r = mapBpoQueueRow(bpoRow())
    expect(r.theirPrice).toBeNull()
    expect(r.theirPriceLabel).toBeNull()
    expect(r.theirPriceDelta).toBeNull()
    expect(r.prospectKind).toBeNull()
  })

  it('reads sent from last_sent_at, and archived from archived_at', () => {
    expect(mapBpoQueueRow(bpoRow({ last_sent_at: '2026-09-02T00:00:00.000Z' })).state).toBe('sent')
    expect(mapBpoQueueRow(bpoRow({ sent_count: 2 })).state).toBe('sent')
    expect(mapBpoQueueRow(bpoRow({ archived_at: '2026-09-02T00:00:00.000Z' })).state).toBe('archived')
  })

  it('applies the same audit gate the CMA lanes get', () => {
    expect(
      mapBpoQueueRow(
        bpoRow({
          build_summary: {
            needs_review: true,
            audit: { used_llm: true, verdict: 'fail', summary: 'Comp count does not match.', findings: [{ severity: 'critical' }] },
          },
        }),
      ).state,
    ).toBe('audit-failed')
    expect(
      mapBpoQueueRow(
        bpoRow({ build_summary: { needs_review: true, audit: { used_llm: false, note: 'unavailable' } } }),
      ).state,
    ).toBe('unvetted')
    expect(mapBpoQueueRow(bpoRow({ build_error: 'subject not resolved' })).state).toBe('failed')
  })
})

describe('resolveCmaQueueState / readCmaAuditVerdict are exported for reuse', () => {
  it('classifies an audit that never ran as did-not-run, not a pass', () => {
    expect(readCmaAuditVerdict(null).verdict).toBe('did-not-run')
    expect(readCmaAuditVerdict({ audit: { used_llm: false } }).verdict).toBe('did-not-run')
    expect(readCmaAuditVerdict({ audit: { used_llm: true, verdict: 'pass' } }).verdict).toBe('pass')
  })

  it('is the one function that decides a queue state', () => {
    // The worker's auto-send decision (deliverable 3) must reach `ready`
    // through exactly this function, or the switch and the screen can disagree.
    expect(
      resolveCmaQueueState({
        status: 'draft',
        archivedAt: null,
        buildError: null,
        hasDocument: true,
        needsReview: false,
        auditVerdict: 'pass',
        deliveredAt: null,
        emailSentAt: null,
        queuedAt: null,
      }),
    ).toBe('ready')
    expect(
      resolveCmaQueueState({
        status: 'draft',
        archivedAt: null,
        buildError: null,
        hasDocument: true,
        needsReview: true,
        auditVerdict: 'pass',
        deliveredAt: null,
        emailSentAt: null,
        queuedAt: null,
      }),
    ).toBe('flagged')
  })
})
