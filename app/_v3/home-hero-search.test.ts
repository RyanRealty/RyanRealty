import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { preferPlaceHero } from './home-constants'

const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')
const SEARCH = readFileSync(resolve('app/_v3/HomeHeroSearch.client.tsx'), 'utf8')
const FIELD = readFileSync(resolve('app/_v3/HomeHomesField.tsx'), 'utf8')
const V3_FIELD = readFileSync(resolve('components/site/v3/V3Field.tsx'), 'utf8')
const V3_FIELD_CSS = readFileSync(resolve('components/site/v3/V3Field.css'), 'utf8')
const FIELD_MAP = readFileSync(resolve('app/central-oregon/_v3/PlaceFieldMapImpl.tsx'), 'utf8')

describe('homepage hero search uses the public search stack', () => {
  it('mounts HomeHeroSearch as the only Stage action', () => {
    expect(PAGE).toMatch(/<HomeHeroSearch/)
    expect(PAGE).toMatch(/<V3Stage/)
    expect(PAGE).not.toMatch(/action=\{\{\s*label:\s*['"]See homes['"]/)
    expect(PAGE).not.toMatch(/>See homes</)
  })

  it('reuses SearchSuggest and searchHrefForQuery', () => {
    expect(SEARCH).toContain("from '@/components/search/SearchSuggest'")
    expect(SEARCH).toContain('<SearchSuggestPanel')
    expect(SEARCH).toContain("from '@/lib/parse-search-query'")
    expect(SEARCH).toContain('searchHrefForQuery')
    expect(SEARCH).toContain('City, community, or address')
  })

  it('empty submit opens the regional list, not a dead form', () => {
    expect(SEARCH).toContain('publishRegionalSearchHref()')
  })

  it('does not print leftover Search homes on the Stage', () => {
    expect(SEARCH).not.toContain('>Search homes<')
    expect(SEARCH).toContain('aria-label="Search city, community, or address"')
  })

  it('paints the Stage search as cream field and navy Search', () => {
    const css = readFileSync(resolve('app/_v3/home-hero-search.css'), 'utf8')
    expect(css).toContain('.v3.v3-stage .home-hero-search__input')
    expect(css).toContain('background: var(--v3-surface)')
    expect(css).toContain('color: var(--v3-ink)')
    expect(css).toContain('-webkit-appearance: none')
    expect(css).toContain('.v3.v3-stage .home-hero-search__go')
    expect(css).toContain('background: var(--v3-ink)')
    expect(css).toContain('color: var(--v3-ink-on-navy)')
  })
})

describe('preferPlaceHero', () => {
  it('uses the live url when present and the fallback when not', () => {
    expect(preferPlaceHero(' https://cdn.example/hero.jpg ', '/images/kb/bend.jpg')).toBe(
      'https://cdn.example/hero.jpg',
    )
    expect(preferPlaceHero(null, '/images/kb/bend.jpg')).toBe('/images/kb/bend.jpg')
    expect(preferPlaceHero('   ', '/images/kb/bend.jpg')).toBe('/images/kb/bend.jpg')
  })
})

describe('homepage Field stays on the barrel', () => {
  it('does not restyle Field rows into a one-off card language', () => {
    expect(FIELD).not.toContain('home-homes-field')
    expect(FIELD).not.toContain('home-field-types')
    expect(FIELD).toContain('V3Button')
    expect(FIELD).toContain('listFlow')
    expect(FIELD).not.toContain('count=')
    expect(V3_FIELD_CSS).toContain('.v3-field__lead')
    expect(V3_FIELD_CSS).toContain('.v3-field__mark--cat-0')
  })

  it('caps the preview set so the map sits with the list, not after a novel of cards', () => {
    const constants = readFileSync(resolve('app/_v3/home-constants.ts'), 'utf8')
    expect(constants).toMatch(/export const HOME_FIELD_LIMIT = 12/)
    expect(constants).toMatch(/export const HOME_FIELD_POOL = 24/)
    expect(FIELD).toContain('displayLimit')
    expect(V3_FIELD_CSS).toContain('.v3-field__frame > .v3-field__col:first-of-type')
    expect(V3_FIELD_CSS).toContain('order: 0')
    expect(V3_FIELD_CSS).toContain('.v3-field__frame > .v3-field__col:last-of-type')
    expect(V3_FIELD_CSS).toContain('order: 1')
  })

  it('wears the Field frame: fold-filling map, same-height list from 900, See all', () => {
    expect(V3_FIELD).toContain('listFlow')
    expect(V3_FIELD).toContain('v3-field--flow')
    expect(V3_FIELD).toContain('v3-field__action')
    expect(V3_FIELD_CSS).toContain('.v3.v3-field--flow .v3-field__map:not(.v3-field__map--photos)')
    expect(V3_FIELD_CSS).toContain('min-height: var(--v3-photo-lead-min)')
    expect(V3_FIELD_CSS).toContain('align-items: stretch')
    expect(PAGE).toMatch(/listFlow/)
    expect(PAGE).toMatch(/seeAll=\{\{ href: publishRegionalSearchHref\(\)/)
  })

  it('keeps the Google map inside the Field tile at 390', () => {
    expect(V3_FIELD_CSS).toContain('.v3-field__map:not(.v3-field__map--photos) > :only-child')
    expect(V3_FIELD_CSS).toContain('contain: inline-size')
    expect(V3_FIELD_CSS).toContain('position: absolute')
    expect(V3_FIELD_CSS).toContain('inset: 0')
    expect(V3_FIELD_CSS).not.toContain('100vw')
  })

  it('uses Field navy pins on the Google frame, price only when active', () => {
    expect(FIELD_MAP).toContain('OverlayView')
    expect(FIELD_MAP).toContain('v3-field__pin')
    expect(FIELD_MAP).toContain('v3-field__pin-label')
    expect(FIELD_MAP).toContain('v3-field__pin--cat-')
    expect(FIELD_MAP).toContain('<Link')
    expect(FIELD_MAP).toContain('FRAME_INSET_PCT')
    expect(FIELD_MAP).toContain('MIN_FIT_PX')
    expect(FIELD_MAP).toContain('ResizeObserver')
    expect(FIELD_MAP).toContain('for (const ring of polygons)')
    expect(FIELD_MAP).not.toContain('MarkerClusterer')
    expect(FIELD_MAP).not.toContain('getListingMarkerIcon')
    expect(FIELD_MAP).not.toContain('MAP_LABEL_LISTING')
    expect(FIELD_MAP).not.toContain('#0d9488')
    expect(FIELD_MAP).not.toContain('setZoom(9)')
    expect(FIELD).toContain('PlaceFieldMap')
    expect(FIELD).toContain('boundary={boundary}')
    expect(PAGE).toContain('getBoundaryGeoJSON')
    expect(PAGE).toContain('unionBoundaryGeometry')
    expect(PAGE).toContain('boundary={regionBoundary ?? undefined}')
  })

  it('toggles types that exist in the set as Field lead chips', () => {
    expect(FIELD).toContain('aria-label="Property types"')
    expect(FIELD).not.toContain('aria-label="Towns"')
    expect(PAGE).not.toMatch(/towns=\{/)
    expect(FIELD).toContain('v3-field__mark')
    expect(FIELD).toContain('ariaPressed')
    expect(FIELD).toContain('mapSlot={(binding)')
    expect(V3_FIELD_CSS).toContain('.v3-field__pin--cat-0')
    expect(V3_FIELD_CSS).toContain('.v3-field__mark--cat-0')
    expect(V3_FIELD_CSS).toContain('background: var(--v3-cat-0)')
    expect(PAGE).toContain('homeFieldPool')
    expect(PAGE).not.toContain("propertySubType: 'Single Family Residence'")
  })

  it('does not print the leftover inventory caption', () => {
    expect(PAGE).not.toContain('HERO_COUNT_LEAD')
    expect(PAGE).not.toContain('homes for sale across Central Oregon. Live list prices and days on market.')
    expect(PAGE).not.toContain('The map plots these')
    expect(FIELD).not.toContain('mapNote')
    expect(PAGE).not.toMatch(/\bcount=\{/)
    expect(FIELD).not.toContain('count=')
  })

  it('does not print MARKET TRUTH LEFTOVER on the market chart', () => {
    expect(PAGE).toContain("placeMedianChartCaption('Central Oregon')")
    expect(PAGE).not.toContain('Market Truth leftover')
  })

  it('keeps Field lead chips on one scrolling row per nav', () => {
    expect(V3_FIELD_CSS).toContain('.v3-field__lead nav')
    expect(V3_FIELD_CSS).toContain('flex-wrap: nowrap')
    expect(V3_FIELD_CSS).toContain('overflow-x: auto')
    expect(V3_FIELD_CSS).toContain('flex: none')
  })

  it('opens with Stage then Field, Chart Room mid-page', () => {
    expect(PAGE).toMatch(/<V3Stage/)
    expect(PAGE).toMatch(/<HomeHomesField/)
    expect(PAGE).toMatch(/<V3Instrument/)
    expect(PAGE).toMatch(/id="towns"/)
    const stageAt = PAGE.indexOf('<V3Stage')
    const fieldAt = PAGE.indexOf('<HomeHomesField')
    const townsAt = PAGE.indexOf('id="towns"')
    const marketAt = PAGE.indexOf('<V3Instrument')
    expect(stageAt).toBeGreaterThan(-1)
    expect(fieldAt).toBeGreaterThan(stageAt)
    expect(townsAt).toBeGreaterThan(fieldAt)
    expect(marketAt).toBeGreaterThan(townsAt)
  })

  it('gives the towns Ledger room under the sticky chrome', () => {
    const ledgerCss = readFileSync(resolve('components/site/v3/V3Ledger.css'), 'utf8')
    expect(ledgerCss).toContain('.v3.v3-ledger[id]')
    expect(ledgerCss).toContain('scroll-margin-top: calc(var(--v3-space-3xl) + var(--v3-tap))')
  })

  it('does not print leftover CITY on town rows', () => {
    expect(PAGE).toMatch(/when: _kind/)
    expect(PAGE).not.toMatch(/when:\s*v3Text\('City'\)/)
  })

  it('does not print the regional remainder paragraph', () => {
    expect(PAGE).not.toContain('townRemainder')
    expect(PAGE).not.toContain('namePulseCityRemainder')
    expect(PAGE).not.toContain('Also in the leftover regional count')
    expect(PAGE).not.toContain('Also in the regional count')
  })
})
