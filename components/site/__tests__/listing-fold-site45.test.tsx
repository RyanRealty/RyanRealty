import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PriceCtaStrip } from '@/components/site/listing-detail/PriceCtaStrip'
import { PriceDropMark } from '@/components/site/listing-detail/PriceDropMark'
import { ListingDetailShell } from '@/components/site/listing-detail/ListingDetailShell'

/**
 * SITE-45: the listing fold's two drawn facts and the hero's seat.
 *  - the price cut is two prices at rest, and it never draws off market;
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

describe('the price cut at rest, under one headline price', () => {
  const mark = { from: 1_075_000, to: 999_000, drop: 76_000, pct: 7.1, date: '2026-08-15' }

  it('prints was, cut, percent and date without a hover, and the price once', () => {
    const html = strip({ dropMark: mark })
    expect(html).toContain('class="listing-drop"')
    expect(html).not.toContain('<line')
    expect(html).not.toContain('<circle')
    expect(html).toContain('Was <span class="listing-drop__from">$1,075,000</span>')
    expect(html).toContain('Cut $76,000 (−7.1%)')
    expect(html).toContain('on Aug 15, 2026')
    // Matt 2026-09-25: the new price is the headline and is printed once. The
    // 2026-09-24 line repeated it beside the old one ($486,000 twice on a phone).
    expect(html).not.toContain('listing-drop__to')
    const visible = html.replace(/aria-label="[^"]*"/g, '')
    expect(visible.match(/\$999,000/g)).toHaveLength(1)
    // The screen-reader reading still names both prices.
    expect(html).toMatch(/aria-label="Price drop \$76K: \$1,075,000 to \$999,000, 7\.1% on Aug 15, 2026"/)
  })

  it('draws nothing once a later price change leaves the cut behind the headline price', () => {
    // Listed 1,195,000, cut to 999,000 on Aug 15, raised to 1,025,000 on Sep 1:
    // the newest DROP still says 999,000, which is not today's price, and "Was
    // $1,075,000" beside $1,025,000 would describe a cut that did not set it.
    const raised = strip({
      dropMark: mark,
      listing: { ...LISTING, listPrice: 1_025_000 },
    })
    expect(raised).not.toContain('listing-drop')
    expect(raised).not.toContain('$999,000')
    // The mark still draws when the cut set the headline price.
    expect(strip({ dropMark: mark })).toContain('listing-drop__cut')
  })

  it('draws nothing without a dated mark, including off market', () => {
    // Matt 2026-09-15: a cut without the date does not ship. original-vs-ask
    // without event_date is not a price-drop mark.
    expect(strip({ dropMark: null })).not.toMatch(/Down .*1,195,000/)
    expect(strip({ dropMark: null })).not.toContain('listing-drop')
    const sold = strip({
      dropMark: mark,
      listing: { ...LISTING, status: 'Closed', closePrice: 990_000, closeDate: '2026-09-01' },
    })
    expect(sold).not.toContain('listing-drop')
  })

  it('PriceDropMark alone: was, exception cut with its percent, date, no slope', () => {
    const html = renderToStaticMarkup(createElement(PriceDropMark, { mark, label: 'Price drop $76K' }))
    // "Was $1,075,000 · Cut $76,000 (−7.1%) on Aug 15, 2026". The dot rides the
    // old price (hidden from readers) so a phone wrap never leaves it hanging.
    expect(html).toMatch(
      /<span class="listing-drop__was">Was <span class="listing-drop__from">\$1,075,000<\/span> <span class="listing-drop__sep" aria-hidden="true">·<\/span><\/span><span class="listing-drop__cut">Cut \$76,000 \(−7\.1%\)<\/span><span class="listing-drop__meta">on Aug 15, 2026<\/span>/,
    )
    expect(html).not.toContain('$999,000<')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('<line')
  })
})

describe("the pills' plain read", () => {
  it('prints the sentence and its trace behind a disclosure', () => {
    const html = strip({
      read: {
        sentence: '112 days listed is about 4.9 times the 23 a typical Bend home takes to go under contract.',
        source:
          'regional MLS through Oregon Data Share, median days from listing to contract, detached homes in Bend, trailing 90 days (market_metric, detached).',
        sourceName: 'regional MLS through Oregon Data Share',
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

describe('the ask as one grouped control', () => {
  it('renders Tour as the one ask beside the price, not Call / Text sticky verbs', () => {
    const html = strip()
    expect(html).toContain('data-slot="button-group"')
    expect(html).toContain('Tour')
    expect(html).not.toMatch(/>Call</)
    expect(html).not.toMatch(/href="tel:/)
    expect(html).not.toMatch(/href="sms:/)
    expect(html).not.toMatch(/class="btn alt"/)
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
