import { describe, it, expect } from 'vitest'
import {
  GA4_PERSON_DOCUMENT_PREFIXES,
  GA4_STRIP_PARAMS,
  PERSON_TEXT_PARAMS,
  ga4SafeEventParams,
  ga4SafePageTitle,
  ga4SafeUrlJs,
  ga4SafeUserProperties,
  isPersonParamName,
  stripClickDestination,
  stripGa4UrlParams,
  stripIdentityParams,
  visitorEventMetadata,
  withoutIdentityOnOwnSite,
} from './strip-identity'
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

/**
 * No personal information reaches GA4 (Matt 2026-10-14). Google's GA4 terms
 * forbid it and a mailing address is personal information. Found live
 * 2026-10-14: `/sell?address=<what a person typed>` went to GA4 as dl= on the
 * page_view and every event after it, a CMA's address slug went as
 * page_location / page_path / page_title on the server mirror, and
 * valuation_requested carried `cma_slug`.
 */
describe('stripGa4UrlParams: what GA4 may receive', () => {
  it('drops a home address or inquiry a person typed, keeps the campaign and the broker', () => {
    expect(
      stripGa4UrlParams('https://ryan-realty.com/sell?from=%2F&address=123%20Test%20Ln%2C%20Bend%20OR&utm_source=gbp&agent=matt#get-value'),
    ).toBe('https://ryan-realty.com/sell?from=%2F&utm_source=gbp&agent=matt')
    expect(stripGa4UrlParams('https://ryan-realty.com/sell/valuation?address=61234%20SE%20River%20Rd&from=%2Fzip%2F97702')).toBe(
      'https://ryan-realty.com/sell/valuation?from=%2Fzip%2F97702',
    )
    expect(stripGa4UrlParams('https://ryan-realty.com/contact?inquiry=We%20want%20to%20sell%20our%20place')).toBe(
      'https://ryan-realty.com/contact',
    )
    expect(stripGa4UrlParams('https://ryan-realty.com/contact?Address=1&EMAIL=x&Name=Pat')).toBe('https://ryan-realty.com/contact')
  })

  it('covers every person-text param and the identity params', () => {
    for (const p of ['address', 'inquiry', 'email', 'phone', 'name', 'message', '_pid', '_fuid', 'rr_doc']) {
      expect(GA4_STRIP_PARAMS).toContain(p)
      expect(stripGa4UrlParams(`https://ryan-realty.com/x?${p}=v&keep=1`)).toBe('https://ryan-realty.com/x?keep=1')
    }
    expect(PERSON_TEXT_PARAMS.every((p) => (GA4_STRIP_PARAMS as readonly string[]).includes(p))).toBe(true)
  })

  it('makes a CMA or BPO address slug /<doc>/[document], static copies included, and is idempotent', () => {
    expect(GA4_PERSON_DOCUMENT_PREFIXES).toEqual(expect.arrayContaining(['cma', 'bpo']))
    const cma = stripGa4UrlParams('https://ryan-realty.com/cma/cma-828-florida?utm_source=cma&utm_medium=email&utm_campaign=cma-letter&rr_doc=cma-828-florida')
    expect(cma).toBe('https://ryan-realty.com/cma/[document]?utm_source=cma&utm_medium=email&utm_campaign=cma-letter')
    expect(stripGa4UrlParams(cma)).toBe(cma)
    expect(stripGa4UrlParams('https://ryan-realty.com/bpo/bpo-61234-se-river-bend-or')).toBe('https://ryan-realty.com/bpo/[document]')
    expect(stripGa4UrlParams('https://ryan-realty.com/cmas/cma-21042-robin/cma.html')).toBe('https://ryan-realty.com/cmas/[document]/cma.html')
    expect(stripGa4UrlParams('https://ryan-realty.com/CMA/cma-1--v2')).toBe('https://ryan-realty.com/cma/[document]')
    // a page that only starts the same way is not a document
    expect(stripGa4UrlParams('https://ryan-realty.com/cma-request')).toBe('https://ryan-realty.com/cma-request')
  })

  it('drops any param whose value is an email address or phone number, whatever it is called', () => {
    expect(stripGa4UrlParams('https://ryan-realty.com/x?ref=pat%40example.com&q=bend')).toBe('https://ryan-realty.com/x?q=bend')
    expect(stripGa4UrlParams('https://ryan-realty.com/x?c=(541)%20555-1212')).toBe('https://ryan-realty.com/x')
    expect(stripGa4UrlParams('https://ryan-realty.com/x?c=%2B15415551212')).toBe('https://ryan-realty.com/x')
    // listing keys, MLS numbers, prices and map boxes are not phone numbers
    const kept = 'https://ryan-realty.com/homes-for-sale?listing=20260714190234066850000000&mls=220225388&minPrice=500000&bbox=-121.4,44.0,-121.2,44.1'
    expect(stripGa4UrlParams(kept)).toBe(kept)
  })

  it('drops a param that links into a person document or carries a person param (a sign-in next=)', () => {
    expect(stripGa4UrlParams('https://ryan-realty.com/auth-error?reason=x&next=%2Fcma%2Fcma-648-se-douglas')).toBe(
      'https://ryan-realty.com/auth-error?reason=x',
    )
    expect(stripGa4UrlParams('https://ryan-realty.com/login?next=%2Fsell%3Faddress%3D12%2520Elm')).toBe('https://ryan-realty.com/login')
    expect(stripGa4UrlParams('https://ryan-realty.com/login?next=%2Fhomes-for-sale%2Fbend')).toBe(
      'https://ryan-realty.com/login?next=%2Fhomes-for-sale%2Fbend',
    )
  })

  it('turns a legacy utm_campaign=<cma slug> into the program campaign cma-letter', () => {
    expect(stripGa4UrlParams('https://ryan-realty.com/homes-for-sale/bend?utm_campaign=cma-1975-harriman&utm_source=cma')).toBe(
      'https://ryan-realty.com/homes-for-sale/bend?utm_source=cma&utm_campaign=cma-letter',
    )
    expect(stripGa4UrlParams('https://ryan-realty.com/x?utm_campaign=test-cma-1975-harriman')).toBe(
      'https://ryan-realty.com/x?utm_campaign=test-cma-letter',
    )
    const program = 'https://ryan-realty.com/x?utm_campaign=cma-letter'
    expect(stripGa4UrlParams(program)).toBe(program)
  })

  it('drops the fragment, leaves a clean URL byte for byte, and sends nothing for a non-URL', () => {
    expect(stripGa4UrlParams('https://ryan-realty.com/sell#get-value')).toBe('https://ryan-realty.com/sell')
    const clean = 'https://ryan-realty.com/search?q=NW%20Crossing&beds=3'
    expect(stripGa4UrlParams(clean)).toBe(clean)
    expect(stripGa4UrlParams('https://www.google.com/')).toBe('https://www.google.com/')
    expect(stripGa4UrlParams('not a url')).toBeUndefined()
    expect(stripGa4UrlParams('')).toBeUndefined()
    expect(stripGa4UrlParams(null)).toBeUndefined()
  })
})

