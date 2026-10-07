import { describe, expect, it } from 'vitest'
import { blamesPriorAgent, isWorthQuestionCopy } from '@/lib/crm/first-touch-copy'
import {
  decideCmaAccess,
  gateBrokerFromRow,
  renderConsentBarHtml,
  renderConsentShell,
  renderEmailLinkSentShell,
  renderRegisterShell,
  renderWrongPersonShell,
} from './register-gate'

const BROKER = {
  name: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  phone: '+15417033095',
  photoUrl: '/images/brokers/ryan-matt.png',
  license: '201206613',
}

describe('CMA register shell — inbound packet', () => {
  it('names THIS home and what is inside, never a worth-question', () => {
    const html = renderRegisterShell({
      slug: 'cma-1842-nw-foo',
      address: '1842 NW Foo St, Bend, OR 97701',
      clientName: 'Pat',
    })
    expect(html).toContain('Your report on 1842 NW Foo St is ready')
    expect(html).toContain('Bend, OR 97701')
    expect(html).toContain('Where we would list your home, and why')
    expect(html).toContain('What nearby homes sold for after concessions')
    expect(html).toContain('The homes you would compete with today')
    // The street prints once in the heading, not three times down the card.
    expect(html.match(/1842 NW Foo St/g)?.length).toBe(2) // <title> + <h1>
    expect(html).not.toMatch(/how we would market|listing video|flyers/i)
    expect(html).not.toMatch(/what your home is worth/i)
    expect(html).not.toMatch(/What every listing gets/i)
    expect(isWorthQuestionCopy(html)).toBe(false)
    expect(blamesPriorAgent(html)).toBe(false)
  })

  it('offers Google and a private link by email to the address on file', () => {
    const html = renderRegisterShell({ slug: 'cma-1842-nw-foo', address: '1842 NW Foo St', clientName: null })
    expect(html).toContain('href="/api/cma/register?slug=cma-1842-nw-foo&start=1"')
    expect(html).toContain('Continue with Google')
    expect(html).toContain('action="/api/cma/email-link"')
    expect(html).toContain('name="slug" value="cma-1842-nw-foo"')
    expect(html).toContain('type="email" name="email" required')
    expect(html).toContain('Email me the link')
  })

  it('shows the broker: face, name, and Call and Text that say Call and Text', () => {
    const html = renderRegisterShell({ slug: 'cma-x', address: '2566 Keats, Bend, OR 97701', clientName: null, broker: BROKER })
    expect(html).toContain('Prepared by Matt Ryan for the owner')
    expect(html).toContain('src="/images/brokers/ryan-matt.png"')
    expect(html).toContain('href="tel:+15417033095"')
    expect(html).toContain('href="sms:+15417033095"')
    expect(html).toMatch(/>Call<\/a>/)
    expect(html).toMatch(/>Text<\/a>/)
    expect(html).toContain('541.703.3095')
    expect(html).toContain('Oregon license 201206613')
    expect(html).not.toMatch(/CALL 541/i)
  })

  it('renders without a broker when the broker read timed out', () => {
    const html = renderRegisterShell({ slug: 'cma-x', address: '2566 Keats', clientName: null, broker: null })
    expect(html).toContain('Prepared for the owner')
    expect(html).not.toContain('tel:')
  })

  it('is on brand: cream, navy, the wordmark, no white card, no em dash', () => {
    const html = renderRegisterShell({ slug: 'cma-x', address: '2566 Keats', clientName: null, broker: BROKER })
    expect(html).toContain('/images/brand/logo-blue.png')
    expect(html).toContain('family=Geist')
    expect(html).not.toMatch(/background:#fff(fff)?\b/i)
    expect(html).not.toMatch(/\u2014|&mdash;|&#8212;/)
  })

  it('escapes the address and the slug', () => {
    const html = renderRegisterShell({ slug: 'cma-x', address: '<b>1 A St</b>', clientName: null })
    expect(html).not.toContain('<b>1 A St</b>')
    expect(html).toContain('&lt;b&gt;1 A St&lt;/b&gt;')
  })
})

describe('CMA door email option', () => {
  it('drops the email form when nothing is on file to match (phone-only lead)', () => {
    const html = renderRegisterShell({ slug: 'cma-x', address: '2566 Keats', clientName: null, emailLink: false })
    expect(html).toContain('Continue with Google')
    expect(html).not.toContain('/api/cma/email-link')
  })

  it('wrong-person door keeps the account switch when the form is off', () => {
    const html = renderWrongPersonShell({ viewerEmail: 'someone@gmail.com', slug: 'cma-x', emailLink: false })
    expect(html).toContain('switch=1')
    expect(html).not.toContain('/api/cma/email-link')
  })

  it('a limited post says so instead of claiming a send', () => {
    const html = renderEmailLinkSentShell({ slug: 'cma-x', address: '2566 Keats', limited: true })
    expect(html).toContain('Too many tries')
    expect(html).not.toContain('Check your email')
  })
})

describe('gateBrokerFromRow', () => {
  it('uses the transparent portrait for a .jpg headshot', () => {
    const b = gateBrokerFromRow({
      display_name: 'Paul Stevenson',
      title: 'Broker',
      twilio_number: '+15415023436',
      photo_url: '/images/brokers/stevenson-paul.jpg',
      license_number: '201259123',
    })
    expect(b?.photoUrl).toBe('/images/brokers/stevenson-paul.png')
    expect(b?.phone).toBe('+15415023436')
  })

  it('returns null without a row or a name', () => {
    expect(gateBrokerFromRow(null)).toBeNull()
    expect(gateBrokerFromRow({ display_name: '  ' })).toBeNull()
  })
})

describe('CMA wrong-person door', () => {
  it('is not a dead end: another Google account, the email link, and a person', () => {
    const html = renderWrongPersonShell({ viewerEmail: 'someone@gmail.com', slug: 'cma-x', broker: BROKER })
    expect(html).toContain('someone@gmail.com')
    expect(html).toContain('href="/api/cma/register?slug=cma-x&start=1&switch=1"')
    expect(html).toContain('Use a different Google account')
    expect(html).toContain('action="/api/cma/email-link"')
    expect(html).toContain('Send the link')
    expect(html).toContain('href="sms:+15417033095"')
    expect(html).not.toMatch(/\u2014|&mdash;/)
  })

  it('still renders without a slug (no switch link, no form)', () => {
    const html = renderWrongPersonShell({ viewerEmail: 'someone@gmail.com' })
    expect(html).toContain('This report is private to the homeowner')
    expect(html).not.toContain('/api/cma/email-link')
  })
})

describe('CMA email-link answer page', () => {
  it('says the same thing whether or not the email matched, and names no address', () => {
    const html = renderEmailLinkSentShell({ slug: 'cma-x', address: '2566 Keats, Bend, OR 97701', broker: BROKER })
    expect(html).toContain('Check your email')
    expect(html).toContain('If that is the email we have for 2566 Keats')
    expect(html).toContain('from Matt Ryan')
    expect(html).toContain('href="/cma/cma-x"')
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)
  })
})

describe('CMA access gate — Google comms cookie skips Almost there', () => {
  const matched = {
    isAdmin: false,
    viewerEmail: 'pat@example.com',
    clientEmail: 'pat@example.com',
    personEmails: ['pat@example.com'],
    claimedBy: null as string | null,
  }

  it('serves when the comms cookie already recorded the ask', () => {
    expect(
      decideCmaAccess({ ...matched, consentRecorded: false, commsConsentRecorded: true }),
    ).toEqual({ kind: 'serve' })
  })

  it('still asks consent when identity matches and no cookie or CRM mark', () => {
    expect(
      decideCmaAccess({ ...matched, consentRecorded: false, commsConsentRecorded: false }),
    ).toEqual({ kind: 'consent' })
  })

  it('does not treat a site-wide cookie as a phone-only claim', () => {
    expect(
      decideCmaAccess({
        isAdmin: false,
        viewerEmail: 'new@example.com',
        clientEmail: null,
        personEmails: [],
        claimedBy: null,
        consentRecorded: false,
        commsConsentRecorded: true,
      }),
    ).toEqual({ kind: 'claim-and-consent' })
  })

  it('serves a phone-only doc once CRM consent (the claim) is recorded', () => {
    expect(
      decideCmaAccess({
        isAdmin: false,
        viewerEmail: 'new@example.com',
        clientEmail: null,
        personEmails: [],
        claimedBy: null,
        consentRecorded: true,
        commsConsentRecorded: true,
      }),
    ).toEqual({ kind: 'serve' })
  })

  it('keeps the consent shell free of Almost there and worth-questions', () => {
    const html = renderConsentShell({
      slug: 'cma-1842-nw-foo',
      address: '1842 NW Foo St',
      viewerEmail: 'pat@example.com',
      smsConsentText: 'I agree to receive text messages from Ryan Realty',
      claiming: false,
    })
    expect(html).not.toMatch(/Almost there/i)
    expect(html).toContain('I agree to receive text messages from Ryan Realty')
    expect(isWorthQuestionCopy(html)).toBe(false)
  })
})

describe('CMA access gate — the recipient reads without the door (Matt 2026-09-09)', () => {
  const doc = {
    isAdmin: false,
    viewerEmail: null,
    clientEmail: 'avery@example.com',
    personEmails: ['avery@example.com'],
    claimedBy: null,
    consentRecorded: false,
    personId: 63297,
  }

  it('the person the email went to is served straight away, consent or not', () => {
    expect(decideCmaAccess({ ...doc, recipientPersonId: 63297 })).toEqual({ kind: 'serve', via: 'recipient' })
  })

  it('anyone else still meets the door', () => {
    expect(decideCmaAccess({ ...doc, recipientPersonId: 99 })).toEqual({ kind: 'register' })
    expect(decideCmaAccess({ ...doc, recipientPersonId: null })).toEqual({ kind: 'register' })
    expect(decideCmaAccess({ ...doc, personId: null, recipientPersonId: 63297 })).toEqual({ kind: 'register' })
  })

  it('a signed-in stranger with the recipient cookie is still the recipient', () => {
    // The document belongs to the person, and they arrived on their link.
    expect(decideCmaAccess({ ...doc, viewerEmail: 'other@example.com', recipientPersonId: 63297 })).toEqual({
      kind: 'serve',
      via: 'recipient',
    })
  })

  it('the bar carries the slug, the person, both optional choices and a way out', () => {
    const html = renderConsentBarHtml({ slug: 'cma-2465', personId: 63297, address: '2465 NE 7th', smsConsentText: 'SMS WORDING' })
    expect(html).toContain('name="slug" value="cma-2465"')
    expect(html).toContain('name="pid" value="63297"')
    expect(html).toContain('name="emailOptIn"')
    expect(html).toContain('name="smsOptIn"')
    expect(html).toContain('SMS WORDING')
    expect(html).toContain('Not now')
    expect(html).toContain('action="/api/cma/register"')
  })
})
