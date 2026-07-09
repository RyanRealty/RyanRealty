import { describe, it, expect } from 'vitest'
import { buildSignature, AGENCY_PAMPHLET_URL } from './email-signature'
import type { Broker } from '@/lib/data/types/broker'

/** Minimal broker fixture matching the live matthew-ryan row shape. */
function broker(overrides: Partial<Broker> = {}): Broker {
  return {
    slug: 'matthew-ryan',
    fullName: 'Matt Ryan',
    title: 'Owner & Principal Broker',
    email: 'matt@ryan-realty.com',
    phoneDirect: '541.703.3095',
    phoneFub: '541.703.3095',
    headshotPng: '/images/brokers/ryan-matt.png',
    headshotJpg: '/images/brokers/ryan-matt.jpg',
    licenseNumber: '201206613',
    bio: null,
    isPrincipal: true,
    ...overrides,
  }
}

describe('buildSignature — generated (no custom signature)', () => {
  it('renders the identity block + the ORS 696.820 pamphlet line', () => {
    const sig = buildSignature(broker())
    expect(sig.html).toContain('Matt Ryan')
    expect(sig.html).toContain('Owner &amp; Principal Broker')
    expect(sig.html).toContain('541.703.3095')
    expect(sig.html).toContain(AGENCY_PAMPHLET_URL)
    expect(sig.plain).toContain('Matt Ryan')
    expect(sig.plain).toContain(AGENCY_PAMPHLET_URL)
  })

  it('blank / whitespace-only custom signature falls back to generated', () => {
    const sig = buildSignature(broker({ emailSignature: '   \n  ' }))
    expect(sig.html).toContain('Owner &amp; Principal Broker')
    expect(sig.html).toContain('/images/brokers/ryan-matt.png')
  })
})

describe('buildSignature — Gmail-synced signature (2026-07-09)', () => {
  const GMAIL_SIG = '<div dir="ltr"><b>Matt Ryan</b><br>Ryan Realty · 541.213.6706<br><img src="https://example.com/logo.png"></div>'

  it('uses the Gmail signature HTML verbatim and outranks custom + generated', () => {
    const sig = buildSignature(
      broker({ gmailSignatureHtml: GMAIL_SIG, emailSignature: 'Custom fallback text' }),
    )
    expect(sig.html).toContain(GMAIL_SIG)
    expect(sig.html).not.toContain('Custom fallback text')
    // Generated identity block is replaced entirely.
    expect(sig.html).not.toContain('Owner &amp; Principal Broker')
    expect(sig.html).not.toContain('/images/brokers/ryan-matt.png')
  })

  it('ALWAYS appends the Oregon pamphlet compliance line (ORS 696.820)', () => {
    const sig = buildSignature(broker({ gmailSignatureHtml: GMAIL_SIG }))
    expect(sig.html).toContain(AGENCY_PAMPHLET_URL)
    expect(sig.html).toContain('ORS 696.820')
    expect(sig.plain).toContain(AGENCY_PAMPHLET_URL)
  })

  it('plain-text mirror strips the HTML', () => {
    const sig = buildSignature(broker({ gmailSignatureHtml: GMAIL_SIG }))
    expect(sig.plain).toContain('Matt Ryan')
    expect(sig.plain).toContain('Ryan Realty · 541.213.6706')
    expect(sig.plain).not.toContain('<b>')
  })

  it('blank/whitespace Gmail signature falls through to the custom signature', () => {
    const sig = buildSignature(broker({ gmailSignatureHtml: '  \n ', emailSignature: 'Custom fallback text' }))
    expect(sig.html).toContain('Custom fallback text')
  })
})

describe('buildSignature — broker custom signature (P1-6)', () => {
  it('replaces the identity block with the saved text, newlines become <br>', () => {
    const sig = buildSignature(
      broker({ emailSignature: 'Talk soon,\nMatt Ryan\nRyan Realty · 541.213.6706' }),
    )
    expect(sig.html).toContain('Talk soon,<br>Matt Ryan<br>Ryan Realty · 541.213.6706')
    // Generated identity block is replaced (no headshot, no title line).
    expect(sig.html).not.toContain('Owner &amp; Principal Broker')
    expect(sig.html).not.toContain('/images/brokers/ryan-matt.png')
    expect(sig.plain).toContain('Talk soon,\nMatt Ryan\nRyan Realty · 541.213.6706')
  })

  it('ALWAYS appends the Oregon pamphlet compliance line (ORS 696.820)', () => {
    const sig = buildSignature(broker({ emailSignature: 'Just Matt' }))
    expect(sig.html).toContain(AGENCY_PAMPHLET_URL)
    expect(sig.html).toContain('ORS 696.820')
    expect(sig.plain).toContain(AGENCY_PAMPHLET_URL)
  })

  it('escapes HTML in the saved text (plain text only, no injection)', () => {
    const sig = buildSignature(broker({ emailSignature: '<script>alert(1)</script> & Co' }))
    expect(sig.html).not.toContain('<script>')
    expect(sig.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co')
  })

  it('handles CRLF newlines from textarea input', () => {
    const sig = buildSignature(broker({ emailSignature: 'Line one\r\nLine two' }))
    expect(sig.html).toContain('Line one<br>Line two')
  })
})
