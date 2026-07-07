import { createRequire } from 'node:module'
import { describe, it, expect } from 'vitest'
import {
  buildListingAlertEmail,
  buildListingAlertSubject,
  formatListingPrice,
  formatListingMeta,
  type ListingAlertListing,
} from './listing-alert-email'

const requireCjs = createRequire(import.meta.url)
const BANNED_VOCAB = requireCjs('../../scripts/brand-voice-vocabulary.cjs') as {
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
    detailUrl: 'https://ryan-realty.com/homes-for-sale/bend/61542-hosmer-lake-dr-220199001',
    status: 'Active',
    ...overrides,
  }
}

const BASE_INPUT = {
  searchName: 'Bend under 800k',
  filtersSummary: '3+ Beds, Max $800,000, Bend',
  browseAllUrl: 'https://ryan-realty.com/homes-for-sale?maxPrice=800000',
  unsubscribeUrl: 'https://ryan-realty.com/alerts/unsubscribe?token=tok123',
}

/** Visible copy only — tags (and their inline styles) stripped. */
function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ')
}

describe('formatListingPrice (exact list price, $ and commas)', () => {
  it('formats with dollar sign and thousands separators', () => {
    expect(formatListingPrice(749900)).toBe('$749,900')
    expect(formatListingPrice(3025000)).toBe('$3,025,000')
  })
  it('renders "Price on request" when unavailable', () => {
    expect(formatListingPrice(null)).toBe('Price on request')
    expect(formatListingPrice(undefined)).toBe('Price on request')
    expect(formatListingPrice(Number.NaN)).toBe('Price on request')
  })
})

describe('formatListingMeta (every number carries units)', () => {
  it('renders beds, baths, and sqft with units', () => {
    expect(formatListingMeta(listing())).toBe('3 beds · 2.5 baths · 1,850 sqft')
  })
  it('singularizes one bed and one bath', () => {
    expect(formatListingMeta(listing({ beds: 1, baths: 1, sqft: null }))).toBe('1 bed · 1 bath')
  })
  it('omits missing fields instead of showing zeros', () => {
    expect(formatListingMeta(listing({ beds: null, baths: null, sqft: null }))).toBe('')
  })
})

describe('buildListingAlertSubject', () => {
  it('carries the count and the search name, plural', () => {
    expect(buildListingAlertSubject(6, 'Bend under 800k')).toBe('6 new listings for Bend under 800k')
  })
  it('singular for one listing', () => {
    expect(buildListingAlertSubject(1, 'Tumalo acreage')).toBe('1 new listing for Tumalo acreage')
  })
})

describe('buildListingAlertEmail', () => {
  it('renders subject with count and each listing address + formatted price', () => {
    const out = buildListingAlertEmail({
      ...BASE_INPUT,
      listings: [
        listing(),
        listing({ address: '2417 NW Awbrey Rd', price: 1250000, beds: 4, baths: 3, sqft: 2980 }),
      ],
    })
    expect(out.subject).toBe('2 new listings for Bend under 800k')
    expect(out.html).toContain('61542 Hosmer Lake Dr')
    expect(out.html).toContain('$749,900')
    expect(out.html).toContain('2417 NW Awbrey Rd')
    expect(out.html).toContain('$1,250,000')
    expect(out.html).toContain('3 beds · 2.5 baths · 1,850 sqft')
    expect(out.html).toContain('2 new listings match your search')
    // text part carries the same facts
    expect(out.text).toContain('61542 Hosmer Lake Dr, Bend')
    expect(out.text).toContain('$749,900')
  })

  it('includes the unsubscribe URL, the browse-all button target, and each detail link', () => {
    const out = buildListingAlertEmail({ ...BASE_INPUT, listings: [listing()] })
    expect(out.html).toContain(BASE_INPUT.unsubscribeUrl)
    expect(out.html).toContain(BASE_INPUT.browseAllUrl)
    expect(out.html).toContain('See all matching homes')
    expect(out.html).toContain(listing().detailUrl)
    expect(out.text).toContain(BASE_INPUT.unsubscribeUrl)
  })

  it('shows a "+N more" link when the diff exceeds the shown cards', () => {
    const out = buildListingAlertEmail({
      ...BASE_INPUT,
      listings: [listing()],
      totalNewCount: 15,
    })
    expect(out.subject).toBe('15 new listings for Bend under 800k')
    expect(out.html).toContain('+14 more new listings')
    expect(out.text).toContain('+14 more new listings')
  })

  it('omits the "+N more" link when everything fits', () => {
    const out = buildListingAlertEmail({ ...BASE_INPUT, listings: [listing()], totalNewCount: 1 })
    expect(out.html).not.toContain('more new listing')
  })

  it('escapes HTML in user-provided strings', () => {
    const out = buildListingAlertEmail({
      ...BASE_INPUT,
      searchName: 'Homes <script>alert(1)</script>',
      listings: [listing({ address: '123 "Quote" Ln & Co' })],
    })
    expect(out.html).not.toContain('<script>')
    expect(out.html).toContain('&lt;script&gt;')
    expect(out.html).toContain('&amp; Co')
  })

  // --- Brand-voice cleanliness (CLAUDE.md §3) ---

  const sampleEmail = () =>
    buildListingAlertEmail({
      ...BASE_INPUT,
      listings: [
        listing(),
        listing({ address: '2417 NW Awbrey Rd', price: null, beds: 1, baths: 1, sqft: 980, status: 'Coming Soon' }),
      ],
      totalNewCount: 5,
      manageUrl: 'https://ryan-realty.com/account/saved-searches',
    })

  it('contains no em-dash or en-dash in visible copy', () => {
    const out = sampleEmail()
    expect(out.subject).not.toMatch(/[–—]/)
    expect(visibleText(out.html)).not.toMatch(/[–—]/)
    expect(out.text).not.toMatch(/[–—]/)
  })

  it('contains no semicolons in visible copy', () => {
    const out = sampleEmail()
    expect(out.subject).not.toContain(';')
    expect(visibleText(out.html)).not.toContain(';')
    expect(out.text).not.toContain(';')
  })

  it('contains no exclamation marks in visible copy', () => {
    const out = sampleEmail()
    expect(out.subject).not.toContain('!')
    expect(visibleText(out.html)).not.toContain('!')
    expect(out.text).not.toContain('!')
  })

  it('contains no banned vocabulary in visible copy', () => {
    const out = sampleEmail()
    const haystack = `${out.subject}\n${visibleText(out.html)}\n${out.text}`.toLowerCase()
    const hits = BANNED_VOCAB.BANNED_WORD_STRINGS.filter((w) => {
      if (/\s/.test(w)) return haystack.includes(w)
      return new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack)
    })
    expect(hits).toEqual([])
  })
})
