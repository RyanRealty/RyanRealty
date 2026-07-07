import { describe, it, expect } from 'vitest'
import {
  wrapNewsletterHtml,
  newsletterTextFooter,
  NEWSLETTER_FRAME_INVARIANTS,
  type SenderBroker,
} from './newsletter-shell'
import { wrapBrandedEmail } from '@/lib/email/shell'
import { BROKERAGE_POSTAL_ADDRESS } from '@/lib/email/prepare'

const broker: SenderBroker = {
  name: 'Matt Ryan',
  firstName: 'Matt',
  title: 'Owner & Principal Broker',
  phone: '541.703.3095',
  email: 'matt@ryan-realty.com',
  headshotUrl: 'https://ryan-realty.com/images/brokers/ryan-matt.png',
  isOwner: true,
}

const UNSUB = 'https://ryan-realty.com/api/email/unsubscribe?t=abc.def'

describe('wrapNewsletterHtml (facade over the shared branded shell)', () => {
  const html = wrapNewsletterHtml({
    bodyHtml: '<tr><td style="padding:30px 34px;">Hello Bend.</td></tr>',
    previewText: 'The July read on the Bend market.',
    unsubscribeUrl: UNSUB,
    issueLine: 'THE BEND BRIEF · JULY',
    senderBroker: broker,
  })

  it('renders every G-NL-7 frame invariant in the output', () => {
    for (const invariant of NEWSLETTER_FRAME_INVARIANTS) {
      expect(html).toContain(invariant)
    }
  })

  it('carries the issue line, body, unsubscribe URL, and postal address', () => {
    expect(html).toContain('THE BEND BRIEF · JULY')
    expect(html).toContain('Hello Bend.')
    expect(html).toContain(UNSUB)
    expect(html).toContain('115 NW Oregon Ave')
  })

  it('renders the broker close with the first-person note and CTA', () => {
    expect(html).toContain('Matt Ryan')
    expect(html).toContain('TALK TO MATT')
    expect(html).toContain('tel:5417033095')
  })

  it('defaults the issue line to THE BEND BRIEF', () => {
    const out = wrapNewsletterHtml({ bodyHtml: '<tr><td>x</td></tr>', unsubscribeUrl: UNSUB })
    expect(out).toContain('THE BEND BRIEF')
  })

  it('produces the exact same frame as wrapBrandedEmail (one implementation)', () => {
    const direct = wrapBrandedEmail({
      bodyHtml: '<tr><td style="padding:30px 34px;">Hello Bend.</td></tr>',
      previewText: 'The July read on the Bend market.',
      mastheadLine: 'THE BEND BRIEF · JULY',
      senderBroker: broker,
      unsubscribeUrl: UNSUB,
      audienceLine: "You're receiving this because you subscribed to Ryan Realty updates.",
    })
    const viaFacade = wrapNewsletterHtml({
      bodyHtml: '<tr><td style="padding:30px 34px;">Hello Bend.</td></tr>',
      previewText: 'The July read on the Bend market.',
      unsubscribeUrl: UNSUB,
      issueLine: 'THE BEND BRIEF · JULY',
      senderBroker: broker,
    })
    expect(viaFacade).toBe(direct)
  })
})

describe('newsletterTextFooter', () => {
  it('spells out the postal address and unsubscribe link', () => {
    const text = newsletterTextFooter(UNSUB)
    expect(text).toContain(BROKERAGE_POSTAL_ADDRESS)
    expect(text).toContain(`Unsubscribe: ${UNSUB}`)
  })
})
