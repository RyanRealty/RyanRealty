import { describe, expect, it } from 'vitest'
import { collapseSendLog, summarizeCampaign, summarizeEngagement, type RawEmailEventRow } from './getEmailReporting'
import { summarizeEmailEngagement } from './getContactEmailEngagement'
import { foldCampaignRecipients } from './getBulkEmailCampaigns'
import { foldSendRows } from './emailDelivery'
import { computeEmailMetrics, computeTemplatePerf } from './getCrmTemplatesAdmin'

/**
 * A scanner's click is not a click (Matt 2026-09-29, tracked-email breaks).
 *
 * `/api/track/e/click` records a click made by automation (an email security
 * scanner, a link previewer, a crawler) as email_events `click_automated`, with
 * `meta.automation_reason`, and never as `click`. It lands in the same table as
 * the real lifecycle events, so every reader that fetches a send's events and
 * buckets them in memory sees the row. This file pins the promise the tracking
 * policy makes: no reader that reports engagement counts it as one.
 *
 * Each reader gets the same fan twice, once with a scanner row in it and once
 * without, and must answer identically; and a fan made only of scanner rows must
 * report no click at all. The readers that filter in SQL (`.eq('event','click')`,
 * `.in('event',['open','click'])`) cannot match the value by construction and are
 * listed in the commit report, not here.
 */

const BASE = {
  message_id: 'm1',
  recipient_email: 'lead@example.com',
  person_id: 7,
  broker: 'matt',
  send_type: 'cma',
  subject: 'Your home value report',
  email_key: 'cma:cma-828-florida',
}

type Row = RawEmailEventRow & { meta?: Record<string, unknown> | null }

function ev(event: string, occurred_at: string, over: Partial<Row> = {}): Row {
  return { ...BASE, event, occurred_at, meta: null, ...over }
}

/** What a recipient really did with the mail. */
const human: Row[] = [
  ev('sent', '2026-09-29T18:00:00.000Z'),
  ev('delivered', '2026-09-29T18:00:02.000Z'),
  ev('open', '2026-09-29T19:10:00.000Z'),
  ev('click', '2026-09-29T19:11:00.000Z', { meta: { url: 'https://ryan-realty.com/cma/cma-828-florida' } }),
]

/** What the recipient's mail server did three seconds after delivery. */
const scanner: Row[] = [
  ev('click_automated', '2026-09-29T18:00:05.000Z', {
    meta: { url: 'https://ryan-realty.com/cma/cma-828-florida', automation_reason: 'declared-crawler' },
  }),
  ev('click_automated', '2026-09-29T18:00:06.000Z', {
    meta: { url: 'https://ryan-realty.com/reviews', automation_reason: 'tool' },
  }),
]

// Delivery order does not matter to any reader; put the scanner in the middle of the fan.
const withScanner: Row[] = [human[0]!, human[1]!, ...scanner, human[2]!, human[3]!]
const preDelivery: Row[] = [human[0]!, human[1]!]

describe('collapseSendLog (the email send log, the contact card, the batch report)', () => {
  it('answers the same with a scanner row in the fan', () => {
    expect(collapseSendLog(withScanner)).toEqual(collapseSendLog(human))
  })

  it('a send the scanner touched but nobody clicked has no click time and does not rank as clicked', () => {
    const [row] = collapseSendLog([...preDelivery, ...scanner])
    expect(row).toBeDefined()
    expect(row!.clickedAtIso).toBeNull()
    expect(row!.latestEvent).toBe('delivered')
  })

  it('scanner rows alone build no send at all', () => {
    expect(collapseSendLog(scanner)).toEqual([])
  })
})

describe('summarizeEngagement and summarizeCampaign (click counts and click rate)', () => {
  it('answers the same with a scanner row in the fan', () => {
    expect(summarizeEngagement(withScanner)).toEqual(summarizeEngagement(human))
    expect(summarizeCampaign(withScanner)).toEqual(summarizeCampaign(human))
  })

  it('scanner clicks add nothing to clicked or clickRate', () => {
    const s = summarizeEngagement([...preDelivery, ...scanner])
    expect(s.clicked).toBe(0)
    expect(s.clickRate).toBe(0)
    expect(s.sent).toBe(1)
    expect(s.delivered).toBe(1)
  })

  it('a scanner row does not imply a delivery either', () => {
    // Real opens and clicks imply the mail was delivered (partial webhook
    // coverage); a scanner following a link implies nothing the store can trust.
    const s = summarizeEngagement(scanner)
    expect(s).toMatchObject({ sent: 0, delivered: 0, opened: 0, clicked: 0 })
  })
})

describe('summarizeEmailEngagement (the contact record card)', () => {
  const rows = (fan: Row[]) => fan.map((r) => ({ event: r.event, occurred_at: r.occurred_at }))

  it('answers the same with a scanner row in the fan', () => {
    expect(summarizeEmailEngagement(rows(withScanner))).toEqual(summarizeEmailEngagement(rows(human)))
  })

  it('scanner clicks are not a click and do not move the last-click time', () => {
    const s = summarizeEmailEngagement(rows([...preDelivery, ...scanner]))
    expect(s.clicks).toBe(0)
    expect(s.lastClickAt).toBeNull()
    expect(s.sent).toBe(1)
  })
})

describe('foldCampaignRecipients (the bulk campaign recipient table)', () => {
  it('answers the same with a scanner row in the fan', () => {
    expect(foldCampaignRecipients(withScanner)).toEqual(foldCampaignRecipients(human))
  })

  it('a recipient the scanner clicked for is not a clicker', () => {
    const [row] = foldCampaignRecipients([...preDelivery, ...scanner])
    expect(row).toBeDefined()
    expect(row!.clickCount).toBe(0)
    expect(row!.clickedAt).toBeNull()
    expect(row!.clickUrl).toBeNull()
    expect(row!.latestEvent).toBe('delivered')
  })

  it('scanner rows alone build no recipient', () => {
    expect(foldCampaignRecipients(scanner)).toEqual([])
  })
})

describe('foldSendRows (the delivery report)', () => {
  it('answers the same with a scanner row in the fan', () => {
    expect(foldSendRows(withScanner)).toEqual(foldSendRows(human))
  })

  it('a scanner click marks the send neither clicked nor opened', () => {
    const [row] = foldSendRows([...preDelivery, ...scanner])
    expect(row).toBeDefined()
    expect(row!.clicked).toBe(false)
    expect(row!.clickedAtIso).toBeNull()
    expect(row!.opened).toBe(false)
    expect(row!.status).toBe('delivered')
  })
})

describe('computeEmailMetrics (the template performance tab)', () => {
  const tpl = (event: string, n = 1) => ({ email_key: `tpl:welcome:${n}:100`, event })

  it('answers the same with scanner rows in the fan', () => {
    const real = [tpl('sent'), tpl('open'), tpl('click')]
    const scanned = [...real, tpl('click_automated'), tpl('click_automated', 2)]
    expect(computeEmailMetrics('welcome', 'email', scanned)).toEqual(computeEmailMetrics('welcome', 'email', real))
    expect(computeTemplatePerf('welcome', 'email', scanned)).toEqual(computeTemplatePerf('welcome', 'email', real))
  })

  it('scanner rows are no click', () => {
    const m = computeEmailMetrics('welcome', 'email', [tpl('sent'), tpl('click_automated')])
    expect(m).toMatchObject({ sent: 1, clicks: 0, opens: 0 })
  })
})
