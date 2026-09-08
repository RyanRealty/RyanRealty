import { describe, it, expect } from 'vitest'
import {
  trackedDocLink,
  CMA_DOC_ORIGIN,
  cmaCampaignFromUrl,
  type TrackedDocLinkCtx,
} from './doc-links'

const CTX: TrackedDocLinkCtx = {
  brokerSlug: 'matt',
  personId: 13168,
  cmaSlug: 'cma-1975-harriman',
}

/** Every kind returns an absolute URL on the production origin. */
function parsed(url: string): URL {
  expect(url.startsWith(`${CMA_DOC_ORIGIN}/`)).toBe(true)
  return new URL(url)
}

/** The five params the blueprint requires on every document link. */
function expectIdentity(url: string) {
  const u = parsed(url)
  expect(u.searchParams.get('agent')).toBe('matt')
  expect(u.searchParams.get('_pid')).toBe('13168')
  expect(u.searchParams.get('utm_source')).toBe('cma')
  expect(u.searchParams.get('utm_medium')).toBe('document')
  expect(u.searchParams.get('utm_campaign')).toBe('cma-1975-harriman')
  return u
}

describe('trackedDocLink — identity + campaign on every kind', () => {
  it('stamps agent, _pid and the three utm params on all six kinds', () => {
    const urls = [
      trackedDocLink('listing', { listingKey: '20260714190234066850000000', mlsNumber: '220225388', address: '1299 Ogden', city: 'Bend', subdivision: 'Newport Gardens' }, CTX),
      trackedDocLink('place', 'Newport Gardens', CTX),
      trackedDocLink('market', 'Bend', CTX),
      trackedDocLink('search', { city: 'Bend', subdivision: 'Newport Gardens' }, CTX),
      trackedDocLink('book', null, CTX),
      trackedDocLink('site', '/how-we-get-our-numbers', CTX),
    ]
    for (const u of urls) expectIdentity(u)
  })
})

describe('trackedDocLink — listing', () => {
  it('builds the canonical /homes-for-sale hierarchy through listingTileHref', () => {
    const u = parsed(
      trackedDocLink(
        'listing',
        {
          listingKey: '20260714190234066850000000',
          mlsNumber: '220225388',
          address: '1299 Ogden',
          city: 'Bend',
          subdivision: 'Newport Gardens',
        },
        CTX,
      ),
    )
    expect(u.pathname).toBe('/homes-for-sale/bend/newport-gardens/1299-ogden-220225388')
  })

  it('accepts a bare listing key string and degrades to the by-key form', () => {
    const u = parsed(trackedDocLink('listing', '20260714190234066850000000', CTX))
    expect(u.pathname).toBe('/homes-for-sale/listing/20260714190234066850000000')
  })

  it('uses the MLS number when a comp carries no listing key', () => {
    const u = parsed(
      trackedDocLink('listing', { mlsNumber: '220225388', address: '1299 Ogden', city: 'Bend' }, CTX),
    )
    expect(u.pathname).toBe('/homes-for-sale/bend/1299-ogden-220225388')
  })

  it('splits a combined address into number and street for the slug', () => {
    const u = parsed(
      trackedDocLink('listing', { mlsNumber: '220226058', address: '20396 Mission Ridge', city: 'Bend' }, CTX),
    )
    expect(u.pathname).toBe('/homes-for-sale/bend/20396-mission-ridge-220226058')
  })

  it('drops the N/A subdivision sentinel rather than publishing it as a segment', () => {
    const u = parsed(
      trackedDocLink('listing', { mlsNumber: '220225388', address: '1299 Ogden', city: 'Bend', subdivision: 'N/A' }, CTX),
    )
    expect(u.pathname).toBe('/homes-for-sale/bend/1299-ogden-220225388')
  })

  it('NULL-SAFE: no listing key and no MLS falls back to a place-scoped search, never a broken link', () => {
    const u = parsed(
      trackedDocLink('listing', { address: '1299 Ogden', city: 'Bend', subdivision: 'Newport Gardens' }, CTX),
    )
    expect(u.pathname).toBe('/homes-for-sale/bend/newport-gardens')
    expect(u.pathname).not.toContain('undefined')
    expect(u.pathname).not.toContain('null')
  })

  it('NULL-SAFE: nothing at all still returns the regional search', () => {
    const u = parsed(trackedDocLink('listing', null, CTX))
    expect(u.pathname).toBe('/homes-for-sale')
    expect(u.searchParams.get('view')).toBe('list')
  })
})

