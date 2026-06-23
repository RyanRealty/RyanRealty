import { describe, it, expect } from 'vitest'
import { prepareDeliverableEmail, htmlToPlainText, BROKERAGE_POSTAL_ADDRESS } from './prepare'

const ON_DOMAIN_UNSUB = 'https://ryan-realty.com/api/email/unsubscribe?t=abc'

describe('prepareDeliverableEmail (9.E.7 + 9.3)', () => {
  it('produces an inbox-safe email (ok) with a multipart + List-Unsubscribe headers', () => {
    const r = prepareDeliverableEmail({
      subject: 'Your Bend home value update',
      html: '<p>Hi Pat, here is your updated home value for 123 Main St.</p><p><a href="https://ryan-realty.com/home-value">View the report</a></p>',
      unsubscribeUrl: ON_DOMAIN_UNSUB,
    })
    expect(r.report.level).toBe('ok')
    expect(r.text.length).toBeGreaterThan(0)
    expect(r.html).toContain('Unsubscribe')
    expect(r.headers['List-Unsubscribe']).toBe(`<${ON_DOMAIN_UNSUB}>`)
    expect(r.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('derives a plain-text alternative from the HTML when text is omitted', () => {
    const r = prepareDeliverableEmail({
      subject: 'Market update',
      html: '<p>The Bend median home value moved this month.</p>',
      unsubscribeUrl: ON_DOMAIN_UNSUB,
    })
    expect(r.text).toContain('median home value')
    expect(r.text).toContain('Unsubscribe')
  })

  it('builds the one-click URL + headers from a personId', () => {
    const r = prepareDeliverableEmail({
      subject: 'Hi there',
      html: '<p>A friendly note about your saved homes in Bend.</p>',
      personId: 4242,
    })
    expect(r.headers['List-Unsubscribe']).toMatch(/\/api\/email\/unsubscribe\?t=/)
    expect(r.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('appends the CAN-SPAM physical address to both parts', () => {
    const r = prepareDeliverableEmail({
      subject: 'Hi there',
      html: '<p>A friendly note about your saved homes in Bend.</p>',
      unsubscribeUrl: ON_DOMAIN_UNSUB,
    })
    const zip = BROKERAGE_POSTAL_ADDRESS.match(/\b\d{5}\b/)?.[0] ?? '97701'
    expect(r.html).toContain(zip)
    expect(r.text).toContain(zip)
  })

  it('FAILS (and exposes the report) when there is no unsubscribe path at all', () => {
    const r = prepareDeliverableEmail({
      subject: 'Hi there',
      html: '<p>A note with no recipient identity attached to it.</p>',
    })
    expect(r.headers['List-Unsubscribe']).toBeUndefined()
    expect(r.report.level).toBe('fail')
    expect(r.report.issues.some((i) => i.code === 'no-unsubscribe')).toBe(true)
  })

  it('htmlToPlainText strips tags and collapses whitespace', () => {
    expect(htmlToPlainText('<h1>Hi</h1><p>Line one.</p><p>Line two.</p>')).toBe('Hi\nLine one.\nLine two.')
  })
})
