import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'
import { PriceDropMark } from '@/components/site/listing-detail/PriceDropMark'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'

/**
 * SITE-45: the listing fold's two drawn facts and the hero's seat.
 *  - the price cut is two points with a reading, and it never draws off market;
 *  - the pills carry one plain sentence with its trace;
 *  - the shell can seat the hero inside the main column, beside the sidebar.
 */

const LISTING = {
  listingKey: 'k1',
  listNumber: '220000001',
  onMarketDate: '2026-05-20',
  listPrice: 999_000,
  closePrice: null,
  closeDate: null,
  status: 'Active',
  dom: 12,
  pricePerSqft: 446,
  propertySubType: 'Single Family Residence',
  propertyType: 'A',
  streetNumber: '909',
  streetDirPrefix: 'NW',
  streetName: 'Delaware',
  streetSuffix: 'Avenue',
  streetDirSuffix: null,
  city: 'Bend',
  postalCode: '97703',
  subdivisionName: null,
  originalListPrice: 1_195_000,
  priceDropCount: 2,
  beds: 3,
  baths: 2,
  sqft: 2240,
  totalLivingAreaSqFt: 2240,
  lotSizeAcres: 0.2,
  taxAnnualAmount: null,
  hoaMonthly: null,
  listAgentName: null,
  listOfficeName: null,
  listAgentPhone: null,
  listOfficePhone: null,
  lat: null,
  lng: null,
}

const HISTORY = [
  { event: 'listed', event_date: '2026-06-04', price: 1_195_000, price_change: null },
  { event: 'pricechange', event_date: '2026-08-15', price: 999_000, price_change: -76_000 },
]

function strip(over: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PriceCtaStrip, {
      listing: LISTING as unknown as Parameters<typeof PriceCtaStrip>[0]['listing'],
      history: HISTORY,
      showEstPayment: false,
      showAlerts: false,
      ...over,
    } as Parameters<typeof PriceCtaStrip>[0]),
  )
}

describe('the price cut as two points', () => {
  const mark = { from: 1_075_000, to: 999_000, drop: 76_000, pct: 7.1, date: '2026-08-15' }

  it('draws the mark with the label the strip always printed and a reading for hover', () => {
    const html = strip({ dropMark: mark })
    expect(html).toContain('class="listing-drop"')
    expect(html).toMatch(/Price drop \$76K/)
    expect(html).toContain('<line')
    expect(html).toContain('$1,075,000')
    expect(html).toContain('$999,000')
    expect(html).toContain('−7.1%')
    expect(html).toContain('Aug 15, 2026')
    // The whole reading is the button's accessible name, so a screen reader
    // gets it without the hover.
    expect(html).toMatch(/aria-label="Price drop \$76K: \$1,075,000 to \$999,000, 7\.1% on Aug 15, 2026"/)
  })

  it('falls back to the strip\'s own drop line without a mark, and draws nothing off market', () => {
    // With no mark the strip prints what it always did: the supported
    // original ("Down $196,000 from $1,195,000"), else the last drop's label.
    expect(strip({ dropMark: null })).toMatch(/Down .*1,195,000/)
    expect(strip({ dropMark: null })).not.toContain('listing-drop')
    const sold = strip({
      dropMark: mark,
      listing: { ...LISTING, status: 'Closed', closePrice: 990_000, closeDate: '2026-09-01' },
    })
    expect(sold).not.toContain('listing-drop')
  })

  it('PriceDropMark alone: hollow from-point, filled to-point, one line', () => {
    const html = renderToStaticMarkup(createElement(PriceDropMark, { mark, label: 'Price drop $76K' }))
    expect(html.match(/<circle/g)).toHaveLength(2)
    expect(html).toContain('listing-drop__from')
    expect(html.match(/<line/g)).toHaveLength(1)
  })
})

describe("the pills' plain read", () => {
  it('prints the sentence and its trace behind a disclosure', () => {
    const html = strip({
      read: {
        sentence: '112 days listed is about 4.9 times the 23 a typical Bend home takes to go under contract.',
        source: 'Market Truth (market_metric, detached): median days from listing to contract, detached homes in Bend, trailing 90 days.',
      },
    })
    expect(html).toContain('class="listing-read"')
    expect(html).toContain('112 days listed is about 4.9 times')
    expect(html).toMatch(/<details class="listing-read__source"><summary>Source<\/summary>/)
    expect(html).toContain('trailing 90 days')
  })

  it('prints the pills alone without a read', () => {
    expect(strip({ read: null })).not.toContain('listing-read')
  })
})

describe('the hero in the main column', () => {
  it('seats the hero inside .listing-detail-main when heroInMain is set, else above the grid', () => {
    const inMain = renderToStaticMarkup(
      createElement(ListingDetailShell, {
        hero: createElement('div', { id: 'hero-stub' }),
        main: createElement('div', { id: 'main-stub' }),
        sidebar: createElement('div', { id: 'aside-stub' }),
        heroInMain: true,
      }),
    )
    expect(inMain).not.toContain('listing-hero-bleed')
    expect(inMain.indexOf('listing-detail-main')).toBeLessThan(inMain.indexOf('hero-stub'))
    expect(inMain.indexOf('hero-stub')).toBeLessThan(inMain.indexOf('main-stub'))
    expect(inMain).toContain('listing-hero-column')
    const above = renderToStaticMarkup(
      createElement(ListingDetailShell, {
        hero: createElement('div', { id: 'hero-stub' }),
        main: createElement('div', { id: 'main-stub' }),
      }),
    )
    expect(above).toContain('listing-hero-bleed')
    expect(above.indexOf('hero-stub')).toBeLessThan(above.indexOf('listing-detail-shell'))
  })
})
