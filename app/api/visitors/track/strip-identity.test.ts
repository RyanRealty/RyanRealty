import { describe, it, expect } from 'vitest'
import { stripClickDestination, stripGa4UrlParams, stripIdentityParams, visitorEventMetadata, withoutIdentityOnOwnSite } from './strip-identity'
import { CMA_DOC_PARAM } from '@/lib/analytics/utm'
import { trackedDocLink } from '@/lib/cma/doc-links'
import { cmaCampaignFromUrl } from '@/lib/cma/doc-links'

describe('stripIdentityParams', () => {
  it('removes _pid and _fuid from a stored arrival URL', () => {
    expect(stripIdentityParams('https://ryan-realty.com/?agent=matt&_fuid=22288&_pid=13490')).toBe(
      'https://ryan-realty.com/?agent=matt',
    )
  })

  it('keeps every campaign param — they describe the click, not the person', () => {
    const out = stripIdentityParams(
      'https://ryan-realty.com/homes-for-sale/bend/x-220000001?agent=matt&_pid=13168&utm_source=cma&utm_medium=document&utm_campaign=cma-101-main&fbclid=abc&gclid=def',
    )!
    const u = new URL(out)
    expect(u.searchParams.get('utm_source')).toBe('cma')
    expect(u.searchParams.get('utm_medium')).toBe('document')
    expect(u.searchParams.get('utm_campaign')).toBe('cma-101-main')
    expect(u.searchParams.get('agent')).toBe('matt')
    expect(u.searchParams.get('fbclid')).toBe('abc')
    expect(u.searchParams.get('gclid')).toBe('def')
    expect(u.searchParams.has('_pid')).toBe(false)
  })

  it('leaves a URL with no identity params byte-identical', () => {
    const url = 'https://ryan-realty.com/property-search/features/pdf?pid=178667'
    expect(stripIdentityParams(url)).toBe(url)
  })

  it('returns undefined for an absent value so the column stays null', () => {
    expect(stripIdentityParams(null)).toBeUndefined()
    expect(stripIdentityParams(undefined)).toBeUndefined()
    expect(stripIdentityParams('   ')).toBeUndefined()
  })

  it('returns an unparseable string unchanged rather than half-editing it', () => {
    expect(stripIdentityParams('android-app://com.google.android.gm')).toBe(
      'android-app://com.google.android.gm',
    )
  })

  it('stripClickDestination is the same identity strip used on stored arrivals', () => {
    expect(
      stripClickDestination(
        'https://ryan-realty.com/subdivisions/diamond-bar-ranch?_pid=tok&_fuid=9&utm_campaign=cma-x',
      ),
    ).toBe('https://ryan-realty.com/subdivisions/diamond-bar-ranch?utm_campaign=cma-x')
  })

  it('keeps a stripped destination at essential consent and drops other metadata', () => {
    const dest =
      'https://ryan-realty.com/reviews?_pid=tok&utm_source=cma&utm_medium=document&utm_campaign=cma-x'
    expect(
      visitorEventMetadata({ destination: dest, extra: 'drop-me' }, true),
    ).toEqual({
      destination: 'https://ryan-realty.com/reviews?utm_source=cma&utm_medium=document&utm_campaign=cma-x',
    })
    expect(visitorEventMetadata({ extra: 'drop-me' }, true)).toBeUndefined()
  })

  it('keeps sibling metadata when consent is not essential, still stripping identity', () => {
    expect(
      visitorEventMetadata(
        { destination: 'https://ryan-realty.com/about?_pid=tok', extra: 'keep' },
        false,
      ),
    ).toEqual({
      destination: 'https://ryan-realty.com/about',
      extra: 'keep',
    })
  })

  it('a tracked document link survives the strip with its campaign intact', () => {
    const link = trackedDocLink(
      'listing',
      { listingKey: '20260714190234066850000000', mlsNumber: '220225388', address: '1299 Ogden', city: 'Bend' },
      { brokerSlug: 'matt', personId: 13168, cmaSlug: 'cma-1975-harriman' },
    )
    const stored = stripIdentityParams(link)!
    expect(stored).not.toContain('_pid')
    expect(stored).toContain(`${CMA_DOC_PARAM}=cma-1975-harriman`)
    expect(cmaCampaignFromUrl(stored)).toBe('cma-1975-harriman')
  })

  it('strips rr_doc from a URL forwarded to GA4 and keeps it on the stored first-party URL', () => {
    const link =
      'https://ryan-realty.com/homes-for-sale/bend?utm_source=cma&utm_medium=document&utm_campaign=cma-letter&rr_doc=cma-1975-harriman&_pid=tok'
    const stored = stripIdentityParams(link)!
    expect(stored).toContain('rr_doc=cma-1975-harriman')
    expect(stored).not.toContain('_pid')
    const ga4 = stripGa4UrlParams(link)!
    expect(ga4).not.toContain('rr_doc=')
    expect(ga4).not.toContain('_pid')
    expect(ga4).toContain('utm_campaign=cma-letter')
    expect(cmaCampaignFromUrl(stored)).toBe('cma-1975-harriman')
    expect(cmaCampaignFromUrl('https://ryan-realty.com/x?utm_campaign=cma-1975-harriman')).toBe(
      'cma-1975-harriman',
    )
  })
})

describe('withoutIdentityOnOwnSite (where a redirect sends automation)', () => {
  it('takes every person token off one of our links and keeps what describes the click', () => {
    expect(withoutIdentityOnOwnSite('https://ryan-realty.com/cma/cma-1?utm_source=cma&agent=matt&_pid=7.document.sig&_fuid=9')).toBe(
      'https://ryan-realty.com/cma/cma-1?utm_source=cma&agent=matt',
    )
    expect(withoutIdentityOnOwnSite('https://www.ryan-realty.com/?_pid=7.email.sig')).toBe('https://www.ryan-realty.com/')
  })

  it('leaves another site\'s link, a link with nothing to take, and a string that is not a URL exactly as they are', () => {
    expect(withoutIdentityOnOwnSite('https://example.org/listing?_pid=theirs')).toBe('https://example.org/listing?_pid=theirs')
    expect(withoutIdentityOnOwnSite('https://ryan-realty.com/sell?utm_source=crm')).toBe('https://ryan-realty.com/sell?utm_source=crm')
    expect(withoutIdentityOnOwnSite('not a url')).toBe('not a url')
  })
})
