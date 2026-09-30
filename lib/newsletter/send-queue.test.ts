import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { computeSchedule, renderForRecipient, NEWSLETTER_FROM_ADDRESS } from './send-queue'
import { verifyEmailToken } from '@/lib/email-tracking'

// These are the published business lines (brokers.twilio_number), never a personal cell.
const BROKERS = new Map([
  ['matt', { slug: 'matt', name: 'Matt Ryan', email: 'matt@ryan-realty.com', phone: '541.703.3095', title: 'Owner & Principal Broker' }],
  ['rebecca', { slug: 'rebecca', name: 'Rebecca Ryser Peterson', email: 'rebeccapeterson@ryan-realty.com', phone: '541.250.3380', title: 'Broker' }],
  ['paul', { slug: 'paul', name: 'Paul Stevenson', email: 'paul@ryan-realty.com', phone: '541.502.3436', title: 'Broker' }],
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

  it('large warm-up: every queued recipient gets a day, and no ramp day is over its ceiling for the whole domain', () => {
    // A first list send: some engaged, most new, and a large cold tier.
    const counts = new Map([[1, 600], [2, 5340], [3, 100000]])
    const rows = computeSchedule(counts, true, true)
    for (const [tier, n] of counts) {
      expect(rows.filter((r) => r.tier === tier).reduce((sum, r) => sum + r.cap, 0)).toBe(n)
    }
    // Per DAY, every tier on it together.
    const ramp = [500, 1000, 2000, 4000, 8000]
    const perDay = new Map<number, number>()
    for (const r of rows) perDay.set(r.day_index, (perDay.get(r.day_index) ?? 0) + r.cap)
    for (const [day, total] of perDay) if (day < ramp.length) expect(total).toBeLessThanOrEqual(ramp[day]!)
    // Tier 1's extra 100 rides day 1, tier 2 fills what is left of days 1 and 2 and carries to day 3.
    expect(rows.filter((r) => r.tier === 1)).toEqual([
      { day_index: 0, tier: 1, cap: 500 },
      { day_index: 1, tier: 1, cap: 100 },
    ])
    expect(rows.filter((r) => r.tier === 2)).toEqual([
      { day_index: 1, tier: 2, cap: 900 },
      { day_index: 2, tier: 2, cap: 2000 },
      { day_index: 3, tier: 2, cap: 2440 },
    ])
    // No day holds a tier twice, and nothing is scheduled with no one in it.
    const keys = rows.map((r) => `${r.day_index}:${r.tier}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(rows.every((r) => r.cap > 0)).toBe(true)
  })

  it('large warm-up: a tier that fits its own days does not spill past them', () => {
    // Day 1 is capped at 1,000; day 2 takes the other 1,500 under its 2,000.
    expect(computeSchedule(new Map([[2, 2500]]), true, true)).toEqual([
      { day_index: 1, tier: 2, cap: 1000 },
      { day_index: 2, tier: 2, cap: 1500 },
    ])
  })

  it('large steady send: the split covers everyone and adds no extra days', () => {
    const counts = new Map([[1, 3001], [2, 4001], [3, 5001]])
    const rows = computeSchedule(counts, true, false)
    for (const [tier, n] of counts) {
      expect(rows.filter((r) => r.tier === tier).reduce((sum, r) => sum + r.cap, 0)).toBeGreaterThanOrEqual(n)
    }
    expect(Math.max(...rows.map((r) => r.day_index))).toBe(6)
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

  it('a web slug is that broker, not Matt', () => {
    const r = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'paul-stevenson', subscriber_id: 's1' }, BROKERS, 'tok', 555)
    expect(r.from).toBe(`Paul Stevenson · Ryan Realty <${NEWSLETTER_FROM_ADDRESS}>`)
    expect(r.replyTo).toBe('paul@ryan-realty.com')
    expect(r.html).toContain('541.502.3436')
    // Site links are click-wrapped, so the broker stamp lives in each signed
    // destination. Image src attributes are not links and are not decorated.
    const dests = [...r.html!.matchAll(/\/api\/track\/e\/click\?t=([^"&]+)/g)]
      .map((m) => verifyEmailToken(decodeURIComponent(m[1]!))?.url ?? '')
      .filter((u) => u.includes('ryan-realty.com'))
    expect(dests.length).toBeGreaterThan(0)
    expect(dests.every((u) => u.includes('agent=paul'))).toBe(true)
    expect(r.html).not.toContain('977-6841')
    expect(r.html).not.toContain('agent=matt')
    expect(dests.some((u) => u.includes('agent=matt'))).toBe(false)
  })

  it('derives non-empty plain text from HTML when body_text is blank (G-NL-3)', () => {
    const r = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'matt', subscriber_id: 's1' }, BROKERS, 'tok', 1)
    expect(r.text.trim().length).toBeGreaterThan(20)
    expect(r.text).toContain('1,831 homes')
  })
})

describe('shell frame (email.html parity)', () => {
  it('renders masthead + hero + per-broker close + compliant footer at 640px', () => {
    const r = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'rebecca', subscriber_id: 's1' }, BROKERS, 'tok', 27004)
    const html = r.html!
    expect(html).toContain('max-width:640px') // approved mockup width (A7)
    expect(html).toContain('name="color-scheme"') // dark-mode safe (G-NL-7)
    expect(html).toMatch(/Ryan Realty<\/td>/) // navy masthead wordmark
    expect(html).toContain('images/lp/hero-oldmill.jpg') // full-bleed hero
    // per-broker close: Rebecca's name, dotted phone, "TALK TO REBECCA"
    expect(html).toContain("I'm Rebecca Ryser Peterson.")
    expect(html).toContain('541.250.3380')
    expect(html).not.toContain('308-9087')
    expect(html).not.toContain('977-6841')
    expect(html).toContain('TALK TO REBECCA')
    // footer compliance
    expect(html).toContain('115 NW Oregon Ave')
    expect(html).toContain('Unsubscribe')
    // write a sample for visual review (out/ is gitignored)
    try {
      mkdirSync('out', { recursive: true })
      writeFileSync('out/newsletter-preview.html', html)
    } catch { /* best effort */ }
  })

  it('owner (Matt) close names the ownership; a non-owner does not', () => {
    const matt = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'matt', subscriber_id: 's1' }, BROKERS, 'tok', 1).html!
    const paul = renderForRecipient(LETTER, { email: 'x@y.com', broker: 'paul', subscriber_id: 's1' }, BROKERS, 'tok', 1).html!
    expect(matt).toContain('I run Ryan Realty') // owner
    expect(paul).not.toContain('I run Ryan Realty') // non-owner: no ownership claim
    expect(paul).toContain("I'm Paul Stevenson.")
    expect(paul).toContain('TALK TO PAUL')
    // brand-voice: the corny trust-me lines are gone
    expect(matt).not.toContain('answer my own phone')
    expect(matt).not.toContain('No pitch')
  })
})
