import { describe, expect, it } from 'vitest'
import {
  foldCampaignRecipients,
  cohortEmailKeyForJob,
  sortCampaignRecipients,
  recipientHeat,
} from './getBulkEmailCampaigns'
import { inheritEmailKeys } from './getEmailReporting'
import type { RawEmailEventRow } from './getEmailReporting'

type Row = RawEmailEventRow & { meta?: { url?: string } | null }

function ev(over: Partial<Row>): Row {
  return {
    message_id: 'm1',
    recipient_email: 'lead@example.com',
    person_id: 7,
    broker: 'matt',
    send_type: 'campaign',
    event: 'sent',
    email_key: 'bulk:email-cohort:26',
    subject: 'Hi Jane',
    occurred_at: '2026-08-29T21:00:00.000Z',
    meta: null,
    ...over,
  }
}

describe('cohortEmailKeyForJob', () => {
  it('is stable per job', () => {
    expect(cohortEmailKeyForJob(26)).toBe('bulk:email-cohort:26')
  })
})

describe('foldCampaignRecipients', () => {
  it('groups a lifecycle fan into one row per recipient', () => {
    const rows = foldCampaignRecipients([
      ev({ event: 'sent' }),
      ev({ event: 'delivered', occurred_at: '2026-08-29T21:00:02.000Z' }),
      ev({ event: 'open', occurred_at: '2026-08-29T21:05:00.000Z' }),
      ev({ event: 'click', occurred_at: '2026-08-29T21:06:00.000Z', meta: { url: 'https://ryan-realty.com/cities/bend' } }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      email: 'lead@example.com',
      personId: 7,
      sentAt: '2026-08-29T21:00:00.000Z',
      deliveredAt: '2026-08-29T21:00:02.000Z',
      openedAt: '2026-08-29T21:05:00.000Z',
      clickedAt: '2026-08-29T21:06:00.000Z',
      clickCount: 1,
      bouncedAt: null,
      latestEvent: 'click',
      clickUrl: 'https://ryan-realty.com/cities/bend',
    })
  })

  it('counts every click event, not just the first', () => {
    const rows = foldCampaignRecipients([
      ev({ event: 'sent' }),
      ev({ event: 'click', occurred_at: '2026-08-29T21:06:00.000Z', meta: { url: 'https://ryan-realty.com/a' } }),
      ev({ event: 'click', occurred_at: '2026-08-29T21:07:00.000Z', meta: { url: 'https://ryan-realty.com/b' } }),
    ])
    expect(rows[0]?.clickCount).toBe(2)
  })

  it('sorts clickers above visitors above opens', () => {
    const opened = foldCampaignRecipients([ev({ recipient_email: 'open@x.com', event: 'open' })])[0]!
    const clicked = foldCampaignRecipients([
      ev({ recipient_email: 'click@x.com', event: 'click', occurred_at: '2026-08-29T21:06:00.000Z' }),
      ev({ recipient_email: 'click@x.com', event: 'click', occurred_at: '2026-08-29T21:07:00.000Z' }),
    ])[0]!
    const visited = {
      ...opened,
      email: 'visit@x.com',
      visitedAfterSend: true,
      clickCount: 0,
    }
    const ranked = sortCampaignRecipients([opened, visited, clicked])
    expect(ranked.map((r) => r.email)).toEqual(['click@x.com', 'visit@x.com', 'open@x.com'])
    expect(recipientHeat(clicked)).toBeGreaterThan(recipientHeat(visited))
  })

  it('keeps two people as two rows even when they share an email_key', () => {
    const rows = foldCampaignRecipients([
      ev({ recipient_email: 'a@x.com', person_id: 1, event: 'sent' }),
      ev({ recipient_email: 'b@x.com', person_id: 2, event: 'sent', message_id: 'm2' }),
      ev({ recipient_email: 'a@x.com', person_id: 1, event: 'bounce', occurred_at: '2026-08-29T21:01:00.000Z' }),
    ])
    expect(rows.map((r) => r.email).sort()).toEqual(['a@x.com', 'b@x.com'])
    expect(rows.find((r) => r.email === 'a@x.com')?.latestEvent).toBe('bounce')
    expect(rows.find((r) => r.email === 'b@x.com')?.latestEvent).toBe('sent')
  })

  it('collapses recipient casing', () => {
    const rows = foldCampaignRecipients([
      ev({ recipient_email: 'Lead@Example.com', event: 'sent' }),
      ev({ recipient_email: 'lead@example.com', event: 'open', occurred_at: '2026-08-29T21:02:00.000Z' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].openedAt).toBe('2026-08-29T21:02:00.000Z')
  })

  it('folds a webhook delivered row that arrived with a null email_key', () => {
    const rows = foldCampaignRecipients(
      inheritEmailKeys([
        ev({ event: 'sent', message_id: 're_1', email_key: 'bulk:email-cohort:26' }),
        ev({
          event: 'delivered',
          message_id: 're_1',
          email_key: null,
          occurred_at: '2026-08-29T21:00:02.000Z',
        }),
      ]),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].deliveredAt).toBe('2026-08-29T21:00:02.000Z')
    expect(rows[0].latestEvent).toBe('delivered')
  })
})

describe('inheritEmailKeys', () => {
  it('copies email_key from the sent row onto later message_id matches', () => {
    const [sent, delivered] = inheritEmailKeys([
      ev({ event: 'sent', message_id: 're_1', email_key: 'bulk:email-cohort:26' }),
      ev({ event: 'delivered', message_id: 're_1', email_key: null }),
    ])
    expect(sent.email_key).toBe('bulk:email-cohort:26')
    expect(delivered.email_key).toBe('bulk:email-cohort:26')
    expect(delivered.send_type).toBe('campaign')
    expect(delivered.broker).toBe('matt')
  })
})
