import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crmLink, resolveAlertFrom } from './expired-alert'

/**
 * Locks the two bugs found in the 2026-07-03 expired-workflow audit:
 *
 *  1. The alert linked to a dead FUB deep-link (app.followupboss.com/people/<id>)
 *     after the FUB cutover. It must link to the in-house CRM lead instead.
 *  2. The alert hard-coded an UNVERIFIED sender (alerts@mail.ryan-realty.com),
 *     so Resend rejected 100% of expired alerts (alert_sent_at was NULL on every
 *     row). It must resolve from RESEND_FROM (the verified sender), and must NOT
 *     double-wrap a RESEND_FROM value that already carries a display name.
 */

describe('expired-alert crmLink', () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = prev
  })

  it('links to the in-house CRM lead, never to Follow Up Boss', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ryan-realty.com'
    const link = crmLink(12345)
    expect(link).toBe('https://ryan-realty.com/admin/crm/12345')
    expect(link).not.toContain('followupboss')
  })

  it('trims a trailing slash on the site url', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ryan-realty.com/'
    expect(crmLink(7)).toBe('https://ryan-realty.com/admin/crm/7')
  })

  it('returns a clear pending message when no person was created (contact pending)', () => {
    const link = crmLink(null)
    expect(link).toContain('no CRM lead yet')
    expect(link).not.toContain('/admin/crm/')
  })
})

describe('expired-alert resolveAlertFrom', () => {
  const prev = process.env.RESEND_FROM
  beforeEach(() => {
    delete process.env.RESEND_FROM
  })
  afterEach(() => {
    if (prev === undefined) delete process.env.RESEND_FROM
    else process.env.RESEND_FROM = prev
  })

  it('falls back to a verified mail.ryan-realty.com sender when RESEND_FROM is unset', () => {
    const from = resolveAlertFrom()
    expect(from).toBe('Ryan Realty Brain <noreply@mail.ryan-realty.com>')
    // the historic bug: never the unverified alerts@ sender
    expect(from).not.toContain('alerts@')
  })

  it('wraps a bare RESEND_FROM address with a display name', () => {
    process.env.RESEND_FROM = 'noreply@mail.ryan-realty.com'
    expect(resolveAlertFrom()).toBe('Ryan Realty Brain <noreply@mail.ryan-realty.com>')
  })

  it('uses a RESEND_FROM that already carries a display name verbatim (no nested wrap)', () => {
    process.env.RESEND_FROM = 'Ryan Realty <noreply@mail.ryan-realty.com>'
    const from = resolveAlertFrom()
    expect(from).toBe('Ryan Realty <noreply@mail.ryan-realty.com>')
    // never produce the malformed nested header `Name <Name <addr>>`
    expect(from.match(/</g)?.length).toBe(1)
  })
})
