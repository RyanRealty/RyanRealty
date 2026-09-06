import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { preferPlaceHero } from './home-constants'

const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')
const SEARCH = readFileSync(resolve('app/_v3/HomeHeroSearch.client.tsx'), 'utf8')
const RAILS = readFileSync(resolve('app/_v3/HomeHomesRails.tsx'), 'utf8')
const RAIL_CLIENT = readFileSync(resolve('app/_v3/HomeListingRail.client.tsx'), 'utf8')
const RAIL_ITEMS = readFileSync(resolve('app/_v3/home-rail-items.ts'), 'utf8')
const ATLAS = readFileSync(resolve('components/site/v3/V3Atlas.client.tsx'), 'utf8')

describe('homepage hero search uses the public search stack', () => {
  it('Stage H1 is brand; job line sits under it (H5 + ci:seo-shell)', () => {
    expect(PAGE).toMatch(/headline=\{v3Text\('Ryan Realty, Bend'\)\}/)
    expect(PAGE).toContain('home-hero-search__job')
    expect(PAGE).toContain('Find homes in Central Oregon')
    expect(PAGE).toMatch(/title:\s*\{\s*absolute:\s*'Ryan Realty, Bend'\s*\}/)
    expect(PAGE).toMatch(/openGraph: \{[\s\S]*?title: 'Ryan Realty, Bend'/)
    expect(PAGE).toMatch(/twitter: \{[\s\S]*?title: 'Ryan Realty, Bend'/)
    expect(PAGE).not.toMatch(/headline=\{v3Text\('Find homes in Central Oregon'\)\}/)
  })

  it('mounts HomeHeroSearch on the Stage; house rails before doors (expanded Home lock)', () => {
    expect(PAGE).toMatch(/<V3Stage/)
    expect(PAGE).toMatch(/height="tall"/)
    expect(PAGE).toMatch(/videoSrc=\{HERO_VIDEO\}/)
    expect(PAGE).toMatch(/posterSrc=\{HERO_POSTER\}/)
    expect(PAGE).toMatch(/<HomeHeroSearch/)
    expect(PAGE).not.toMatch(/<V3Atlas/)
    expect(PAGE).not.toMatch(/<HomeExploreMap/)
    expect(PAGE).not.toMatch(/action=\{\{\s*label:\s*['"]See homes['"]/)
    expect(PAGE).not.toMatch(/>See homes</)
    const stageAt = PAGE.indexOf('<V3Stage')
    const searchAt = PAGE.indexOf('<HomeHeroSearch')
    const railsAt = PAGE.indexOf('<HomeHomesRails')
    const doorsAt = PAGE.indexOf('<V3Doors')
    expect(stageAt).toBeGreaterThan(-1)
    expect(searchAt).toBeGreaterThan(stageAt)
    expect(railsAt).toBeGreaterThan(searchAt)
    expect(doorsAt).toBeGreaterThan(railsAt)
  })

  it('reuses SearchSuggest and searchHrefForQuery', () => {
    expect(SEARCH).toContain("from '@/components/search/SearchSuggest'")
    expect(SEARCH).toContain('<SearchSuggestPanel')
    expect(SEARCH).toContain("from '@/lib/parse-search-query'")
    expect(SEARCH).toContain('searchHrefForQuery')
    expect(SEARCH).toContain('City, community, or address')
    expect(SEARCH).toContain('home-hero-search__label')
    expect(SEARCH).toContain('htmlFor={fieldId}')
  })

  it('empty submit opens the regional list, not a dead form', () => {
    expect(SEARCH).toContain('publishRegionalSearchHref()')
  })

  it('does not print leftover Search homes on the Stage; label is visible (H2)', () => {
    expect(SEARCH).not.toContain('>Search homes<')
    expect(SEARCH).toContain('home-hero-search__label')
    expect(SEARCH).toContain('City, community, or address')
    expect(SEARCH).not.toContain('aria-label="Search city, community, or address"')
  })

  it('paints the search as cream field and navy Search wherever the v3 root hosts it', () => {
    const css = readFileSync(resolve('app/_v3/home-hero-search.css'), 'utf8')
    expect(css).toContain('.v3 .home-hero-search__input')
    expect(css).toContain('background: var(--v3-surface)')
    expect(css).toContain('color: var(--v3-ink)')
    expect(css).toContain('-webkit-appearance: none')
    expect(css).toContain('.v3 .home-hero-search__go')
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

describe('homepage house rails use SplitCardMedia cards', () => {
  it('stacks HomeHomesRails instead of a lonely Field grid', () => {
    expect(PAGE).toMatch(/<HomeHomesRails/)
    expect(PAGE).not.toMatch(/<HomeHomesField/)
    expect(PAGE).not.toContain('homeFieldPool')
    expect(PAGE).toContain('homeRailRows')
    expect(RAILS).toContain('HomeListingRail')
    expect(RAIL_CLIENT).toContain('SplitCardMedia')
    expect(RAIL_CLIENT).toContain('HeartIcon')
    expect(RAIL_CLIENT).toContain('publishListingShareKind')
    expect(RAIL_ITEMS).toContain('publishListingCardBadges')
    expect(RAIL_ITEMS).toContain('Homes in Bend and nearby')
    expect(RAIL_ITEMS).toContain('Price cuts')
    expect(RAIL_ITEMS).toContain('New this week')
    expect(RAIL_ITEMS).not.toContain('Homes for You')
  })

  it('does not print the leftover inventory caption', () => {
    expect(PAGE).not.toContain('HERO_COUNT_LEAD')
    expect(PAGE).not.toContain('homes for sale across Central Oregon. Live list prices and days on market.')
    expect(PAGE).not.toContain('The map plots these')
    expect(PAGE).not.toMatch(/\bcount=\{/)
  })

  it('does not mount a market chart on the homepage (H9)', () => {
    expect(PAGE).not.toContain('placeMedianChart')
    expect(PAGE).not.toContain('placeMedianChartCaption')
    expect(PAGE).not.toContain('chart={medianChart}')
    expect(PAGE).not.toContain('Market Truth leftover')
  })

  it('homepage has no Atlas and no explore map (expanded Home lock)', () => {
    expect(PAGE).not.toMatch(/<V3Atlas/)
    expect(PAGE).not.toMatch(/<HomeExploreMap/)
    expect(ATLAS).toContain('zoomAt')
    expect(ATLAS).toContain('router.push')
    expect(ATLAS).toContain('openPlace')
    expect(ATLAS).toContain('setPinned')
    expect(ATLAS).toContain('v3-atlas__label--active')
    expect(ATLAS).toContain('pinchRef')
    expect(ATLAS).toContain("from '@/lib/atlas/pack-labels'")
    expect(ATLAS).toContain('is-here')
    expect(ATLAS).toContain('v3-atlas__card-homes')
    expect(ATLAS).toContain('setHover(s.id)')
  })

  it('opens Stage → rails → Doors → faces → places → proof (expanded Home lock)', () => {
    expect(PAGE).toMatch(/<V3Stage/)
    expect(PAGE).not.toMatch(/<V3Atlas/)
    expect(PAGE).toMatch(/<V3Doors/)
    expect(PAGE).toMatch(/<HomeHomesRails/)
    expect(PAGE).not.toMatch(/<HomeExploreMap/)
    expect(PAGE).not.toMatch(/<V3Instrument/)
    expect(PAGE).not.toMatch(/id="towns"/)
    expect(PAGE).not.toMatch(/id="market"/)
    expect(PAGE).toMatch(/<V3Proof/)
    expect(PAGE).toMatch(/id="proof"/)
    expect(PAGE).toMatch(/id="places"/)
    expect(PAGE).toMatch(/Browse places/)
    expect(PAGE).toMatch(/Talk to a broker/)
    expect(PAGE).toMatch(/Value my home/)
    expect(PAGE).not.toMatch(/See what your home is worth/)
    expect(PAGE).not.toMatch(/<SellCapture/)
    expect(PAGE).not.toMatch(/id="communities"/)
    expect(PAGE).toMatch(/imageSrc: DOOR_ART\.buy/)
    const stageAt = PAGE.indexOf('<V3Stage')
    const railsAt = PAGE.indexOf('<HomeHomesRails')
    const doorsAt = PAGE.indexOf('<V3Doors')
    const facesAt = PAGE.indexOf('Talk to a broker')
    const placesAt = PAGE.indexOf('id="places"')
    const proofAt = PAGE.indexOf('<V3Proof')
    expect(stageAt).toBeGreaterThan(-1)
    expect(railsAt).toBeGreaterThan(stageAt)
    expect(doorsAt).toBeGreaterThan(railsAt)
    expect(facesAt).toBeGreaterThan(doorsAt)
    expect(placesAt).toBeGreaterThan(facesAt)
    expect(proofAt).toBeGreaterThan(placesAt)
  })

  it('does not print the regional remainder paragraph', () => {
    expect(PAGE).not.toContain('townRemainder')
    expect(PAGE).not.toContain('namePulseCityRemainder')
    expect(PAGE).not.toContain('Also in the leftover regional count')
    expect(PAGE).not.toContain('Also in the regional count')
  })
})