describe('ga4SafeUrlJs: the inline bootstrap runs the same function', () => {
  const run = new Function('h', `return ${ga4SafeUrlJs('h')}`) as (h: unknown) => string | undefined
  it.each([
    'https://ryan-realty.com/sell?from=%2F&address=123%20Test%20Ln%2C%20Bend%20OR#get-value',
    'https://ryan-realty.com/contact?inquiry=I%20want%20to%20sell',
    'https://ryan-realty.com/cma/cma-828-florida?utm_campaign=cma-828-florida&rr_doc=cma-828-florida&_pid=1.2.3',
    'https://ryan-realty.com/bpo/bpo-1-main-st-bend-or',
    'https://ryan-realty.com/cmas/cma-21042-robin/cma.html',
    'https://ryan-realty.com/cma/[document]',
    'https://ryan-realty.com/x?ref=pat%40example.com&q=bend',
    'https://ryan-realty.com/x?c=(541)%20555-1212',
    'https://ryan-realty.com/auth-error?next=%2Fcma%2Fcma-648-se-douglas',
    'https://ryan-realty.com/x?utm_campaign=test-cma-1975-harriman&utm_source=cma',
    'https://ryan-realty.com/homes-for-sale?bbox=-121.4,44.0,-121.2,44.1&keywords=3%20bed',
    'https://ryan-realty.com/?agent=matt&_pid=7.document.sig',
    'https://www.google.com/',
    '',
    'not a url',
  ])('%s', (href) => {
    expect(run(href)).toBe(stripGa4UrlParams(href))
  })
  it('evaluates to undefined for an absent referrer', () => {
    expect(run(undefined)).toBeUndefined()
  })
})

