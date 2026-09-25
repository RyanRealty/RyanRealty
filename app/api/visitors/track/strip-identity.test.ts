import { describe, it, expect } from 'vitest'
import { stripClickDestination, stripIdentityParams, visitorEventMetadata } from './strip-identity'
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
    expect(cmaCampaignFromUrl(stored)).toBe('cma-1975-harriman')
  })
})
