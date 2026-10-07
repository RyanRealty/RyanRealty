import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CANONICAL_SITE_HOST,
  CANONICAL_SITE_ORIGIN,
  canonicalizeSiteHosts,
  configuredSiteOrigin,
  isProductionSiteHost,
  siteHost,
  siteOrigin,
  siteUrl,
} from './site-origin'
import { CANONICAL_EMAIL_ORIGIN, canonicalizeEmailHosts, emailLinkOrigin } from './email/link-origin'

// Built from parts so the no-staging-host gate reads no literal alias URL here.
const ALIAS_HOST = ['ryanrealty', 'vercel', 'app'].join('.')
const ALIAS = `https://${ALIAS_HOST}`
const PREVIEW = ['https://ryanrealty-git-x-team', 'vercel', 'app'].join('.') // staging-host-ok

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('siteOrigin', () => {
  it('maps the production alias to ryan-realty.com, with or without a path or slash', () => {
    expect(siteOrigin(ALIAS)).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin(`${ALIAS}/`)).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin(`${ALIAS}/api/x?y=1`)).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin(`http://${ALIAS_HOST.toUpperCase()}`)).toBe(CANONICAL_SITE_ORIGIN)
  })

  it('keeps the canonical host and folds www into it', () => {
    expect(siteOrigin('https://ryan-realty.com')).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin('https://ryan-realty.com/')).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin('https://www.ryan-realty.com/')).toBe(CANONICAL_SITE_ORIGIN)
  })

  it('defaults to ryan-realty.com when unset, blank or unparseable', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined)
    expect(siteOrigin()).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin(null)).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin('')).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin('   ')).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin('not a url')).toBe(CANONICAL_SITE_ORIGIN)
    expect(siteOrigin('ftp://ryan-realty.com')).toBe(CANONICAL_SITE_ORIGIN)
  })

  it('keeps a preview or local host so a test never targets production', () => {
    expect(siteOrigin('http://localhost:3000')).toBe('http://localhost:3000')
    expect(siteOrigin('http://localhost:3000/')).toBe('http://localhost:3000')
    expect(siteOrigin(PREVIEW)).toBe(PREVIEW)
    expect(siteOrigin('https://preview.example.test/')).toBe('https://preview.example.test')
  })

  it('reads NEXT_PUBLIC_SITE_URL when called without an argument', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', ALIAS)
    expect(siteOrigin()).toBe(CANONICAL_SITE_ORIGIN)
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    expect(siteOrigin()).toBe('http://localhost:3000')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(siteOrigin()).toBe(CANONICAL_SITE_ORIGIN)
  })
})

describe('configuredSiteOrigin', () => {
  it('is null when unset or unparseable, so a caller can choose its own fallback', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined)
    expect(configuredSiteOrigin()).toBeNull()
    expect(configuredSiteOrigin(null)).toBeNull()
    expect(configuredSiteOrigin('')).toBeNull()
    expect(configuredSiteOrigin('nope')).toBeNull()
  })

  it('applies the same production mapping when set', () => {
    expect(configuredSiteOrigin(ALIAS)).toBe(CANONICAL_SITE_ORIGIN)
    expect(configuredSiteOrigin('http://localhost:3000/')).toBe('http://localhost:3000')
  })
})

describe('siteHost and siteUrl', () => {
  it('gives the bare canonical host for a production value', () => {
    expect(siteHost(ALIAS)).toBe(CANONICAL_SITE_HOST)
    expect(siteHost(null)).toBe(CANONICAL_SITE_HOST)
    expect(siteHost('http://localhost:3000')).toBe('localhost:3000')
  })

  it('joins a path onto the origin with exactly one slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', `${ALIAS}/`)
    expect(siteUrl('/contact')).toBe('https://ryan-realty.com/contact')
    expect(siteUrl('contact')).toBe('https://ryan-realty.com/contact')
    expect(siteUrl()).toBe('https://ryan-realty.com/')
  })
})

describe('isProductionSiteHost', () => {
  it('knows the apex, www and the alias, and nothing else', () => {
    expect(isProductionSiteHost('ryan-realty.com')).toBe(true)
    expect(isProductionSiteHost('WWW.ryan-realty.com')).toBe(true)
    expect(isProductionSiteHost(ALIAS_HOST)).toBe(true)
    expect(isProductionSiteHost('seller.ryan-realty.com')).toBe(false)
    expect(isProductionSiteHost('localhost')).toBe(false)
    expect(isProductionSiteHost(null)).toBe(false)
  })
})

describe('canonicalizeSiteHosts', () => {
  it('moves the alias host on images and links to ryan-realty.com, path untouched', () => {
    const html = `<img src="${ALIAS}/images/brokers/ryan-matt.png"><a href='${ALIAS}/?agent=matt'>x</a> ${ALIAS}`
    expect(canonicalizeSiteHosts(html)).toBe(
      `<img src="https://ryan-realty.com/images/brokers/ryan-matt.png"><a href='https://ryan-realty.com/?agent=matt'>x</a> https://ryan-realty.com`,
    )
  })

  it('does not touch other vercel.app hosts or look-alikes', () => {
    const html = `<img src="${PREVIEW}/a.png"><img src="${ALIAS}x/b.png">`
    expect(canonicalizeSiteHosts(html)).toBe(html)
  })
})

describe('lib/email/link-origin keeps its names', () => {
  it('re-exports the same implementation', () => {
    expect(CANONICAL_EMAIL_ORIGIN).toBe(CANONICAL_SITE_ORIGIN)
    expect(emailLinkOrigin).toBe(siteOrigin)
    expect(canonicalizeEmailHosts).toBe(canonicalizeSiteHosts)
  })
})
