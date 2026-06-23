import { describe, it, expect } from 'vitest'
import {
  summarizeDigest,
  buildSummarySentence,
  classifyAudience,
  crmContactUrl,
  summarizeWeeklyLeads,
  summarizeActiveDeals,
  type BrokerDigestRows,
} from './getBrokerDigest'

function baseRows(over: Partial<BrokerDigestRows> = {}): BrokerDigestRows {
  return {
    broker: { slug: 'matt', firstName: 'Matt' },
    windowStartIso: '2026-06-19T15:00:00Z',
    asOfDate: '2026-06-20',
    newLeads: [],
    openTasks: [],
    activeEnrollments: [],
    recentInbound: [],
    ...over,
  }
}

describe('getBrokerDigest pure helpers (10.4)', () => {
  describe('crmContactUrl', () => {
    it('builds the CRM admin deep link, not a FUB url', () => {
      expect(crmContactUrl(4821)).toBe('https://ryan-realty.com/admin/crm/4821')
      expect(crmContactUrl(4821)).not.toContain('followupboss')
    })
  })

  describe('classifyAudience', () => {
    it('reads the explicit audience tags first', () => {
      expect(classifyAudience(['audience:seller'])).toBe('seller')
      expect(classifyAudience(['audience:buyer'])).toBe('buyer')
    })
    it('falls back to a plain seller/buyer tag', () => {
      expect(classifyAudience(['seller', 'hot'])).toBe('seller')
      expect(classifyAudience(['buyer'])).toBe('buyer')
    })
    it('returns unknown for no signal or a non-array', () => {
      expect(classifyAudience([])).toBe('unknown')
      expect(classifyAudience(null)).toBe('unknown')
      expect(classifyAudience(undefined)).toBe('unknown')
    })
  })

  describe('buildSummarySentence', () => {
    it('says no new leads when the window is empty', () => {
      expect(
        buildSummarySentence({
          newLeads: 0,
          sellers: 0,
          buyers: 0,
          unclassified: 0,
          awaitingBroker: 0,
          overdueTasks: 0,
          recentInbound: 0,
        }),
      ).toBe('No new leads in this window.')
    })

    it('uses the singular for exactly one new lead', () => {
      expect(
        buildSummarySentence({
          newLeads: 1,
          sellers: 1,
          buyers: 0,
          unclassified: 0,
          awaitingBroker: 0,
          overdueTasks: 0,
          recentInbound: 0,
        }),
      ).toBe('You got 1 new lead.')
    })

    it('breaks down the audience mix and appends action items', () => {
      const out = buildSummarySentence({
        newLeads: 5,
        sellers: 2,
        buyers: 2,
        unclassified: 1,
        awaitingBroker: 3,
        overdueTasks: 1,
        recentInbound: 2,
      })
      expect(out).toBe(
        'You got 5 new leads, 2 sellers, 2 buyers, 1 unclassified. 3 contacts are awaiting your next step. 2 inbound replies came in. 1 task is overdue.',
      )
    })

    it('singularizes awaiting / inbound / overdue at a count of one', () => {
      const out = buildSummarySentence({
        newLeads: 0,
        sellers: 0,
        buyers: 0,
        unclassified: 0,
        awaitingBroker: 1,
        overdueTasks: 1,
        recentInbound: 1,
      })
      expect(out).toBe(
        'No new leads in this window. 1 contact is awaiting your next step. 1 inbound reply came in. 1 task is overdue.',
      )
    })

    it('never emits a banned punctuation mark', () => {
      const out = buildSummarySentence({
        newLeads: 3,
        sellers: 1,
        buyers: 1,
        unclassified: 1,
        awaitingBroker: 2,
        overdueTasks: 2,
        recentInbound: 1,
      })
      expect(out).not.toMatch(/[—–;]/)
    })
  })

  describe('summarizeDigest', () => {
    it('shapes an empty digest with zeroed counts', () => {
      const s = summarizeDigest(baseRows())
      expect(s.counts).toEqual({
        newLeads: 0,
        sellers: 0,
        buyers: 0,
        unclassified: 0,
        openTasks: 0,
        overdueTasks: 0,
        activeEnrollments: 0,
        awaitingBroker: 0,
        recentInbound: 0,
      })
      expect(s.leads).toEqual([])
      expect(s.brokerFirstName).toBe('Matt')
      expect(s.asOfDate).toBe('2026-06-20')
      expect(s.summarySentence).toBe('No new leads in this window.')
    })

    it('maps leads, derives the name, the audience, and the CRM url', () => {
      const s = summarizeDigest(
        baseRows({
          newLeads: [
            {
              personId: 10,
              name: 'Jane Doe',
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane@example.com',
              phone: '5415551212',
              source: 'Seller LP',
              stage: 'Lead',
              tags: ['audience:seller'],
              createdAtIso: '2026-06-20T01:00:00Z',
              lastActivityIso: '2026-06-20T02:00:00Z',
            },
            {
              personId: 11,
              name: null,
              firstName: 'Bob',
              lastName: null,
              email: 'bob@example.com',
              phone: null,
              source: null,
              stage: 'Lead',
              tags: ['buyer'],
              createdAtIso: '2026-06-20T03:00:00Z',
              lastActivityIso: null,
            },
            {
              personId: 12,
              name: '   ',
              firstName: null,
              lastName: null,
              email: null,
              phone: null,
              source: null,
              stage: 'Lead',
              tags: [],
              createdAtIso: '2026-06-20T04:00:00Z',
              lastActivityIso: null,
            },
          ],
        }),
      )
      expect(s.counts.newLeads).toBe(3)
      expect(s.counts.sellers).toBe(1)
      expect(s.counts.buyers).toBe(1)
      expect(s.counts.unclassified).toBe(1)

      expect(s.leads[0].name).toBe('Jane Doe')
      expect(s.leads[0].audience).toBe('seller')
      expect(s.leads[0].crmUrl).toBe('https://ryan-realty.com/admin/crm/10')
      // name falls back to first+last, then email, then Contact {id}
      expect(s.leads[1].name).toBe('Bob')
      expect(s.leads[2].name).toBe('Contact 12')
      // lastActivity falls back to createdAt when null
      expect(s.leads[1].lastActivityIso).toBe('2026-06-20T03:00:00Z')
    })

    it('flags overdue tasks against the wall clock', () => {
      const past = new Date(Date.now() - 86_400_000).toISOString()
      const future = new Date(Date.now() + 86_400_000).toISOString()
      const s = summarizeDigest(
        baseRows({
          openTasks: [
            { taskId: 1, personId: 10, personName: 'Jane', name: 'Call back', type: 'call', dueAtIso: past },
            { taskId: 2, personId: 11, personName: 'Bob', name: 'Send CMA', type: null, dueAtIso: future },
            { taskId: 3, personId: null, personName: null, name: 'No due date', type: null, dueAtIso: null },
          ],
        }),
      )
      expect(s.counts.openTasks).toBe(3)
      expect(s.counts.overdueTasks).toBe(1)
      expect(s.tasks.find((t) => t.taskId === 1)?.overdue).toBe(true)
      expect(s.tasks.find((t) => t.taskId === 2)?.overdue).toBe(false)
      expect(s.tasks.find((t) => t.taskId === 3)?.overdue).toBe(false)
    })

    it('counts awaiting-broker enrollments separately from running ones', () => {
      const s = summarizeDigest(
        baseRows({
          activeEnrollments: [
            { enrollmentId: 1, personId: 10, personName: 'Jane', sequenceName: 'Seller nurture', status: 'running', nextRunIso: null },
            { enrollmentId: 2, personId: 11, personName: 'Bob', sequenceName: 'Seller nurture', status: 'awaiting_broker', nextRunIso: null },
            { enrollmentId: 3, personId: 12, personName: 'Cy', sequenceName: 'Buyer nurture', status: 'paused_reply', nextRunIso: null },
          ],
        }),
      )
      expect(s.counts.activeEnrollments).toBe(3)
      expect(s.counts.awaitingBroker).toBe(2)
      expect(s.enrollments.find((e) => e.enrollmentId === 1)?.awaiting).toBe(false)
      expect(s.enrollments.find((e) => e.enrollmentId === 2)?.awaiting).toBe(true)
      expect(s.enrollments.find((e) => e.enrollmentId === 3)?.awaiting).toBe(true)
    })

    it('builds inbound snippets, preferring body and truncating long text', () => {
      const long = 'x'.repeat(200)
      const s = summarizeDigest(
        baseRows({
          recentInbound: [
            { timelineId: 1, personId: 10, personName: 'Jane', kind: 'sms_in', title: 'Text received', body: 'Is the home still available?', tsIso: '2026-06-20T05:00:00Z' },
            { timelineId: 2, personId: 11, personName: 'Bob', kind: 'form_submit', title: 'Seller form', body: null, tsIso: '2026-06-20T06:00:00Z' },
            { timelineId: 3, personId: 12, personName: 'Cy', kind: 'email_in', title: null, body: long, tsIso: '2026-06-20T07:00:00Z' },
          ],
        }),
      )
      expect(s.counts.recentInbound).toBe(3)
      expect(s.inbound[0].snippet).toBe('Is the home still available?')
      expect(s.inbound[1].snippet).toBe('Seller form')
      expect(s.inbound[2].snippet).toHaveLength(160)
      expect(s.inbound[2].snippet?.endsWith('...')).toBe(true)
    })
  })

  describe('summarizeWeeklyLeads', () => {
    it('tallies audience and source, dropping zero-count audiences', () => {
      const out = summarizeWeeklyLeads([
        { tags: ['audience:seller'], source: 'Seller LP' },
        { tags: ['audience:seller'], source: 'Seller LP' },
        { tags: ['buyer'], source: 'Buyer LP' },
        { tags: [], source: null },
      ])
      expect(out.totalNewLeads).toBe(4)
      expect(out.byAudience).toEqual([
        { label: 'Seller', count: 2 },
        { label: 'Buyer', count: 1 },
        { label: 'Unclassified', count: 1 },
      ])
      // sources sorted by count desc, blank source labeled Unknown
      expect(out.bySource[0]).toEqual({ source: 'Seller LP', count: 2 })
      expect(out.bySource.find((s) => s.source === 'Unknown')?.count).toBe(1)
    })

    it('handles an empty week', () => {
      const out = summarizeWeeklyLeads([])
      expect(out).toEqual({ byAudience: [], bySource: [], totalNewLeads: 0 })
    })
  })

  describe('summarizeActiveDeals', () => {
    it('sums open deal value and skips closed / lost / won stages', () => {
      const out = summarizeActiveDeals([
        { stage: 'Active', status: 'open', value: 500000 },
        { stage: 'Under contract', status: 'open', value: 750000 },
        { stage: 'Closed', status: 'closed', value: 600000 },
        { stage: 'Lost', status: null, value: 400000 },
        { stage: null, status: 'won', value: 900000 },
        { stage: 'Active', status: 'open', value: null },
      ])
      expect(out.count).toBe(3)
      expect(out.value).toBe(1_250_000)
    })

    it('returns zeros for no deals', () => {
      expect(summarizeActiveDeals([])).toEqual({ count: 0, value: 0 })
    })
  })
})
