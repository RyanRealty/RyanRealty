import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeTableDb, type Row } from '@/test/fake-table-db'
import { GBP_REVIEW_URL } from '@/lib/brand/contact'

vi.mock('server-only', () => ({}))

const db = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('@/test/fake-table-db').fakeTableDb> }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => db.current!.client }))
vi.mock('@/lib/data/brokers/directory', () => ({ ensureBrokerDirectory: async () => {} }))

// The send-time chokepoint, answered from the people rows' own markers.
const suppressed = vi.hoisted(() => ({ email: new Set<number>(), sms: new Set<number>() }))
vi.mock('@/lib/crm/suppressions', () => ({
  isSuppressed: vi.fn(async (personId: number, channel: 'email' | 'sms') => ({
    suppressed: suppressed[channel].has(personId),
    reasons: [],
  })),
}))

// If anything on this path reached a send rail, these would record it.
const sends = vi.hoisted(() => ({ email: vi.fn(), sms: vi.fn() }))
vi.mock('@/lib/comms/sendGovernedEmail', () => ({ sendGovernedEmail: sends.email }))
vi.mock('@/lib/comms/sendGovernedSms', () => ({ sendGovernedSms: sends.sms }))

import { stageReviewAsksForRecentCloses } from './stageReviewAsksForRecentCloses'

const NOW = new Date('2026-10-14T16:00:00Z')

function cycle(id: string, dealId: string, closeDate: string, over: Row = {}): Row {
  return { id, deal_id: dealId, kind: 'sale', status: 'Closed', actual_closing_date: closeDate, ...over }
}
function deal(id: string, over: Row = {}): Row {
  return { id, address: '3480 SW 45th Street, Redmond, OR 97756', broker_name: 'Matt Ryan', stage: 'closed', stage_detail: 'Closed', ...over }
}
function link(dealId: string, personId: number, role = 'buyer'): Row {
  return { id: `${dealId}-${personId}`, deal_id: dealId, person_id: personId, role }
}
function person(id: number, over: Row = {}): Row {
  return {
    id,
    first_name: 'Dana',
    name: 'Dana Example',
    stage: 'Past Client',
    tags: [],
    emails: [{ value: `p${id}@example.com` }],
    phones: [{ value: '5415550123' }],
    deleted: false,
    ...over,
  }
}

function seed(over: Partial<Record<string, Row[]>> = {}) {
  db.current = fakeTableDb({
    tc_cycles: [],
    tc_deals: [],
    tc_deal_people: [],
    crm_people: [],
    crm_timeline: [],
    crm_message_drafts: [],
    ...over,
  })
  return db.current
}

const drafts = () => db.current!.tables().crm_message_drafts!
const ledger = () => db.current!.tables().crm_timeline!.filter((r) => String(r.dedupe_key ?? '').startsWith('review-ask:'))
const run = (opts: { dryRun?: boolean } = {}) => stageReviewAsksForRecentCloses({ now: NOW, ...opts })

beforeEach(() => {
  suppressed.email.clear()
  suppressed.sms.clear()
  sends.email.mockClear()
  sends.sms.mockClear()
})

