import { describe, it, expect } from 'vitest'
import { computeSchedule, renderForRecipient, NEWSLETTER_FROM_ADDRESS } from './send-queue'
import { verifyEmailToken } from '@/lib/email-tracking'

const BROKERS = new Map([
  ['matt', { slug: 'matt', name: 'Matt Ryan', email: 'matt@ryan-realty.com' }],
  ['rebecca', { slug: 'rebecca', name: 'Rebecca Ryser Peterson', email: 'rebeccapeterson@ryan-realty.com' }],
  ['paul', { slug: 'paul', name: 'Paul Stevenson', email: 'paul@ryan-realty.com' }],
])

const LETTER = {
  id: 'nl-123',
  subject: 'The Bend Brief',
  preview_text: 'Preview',
  body_html: '<p>There are <b>1,831 homes</b> for sale. <a href="https://ryan-realty.com/buy">Browse homes</a>.</p>',
  body_text: null,
}

describe('computeSchedule', () => {
  it('small send: one day-0 row per present tier (everything goes immediately)', () => {
    const rows = computeSchedule(new Map([[1, 2], [2, 1]]), false, false)
    expect(rows).toEqual(
      expect.arrayContaining([
        { day_index: 0, tier: 1, cap: 2 },
        { day_index: 0, tier: 2, cap: 1 },
      ]),
    )
    expect(rows.every((r) => r.day_index === 0)).toBe(true)
  })

  it('large send: engaged day 0, new days 1-2, cold days 3-6', () => {
    const rows = computeSchedule(new Map([[1, 3000], [2, 4000], [3, 5000]]), true, false)
    const days = (tier: number) => rows.filter((r) => r.tier === tier).map((r) => r.day_index).sort()
    expect(days(1)).toEqual([0])
    expect(days(2)).toEqual([1, 2])
    expect(days(3)).toEqual([3, 4, 5, 6])
  })

  it('large warm-up: first-day caps are ramped (<= warm ceiling), not the full split', () => {
    const rows = computeSchedule(new Map([[3, 100000]]), true, true)
    const day3 = rows.find((r) => r.tier === 3 && r.day_index === 3)
    expect(day3!.cap).toBeLessThanOrEqual(4000) // warm ceiling for day 3, not 25000
  })
})

describe('renderForRecipient — per-broker sender identity + broker-stamped token', () => {
  it('swaps From display-name + reply-to to the recipient\'s frozen broker, from the news. domain', () => {
    const r = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'rebecca', subscriber_id: 's1' }, BROKERS, 'tok-abc', 27004)
    expect(r.from).toBe(`Rebecca Ryser Peterson · Ryan Realty <${NEWSLETTER_FROM_ADDRESS}>`)
    expect(r.replyTo).toBe('rebeccapeterson@ryan-realty.com')
    expect(NEWSLETTER_FROM_ADDRESS).toContain('news.ryan-realty.com') // audit A4: bulk on news., not mail.
  })

  it('stamps ?agent=<recipient broker> and the broker INTO the tracking token (linked person)', () => {
    const r = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'paul', subscriber_id: 's1' }, BROKERS, 'tok', 555)
    expect(r.html).toContain('/api/track/e/click?t=') // instrumented (personId present)
    // the real destination link carries ?agent=paul (inside the signed token)
    const tokMatch = r.html!.match(/click\?t=([^"]+)"/)
    const ctx = verifyEmailToken(decodeURIComponent(tokMatch![1]))
    expect(ctx?.broker).toBe('paul')
    expect(ctx?.url).toContain('agent=paul')
  })

  it('unlinked subscriber (no person): attributed but not instrumented (no tracking hop)', () => {
    const r = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'matt', subscriber_id: 's1' }, BROKERS, 'tok', null)
    expect(r.html).toContain('agent=matt')
    expect(r.html).not.toContain('/api/track/e/')
  })

  it('unknown/garbage broker slug falls back to Matt', () => {
    const r = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'nobody', subscriber_id: 's1' }, BROKERS, 'tok', 1)
    expect(r.from).toBe(`Matt Ryan · Ryan Realty <${NEWSLETTER_FROM_ADDRESS}>`)
  })

  it('derives non-empty plain text from HTML when body_text is blank (G-NL-3)', () => {
    const r = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'matt', subscriber_id: 's1' }, BROKERS, 'tok', 1)
    expect(r.text.trim().length).toBeGreaterThan(20)
    expect(r.text).toContain('1,831 homes')
  })
})
