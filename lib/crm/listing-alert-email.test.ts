import { describe, it, expect } from 'vitest'
import {
  buildListingAlertEmail,
  buildListingAlertSubject,
  formatListingPrice,
  formatListingMeta,
  type ListingAlertListing,
} from './listing-alert-email'

const BANNED_VOCAB = require('../../scripts/brand-voice-vocabulary.cjs') as {
  BANNED_WORD_STRINGS: string[]
}

function listing(overrides: Partial<ListingAlertListing> = {}): ListingAlertListing {
  return {
    address: '61542 Hosmer Lake Dr',
    city: 'Bend',
    price: 749900,
    beds: 3,
    baths: 2.5,
    sqft: 1850,
    photoUrl: 'https://cdn.example.com/photo-1.jpg',
    detailUrl: 'https://ryan-realty.com/homes-for-sale/bend/61542-hosmer-lake-dr-220189422',
    status: 'Active',
    ...overrides,
  }
}

const UNSUB = 'https://ryan-realty.com/alerts/unsubscribe?token=tok123'
const BROWSE = 'https://ryan-realty.com/homes-for-sale/bend?maxPrice=800000'

describe('formatListingPrice (exact list price, §0)', () => {
  it('renders the exact price with $ and commas', () => {
    expect(formatListingPrice(749900)).toBe('$749,900')
    expect(formatListingPrice(1250000)).toBe('$1,250,000')
  })
  it('renders "Price on request" when unavailable', () => {
    expect(formatListingPrice(null)).toBe('Price on request')
    expect(formatListingPrice(Number.NaN)).toBe('Price on request')
  })
})

describe('formatListingMeta (every number carries units)', () => {
  it('joins beds, baths, and sqft with middots', () => {
    expect(formatListingMeta(listing())).toBe('3 beds · 2.5 baths · 1,850 sqft')
  })
  it('singularizes one bed / one bath', () => {
    expect(formatListingMeta(listing({ beds: 1, baths: 1, sqft: null }))).toBe('1 bed · 1 bath')
  })
  it('omits missing fields', () => {
    expect(formatListingMeta(listing({ beds: null, baths: null, sqft: null }))).toBe('')
  })
})

describe('buildListingAlertSubject', () => {
  it('is specific and no-hype', () => {
    expect(buildListingAlertSubject(6, 'Bend under 800k')).toBe('6 new listings for Bend under 800k')
    expect(buildListingAlertSubject(1, 'Tumalo acreage')).toBe('1 new listing for Tumalo acreage')
  })
})

describe('buildListingAlertEmail', () => {
  const input = () => ({
    searchName: 'Bend under 800k',
    filtersSummary: '3+ beds, max $800,000, Bend',
    listings: [listing(), listing({ address: '2054 NW Glassow Dr', price: 675000, status: null, photoUrl: null })],
    totalNewCount: 6,
    browseAllUrl: BROWSE,
    unsubscribeUrl: UNSUB,
    manageUrl: 'https://ryan-realty.com/account/saved-searches',
  })

  it('renders subject, cards, +N more link, and CTA', () => {
    const out = buildListingAlertEmail(input())
    expect(out.subject).toBe('6 new listings for Bend under 800k')
    expect(out.html).toContain('61542 Hosmer Lake Dr, Bend')
    expect(out.html).toContain('$749,900')
    expect(out.html).toContain('3 beds · 2.5 baths · 1,850 sqft')
    expect(out.html).toContain('2054 NW Glassow Dr, Bend')
    expect(out.html).toContain('+4 more new listings on the site')
    expect(out.html).toContain('SEE ALL MATCHING HOMES')
    expect(out.html).toContain(BROWSE)
  })

  it('wraps the body in the one branded frame with the NEW LISTINGS masthead', () => {
    const out = buildListingAlertEmail(input())
    expect(out.html).toContain('NEW LISTINGS · BEND UNDER 800K')
    expect(out.html).toContain('#102742')
    expect(out.html).toContain('max-width:640px')
    expect(out.html).toContain('name="color-scheme"')
    expect(out.html).toContain('>Ryan Realty</td>')
    // No brand hero — the listing photos carry the visual.
    expect(out.html).not.toContain('hero-oldmill')
  })

  it('carries the audience line, manage link, and unsubscribe URL', () => {
    const out = buildListingAlertEmail(input())
    expect(out.html).toContain('you asked for listing alerts at ryan-realty.com')
    expect(out.html).toContain('https://ryan-realty.com/account/saved-searches')
    expect(out.html).toContain('Manage preferences')
    expect(out.html).toContain(UNSUB)
    expect(out.html).toContain('Unsubscribe')
    expect(out.text).toContain(`Stop these alerts: ${UNSUB}`)
  })

  it('renders the broker close card when the subscription has an assigned broker', () => {
    const out = buildListingAlertEmail({
      ...input(),
      senderBroker: {
        name: 'Rebecca Peterson',
        firstName: 'Rebecca',
        title: 'Broker',
        phone: '541.250.3380',
        email: 'rebeccapeterson@ryan-realty.com',
        headshotUrl: 'https://ryan-realty.com/images/brokers/peterson-rebecca.png',
        isOwner: false,
      },
    })
    expect(out.html).toContain('TALK TO REBECCA')
    expect(out.html).toContain('Rebecca Peterson')
  })

  it('omits the broker close card and +N more when not applicable', () => {
    const out = buildListingAlertEmail({ ...input(), totalNewCount: 2, senderBroker: null })
    expect(out.html).not.toContain('TALK TO')
    expect(out.html).not.toContain('more new listing')
  })

  it('escapes HTML in listing data', () => {
    const out = buildListingAlertEmail({
      ...input(),
      listings: [listing({ address: '1 <script>alert("x")</script> Ln' })],
    })
    expect(out.html).not.toContain('<script>alert')
  })

  // --- Brand-voice cleanliness (CLAUDE.md §3) ---

  it('contains no em-dash, en-dash, semicolon, or exclamation in subject and text', () => {
    const out = buildListingAlertEmail(input())
    expect(out.subject).not.toMatch(/[–—;!]/)
    expect(out.text).not.toMatch(/[–—]/)
    expect(out.text).not.toContain(';')
    expect(out.text).not.toContain('!')
  })

  it('contains no banned vocabulary', () => {
    const out = buildListingAlertEmail(input())
    const haystack = `${out.subject}\n${out.text}`.toLowerCase()
    const hits = BANNED_VOCAB.BANNED_WORD_STRINGS.filter((w) => {
      if (/\s/.test(w)) return haystack.includes(w)
      return new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack)
    })
    expect(hits).toEqual([])
  })
})
