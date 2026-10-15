import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeTableDb, type Row } from '@/test/fake-table-db'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const db = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('@/test/fake-table-db').fakeTableDb> }))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => db.current!.client }))
vi.mock('@/lib/data/brokers/directory', () => ({ ensureBrokerDirectory: async () => {} }))
vi.mock('@/lib/crm/suppressions', () => ({ isSuppressed: vi.fn(async () => ({ suppressed: false, reasons: [] })) }))

const access = vi.hoisted(() => ({
  current: { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' } as null | {
    email: string
    role: 'superuser' | 'broker' | 'report_viewer'
    brokerSlug: string | null
  },
}))
vi.mock('@/app/actions/crm-access', () => ({ getCrmAccess: async () => access.current }))

const sends = vi.hoisted(() => ({ email: vi.fn(), sms: vi.fn() }))
vi.mock('@/lib/comms/sendGovernedEmail', () => ({ sendGovernedEmail: sends.email }))
vi.mock('@/lib/comms/sendGovernedSms', () => ({ sendGovernedSms: sends.sms }))

import { draftReviewAskAction } from './crm-review-ask'

function person(id: number, over: Row = {}): Row {
  return {
    id,
    first_name: 'Sam',
    name: 'Sam Example',
    stage: 'Past Client',
    tags: [],
    emails: [{ value: `p${id}@example.com` }],
    phones: [],
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
}
const drafts = () => db.current!.tables().crm_message_drafts!

beforeEach(() => {
  access.current = { email: 'matt@ryan-realty.com', role: 'superuser', brokerSlug: 'matt' }
  sends.email.mockClear()
  sends.sms.mockClear()
})

describe('Matt picks past clients: one draft each, never sent', () => {
  it('drafts one ask for a picked past client, thanking them for their closed file', async () => {
    seed({
      crm_people: [person(7)],
      tc_deal_people: [{ id: 'l1', deal_id: 'd1', person_id: 7, role: 'seller' }],
      tc_deals: [{ id: 'd1', address: '61271 Kwinnum Drive, Bend, OR 97702', broker_name: 'Matt Ryan', stage_detail: 'Closed 2025-04-02' }],
      tc_cycles: [{ id: 'c1', deal_id: 'd1', kind: 'sale', status: 'Closed', actual_closing_date: '2025-04-02' }],
    })
    const r = await draftReviewAskAction([7])
    expect(r).toEqual({ ok: true, drafted: 1, skipped: [] })
    expect(drafts()).toEqual([expect.objectContaining({ person_id: 7, broker_slug: 'matt', channel: 'email', subject: 'A quick favor' })])
    expect(String(drafts()[0]!.body)).toContain('Hi Sam,')
    expect(String(drafts()[0]!.body)).toContain('trusting us with 61271 Kwinnum Drive.')
    expect(sends.email).not.toHaveBeenCalled()
    expect(sends.sms).not.toHaveBeenCalled()
  })

  it('a second click the same day does not make a second draft', async () => {
    seed({ crm_people: [person(7)] })
    await draftReviewAskAction([7])
    const again = await draftReviewAskAction([7])
    expect(again).toEqual({ ok: true, drafted: 0, skipped: [{ personId: 7, reason: 'a review ask is already drafted' }] })
    expect(drafts()).toHaveLength(1)
  })

  it('skips test, internal and already-asked people with the reason in plain words', async () => {
    seed({
      crm_people: [person(1, { tags: ['fleet:test'] }), person(2, { emails: [{ value: 'paul@ryan-realty.com' }] }), person(3), person(4)],
      crm_timeline: [
        { id: 1, person_id: 3, kind: 'email_out', title: 'A quick favor', body: 'leave us a Google review (https://search.google.com/local/writereview?placeid=x)', ts: '2026-01-01' },
      ],
    })
    const r = await draftReviewAskAction([1, 2, 3, 4])
    expect(r).toEqual({
      ok: true,
      drafted: 1,
      skipped: [
        { personId: 1, reason: 'test contact' },
        { personId: 2, reason: 'one of our own addresses' },
        { personId: 3, reason: 'already asked for a review' },
      ],
    })
    expect(drafts().map((d) => d.person_id)).toEqual([4])
  })

  it('only the principal broker drafts review asks', async () => {
    seed({ crm_people: [person(7)] })
    access.current = { email: 'rebeccapeterson@ryan-realty.com', role: 'broker', brokerSlug: 'rebecca' }
    const r = await draftReviewAskAction([7])
    expect(r.ok).toBe(false)
    expect(drafts()).toHaveLength(0)
    access.current = null
    expect((await draftReviewAskAction([7])).ok).toBe(false)
  })
})
