import { describe, expect, it } from 'vitest'
import {
  buildTransactionsDashboard,
  compactMoney,
  initials,
  shortDate,
  type DashboardDeal,
  type DashboardInput,
} from './dashboard'

function deal(p: Partial<DashboardDeal> & { id: string; stage: string }): DashboardDeal {
  return {
    propertyKey: `key-${p.id}`,
    address: `${p.id} Test Ave, Bend, OR, 97701`,
    city: 'Bend',
    brokerName: 'Matt Ryan',
    stageDetail: null,
    cycleKind: p.stage === 'active_listing' ? 'listing' : 'sale',
    listingDate: null,
    contractAcceptanceDate: null,
    escrowClosingDate: null,
    actualClosingDate: null,
    expirationDate: null,
    inspectionDays: null,
    financingDays: null,
    salePrice: null,
    listingPrice: null,
    itemsTotal: 0,
    itemsInReview: 0,
    itemsRequired: 0,
    partyNames: [],
    ...p,
  }
}

const TODAY = '2026-09-24'

function input(p: Partial<DashboardInput>): DashboardInput {
  return { deals: [], review: null, envelopes: [], mailQueue: 0, documentReview: 0, today: TODAY, ...p }
}

describe('stat tiles', () => {
  it('counts each stage from the board rows and sums volume from the same rows', () => {
    const d = buildTransactionsDashboard(
      input({
        deals: [
          deal({ id: '1', stage: 'active_listing', listingPrice: 650_000 }),
          deal({ id: '2', stage: 'active_listing', listingPrice: 1_350_000 }),
          deal({ id: '3', stage: 'pending', salePrice: 539_000, escrowClosingDate: '2026-10-10' }),
          deal({ id: '4', stage: 'pending', salePrice: 400_000, escrowClosingDate: '2026-12-01' }),
          deal({ id: '5', stage: 'closed', salePrice: 665_000, actualClosingDate: '2026-09-01' }),
          deal({ id: '6', stage: 'closed', salePrice: 999_000, actualClosingDate: '2025-06-01' }),
          deal({ id: '7', stage: 'dead' }),
        ],
      }),
    )
    const by = Object.fromEntries(d.stats.map((s) => [s.key, s]))
    expect(by.listings.value).toBe(2)
    expect(by.listings.sub).toBe('$2.0M listed')
    expect(by.contract.value).toBe(2)
    expect(by.contract.sub).toBe('$939K in escrow')
    // Only the Oct 10 close falls within 30 days of Sep 24.
    expect(by.closing.value).toBe(1)
    expect(by.closing.sub).toBe('next Oct 10')
    // 2025 closes do not count toward this year.
    expect(by.closed.value).toBe(1)
    expect(by.closed.label).toBe('Closed in 2026')
    expect(by.closed.sub).toBe('$665K volume')
    expect(by.review).toBeUndefined()
  })

  it('shows the review tile only to the principal broker, red when anything is late', () => {
    const d = buildTransactionsDashboard(input({ review: { deals: [], totalItems: 17, overdueItems: 3 } }))
    const review = d.stats.find((s) => s.key === 'review')!
    expect(review.value).toBe(17)
    expect(review.sub).toBe('3 past 7 banking days')
    expect(review.tone).toBe('danger')
    expect(review.href).toBe('/admin/sign-off/review')
  })
})

describe('needs you', () => {
  it('puts overdue reviews first, then passed closings, then the rest', () => {
    const d = buildTransactionsDashboard(
      input({
        deals: [
          deal({ id: 'a', stage: 'pending', escrowClosingDate: '2026-09-20', itemsTotal: 10, itemsRequired: 2 }),
          deal({ id: 'b', stage: 'active_listing', expirationDate: '2026-10-03' }),
        ],
        review: {
          totalItems: 2,
          overdueItems: 1,
          deals: [
            {
              propertyKey: 'key-r',
              address: '20702 Beaumont Drive',
              items: [
                { deadline: { dueIso: '2026-09-20', bankingDaysRemaining: -2, overdue: true } },
                { deadline: { dueIso: '2026-09-30', bankingDaysRemaining: 4, overdue: false } },
              ],
            },
          ],
        },
        mailQueue: 3,
      }),
    )
    expect(d.needsYou.map((n) => n.key)).toEqual(['review:key-r', 'pastclose:a', 'expires:b', 'missing:a', 'mail'])
    expect(d.needsYou[0].title).toBe('2 documents to review · 20702 Beaumont Drive')
    expect(d.needsYou[0].context).toMatch(/1 past the 7-banking-day deadline/)
    expect(d.needsYou[0].href).toBe('/admin/sign-off/review?deal=key-r')
    expect(d.needsYou[2].title).toBe('Listing expires in 9 days · b Test Ave')
    expect(d.needsYou[3].context).toBe('Matt Ryan · 8 of 10 checklist items done')
  })

  it('asks for the side and stage on a file the mail sweep opened', () => {
    const d = buildTransactionsDashboard(
      input({ deals: [deal({ id: 'x', stage: 'pre_contract', stageDetail: 'Opened from email: confirm side and stage' })] }),
    )
    expect(d.needsYou[0].key).toBe('confirm:x')
    expect(d.pipeline[0].label).toBe('Before contract')
    expect(d.pipeline[0].cards[0].line).toBe('Opened from email · confirm')
  })

  it('lists envelopes waiting two or more days, not ones sent today', () => {
    const d = buildTransactionsDashboard(
      input({
        envelopes: [
          { id: 'e1', name: 'Repair addendum', status: 'sent', sentAt: '2026-09-20T18:00:00Z', dealKey: 'k', dealAddress: '1 A St', recipientCount: 2, signedCount: 1 },
          { id: 'e2', name: 'Counter', status: 'sent', sentAt: '2026-09-24T10:00:00Z', dealKey: 'k', dealAddress: '1 A St', recipientCount: 2, signedCount: 0 },
          { id: 'e3', name: 'Done', status: 'completed', sentAt: '2026-09-01T10:00:00Z', dealKey: 'k', dealAddress: '1 A St', recipientCount: 2, signedCount: 2 },
        ],
      }),
    )
    expect(d.needsYou.map((n) => n.key)).toEqual(['sig:e1'])
    expect(d.needsYou[0].context).toBe('1 of 2 signed · sent 4 days ago')
  })

  it('says nothing needs you when nothing does', () => {
    const d = buildTransactionsDashboard(input({ deals: [deal({ id: 'z', stage: 'active_listing' })] }))
    expect(d.needsYou).toEqual([])
    expect(d.verdict).toBe('Nothing needs you · 1 live file')
  })
})

