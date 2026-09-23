import { describe, expect, it } from 'vitest'
import {
  channelFromEmailKey,
  decorateOutboundText,
  decorateOutboundUrl,
  personalSiteLink,
  stripUnsignedIdentity,
} from './outbound-links'
import { signPersonLinkToken, verifyPersonLinkToken } from './link-token'

const pidOf = (url: string) => new URL(url).searchParams.get('_pid')

describe('decorateOutboundText — the one decoration helper', () => {
  it('stamps agent, the signed token for the channel, and CRM UTMs on our link', () => {
    const out = decorateOutboundUrl('https://ryan-realty.com/homes-for-sale/bend', {
      brokerSlug: 'matt',
      personId: 64115,
      channel: 'sequence',
    })
    const u = new URL(out)
    expect(u.searchParams.get('agent')).toBe('matt')
    expect(verifyPersonLinkToken(u.searchParams.get('_pid'))).toEqual({ personId: 64115, channel: 'sequence' })
    expect(u.searchParams.get('utm_source')).toBe('crm')
    expect(u.searchParams.has('_fuid')).toBe(false)
  })

  it('decorates every our-domain link inside an HTML body and leaves third-party links alone', () => {
    const html =
      '<a href="https://ryan-realty.com/a">A</a> <a href="https://www.ryan-realty.com/b?x=1">B</a> <a href="https://example.com/c">C</a>'
    const out = decorateOutboundText(html, { brokerSlug: 'rebecca', personId: 7, channel: 'email' })
    const token = signPersonLinkToken(7, 'email')
    expect((out.match(new RegExp(`_pid=${token.replace(/[.-]/g, '\\$&')}`, 'g')) ?? []).length).toBe(2)
    expect(out).toContain('href="https://example.com/c"')
  })

  it('replaces an UNSIGNED legacy _pid / _fuid already on a link with the signed token', () => {
    const out = decorateOutboundUrl('https://ryan-realty.com/cma/cma-1-main?_pid=64115&_fuid=22&utm_source=crm&utm_medium=sms', {
      brokerSlug: 'matt',
      personId: 64115,
      channel: 'prospecting',
    })
    expect(out).not.toMatch(/_pid=64115(&|$)/)
    expect(out).not.toContain('_fuid')
    expect(verifyPersonLinkToken(pidOf(out))?.personId).toBe(64115)
  })

  it('handles &amp; separators in HTML without breaking the query', () => {
    expect(stripUnsignedIdentity('https://ryan-realty.com/x?a=1&amp;_pid=5&amp;b=2')).toBe(
      'https://ryan-realty.com/x?a=1&amp;b=2',
    )
    expect(stripUnsignedIdentity('https://ryan-realty.com/x?_pid=5#top')).toBe('https://ryan-realty.com/x#top')
    // A signed token is kept.
    const t = signPersonLinkToken(5, 'email')
    expect(stripUnsignedIdentity(`https://ryan-realty.com/x?_pid=${t}`)).toBe(`https://ryan-realty.com/x?_pid=${t}`)
  })

  it('is idempotent', () => {
    const opts = { brokerSlug: 'matt', personId: 9, channel: 'newsletter' as const }
    const once = decorateOutboundText('<a href="https://ryan-realty.com/">Home</a>', opts)
    expect(decorateOutboundText(once, opts)).toBe(once)
  })

  it('never stamps identity when there is no person, and still strips a bare id', () => {
    const out = decorateOutboundUrl('https://ryan-realty.com/?_pid=12', { brokerSlug: 'matt', personId: null, channel: 'email' })
    expect(out).not.toContain('_pid')
    expect(out).toContain('agent=matt')
  })

  it('never adds an email, phone or name to a URL', () => {
    const out = decorateOutboundUrl('https://ryan-realty.com/', { brokerSlug: 'matt', personId: 3, channel: 'email' })
    expect(out).not.toMatch(/email=|eml=|phone=|name=|@/)
  })

  it('labels texted links as sms and personal links as personal-link, not email', () => {
    const sms = new URL(decorateOutboundUrl('https://ryan-realty.com/', { brokerSlug: 'matt', personId: 3, channel: 'sms' }))
    expect(sms.searchParams.get('utm_medium')).toBe('sms')
    const personal = new URL(personalSiteLink(3, 'paul'))
    expect(personal.searchParams.get('utm_medium')).toBe('personal-link')
    expect(personal.searchParams.get('agent')).toBe('paul')
    expect(verifyPersonLinkToken(personal.searchParams.get('_pid'))).toEqual({ personId: 3, channel: 'personal' })
  })

  it('leaves admin and tracker links untouched', () => {
    const out = decorateOutboundText('https://ryan-realty.com/admin/crm and https://ryan-realty.com/r/AbC123', {
      brokerSlug: 'matt',
      personId: 3,
      channel: 'sms',
    })
    expect(out).toContain('https://ryan-realty.com/admin/crm ')
  })
})

describe('channelFromEmailKey', () => {
  it('maps the sender keys in use', () => {
    expect(channelFromEmailKey('newsletter:abc:p1')).toBe('newsletter')
    expect(channelFromEmailKey('listing-alert:12:2026-09-23')).toBe('alert')
    expect(channelFromEmailKey('cma:cma-1-main')).toBe('document')
    expect(channelFromEmailKey('bpo:x')).toBe('document')
    expect(channelFromEmailKey('seq:Seller:2')).toBe('sequence')
    expect(channelFromEmailKey('market-report:manual:1:2')).toBe('report')
    expect(channelFromEmailKey('gov:reply:5')).toBe('email')
    expect(channelFromEmailKey(null)).toBe('email')
  })
})
