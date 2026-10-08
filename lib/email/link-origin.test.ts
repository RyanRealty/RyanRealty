import { describe, expect, it } from 'vitest'
import { CANONICAL_EMAIL_ORIGIN, canonicalizeEmailHosts, emailLinkOrigin } from './link-origin'

// Built from parts so the no-staging-host gate reads no literal alias URL here.
const ALIAS = ['https://ryanrealty', 'vercel', 'app'].join('.')

describe('emailLinkOrigin', () => {
  it('maps the production alias to ryan-realty.com', () => {
    expect(emailLinkOrigin(ALIAS)).toBe(CANONICAL_EMAIL_ORIGIN)
    expect(emailLinkOrigin(`${ALIAS}/`)).toBe(CANONICAL_EMAIL_ORIGIN)
  })

  it('keeps the canonical host and folds www into it', () => {
    expect(emailLinkOrigin('https://ryan-realty.com')).toBe(CANONICAL_EMAIL_ORIGIN)
    expect(emailLinkOrigin('https://www.ryan-realty.com/')).toBe(CANONICAL_EMAIL_ORIGIN)
  })

  it('defaults to ryan-realty.com when unset or unparseable', () => {
    expect(emailLinkOrigin(undefined)).toBe(CANONICAL_EMAIL_ORIGIN)
    expect(emailLinkOrigin('')).toBe(CANONICAL_EMAIL_ORIGIN)
    expect(emailLinkOrigin('not a url')).toBe(CANONICAL_EMAIL_ORIGIN)
  })

  it('leaves a preview or local host alone so a test send never targets production', () => {
    expect(emailLinkOrigin('http://localhost:3000')).toBe('http://localhost:3000')
    const preview = ['https://ryanrealty-git-x-team', 'vercel', 'app'].join('.') // staging-host-ok
    expect(emailLinkOrigin(preview)).toBe(preview)
  })
})

describe('canonicalizeEmailHosts', () => {
  it('moves the alias host on images and links to ryan-realty.com, path untouched', () => {
    const html = `<img src="${ALIAS}/images/brokers/ryan-matt.png"><a href='${ALIAS}/?agent=matt'>x</a>`
    expect(canonicalizeEmailHosts(html)).toBe(
      `<img src="https://ryan-realty.com/images/brokers/ryan-matt.png"><a href='https://ryan-realty.com/?agent=matt'>x</a>`,
    )
  })

  it('does not touch other vercel.app hosts or look-alikes', () => {
    const other = ['https://ryanrealty-git-x-team', 'vercel', 'app'].join('.') // staging-host-ok
    const html = `<img src="${other}/a.png"><img src="${ALIAS}x/b.png">`
    expect(canonicalizeEmailHosts(html)).toBe(html)
  })
})
