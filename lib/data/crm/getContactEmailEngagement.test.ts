import { describe, it, expect } from 'vitest'
import {
  campaignJobIdFromEmailKey,
  matchEmailSend,
  mergeEmailSendsIntoTimeline,
  summarizeEmailEngagement,
  type ContactEmailSend,
  type EmailTimelineOverlay,
} from './getContactEmailEngagement'

describe('summarizeEmailEngagement', () => {
  it('returns the empty summary (hasAny false) for no rows', () => {
    const s = summarizeEmailEngagement([])
    expect(s).toEqual({
      sent: 0,
      delivered: 0,
      opens: 0,
      clicks: 0,
      bounces: 0,
      complaints: 0,
      unsubscribes: 0,
      lastOpenAt: null,
      lastClickAt: null,
      hasAny: false,
      sends: [],
    })
  })

  it('counts each event type', () => {
    const s = summarizeEmailEngagement([
      { event: 'sent', occurred_at: '2026-06-01T00:00:00Z' },
      { event: 'delivered', occurred_at: '2026-06-01T00:00:02Z' },
      { event: 'open', occurred_at: '2026-06-01T01:00:00Z' },
      { event: 'open', occurred_at: '2026-06-02T01:00:00Z' },
      { event: 'click', occurred_at: '2026-06-02T02:00:00Z' },
      { event: 'bounce', occurred_at: '2026-06-03T00:00:00Z' },
      { event: 'complaint', occurred_at: '2026-06-03T01:00:00Z' },
      { event: 'unsubscribe', occurred_at: '2026-06-03T02:00:00Z' },
    ])
    expect(s.sent).toBe(1)
    expect(s.delivered).toBe(1)
    expect(s.opens).toBe(2)
    expect(s.clicks).toBe(1)
    expect(s.bounces).toBe(1)
    expect(s.complaints).toBe(1)
    expect(s.unsubscribes).toBe(1)
    expect(s.hasAny).toBe(true)
  })

  it('tracks the MOST RECENT open and click timestamps', () => {
    const s = summarizeEmailEngagement([
      { event: 'open', occurred_at: '2026-06-01T00:00:00Z' },
      { event: 'open', occurred_at: '2026-06-05T00:00:00Z' },
      { event: 'open', occurred_at: '2026-06-03T00:00:00Z' },
      { event: 'click', occurred_at: '2026-06-02T00:00:00Z' },
      { event: 'click', occurred_at: '2026-06-04T00:00:00Z' },
    ])
    expect(s.lastOpenAt).toBe('2026-06-05T00:00:00Z')
    expect(s.lastClickAt).toBe('2026-06-04T00:00:00Z')
  })

  it('ignores unknown event names and null timestamps without crashing', () => {
    const s = summarizeEmailEngagement([
      { event: 'delivered', occurred_at: null },
      { event: 'open', occurred_at: null },
      { event: 'totally-unknown', occurred_at: '2026-06-01T00:00:00Z' },
    ])
    expect(s.delivered).toBe(1)
    expect(s.opens).toBe(1)
    expect(s.lastOpenAt).toBeNull()
    expect(s.hasAny).toBe(true)
  })
})

describe('campaignJobIdFromEmailKey', () => {
  it('reads the job id off a cohort key', () => {
    expect(campaignJobIdFromEmailKey('bulk:email-cohort:26')).toBe(26)
    expect(campaignJobIdFromEmailKey('manual:7:1')).toBeNull()
    expect(campaignJobIdFromEmailKey(null)).toBeNull()
  })
})