describe('trackedDocLink — place', () => {
  it('resolves a subdivision name to its public page', () => {
    const u = parsed(trackedDocLink('place', 'Newport Gardens', CTX))
    expect(u.pathname).toBe('/subdivisions/newport-gardens')
  })

  it('prefers the registry community when the subdivision is a known alias', () => {
    const u = parsed(trackedDocLink('place', 'Sunriver', CTX))
    expect(u.pathname.startsWith('/communities/')).toBe(true)
  })

  it('overrides the place helper own legacy cma-letter utm with the document campaign', () => {
    const url = trackedDocLink('place', 'Newport Gardens', CTX)
    expect(url).not.toContain('utm_campaign=cma-letter')
    expect(url).not.toContain('utm_source=crm')
    expect(new URL(url).searchParams.getAll('utm_source')).toEqual(['cma'])
  })

  it('falls back through subdivision → community → city for an object target', () => {
    const u = parsed(trackedDocLink('place', { city: 'Bend', subdivisionName: 'Newport Gardens' }, CTX))
    expect(u.pathname).toBe('/subdivisions/newport-gardens')
  })

  it('NULL-SAFE: an unknown place falls back to the city page, then the search', () => {
    const withCity = parsed(trackedDocLink('place', { city: 'Bend' }, CTX))
    expect(withCity.pathname).toBe('/cities/bend')
    const nothing = parsed(trackedDocLink('place', null, CTX))
    expect(nothing.pathname).toBe('/homes-for-sale')
  })
})

describe('trackedDocLink — market', () => {
  it('sends a Central Oregon city to its housing-market report', () => {
    expect(parsed(trackedDocLink('market', 'Redmond', CTX)).pathname).toBe('/housing-market/redmond')
  })

  it('NULL-SAFE: a city we do not publish falls back to the market hub', () => {
    expect(parsed(trackedDocLink('market', 'Portland', CTX)).pathname).toBe('/housing-market')
    expect(parsed(trackedDocLink('market', null, CTX)).pathname).toBe('/housing-market')
  })
})

describe('trackedDocLink — search, book, site', () => {
  it('scopes a search to the city and subdivision when both are known', () => {
    expect(parsed(trackedDocLink('search', { city: 'Bend', subdivision: 'Newport Gardens' }, CTX)).pathname)
      .toBe('/homes-for-sale/bend/newport-gardens')
  })

  it('takes a bare city string', () => {
    expect(parsed(trackedDocLink('search', 'Redmond', CTX)).pathname).toBe('/homes-for-sale/redmond')
  })

  it('keeps the regional view param the search helper sets', () => {
    const u = parsed(trackedDocLink('search', null, CTX))
    expect(u.pathname).toBe('/homes-for-sale')
    expect(u.searchParams.get('view')).toBe('list')
    expect(u.searchParams.get('utm_campaign')).toBe('cma-1975-harriman')
  })

  it('book goes to /book', () => {
    expect(parsed(trackedDocLink('book', null, CTX)).pathname).toBe('/book')
  })

  it('site takes a path and never doubles the origin', () => {
    expect(parsed(trackedDocLink('site', '/how-we-get-our-numbers', CTX)).pathname)
      .toBe('/how-we-get-our-numbers')
    expect(parsed(trackedDocLink('site', 'https://ryan-realty.com/about', CTX)).pathname).toBe('/about')
    expect(parsed(trackedDocLink('site', null, CTX)).pathname).toBe('/')
  })

  it('never links off ryan-realty.com, even when handed an outside URL', () => {
    expect(parsed(trackedDocLink('site', 'https://example.com/steal', CTX)).pathname).toBe('/')
  })
})

describe('trackedDocLink — partial context', () => {
  it('omits agent when there is no broker slug', () => {
    const u = parsed(trackedDocLink('book', null, { cmaSlug: 'cma-x', personId: 13168 }))
    expect(u.searchParams.has('agent')).toBe(false)
    expect(u.searchParams.get('_pid')).toBe('13168')
  })

  it('omits _pid for a missing or non-positive person id', () => {
    for (const personId of [null, undefined, 0, -3, 1.5, NaN]) {
      const u = parsed(trackedDocLink('book', null, { cmaSlug: 'cma-x', brokerSlug: 'matt', personId }))
      expect(u.searchParams.has('_pid')).toBe(false)
    }
  })

  it('omits utm_campaign when the document has no slug, and keeps source + medium', () => {
    const u = parsed(trackedDocLink('book', null, { cmaSlug: '  ', brokerSlug: 'matt' }))
    expect(u.searchParams.has('utm_campaign')).toBe(false)
    expect(u.searchParams.get('utm_source')).toBe('cma')
    expect(u.searchParams.get('utm_medium')).toBe('document')
  })

  it('is idempotent: a second pass does not double-stamp', () => {
    const once = trackedDocLink('market', 'Bend', CTX)
    const twice = trackedDocLink('site', once, CTX)
    expect(twice).toBe(once)
  })
})

describe('cmaCampaignFromUrl', () => {
  it('reads the document slug back out of a tracked arrival URL', () => {
    const url = trackedDocLink('listing', '20260714190234066850000000', CTX)
    expect(cmaCampaignFromUrl(url)).toBe('cma-1975-harriman')
  })

  it('only accepts a cma- campaign from the document medium', () => {
    expect(cmaCampaignFromUrl('https://ryan-realty.com/x?utm_campaign=spring-sale')).toBeNull()
    expect(cmaCampaignFromUrl('https://ryan-realty.com/x')).toBeNull()
    expect(cmaCampaignFromUrl(null)).toBeNull()
    expect(cmaCampaignFromUrl('not a url')).toBeNull()
  })

  it('lower-cases and trims what it reads', () => {
    expect(cmaCampaignFromUrl('https://ryan-realty.com/x?utm_campaign=CMA-1975-Harriman')).toBe(
      'cma-1975-harriman',
    )
  })
})
