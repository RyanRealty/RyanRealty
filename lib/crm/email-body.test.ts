import { describe, expect, it } from 'vitest'
import { htmlToPlainText, looksLikeHtml, prepareOutboundEmailBody, wrapPlainTextHtml } from '@/lib/crm/email-body'
import { renderCrmMerge } from '@/lib/crm/merge'

describe('crm email-body', () => {
  it('detects HTML templates', () => {
    expect(looksLikeHtml('<div><p>Hello</p></div>')).toBe(true)
    expect(looksLikeHtml('Hello Dana,\n\nPlain text.')).toBe(false)
  })

  it('strips HTML to readable plain text', () => {
    const plain = htmlToPlainText(
      '<p>Hello Dana,</p><p>Call <a href="tel:+15412136706">541.213.6706</a>.</p>',
    )
    expect(plain).toContain('Hello Dana')
    expect(plain).toContain('541.213.6706')
    expect(plain).not.toContain('<p>')
  })

  it('prepares multipart bodies from HTML', () => {
    const { html, plain } = prepareOutboundEmailBody('<p>Hi %contact_first_name%</p>')
    expect(html).toContain('<p>')
    expect(plain).toBe('Hi %contact_first_name%')
  })
})

describe('renderCrmMerge', () => {
  it('replaces CRM custom field tokens', () => {
    const out = renderCrmMerge('Audit for %customSellerPropertyAddress%', {
      first_name: 'Dana',
      name: 'Dana Felice',
      custom: { customSellerPropertyAddress: '123 Main St, Bend' },
    })
    expect(out).toBe('Audit for 123 Main St, Bend')
  })
})

describe('wrapPlainTextHtml — bare URLs become trackable anchors', () => {
  it('links a bare https URL', () => {
    const html = wrapPlainTextHtml('See https://ryan-realty.com/housing-market for numbers.')
    expect(html).toContain('<a href="https://ryan-realty.com/housing-market"')
    expect(html).toContain('>https://ryan-realty.com/housing-market</a>')
  })

  it('leaves the sentence full stop outside the href', () => {
    const html = wrapPlainTextHtml('Numbers: https://ryan-realty.com/housing-market.')
    expect(html).toContain('href="https://ryan-realty.com/housing-market"')
    expect(html).toMatch(/<\/a>\.$|<\/a>\.</)
  })

  it('keeps query strings intact through escaping', () => {
    const html = wrapPlainTextHtml('https://ryan-realty.com/x?a=1&b=2')
    expect(html).toContain('href="https://ryan-realty.com/x?a=1&amp;b=2"')
  })

  it('still escapes markup and preserves line breaks via pre-wrap', () => {
    const html = wrapPlainTextHtml('a <b>bold</b>\nsecond line')
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;')
    expect(html).toContain('white-space:pre-wrap')
    expect(html).toContain('\nsecond line')
  })

  it('does not link plain text with no URL', () => {
    expect(wrapPlainTextHtml('no links here')).not.toContain('<a ')
  })
})
