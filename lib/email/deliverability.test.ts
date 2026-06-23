import { describe, it, expect } from 'vitest'
import { analyzeEmailDeliverability } from './deliverability'

const GOOD = {
  subject: 'Your Bend home value update',
  text: 'Hi Pat, here is your updated home value. Manage preferences or unsubscribe: https://ryan-realty.com/unsub?t=abc. Ryan Realty, 123 Main St, Bend, OR 97701.',
  html: '<p>Hi Pat, here is your updated home value for 123 Main St.</p><p><a href="https://ryan-realty.com/home-value">View report</a></p><p><a href="https://ryan-realty.com/unsub?t=abc">Unsubscribe</a> · Ryan Realty, 123 Main St, Bend, OR 97701</p>',
}

describe('analyzeEmailDeliverability', () => {
  it('passes a clean, compliant email', () => {
    const r = analyzeEmailDeliverability(GOOD)
    expect(r.level).toBe('ok')
    expect(r.issues).toHaveLength(0)
  })

  it('FAILS an ALL-CAPS subject', () => {
    const r = analyzeEmailDeliverability({ ...GOOD, subject: 'YOUR HOME VALUE UPDATE' })
    expect(r.issues.some((i) => i.code === 'subject-allcaps' && i.severity === 'fail')).toBe(true)
  })

  it('FAILS a deceptive Re: prefix', () => {
    const r = analyzeEmailDeliverability({ ...GOOD, subject: 'Re: your home' })
    expect(r.issues.some((i) => i.code === 'subject-fake-reply')).toBe(true)
  })

  it('FAILS HTML-only (no plain-text part)', () => {
    const r = analyzeEmailDeliverability({ ...GOOD, text: '' })
    expect(r.issues.some((i) => i.code === 'no-plaintext')).toBe(true)
    expect(r.level).toBe('fail')
  })

  it('FAILS an image-only body', () => {
    const r = analyzeEmailDeliverability({ subject: 'Update', text: 'unsubscribe Bend OR 97701', html: '<img src="https://ryan-realty.com/a.png" alt="x">' })
    expect(r.issues.some((i) => i.code === 'image-only')).toBe(true)
  })

  it('FAILS a <script> in the body', () => {
    const r = analyzeEmailDeliverability({ ...GOOD, html: GOOD.html + '<script>alert(1)</script>' })
    expect(r.issues.some((i) => i.code === 'has-script')).toBe(true)
  })

  it('FAILS a missing unsubscribe', () => {
    const r = analyzeEmailDeliverability({ subject: 'Update', text: 'Bend OR 97701', html: '<p>hello there friend</p>' })
    expect(r.issues.some((i) => i.code === 'no-unsubscribe')).toBe(true)
  })

  it('warns on a missing physical address', () => {
    const r = analyzeEmailDeliverability({ subject: 'Update', text: 'unsubscribe here', html: '<p>hello there, please unsubscribe if needed</p>' })
    expect(r.issues.some((i) => i.code === 'no-physical-address' && i.severity === 'warn')).toBe(true)
  })

  it('FAILS a URL shortener link', () => {
    const r = analyzeEmailDeliverability({ ...GOOD, html: GOOD.html + '<a href="https://bit.ly/x">click</a>' })
    expect(r.issues.some((i) => i.code === 'url-shortener')).toBe(true)
  })

  it('warns on off-domain links', () => {
    const r = analyzeEmailDeliverability({ ...GOOD, html: GOOD.html + '<a href="https://evil.example.com/x">click</a>' })
    expect(r.issues.some((i) => i.code === 'external-links')).toBe(true)
  })

  it('warns on multiple spam-trigger phrases', () => {
    const r = analyzeEmailDeliverability({ ...GOOD, html: '<p>FREE cash, act now, 100% guaranteed, no obligation. unsubscribe. Bend OR 97701</p>' })
    expect(r.issues.some((i) => i.code === 'spam-words')).toBe(true)
  })
})