describe('a real Vault closing drafts one ask per eligible party, for Matt to approve', () => {
  it('drafts for the client, not for the test or internal people on the file', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1, 'buyer'), link('d1', 2, 'seller'), link('d1', 3, 'seller')],
      crm_people: [
        person(1),
        person(2, { emails: [{ value: 'admin@ryan-realty.com' }] }),
        person(3, { tags: ['fleet:test'] }),
      ],
    })
    const s = await run()
    expect(s).toMatchObject({ dealsScanned: 1, partiesConsidered: 3, created: 1, errors: 0 })
    expect(s.skipped).toEqual({ internal: 1, test: 1 })
    expect(drafts()).toHaveLength(1)
    const d = drafts()[0]!
    expect(d).toMatchObject({ person_id: 1, broker_slug: 'matt', channel: 'email', subject: 'A quick favor' })
    expect(String(d.body)).toContain('Hi Dana,')
    expect(String(d.body)).toContain('trusting us with 3480 SW 45th Street.')
    expect(String(d.body)).toContain(`[leave us a Google review](${GBP_REVIEW_URL})`)
    expect(ledger().map((r) => r.dedupe_key)).toEqual(['review-ask:1:deal:d1'])
    // Only the draft and its ledger row were written. Nothing went out.
    expect(new Set(db.current!.writes.map((w) => w.table))).toEqual(new Set(['crm_message_drafts', 'crm_timeline']))
    expect(sends.email).not.toHaveBeenCalled()
    expect(sends.sms).not.toHaveBeenCalled()
  })

  it('a closing that reached the Vault weeks late still gets its ask (the old 14-day bug)', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-07-09')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1, 'seller')],
      crm_people: [person(1)],
    })
    expect((await run()).created).toBe(1)
  })

  it('never twice for the same person and deal, even after the draft is sent or discarded', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1)],
      crm_people: [person(1)],
    })
    expect((await run()).created).toBe(1)
    const again = await run()
    expect(again).toMatchObject({ created: 0, already: 1 })
    expect(drafts()).toHaveLength(1)
    // Sending (or discarding) deletes the draft; the ledger still holds.
    db.current!.tables().crm_message_drafts = []
    const third = await run()
    expect(third.created).toBe(0)
    expect(third.skipped).toEqual({ 'already-drafted': 1 })
    expect(drafts()).toHaveLength(0)
  })

  it('one ask for a person on two closings', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2025-11-01'), cycle('c2', 'd2', '2026-09-01')],
      tc_deals: [deal('d1'), deal('d2', { address: '909 NW Delaware Avenue, Bend, OR 97703' })],
      tc_deal_people: [link('d1', 1, 'buyer'), link('d2', 1, 'seller')],
      crm_people: [person(1)],
    })
    const s = await run()
    expect(s.created).toBe(1)
    expect(String(drafts()[0]!.body)).toContain('909 NW Delaware Avenue')
    expect(ledger().map((r) => r.dedupe_key)).toEqual(['review-ask:1:deal:d2'])
  })

  it('skips anyone a broker already asked by hand', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1)],
      crm_people: [person(1)],
      crm_timeline: [{ id: 5, person_id: 1, kind: 'email_out', title: 'A quick review', body: 'Hi', ts: '2025-09-30T17:00:00Z' }],
    })
    const s = await run()
    expect(s.created).toBe(0)
    expect(s.skipped).toEqual({ 'already-asked': 1 })
  })

  it('leaves a broker-started draft alone', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1)],
      crm_people: [person(1)],
      crm_message_drafts: [{ id: 9, person_id: 1, broker_slug: 'matt', channel: 'email', subject: 'Closing gift', body: 'Hi Dana' }],
    })
    const s = await run()
    expect(s).toMatchObject({ created: 0, skippedExisting: 1 })
    expect(drafts()).toEqual([expect.objectContaining({ subject: 'Closing gift', body: 'Hi Dana' })])
  })

  it('respects consent: suppressed email, text only with SMS consent and no DNC block', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1), link('d1', 2, 'seller'), link('d1', 3, 'seller')],
      crm_people: [person(1), person(2, { tags: ['sms-consent:yes'] }), person(3, { tags: ['sms-consent:yes'] })],
    })
    suppressed.email.add(1).add(2).add(3)
    suppressed.sms.add(3) // e.g. compliance:dnc-registry
    const s = await run()
    expect(s.created).toBe(1)
    expect(s.skipped).toEqual({ 'email-blocked': 1, 'sms-blocked': 1 })
    expect(drafts()).toEqual([expect.objectContaining({ person_id: 2, channel: 'text', subject: null })])
    expect(String(drafts()[0]!.body)).toContain(GBP_REVIEW_URL)
  })

  it('leaves out test files and closings older than a year', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-09-23'), cycle('c2', 'd2', '2025-10-01'), cycle('c3', 'd3', '2026-10-01', { status: 'Canceled/App' })],
      tc_deals: [deal('d1', { stage_detail: 'TC TEST (alias harness): closed' }), deal('d2'), deal('d3')],
      tc_deal_people: [link('d1', 1), link('d2', 2), link('d3', 3)],
      crm_people: [person(1), person(2), person(3)],
    })
    const s = await run()
    expect(s).toMatchObject({ dealsScanned: 0, created: 0 })
    expect(drafts()).toHaveLength(0)
  })

  it("names another broker's deal and still lands in Matt's Drafts", async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1', { broker_name: 'Rebecca Peterson' })],
      tc_deal_people: [link('d1', 1)],
      crm_people: [person(1)],
    })
    await run()
    expect(drafts()[0]).toMatchObject({ broker_slug: 'matt' })
    expect(String(drafts()[0]!.body)).toContain('trusting Rebecca and all of us at Ryan Realty with 3480 SW 45th Street.')
  })

  it('counts a closing with nobody linked, so the gap is visible', async () => {
    seed({ tc_cycles: [cycle('c1', 'd1', '2026-09-18')], tc_deals: [deal('d1')] })
    expect(await run()).toMatchObject({ dealsScanned: 1, dealsWithoutParties: 1, created: 0 })
  })

  it('records a draft staged before the ledger existed, so a discard is final', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-09-01')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1)],
      crm_people: [person(1)],
      crm_message_drafts: [
        { id: 18, person_id: 1, broker_slug: 'matt', channel: 'email', subject: 'A quick favor', body: `Hi,\n\n${GBP_REVIEW_URL}\n` },
      ],
    })
    expect(await run()).toMatchObject({ already: 1, created: 0 })
    expect(ledger().map((r) => r.dedupe_key)).toEqual(['review-ask:1:deal:d1'])
  })

  it("an ask still waiting in another broker's Drafts counts as pending (no second ask)", async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1', { broker_name: 'Rebecca Peterson' })],
      tc_deal_people: [link('d1', 1)],
      crm_people: [person(1)],
      crm_message_drafts: [
        { id: 3, person_id: 1, broker_slug: 'rebecca', channel: 'email', subject: 'A quick favor', body: `Hi,\n\n${GBP_REVIEW_URL}\n` },
      ],
    })
    expect(await run()).toMatchObject({ created: 0, already: 1 })
    expect(drafts()).toHaveLength(1)
  })

  it('a g.page review link sent by hand counts as asked', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1)],
      crm_people: [person(1)],
      crm_timeline: [{ id: 6, person_id: 1, kind: 'sms_out', title: 'Text sent', body: 'Would you? https://g.page/r/abc/review', ts: '2026-01-02' }],
    })
    expect((await run()).skipped).toEqual({ 'already-asked': 1 })
  })

  it('a dry run writes nothing', async () => {
    seed({
      tc_cycles: [cycle('c1', 'd1', '2026-10-04')],
      tc_deals: [deal('d1')],
      tc_deal_people: [link('d1', 1)],
      crm_people: [person(1)],
    })
    expect(await run({ dryRun: true })).toMatchObject({ created: 1, dryRun: true })
    expect(db.current!.writes).toHaveLength(0)
  })
})
