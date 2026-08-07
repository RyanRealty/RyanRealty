import { describe, it, expect } from 'vitest'
import {
  triageRank,
  rankTriageItems,
  mergeNeedsAction,
  replySignal,
  classifyDocEvent,
  docSignal,
  visitSignal,
  isTriageTaskCandidate,
  taskSignal,
  formatTriageAge,
  isSuppressedByStateTouch,
  isUnreadStatus,
  TRIAGE_WEIGHTS,
  SEQUENCE_RANK,
  type TriageItem,
  type TriageKind,
} from './getInboundTriage'

const NOW = Date.parse('2026-07-21T18:00:00.000Z')
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString()

function fixture(kind: TriageKind, hoursAgo: number, personId = 1): Omit<TriageItem, 'rank'> {
  return {
    id: `${kind}:${personId}`,
    kind,
    personId,
    personName: 'Test Person',
    signal: 'x',
    occurredAt: iso(hoursAgo),
    deepLink: `/admin/people/${personId}`,
    taskId: null,
  }
}

describe('triageRank', () => {
  it('ranks fresh signals at their full weight', () => {
    expect(triageRank('reply', iso(0), NOW)).toBeCloseTo(TRIAGE_WEIGHTS.reply, 5)
    expect(triageRank('visit', iso(0), NOW)).toBeCloseTo(TRIAGE_WEIGHTS.visit, 5)
  })

  it('halves the weight every 24 hours', () => {
    expect(triageRank('reply', iso(24), NOW)).toBeCloseTo(50, 5)
    expect(triageRank('reply', iso(48), NOW)).toBeCloseTo(25, 5)
    expect(triageRank('doc-open', iso(24), NOW)).toBeCloseTo(30, 5)
  })

  it('orders fresh signals reply > task > doc-open > visit', () => {
    const ranks = (['reply', 'task', 'doc-open', 'visit'] as const).map((k) => triageRank(k, iso(0), NOW))
    expect(ranks[0]).toBeGreaterThan(ranks[1])
    expect(ranks[1]).toBeGreaterThan(ranks[2])
    expect(ranks[2]).toBeGreaterThan(ranks[3])
  })

  it('lets recency beat a heavier stale signal (48h reply < fresh doc-open)', () => {
    expect(triageRank('reply', iso(48), NOW)).toBeLessThan(triageRank('doc-open', iso(0), NOW))
  })

  it('treats an unparseable timestamp as very stale, never NaN', () => {
    const r = triageRank('reply', 'not-a-date', NOW)
    expect(Number.isFinite(r)).toBe(true)
    expect(r).toBeLessThan(triageRank('visit', iso(24), NOW))
  })
})

describe('rankTriageItems', () => {
  it('sorts most urgent first and stamps rank on every item', () => {
    const ranked = rankTriageItems(
      [fixture('visit', 1, 1), fixture('reply', 1, 2), fixture('doc-open', 1, 3)],
      NOW,
    )
    expect(ranked.map((r) => r.kind)).toEqual(['reply', 'doc-open', 'visit'])
    for (const r of ranked) expect(r.rank).toBeGreaterThan(0)
  })

  it('returns an empty array for no items', () => {
    expect(rankTriageItems([], NOW)).toEqual([])
  })
})

describe('mergeNeedsAction', () => {
  const seq = (n: number) => Array.from({ length: n }, (_, i) => ({ enrollmentId: i + 1 }))

  it('puts fresh replies above sequence items and stale visits below', () => {
    const triage = rankTriageItems([fixture('reply', 0, 1), fixture('visit', 60, 2)], NOW)
    const merged = mergeNeedsAction(seq(2), triage)
    expect(merged[0]).toMatchObject({ kind: 'triage' })
    expect((merged[0] as { item: TriageItem }).item.kind).toBe('reply')
    expect(merged[1].kind).toBe('sequence')
    expect(merged[2].kind).toBe('sequence')
    expect(merged[3].kind).toBe('triage')
  })

  it('preserves the sequence queue order (oldest-waiting first)', () => {
    const merged = mergeNeedsAction(seq(3), [])
    expect(merged.map((e) => (e.item as { enrollmentId: number }).enrollmentId)).toEqual([1, 2, 3])
    for (const e of merged) expect(e.rank).toBeLessThanOrEqual(SEQUENCE_RANK)
  })

  it('caps the merged list at 15 by default', () => {
    const triage = rankTriageItems(
      Array.from({ length: 10 }, (_, i) => fixture('reply', i, i + 100)),
      NOW,
    )
    const merged = mergeNeedsAction(seq(10), triage)
    expect(merged).toHaveLength(15)
  })

  it('renders with either source empty', () => {
    expect(mergeNeedsAction([], [])).toEqual([])
    expect(mergeNeedsAction(seq(2), []).every((e) => e.kind === 'sequence')).toBe(true)
    const onlyTriage = mergeNeedsAction([], rankTriageItems([fixture('visit', 1)], NOW))
    expect(onlyTriage).toHaveLength(1)
    expect(onlyTriage[0].kind).toBe('triage')
  })
})

