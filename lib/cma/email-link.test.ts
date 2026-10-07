import { describe, expect, it } from 'vitest'
import {
  CMA_LINK_WINDOW_MS,
  cmaLinkIdempotencyKey,
  composeCmaLinkEmail,
  isKnownCmaEmail,
  normalizeLinkEmail,
} from './email-link'

describe('normalizeLinkEmail', () => {
  it('trims and lowercases a real address', () => {
    expect(normalizeLinkEmail('  Owner@MSN.com ')).toBe('owner@msn.com')
  })

  it('refuses blanks, junk, and markup', () => {
    expect(normalizeLinkEmail('')).toBeNull()
    expect(normalizeLinkEmail('owner')).toBeNull()
    expect(normalizeLinkEmail('a@b')).toBeNull()
    expect(normalizeLinkEmail('<x@y.com>')).toBeNull()
    expect(normalizeLinkEmail(`${'a'.repeat(250)}@b.com`)).toBeNull()
  })
})

describe('isKnownCmaEmail', () => {
  const identity = { clientEmail: 'owner@msn.com', personEmails: ['spouse@gmail.com'], claimedBy: null }

  it('matches the client email and any email on the person, any case', () => {
    expect(isKnownCmaEmail('OWNER@msn.com', identity)).toBe(true)
    expect(isKnownCmaEmail('spouse@gmail.com', identity)).toBe(true)
  })

  it('matches the phone-only claim', () => {
    expect(isKnownCmaEmail('claimer@x.com', { clientEmail: null, personEmails: [], claimedBy: 'claimer@x.com' })).toBe(true)
  })

  it('refuses anyone else, and never matches an empty file', () => {
    expect(isKnownCmaEmail('stranger@x.com', identity)).toBe(false)
    expect(isKnownCmaEmail('', { clientEmail: null, personEmails: [], claimedBy: null })).toBe(false)
  })
})

describe('cmaLinkIdempotencyKey', () => {
  const t0 = 1_791_347_185_000
  const start = Math.floor(t0 / CMA_LINK_WINDOW_MS) * CMA_LINK_WINDOW_MS

  it('holds one key across a window and moves to a new one after it', () => {
    const k = (t: number) => cmaLinkIdempotencyKey('cma-x', 'owner@msn.com', t)
    expect(k(start)).toBe(k(start + CMA_LINK_WINDOW_MS - 1))
    expect(k(start)).not.toBe(k(start + CMA_LINK_WINDOW_MS))
  })

  it('keys each address and each home on its own, case-blind', () => {
    expect(cmaLinkIdempotencyKey('cma-x', 'owner@msn.com', start)).not.toBe(
      cmaLinkIdempotencyKey('cma-x', 'spouse@gmail.com', start),
    )
    expect(cmaLinkIdempotencyKey('cma-x', 'owner@msn.com', start)).not.toBe(
      cmaLinkIdempotencyKey('cma-y', 'owner@msn.com', start),
    )
    expect(cmaLinkIdempotencyKey('cma-x', 'Owner@MSN.com', start)).toBe(
      cmaLinkIdempotencyKey('cma-x', 'owner@msn.com', start),
    )
  })
})

describe('composeCmaLinkEmail', () => {
  const mail = composeCmaLinkEmail({ slug: 'cma-2566-keats', address: '2566 Keats, Bend, OR 97701' })

  it('names the street, not the whole address, in the subject', () => {
    expect(mail.subject).toBe('Your private link to the 2566 Keats report')
  })

  it('links the report on ryan-realty.com behind short words, never a raw URL', () => {
    expect(mail.reportUrl.startsWith('https://ryan-realty.com/cma/cma-2566-keats?')).toBe(true)
    expect(mail.html).toContain(`<a href="${mail.reportUrl}"`)
    expect(mail.html).toContain('>Open your report</a>')
    const visible = mail.html.replace(/<[^>]+>/g, ' ')
    expect(visible).not.toMatch(/https?:\/\//)
  })

  it('carries no person token of its own: the governed send signs it', () => {
    expect(mail.reportUrl).not.toContain('_pid=')
  })

  it('has no em dash', () => {
    expect(mail.html).not.toMatch(/—|&mdash;|&#8212;/)
    expect(mail.subject).not.toMatch(/—/)
  })
})
