import { describe, expect, it } from 'vitest'
import { blamesPriorAgent, isWorthQuestionCopy } from '@/lib/crm/first-touch-copy'
import { decideCmaAccess, renderConsentBarHtml, renderConsentShell, renderRegisterShell } from './register-gate'

describe('CMA register shell — inbound packet', () => {
  it('names THIS home and the comparative market analysis, never a worth-question', () => {
    const html = renderRegisterShell({
      slug: 'cma-1842-nw-foo',
      address: '1842 NW Foo St',
      clientName: 'Pat',
    })
    expect(html).toContain('Your report on 1842 NW Foo St')
    expect(html).toContain('The recommended list for 1842 NW Foo St')
    expect(html).toContain('Who you are competing with at that price')
    expect(html).toContain('How we got the price')
    expect(html).not.toMatch(/how we would market|listing video|flyers/i)
    expect(html).not.toMatch(/what your home is worth/i)
    expect(html).not.toMatch(/What every listing gets/i)
    expect(isWorthQuestionCopy(html)).toBe(false)
    expect(blamesPriorAgent(html)).toBe(false)
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