describe('replySignal', () => {
  it('names the document when the subject carries it', () => {
    expect(replySignal('email_in', 'Re: Your CMA for 123 Main St')).toBe('Replied about the CMA')
    expect(replySignal('email_in', 'Re: Broker price opinion')).toBe('Replied about the BPO')
    expect(replySignal('email_in', 'Re: July market report')).toBe('Replied about the market report')
  })

  it('falls back to the channel', () => {
    expect(replySignal('sms_in', null)).toBe('Replied by text')
    expect(replySignal('email_in', 'Quick question')).toBe('Replied by email')
  })
})

describe('classifyDocEvent', () => {
  it('classifies by concrete send_type first', () => {
    expect(classifyDocEvent('cma', null)).toBe('cma')
    expect(classifyDocEvent('bpo', null)).toBe('bpo')
    expect(classifyDocEvent('market-report', null)).toBe('market-report')
  })

  it('recovers from the email_key prefix when send_type is other/null', () => {
    expect(classifyDocEvent('other', 'cma:cma-62285-deer')).toBe('cma')
    expect(classifyDocEvent(null, 'bpo:some-slug')).toBe('bpo')
    expect(classifyDocEvent('other', 'market-report:bend:2026-07')).toBe('market-report')
    expect(classifyDocEvent('other', 'report:bend')).toBe('market-report')
  })

  it('rejects non-document sends', () => {
    expect(classifyDocEvent('newsletter', 'newsletter:2026-07')).toBeNull()
    expect(classifyDocEvent('alert', 'listing-alert:5:2026-07-20')).toBeNull()
    expect(classifyDocEvent(null, null)).toBeNull()
  })
})

describe('docSignal', () => {
  it('counts opens in plain English', () => {
    expect(docSignal('cma', 1)).toBe('Opened the CMA')
    expect(docSignal('bpo', 2)).toBe('Opened the BPO twice')
    expect(docSignal('market-report', 3)).toBe('Opened the market report 3 times')
  })
})

describe('visitSignal', () => {
  it('says on the site now inside 30 minutes', () => {
    expect(visitSignal(new Date(NOW - 5 * 60_000).toISOString(), 140, NOW)).toBe('On the site now')
  })
  it('falls back to the score after 30 minutes', () => {
    expect(visitSignal(iso(2), 140, NOW)).toBe('Hot on the site (score 140)')
  })
})

describe('isTriageTaskCandidate + taskSignal', () => {
  it('accepts showing/tour tasks by name or type', () => {
    expect(isTriageTaskCandidate({ name: 'Showing request: 123 Main', type: null, origin: 'app' })).toBe(true)
    expect(isTriageTaskCandidate({ name: 'Follow up', type: 'Tour', origin: 'app' })).toBe(true)
    expect(taskSignal({ name: 'Showing request: 123 Main', type: null })).toBe('Requested a showing')
  })

  it('accepts lp-form new-lead call tasks', () => {
    expect(isTriageTaskCandidate({ name: 'Call new seller lead', type: 'Call', origin: 'lp-form' })).toBe(true)
    expect(taskSignal({ name: 'Call new seller lead', type: 'Call' })).toBe('New lead call due')
  })

  it('accepts hot-lead escalation call tasks', () => {
    const name = 'Hot seller lead, score 120: Jane Doe. Call within 5 min.'
    expect(isTriageTaskCandidate({ name, type: 'Call', origin: 'app' })).toBe(true)
    expect(taskSignal({ name, type: 'Call' })).toBe('Hot lead call due')
  })

  it('rejects ordinary tasks', () => {
    expect(isTriageTaskCandidate({ name: 'Send anniversary card', type: 'Follow Up', origin: 'app' })).toBe(false)
    expect(isTriageTaskCandidate({ name: null, type: null, origin: null })).toBe(false)
  })
})

describe('formatTriageAge', () => {
  it('formats minutes, hours, days', () => {
    expect(formatTriageAge(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5m')
    expect(formatTriageAge(iso(3), NOW)).toBe('3h')
    expect(formatTriageAge(iso(50), NOW)).toBe('2d')
  })
  it('never goes negative and tolerates junk', () => {
    expect(formatTriageAge(new Date(NOW + 60_000).toISOString(), NOW)).toBe('0m')
    expect(formatTriageAge('junk', NOW)).toBe('')
  })
})

describe('watermark + unread helpers', () => {
  it('suppresses an item once the state row was touched after the event', () => {
    expect(isSuppressedByStateTouch(iso(1), iso(2))).toBe(true)
    expect(isSuppressedByStateTouch(iso(3), iso(2))).toBe(false)
    expect(isSuppressedByStateTouch(null, iso(2))).toBe(false)
    expect(isSuppressedByStateTouch(undefined, iso(2))).toBe(false)
  })

  it('treats a missing state row as unread (inbox default)', () => {
    expect(isUnreadStatus(undefined)).toBe(true)
    expect(isUnreadStatus(null)).toBe(true)
    expect(isUnreadStatus('unread')).toBe(true)
    expect(isUnreadStatus('open')).toBe(false)
    expect(isUnreadStatus('handled')).toBe(false)
    expect(isUnreadStatus('closed')).toBe(false)
  })
})