describe('matchEmailSend', () => {
  const sends: ContactEmailSend[] = [
    {
      key: 'ek:bulk:email-cohort:26|a@b.com',
      emailKey: 'bulk:email-cohort:26',
      messageId: 're_1',
      subject: 'Hi Jane',
      sentAt: '2026-08-25T23:50:00.000Z',
      deliveredAt: '2026-08-25T23:50:02.000Z',
      openedAt: null,
      clickedAt: null,
      bouncedAt: null,
      latestEvent: 'delivered',
      campaignJobId: 26,
      lastSiteAt: null,
      visitedAfterSend: false,
    },
    {
      key: 'ek:manual:7:1|a@b.com',
      emailKey: 'manual:7:1',
      messageId: 'g1',
      subject: 'Hi Jane',
      sentAt: '2026-08-30T10:00:00.000Z',
      deliveredAt: null,
      openedAt: '2026-08-30T10:05:00.000Z',
      clickedAt: null,
      bouncedAt: null,
      latestEvent: 'open',
      campaignJobId: null,
      lastSiteAt: null,
      visitedAfterSend: false,
    },
  ]

  it('prefers the provider message id', () => {
    expect(matchEmailSend(sends, { messageId: 're_1' })?.campaignJobId).toBe(26)
    expect(matchEmailSend(sends, { messageId: 'g1' })?.emailKey).toBe('manual:7:1')
  })

  it('does not guess when two sends share a subject', () => {
    expect(matchEmailSend(sends, { subject: 'Hi Jane' })).toBeNull()
  })
})

describe('mergeEmailSendsIntoTimeline', () => {
  const item: EmailTimelineOverlay = {
    id: 11,
    kind: 'email_out',
    ts: '2026-08-30T10:00:00.000Z',
    title: 'Hi Jane',
    body: 'Hello',
    broker: 'matt',
    source: 'app',
    starred: false,
    payload: { gmailId: 'g1' },
  }

  it('annotates a matching email_out', () => {
    const out = mergeEmailSendsIntoTimeline(
      [item],
      [
        {
          key: 'ek:manual:7:1|a@b.com',
          emailKey: 'manual:7:1',
          messageId: 'g1',
          subject: 'Hi Jane',
          sentAt: '2026-08-30T10:00:00.000Z',
          deliveredAt: null,
          openedAt: '2026-08-30T10:05:00.000Z',
          clickedAt: null,
          bouncedAt: null,
          latestEvent: 'open',
          campaignJobId: null,
          lastSiteAt: null,
          visitedAfterSend: true,
        },
      ],
    )
    expect(out).toHaveLength(1)
    expect(out[0].opens).toBe(1)
    expect(out[0].visitedAfterSend).toBe(true)
    expect(out[0].id).toBe(11)
  })

  it('inserts a bulk send that has no timeline row', () => {
    const out = mergeEmailSendsIntoTimeline(
      [item],
      [
        {
          key: 'ek:manual:7:1|a@b.com',
          emailKey: 'manual:7:1',
          messageId: 'g1',
          subject: 'Hi Jane',
          sentAt: '2026-08-30T10:00:00.000Z',
          deliveredAt: null,
          openedAt: null,
          clickedAt: null,
          bouncedAt: null,
          latestEvent: 'sent',
          campaignJobId: null,
          lastSiteAt: null,
          visitedAfterSend: false,
        },
        {
          key: 'ek:bulk:email-cohort:26|a@b.com',
          emailKey: 'bulk:email-cohort:26',
          messageId: 're_1',
          subject: 'Cron reporting check',
          sentAt: '2026-08-25T23:50:00.000Z',
          deliveredAt: '2026-08-25T23:50:02.000Z',
          openedAt: null,
          clickedAt: null,
          bouncedAt: null,
          latestEvent: 'delivered',
          campaignJobId: 26,
          lastSiteAt: null,
          visitedAfterSend: false,
        },
      ],
    )
    expect(out).toHaveLength(2)
    const bulk = out.find((r) => r.campaignHref === '/admin/crm/reporting/batch-emails/26')
    expect(bulk?.title).toBe('Cron reporting check')
    expect(bulk?.delivered).toBe(true)
    expect(bulk && bulk.id < 0).toBe(true)
  })
})
