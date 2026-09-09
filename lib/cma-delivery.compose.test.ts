import { describe, expect, it } from 'vitest'
import { composeCmaEmail } from '@/lib/cma-delivery'

const CMA = {
  estimatedValue: 649_000,
  valueLow: 625_000,
  valueHigh: 655_000,
} as unknown as Parameters<typeof composeCmaEmail>[0]['cma']

describe('composeCmaEmail (seller-LP instant valuation, Matt 2026-09-09 register)', () => {
  it('thanks them, gives the numbers, the pricing paragraph, the ask, the reviews', () => {
    const { subject, text, html } = composeCmaEmail({
      leadFirstName: 'Sarah',
      fullAddress: '123 NW Cascade Ave, Bend, OR 97703',
      cma: CMA,
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      brokerPhone: '(541) 703-3095',
    })
    expect(subject).toBe('Your report on 123 NW Cascade Ave')
    expect(text).toContain('Hi Sarah,')
    expect(text).toContain('My name is Matt Ryan with Ryan Realty in Bend. Thank you for asking what 123 NW Cascade Ave is worth.')
    expect(text).toContain('Closed sales nearby support $625,000 to $655,000. We would recommend listing at $649,000.')
    expect(text).toContain('the price is everything')
    expect(text).toContain('earn your business')
    expect(text).toContain('https://ryan-realty.com/reviews')
    expect(text).toContain('Please let me know if you have any questions.')
    expect(text).not.toContain('Reply or call')
    expect(text).not.toMatch(/[—–;!]/)
    expect(html).toContain('<strong>123 NW Cascade Ave</strong>')
    expect(html).toContain('<a href="https://ryan-realty.com/reviews"')
    expect(html).toContain('mailto:matt%40ryan-realty.com')
  })

  it('signs with the system signature when the broker row has one', () => {
    const { html, text } = composeCmaEmail({
      leadFirstName: 'Sarah',
      fullAddress: '123 NW Cascade Ave, Bend, OR 97703',
      cma: CMA,
      brokerName: 'Matt Ryan',
      brokerEmail: 'matt@ryan-realty.com',
      brokerPhone: '(541) 703-3095',
      signature: { html: '<table id="sig">Matt Ryan · Owner</table>', plain: '--\nMatt Ryan · Owner' },
    })
    expect(html).toContain('<table id="sig">')
    expect(html).not.toContain('style="margin-top:28px"')
    expect(text.trimEnd().endsWith('Matt Ryan · Owner')).toBe(true)
    for (const sentence of ['Thank you for asking', 'the price is everything', 'earn your business']) {
      expect(html).toContain(sentence)
    }
  })

  it('omits numbers it does not have and still reads as a letter', () => {
    const { text } = composeCmaEmail({
      leadFirstName: null,
      fullAddress: '9 Pine Rd',
      cma: { estimatedValue: null, valueLow: null, valueHigh: null } as unknown as typeof CMA,
      brokerName: null,
      brokerEmail: null,
      brokerPhone: null,
    })
    expect(text).toContain('Hi,')
    expect(text).toContain('This is Ryan Realty in Bend.')
    expect(text).not.toMatch(/\$\d/)
    expect(text).toContain('Ryan Realty')
  })
})
