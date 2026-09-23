import { describe, expect, it } from 'vitest'
import { arrivalTokenFrom, planArrivalIdentity } from './arrival'
import { signPersonLinkToken, verifyPersonLinkToken } from './link-token'
import { consentCookieDeclines, gpcHeaderOptsOut, identificationAllowed } from './consent'

const tok = (id: number, ch: Parameters<typeof signPersonLinkToken>[1] = 'email') =>
  verifyPersonLinkToken(signPersonLinkToken(id, ch))

describe('planArrivalIdentity — precedence (P7 identity loop)', () => {
  it('a signed token identifies an unowned session with its channel', () => {
    expect(planArrivalIdentity({ token: tok(10, 'sms'), session: { crmPersonId: null } })).toEqual({
      kind: 'identify',
      personId: 10,
      via: 'tracked_link:sms',
    })
  })

  it('a token for the session owner is a no-op', () => {
    expect(planArrivalIdentity({ token: tok(10), session: { crmPersonId: 10 } })).toEqual({ kind: 'already', personId: 10 })
  })

  it('a token for SOMEONE ELSE rotates the session instead of reassigning it', () => {
    expect(planArrivalIdentity({ token: tok(11), session: { crmPersonId: 10 } })).toEqual({ kind: 'rotate', personId: 11 })
  })

  it('a token outranks the identity map and the cookie', () => {
    expect(
      planArrivalIdentity({ token: tok(12), session: null, carryoverPersonId: 99, cookiePersonId: 98 }),
    ).toMatchObject({ kind: 'identify', personId: 12 })
  })

  it('a token for a deleted contact identifies nobody', () => {
    expect(planArrivalIdentity({ token: tok(12), tokenPersonExists: false, session: { crmPersonId: null } })).toEqual({
      kind: 'none',
    })
  })

  it('without a token: identity-map carryover, then the signed cookie', () => {
    expect(planArrivalIdentity({ token: null, session: { crmPersonId: null }, carryoverPersonId: 5, cookiePersonId: 6 })).toEqual({
      kind: 'identify',
      personId: 5,
      via: 'rr_vid_carryover',
    })
    expect(planArrivalIdentity({ token: null, session: { crmPersonId: null }, cookiePersonId: 6 })).toEqual({
      kind: 'identify',
      personId: 6,
      via: 'rr_pid_cookie',
    })
    expect(planArrivalIdentity({ token: null, session: { crmPersonId: null } })).toEqual({ kind: 'none' })
  })

  it('never identifies automation, even with a valid token', () => {
    expect(planArrivalIdentity({ token: tok(10), session: { crmPersonId: null }, automated: true })).toEqual({ kind: 'none' })
  })
})

describe('arrivalTokenFrom', () => {
  it('prefers the explicit identityToken, else reads _pid off the page URL', () => {
    const t = signPersonLinkToken(4, 'alert')
    expect(arrivalTokenFrom({ identityToken: t, pageUrl: 'https://ryan-realty.com/?_pid=1' })).toBe(t)
    expect(arrivalTokenFrom({ pageUrl: `https://ryan-realty.com/homes?agent=matt&_pid=${t}` })).toBe(t)
    expect(arrivalTokenFrom({ pageUrl: 'https://ryan-realty.com/homes?agent=matt' })).toBeNull()
    expect(arrivalTokenFrom({})).toBeNull()
  })
})

describe('consent for identity paths', () => {
  it('no banner answer allows; an explicit decline or unreadable cookie blocks', () => {
    expect(consentCookieDeclines(undefined)).toBe(false)
    expect(consentCookieDeclines(encodeURIComponent(JSON.stringify({ analytics: false, marketing: false })))).toBe(true)
    expect(consentCookieDeclines(encodeURIComponent(JSON.stringify({ analytics: true, marketing: false })))).toBe(false)
    expect(consentCookieDeclines(encodeURIComponent(JSON.stringify({ analytics: false, marketing: true })))).toBe(false)
    expect(consentCookieDeclines('all')).toBe(false)
    expect(consentCookieDeclines('%%%not-json')).toBe(true)
  })

  it('GPC blocks everything', () => {
    expect(gpcHeaderOptsOut('1')).toBe(true)
    expect(gpcHeaderOptsOut(null)).toBe(false)
    expect(identificationAllowed({ secGpc: '1' })).toBe(false)
    expect(identificationAllowed({})).toBe(true)
  })
})