describe('Measurement Protocol params: ga4SafeEventParams', () => {
  it('drops person-named params and makes every page field safe', () => {
    const out = ga4SafeEventParams({
      cma_slug: 'cma-828-florida',
      cma_id: '0b7d5c1e-1111-4222-8333-444455556666',
      subject_address: '828 NW Florida Ave',
      email: 'pat@example.com',
      page_location: 'https://ryan-realty.com/cma/cma-828-florida?rr_doc=cma-828-florida',
      page_referrer: 'https://ryan-realty.com/sell?address=828%20NW%20Florida',
      page_path: '/cma/cma-828-florida',
      page_title: 'Pricing report · 828 NW Florida Ave · Bend, OR 97703',
      campaign: 'cma-828-florida',
      lp_campaign: 'cma-828-florida',
      source: 'pat@example.com',
      lp_variant: 'seller-home-value',
      session_id: 1790000000,
    })
    expect(out).toEqual({
      cma_id: '0b7d5c1e-1111-4222-8333-444455556666',
      page_location: 'https://ryan-realty.com/cma/[document]',
      page_referrer: 'https://ryan-realty.com/sell',
      page_path: '/cma/[document]',
      page_title: 'CMA',
      campaign: 'cma-letter',
      lp_campaign: 'cma-letter',
      lp_variant: 'seller-home-value',
      session_id: 1790000000,
    })
    expect(JSON.stringify(out)).not.toMatch(/828|florida|example\.com/i)
  })

  it('labels a BPO title and keeps an ordinary page title', () => {
    expect(ga4SafePageTitle('https://ryan-realty.com/bpo/bpo-1-main', 'Broker Price Opinion · 1 Main St')).toBe('Broker price opinion')
    expect(ga4SafePageTitle('https://ryan-realty.com/sell', 'Sell Your Home in Central Oregon | Ryan Realty')).toBe(
      'Sell Your Home in Central Oregon | Ryan Realty',
    )
  })

  it('names that would carry a person or a person document are refused; the site\'s own params are not', () => {
    for (const n of ['cma_slug', 'bpo_slug', 'address', 'subject_address', 'street', 'email', 'client_email', 'phone', 'name', 'first_name', 'last_name', 'full_name', 'client_name', 'message', 'inquiry', 'notes']) {
      expect(isPersonParamName(n), n).toBe(true)
    }
    for (const n of ['cma_id', 'bpo_id', 'broker_slug', 'city_slug', 'community_slug', 'place', 'search_term', 'context', 'inquiry_type', 'form_name', 'page_location', 'lead_status', 'crm_person_id', 'subject_city']) {
      expect(isPersonParamName(n), n).toBe(false)
    }
  })

  it('user properties lose a person-named key and a contact value', () => {
    expect(ga4SafeUserProperties({ assigned_broker: 'matt', email: 'x', intent: 'pat@example.com', lead_status: 'cma-draft' })).toEqual({
      assigned_broker: 'matt',
      lead_status: 'cma-draft',
    })
  })
})
