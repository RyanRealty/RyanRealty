/**
 * Matt 2026-10-14: every area page carries a quick "get new listings for this
 * area" signup. On the market pages the strip is a different ask from the
 * inquiry sheet (new listings by email, not a conversation), so both stay, and
 * the strip sits right after the page's listings, or after the opening when the
 * page lists none, never beside the sheet.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CityMarketView } from './city-view'
import { CommunityMarketView } from './community-view'

const PAGE = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')

const ALERTS = createElement('section', { id: 'alerts' }, 'ALERT STRIP')
const SHEET = createElement('section', { id: 'ask' }, 'INQUIRY SHEET')

const at = (html: string, needle: string) => html.indexOf(needle)

function city(props: Record<string, unknown>) {
  return renderToStaticMarkup(
    createElement(CityMarketView, {
      cityName: 'Bend',
      citySlug: 'bend',
      hud: null,
      mosText: null,
      verdict: { kind: 'balanced', label: '4.5 months of supply' },
      refreshedAt: null,
      valuationHrefValue: '/sell',
      snapshots: [],
      faqs: [],
      posts: [],
      closedFigures: [{ value: '$759,000', label: 'Median sale price' }],
      closedTrace: null,
      sheet: SHEET,
      alerts: ALERTS,
      takeaways: ['Bend has 3.6 months of supply.', 'The median single-family home in Bend sold for $759,000.'],
      ...props,
    } as unknown as Parameters<typeof CityMarketView>[0]),
  )
}

describe('/housing-market/<city> listing-alert strip', () => {
  const homes = [
    {
      listingKey: 'k1',
      href: '/listings/k1',
      photoSrc: '',
      address: '1 Main St',
      price: 500000,
    },
  ]

  it('sits right after the homes section, before the cities ledger', () => {
    const html = city({ homes })
    const homesAt = at(html, 'id="city-homes"')
    const alertsAt = at(html, 'id="alerts"')
    const citiesAt = at(html, 'id="cities"')
    expect(homesAt).toBeGreaterThan(-1)
    expect(alertsAt).toBeGreaterThan(homesAt)
    expect(citiesAt).toBeGreaterThan(alertsAt)
  })

  it('with no homes section it follows the opening, still before the ledger', () => {
    const html = city({ homes: [] })
    expect(at(html, 'id="city-homes"')).toBe(-1)
    expect(at(html, 'id="alerts"')).toBeGreaterThan(at(html, 'id="market"'))
    expect(at(html, 'id="cities"')).toBeGreaterThan(at(html, 'id="alerts"'))
  })

  it('is never beside the inquiry sheet, and the sheet stays', () => {
    const html = city({ homes })
    expect(at(html, 'id="ask"')).toBeGreaterThan(at(html, 'id="faq"'))
    expect(at(html, 'id="faq"')).toBeGreaterThan(at(html, 'id="alerts"'))
  })

  it('renders no strip when the place maps to no area', () => {
    expect(city({ homes, alerts: null })).not.toContain('id="alerts"')
  })
})

describe('/housing-market/<city>/<community> listing-alert strip', () => {
  function community(props: Record<string, unknown> = {}) {
    return renderToStaticMarkup(
      createElement(CommunityMarketView, {
        geoName: 'Tetherow',
        cityName: 'Bend',
        citySlug: 'bend',
        communitySlug: 'tetherow',
        hud: null,
        mosText: null,
        verdict: { kind: 'balanced', label: '4.5 months of supply' },
        refreshedAt: null,
        valuationHrefValue: '/sell',
        detail: null,
        snapshots: [],
        faqs: [],
        sheet: SHEET,
        alerts: ALERTS,
        takeaways: ['Tetherow has 3.6 months of supply.'],
        ...props,
      } as unknown as Parameters<typeof CommunityMarketView>[0]),
    )
  }

  it('lists no homes, so it follows the opening and its short answer, before the ledger', () => {
    const html = community()
    expect(at(html, 'id="alerts"')).toBeGreaterThan(at(html, 'id="takeaways"'))
    expect(at(html, 'id="cities"')).toBeGreaterThan(at(html, 'id="alerts"'))
    expect(at(html, 'id="ask"')).toBeGreaterThan(at(html, 'id="faq"'))
  })

  it('renders no strip when the place maps to no area', () => {
    expect(community({ alerts: null })).not.toContain('id="alerts"')
  })
})

describe('market page wiring', () => {
  it('builds one strip from the shared scope builders and passes it to both views', () => {
    expect(PAGE.match(/<PlaceAlertsStrip/g)?.length).toBe(1)
    expect(PAGE).toMatch(/cityAlertScope\(\{ cityName, citySlug: geo\.citySlug \}\)/)
    expect(PAGE).toMatch(/communityAlertScope\(\{ community: communityRecord, slug: geo\.communitySlug, placeName: geoName \}\)/)
    expect(PAGE.match(/alerts=\{alerts\}/g)?.length).toBe(2)
    // no sticky repeat on the market pages
    expect(PAGE).not.toMatch(/stickyAfter/)
    // the inquiry sheet stays
    expect(PAGE).toMatch(/<GeoInquirySheet geoName=\{geoName\} \/>/)
  })
})
