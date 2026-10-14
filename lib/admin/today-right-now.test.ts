import { describe, expect, it } from 'vitest'
import {
  capRightNow,
  dedupeInboundReplies,
  lookingAtWithoutReplies,
  overdueSignOffDeals,
} from './today-right-now'

describe('today right-now strip', () => {
  it('keeps true replies and drops CMA opens / visits / tasks', () => {
    const kept = dedupeInboundReplies([
      { id: 'reply:1', kind: 'reply', personId: 1, occurredAt: '2026-10-14T10:00:00Z' },
      { id: 'doc:1', kind: 'doc-open', personId: 1, occurredAt: '2026-10-14T11:00:00Z' },
      { id: 'visit:2', kind: 'visit', personId: 2, occurredAt: '2026-10-14T11:00:00Z' },
      { id: 'task:3', kind: 'task', personId: 3, occurredAt: '2026-10-14T11:00:00Z' },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.id).toBe('reply:1')
  })

  it('shows Elize once when she replied twice', () => {
    const kept = dedupeInboundReplies([
      { id: 'reply:a', kind: 'reply', personId: 88, occurredAt: '2026-10-14T09:00:00Z' },
      { id: 'reply:b', kind: 'reply', personId: 88, occurredAt: '2026-10-14T12:00:00Z' },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.id).toBe('reply:b')
  })

  it('drops looking-at when that person already has a reply', () => {
    const looking = lookingAtWithoutReplies(
      [
        { personId: 88, occurredAt: '2026-10-14T12:01:00Z' },
        { personId: 99, occurredAt: '2026-10-14T12:02:00Z' },
      ],
      new Set([88]),
    )
    expect(looking.map((row) => row.personId)).toEqual([99])
  })

  it('keeps only overdue sign-off deals', () => {
    const overdue = overdueSignOffDeals([
      { items: [{ deadline: { overdue: true } }] },
      { items: [{ deadline: { overdue: false } }] },
      { items: [{}] },
    ])
    expect(overdue).toHaveLength(1)
  })

  it('caps the strip', () => {
    expect(capRightNow([1, 2, 3, 4], 2)).toEqual([1, 2])
  })
})
