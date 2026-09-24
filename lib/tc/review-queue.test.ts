import { describe, expect, it } from 'vitest'
import type { ReviewDeadline } from './banking-days'
import {
  afterDecisionHref,
  orderReviewQueue,
  reviewHref,
  reviewPosition,
  urgencyWords,
  type ReviewInputDeal,
} from './review-queue'

const due = (bankingDaysRemaining: number): ReviewDeadline => ({
  dueIso: '2026-09-30',
  bankingDaysRemaining,
  overdue: bankingDaysRemaining < 0,
})

function deal(key: string, address: string, items: Array<[string, ReviewDeadline | null]>): ReviewInputDeal {
  return {
    propertyKey: key,
    address,
    broker: 'Matt Ryan',
    stage: 'pending',
    items: items.map(([name, deadline], i) => ({ itemId: `${key}-${i}`, name, docs: [{ id: `${key}-d${i}`, name: `${name}.pdf` }], deadline })),
  }
}

const DEALS: ReviewInputDeal[] = [
  deal('tumalo', '19496 Tumalo Reservoir Rd, Bend', [['Listing Change Forms', null]]),
  deal('beaumont', '20702 Beaumont Drive, Bend', [
    ['Earnest Money Receipt', due(4)],
    ['Sale Agreement', due(-3)],
  ]),
  deal('impala', '5663 Impala Avenue, Redmond', [
    ['Counter Offer', due(-1)],
    ['Addendum', due(1)],
  ]),
]

describe('orderReviewQueue', () => {
  it('puts the most overdue first, then the soonest due, then items with no clock', () => {
    const q = orderReviewQueue(DEALS)
    expect(q.map((e) => e.itemName)).toEqual(['Sale Agreement', 'Counter Offer', 'Addendum', 'Earnest Money Receipt', 'Listing Change Forms'])
    expect(q[0]).toMatchObject({ propertyKey: 'beaumont', address: '20702 Beaumont Drive, Bend', urgency: { word: 'Overdue', tone: 'down', hot: true } })
  })

  it('keeps one file together, in checklist order, when deadlines tie', () => {
    const q = orderReviewQueue([
      deal('b', 'B Street', [['Second', due(2)]]),
      deal('a', 'A Street', [
        ['First', due(2)],
        ['Also first', due(2)],
      ]),
    ])
    expect(q.map((e) => `${e.address}:${e.itemName}`)).toEqual(['A Street:First', 'A Street:Also first', 'B Street:Second'])
  })

  it('scopes to one file when asked', () => {
    expect(orderReviewQueue(DEALS, { dealKey: 'impala' }).map((e) => e.itemName)).toEqual(['Counter Offer', 'Addendum'])
    expect(orderReviewQueue(DEALS, { dealKey: 'nope' })).toEqual([])
  })
})

describe('urgencyWords', () => {
  it('names the deadline in banking days', () => {
    expect(urgencyWords(due(-1))).toMatchObject({ word: 'Overdue', age: '1 banking day overdue' })
    expect(urgencyWords(due(-3)).age).toBe('3 banking days overdue')
    expect(urgencyWords(due(0))).toMatchObject({ word: 'Due soon', tone: 'slow', age: 'due today' })
    expect(urgencyWords(due(2)).age).toBe('due in 2 banking days')
    expect(urgencyWords(due(5))).toMatchObject({ word: 'Waiting', tone: 'waiting' })
    expect(urgencyWords(null)).toMatchObject({ word: 'No date', age: 'no acceptance date' })
  })
})

describe('reviewPosition and the step after a decision', () => {
  const q = orderReviewQueue(DEALS)

  it('finds the item on screen and its neighbors', () => {
    const p = reviewPosition(q, 'impala-0')
    expect(p.index).toBe(1)
    expect(p.prev?.itemId).toBe('beaumont-1')
    expect(p.next?.itemId).toBe('impala-1')
    expect(afterDecisionHref(p)).toBe('/admin/sign-off/review?item=impala-1')
  })

  it('opens the top of the line when no item is named or the item is gone', () => {
    expect(reviewPosition(q, null).current?.itemId).toBe('beaumont-1')
    // signed off in another tab, or cleared by the SkySlope pull
    expect(reviewPosition(q, 'already-signed').index).toBe(0)
  })

  it('after the last item, goes back to whatever is left rather than past the end', () => {
    const last = reviewPosition(q, 'tumalo-0')
    expect(last.next).toBeNull()
    expect(afterDecisionHref(last)).toBe('/admin/sign-off/review')
  })

  it('reports an empty queue as nothing on screen', () => {
    expect(reviewPosition([], 'x')).toEqual({ index: -1, current: null, prev: null, next: null })
  })

  it('keeps the one-file scope in every link', () => {
    const scoped = orderReviewQueue(DEALS, { dealKey: 'impala' })
    const p = reviewPosition(scoped, 'impala-0')
    expect(afterDecisionHref(p, 'impala')).toBe('/admin/sign-off/review?deal=impala&item=impala-1')
    expect(reviewHref({ item: 'impala-0', doc: 'impala-d0', deal: 'impala' })).toBe('/admin/sign-off/review?deal=impala&item=impala-0&doc=impala-d0')
    expect(reviewHref({})).toBe('/admin/sign-off/review')
  })
})
