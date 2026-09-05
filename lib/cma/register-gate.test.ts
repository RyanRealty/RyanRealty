import { describe, expect, it } from 'vitest'
import { checkBrandVoice } from '@/lib/voice/check'
import { blamesPriorAgent, isWorthQuestionCopy } from '@/lib/crm/first-touch-copy'
import { decideCmaAccess, renderConsentShell, renderRegisterShell } from './register-gate'

describe('CMA register shell — inbound packet', () => {
  it('names THIS home and the price opinion, never a worth-question', () => {
    const html = renderRegisterShell({
      slug: 'cma-1842-nw-foo',
      address: '1842 NW Foo St',
      clientName: 'Pat',
    })
    expect(html).toContain('Your report on 1842 NW Foo St')
    expect(html).toContain('The recommended list for 1842 NW Foo St')
    expect(html).toContain('Who you are competing with at that price')
    expect(html).toContain('The sales that set the number')
    expect(html).not.toMatch(/how we would market|listing video|flyers/i)
    expect(html).not.toMatch(/what your home is worth/i)
    expect(html).not.toMatch(/What every listing gets/i)
    expect(isWorthQuestionCopy(html)).toBe(false)
    expect(blamesPriorAgent(html)).toBe(false)
    const visible = [
      'Your report on 1842 NW Foo St is ready',
      'The recommended list for 1842 NW Foo St',
      'Who you are competing with at that price',
      'The sales that set the number',
    ]
    for (const line of visible) {
      const voice = checkBrandVoice(line)
      expect(voice.ok, `${line} -> ${JSON.stringify(voice.violations)}`).toBe(true)
    }
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
