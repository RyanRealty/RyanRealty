import { describe, expect, it } from 'vitest'
import { htmlToPlainText, looksLikeHtml, prepareOutboundEmailBody } from '@/lib/crm/email-body'
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
  it('replaces FUB custom field tokens', () => {
    const out = renderCrmMerge('Audit for %customSellerPropertyAddress%', {
      first_name: 'Dana',
      name: 'Dana Felice',
      custom: { customSellerPropertyAddress: '123 Main St, Bend' },
    })
    expect(out).toBe('Audit for 123 Main St, Bend')
  })
})