describe('coming up', () => {
  it('lists contract deadlines in banking days and closings within three weeks, soonest first', () => {
    const d = buildTransactionsDashboard(
      input({
        deals: [
          deal({ id: 'p', stage: 'pending', contractAcceptanceDate: '2026-09-21', inspectionDays: 10, escrowClosingDate: '2026-10-09' }),
          deal({ id: 'far', stage: 'pending', escrowClosingDate: '2026-12-01' }),
          deal({ id: 'l', stage: 'active_listing', expirationDate: '2026-10-03' }),
        ],
      }),
    )
    const labels = d.comingUp.map((c) => `${c.date} ${c.label}`)
    expect(labels).toContain('2026-10-09 Closes')
    expect(labels).toContain('2026-10-03 Listing expires')
    expect(labels.some((l) => l.includes('Inspection period ends'))).toBe(true)
    // Past items and anything beyond 21 days are left out.
    expect(labels.some((l) => l.startsWith('2026-12-01'))).toBe(false)
    expect(d.comingUp.map((c) => c.date)).toEqual([...d.comingUp.map((c) => c.date)].sort())
  })
})

describe('pipeline', () => {
  it('shows listings by expiration, contracts by closing, and only the last 60 days of closings', () => {
    const d = buildTransactionsDashboard(
      input({
        deals: [
          deal({ id: 'l1', stage: 'active_listing', expirationDate: '2026-12-31', listingDate: '2026-08-01', listingPrice: 650_000 }),
          deal({ id: 'l2', stage: 'active_listing', expirationDate: '2026-10-03' }),
          deal({ id: 'c1', stage: 'pending', escrowClosingDate: '2026-10-12', salePrice: 539_000, itemsTotal: 16, itemsRequired: 2, itemsInReview: 3 }),
          deal({ id: 'x1', stage: 'closed', actualClosingDate: '2026-09-01', itemsTotal: 12, itemsInReview: 2, itemsRequired: 3 }),
          deal({ id: 'x2', stage: 'closed', actualClosingDate: '2026-03-16' }),
        ],
      }),
    )
    const col = Object.fromEntries(d.pipeline.map((c) => [c.key, c]))
    expect(col.listings.cards.map((c) => c.id)).toEqual(['l2', 'l1'])
    expect(col.listings.cards[1].line).toBe('Listed 54 days · expires Dec 31')
    expect(col.contract.cards[0]).toMatchObject({
      address: 'c1 Test Ave',
      priceLabel: '$539,000',
      line: 'Closes Oct 12 · in 18 days',
      progress: { done: 11, total: 16 },
      review: 3,
      missing: 2,
      brokerInitials: 'MR',
    })
    expect(col.closed.cards.map((c) => c.id)).toEqual(['x1'])
    // a closed file carries no warnings (Matt 2026-09-24)
    expect(col.closed.cards[0]).toMatchObject({ review: 0, missing: 0 })
  })
})

describe('formatters', () => {
  it('compacts volume, keeps initials and calendar days honest', () => {
    expect(compactMoney(2_012_000)).toBe('$2.0M')
    expect(compactMoney(539_000)).toBe('$539K')
    expect(initials('Rebecca Peterson')).toBe('RP')
    expect(initials(null)).toBe('?')
    // A calendar day never shifts a day back through a time zone.
    expect(shortDate('2026-10-01')).toBe('Oct 1')
  })
})
