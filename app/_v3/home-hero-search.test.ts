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
const PLACES = readFileSync(resolve('app/_v3/HomeBrowsePlaces.tsx'), 'utf8')

describe('homepage hero search uses the public search stack', () => {
  it('Stage H1 is buyer job line; brand stays in metadata (ci:seo-shell)', () => {
    expect(PAGE).toMatch(/headline=\{v3Text\('Homes for sale in Central Oregon'\)\}/)
    expect(PAGE).not.toContain('home-hero-search__job')
    expect(PAGE).not.toMatch(/headline=\{v3Text\('Ryan Realty, Bend'\)\}/)
    expect(PAGE).toMatch(/title:\s*\{\s*absolute:\s*'Homes for Sale in Central Oregon \| Ryan Realty, Bend'\s*\}/)
    expect(PAGE).toMatch(/openGraph: \{[\s\S]*?title: 'Homes for Sale in Central Oregon \| Ryan Realty, Bend'/)
    expect(PAGE).toMatch(/twitter: \{[\s\S]*?title: 'Homes for Sale in Central Oregon \| Ryan Realty, Bend'/)
    expect(PAGE).toMatch(/<HomeHeroSearch[^>]*valuationHref=/)
  })

  it('mounts HomeHeroSearch on the Stage; house rails before doors (expanded Home lock)', () => {
    expect(PAGE).toMatch(/<V3Stage/)
    // SITE-83: inventory Stage so the pulse claim breaks the fold.
    expect(PAGE).toMatch(/height=\{heroInventory \? 'standard' : 'tall'\}/)
    expect(PAGE).toMatch(/inventory=\{heroInventory\}/)
    expect(PAGE).toMatch(/videoSrc=\{HERO_VIDEO\}/)
    expect(PAGE).toMatch(/preferPlaceHero\(cityBySlug\.get\('bend'\)\?\.heroImageUrl, HERO_POSTER\)/)
    expect(PAGE).toMatch(/posterSrc=\{heroPosterSrc\}/)
    expect(PAGE).toMatch(/<HomeHeroSearch/)
    expect(PAGE).not.toMatch(/<V3Atlas/)
    expect(PAGE).not.toMatch(/<HomeExploreMap/)
    expect(PAGE).not.toMatch(/action=\{\{\s*label:\s*['"]See homes['"]/)
    expect(PAGE).not.toMatch(/>See homes</)
    const stageAt = PAGE.indexOf('<V3Stage')
    const searchAt = PAGE.indexOf('<HomeHeroSearch')
    const pulseAt = PAGE.indexOf('<V3Pulse')
    const railsAt = PAGE.indexOf('<HomeHomesRails')
    const doorsAt = PAGE.indexOf('<V3Doors')
    expect(stageAt).toBeGreaterThan(-1)
    expect(searchAt).toBeGreaterThan(stageAt)
    expect(pulseAt).toBeGreaterThan(searchAt)
    expect(railsAt).toBeGreaterThan(pulseAt)
    expect(doorsAt).toBeGreaterThan(railsAt)
  })

  it('morphing search is a field that grows, not a command palette', () => {
    const morph = readFileSync(resolve('components/motion/morphing-search.tsx'), 'utf8')
    expect(morph).not.toMatch(/<kbd/)
    expect(morph).not.toContain('backdrop-blur')
    expect(morph).not.toContain('No results found')
    expect(morph).toContain('v3-morph-overlay-shell')
    expect(morph).toContain('showList')
    expect(morph).toContain('inline')
    expect(readFileSync(resolve('components/site/v3/V3MorphSearch.tsx'), 'utf8')).toMatch(/\binline\b/)
  })

  it('adapts catalog modules into house primitives on the hero and rails', () => {
    expect(SEARCH).toContain('V3Tabs')
    expect(SEARCH).toContain('V3MorphSearch')
    expect(readFileSync(resolve('components/site/v3/V3MorphSearch.tsx'), 'utf8')).toContain(
      "from '@/components/motion/morphing-search'",
    )
    expect(readFileSync(resolve('components/site/v3/V3Tabs.tsx'), 'utf8')).toContain(
      "from '@/components/motion/tabs'",
    )
    expect(readFileSync(resolve('components/site/v3/V3Carousel.client.tsx'), 'utf8')).toContain(
      "from '@/components/ui/carousel'",
    )
    expect(readFileSync(resolve('components/site/v3/V3Number.client.tsx'), 'utf8')).toContain(
      "from '@/components/motion/number'",
    )
    expect(RAIL_CLIENT).toContain('V3Carousel')
    expect(RAIL_CLIENT).toContain('mode="rail"')
    expect(RAIL_CLIENT).toContain('V3Number')
    expect(RAIL_CLIENT).toContain("from '@/components/ui/card'")
    expect(RAIL_CLIENT).toContain('CardContent')
  })

  it('hero suggestions are places and houses, not blog posts', () => {
    expect(SEARCH).toContain("item.kind === 'address'")
    expect(SEARCH).toContain("item.kind === 'city'")
    expect(SEARCH).not.toMatch(/kind === 'page'/)
  })

  it('reuses SearchSuggest and searchHrefForQuery', () => {
    expect(SEARCH).toContain("from '@/components/search/SearchSuggest'")
    expect(SEARCH).toContain('<SearchSuggestPanel')
    expect(SEARCH).toContain("from '@/lib/parse-search-query'")
    expect(SEARCH).toContain('searchHrefForQuery')
    expect(SEARCH).toContain('Find a home')
    expect(SEARCH).toContain('home-hero-search__label')
    expect(SEARCH).toContain('htmlFor={buyFieldId}')
  })

  it('wires Buy | Sell tabs on the hero (Buy = search, Sell = Value my home)', () => {
    expect(SEARCH).toMatch(/label:\s*'Buy'/)
    expect(SEARCH).toMatch(/label:\s*'Sell'/)
    expect(SEARCH).toContain('Value my home')
    expect(SEARCH).toContain('valuationHref')
    expect(SEARCH).toContain('Value your home')
    expect(SEARCH).not.toContain('see what your home is worth')
    const css = readFileSync(resolve('app/_v3/home-hero-search.css'), 'utf8')
    expect(css).toContain('.v3 .home-hero-search__tabs')
    expect(css).toContain('.v3 .home-hero-search__mode--buy:checked')
    expect(css).toContain('.v3 .home-hero-search__mode--sell:checked')
  })

  // SITE-12. The hard accept test for this node: `curl /` finds the seller
  // address field. That can only be true if the panel is in the document at
  // render, which means the switch cannot be React state and the field cannot
  // be mounted by an effect.
  it('server-renders BOTH panels and switches them in CSS, not in state', () => {
    expect(SEARCH).toContain('name="address"')
    expect(SEARCH).toContain('home-hero-search__panel-form--buy')
    expect(SEARCH).toContain('home-hero-search__panel-form--sell')
    expect(SEARCH).toContain('home-hero-search__mode--buy')
    expect(SEARCH).toContain('home-hero-search__mode--sell')
    // No tab state, and therefore no way to render one panel and not the other.
    expect(SEARCH).not.toMatch(/useState<HeroTab>/)
    expect(SEARCH).not.toMatch(/tab === 'buy' \?/)
    const css = readFileSync(resolve('app/_v3/home-hero-search.css'), 'utf8')
    expect(css).toContain('.v3 .home-hero-search__mode--buy:checked ~ .home-hero-search__panel-form--buy')
    expect(css).toContain('.v3 .home-hero-search__mode--sell:checked ~ .home-hero-search__panel-form--sell')
    // Hidden, never display:none: the switch stays on the tab order.
    expect(css).toContain('.v3 .home-hero-search__mode {')
    expect(css).toContain('clip-path: inset(50%)')
  })

  // 2026-09-08 evaluator: the tabs switched the form and left the copy alone,
  // so Sell mode read "Homes for sale in Central Oregon" over the visitor's own
  // address field. The copy switches with the panel now, in the same stylesheet,
  // and the page still ships exactly one h1 with the locked buyer line in it.
  it('switches the hero copy with the panel, and keeps one h1', () => {
    const STAGE = readFileSync(resolve('components/site/v3/V3Stage.tsx'), 'utf8')
    const STAGE_CSS = readFileSync(resolve('components/site/v3/V3Stage.css'), 'utf8')
    const css = readFileSync(resolve('app/_v3/home-hero-search.css'), 'utf8')

    expect(PAGE).toContain('altEyebrow="Selling in Central Oregon"')
    expect(PAGE).toContain('altHeadline="What is your home worth?"')
    // The locked buyer H1 is untouched, and it is still the only heading.
    expect(PAGE).toMatch(/headline=\{v3Text\('Homes for sale in Central Oregon'\)\}/)
    expect(STAGE).toContain('v3-stage-line--alt')
    expect(STAGE).toContain('v3-stage-eyebrow--alt')
    // A paragraph wearing the heading face — never a second h1 on the page.
    expect(STAGE).not.toMatch(/altHeadline[\s\S]{0,400}<V3Heading/)
    // Hidden by default, so a Stage with alt copy and no switch is still right.
    expect(STAGE_CSS).toContain('.v3 .v3-stage-eyebrow--alt,')
    expect(STAGE_CSS).toContain('.v3 .v3-stage-line--alt {')
    // The switch itself lives with the tabs that drive it.
    expect(css).toContain(
      '.v3 .v3-stage-copy:has(.home-hero-search__mode--sell:checked) .v3-stage-line--alt',
    )
    expect(css).toContain(
      '.v3 .v3-stage-copy:has(.home-hero-search__mode--sell:checked) .v3-stage-line:not(.v3-stage-line--alt)',
    )
  })

  it('both panels submit without JavaScript, to somewhere real', () => {
    expect(SEARCH).toContain("const BUY_ACTION = '/homes-for-sale'")
    expect(SEARCH).toContain("const SELL_ACTION = '/sell#get-value'")
    expect(SEARCH).toContain('action={BUY_ACTION}')
    expect(SEARCH).toContain('action={SELL_ACTION}')
    expect(SEARCH).toMatch(/method="get"[\s\S]*method="get"/)
    expect(SEARCH).toContain('name="q"')
  })

  it('uses the /sell address field itself, never a second address input', () => {
    expect(SEARCH).toContain("import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'")
    expect(SEARCH).toContain('<AddressAutocomplete')
    const SELL_FORM = readFileSync(resolve('app/sell/_v3/SellValueForm.tsx'), 'utf8')
    expect(SELL_FORM).toContain("import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'")
    // …and what the hero hands it is what /sell opens with.
    expect(SELL_FORM).toContain("new URLSearchParams(window.location.search).get('address')")
  })

  it('stamps the hero as the ask source so a home-started valuation is countable', () => {
    expect(SEARCH).toContain("markAskSource('hero')")
    expect(SEARCH).toContain("trackEvent('address_submit', { form: 'get-value', surface: 'home_hero' })")
    expect(SEARCH).toContain("trackEvent('search'")
    expect(SEARCH).toContain("surface: 'home_hero'")
  })

  it('empty submit opens the regional list, not a dead form', () => {
    expect(SEARCH).toContain('publishRegionalSearchHref()')
  })

  it('does not print leftover Search homes on the Stage; label is visible (H2)', () => {
    expect(SEARCH).not.toContain('>Search homes<')
    expect(SEARCH).toContain('home-hero-search__label')
    expect(SEARCH).toContain('Find a home')
    expect(SEARCH).not.toContain('aria-label="Search city, community, or address"')
  })

  it('paints the search as cream field and navy Search wherever the v3 root hosts it', () => {
    const css = readFileSync(resolve('app/_v3/home-hero-search.css'), 'utf8')
    const morph = readFileSync(resolve('components/site/v3/V3MorphSearch.css'), 'utf8')
    expect(css).toContain('.v3 .home-hero-search__input')
    expect(css).toContain('color: var(--v3-ink)')
    expect(css).toContain('-webkit-appearance: none')
    expect(morph).toContain('.v3 .v3-morph-search__shell')
    expect(morph).toContain('background: var(--v3-surface)')
    expect(morph).toContain('.v3 .v3-morph-search__go')
    expect(morph).toContain('background: var(--v3-ink)')
    expect(morph).toContain('color: var(--v3-ink-on-navy)')
  })
})

describe('homepage plain buyer copy', () => {
  it('drops mannered door and proof filler', () => {
    expect(PAGE).not.toContain('Start with what you came to do')
    expect(PAGE).not.toContain('Find your place')
    expect(PAGE).not.toContain('Meet our team')
    expect(PAGE).not.toContain('Income property, with the math')
    expect(PAGE).not.toContain('in full, as written')
    expect(PAGE).not.toContain('see what your home is worth')
    expect(PAGE).toContain('Buy, sell, or work with us')
    expect(PAGE).toContain('Written valuation in 24 hours')
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
    expect(RAIL_CLIENT).toContain('tags={card.badges}')
    expect(RAIL_ITEMS).toContain('publishListingCardBadges')
    expect(RAIL_ITEMS).toContain('openHouseLabel')
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

  it('opens Stage → rails → featured community → Doors → faces → places → proof (expanded Home lock)', () => {
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
    expect(PAGE).toMatch(/<HomeBrowsePlaces/)
    expect(PAGE).not.toMatch(/<V3Quiet/)
    expect(PAGE).toMatch(/id="places"/)
    expect(PLACES).toMatch(/id = 'places'/)
    expect(PLACES).toMatch(/id=\{id\}/)
    expect(PLACES).toMatch(/Browse places/)
    expect(PLACES).toMatch(/home-browse-places__chips/)
    expect(PLACES).toMatch(/home-browse-places__chip/)
    expect(PLACES).not.toMatch(/markSrc/)
    expect(PLACES).not.toMatch(/home-browse-places__mark/)
    expect(PAGE).not.toMatch(/markSrc/)
    expect(PAGE).toContain('attachListingCardExtras')
    expect(PAGE).toContain('enrichHomeRailRows')
    expect(RAIL_CLIENT).toContain('ListingTourOverlay')
    expect(RAIL_CLIENT).toContain('SPLIT_CARD_MEDIA_SIZES_RAIL')
    expect(RAIL_ITEMS).toContain('LISTING_FIELD_LEAD_PHOTO_SIZE')
    expect(PLACES).not.toMatch(/v3-quiet__/)
    expect(PAGE).toMatch(/Talk to a broker/)
    expect(PAGE).toMatch(/Buy a home/)
    expect(PAGE).toMatch(/Sell a home/)
    expect(PAGE).toMatch(/Work with us/)
    expect(PAGE).toMatch(/href: '\/join'/)
    expect(PAGE).not.toMatch(/Income property/)
    expect(PAGE).not.toMatch(/kicker: v3Text\('Invest'\)/)
    expect(PAGE).not.toMatch(/See what your home is worth/)
    expect(PAGE).not.toMatch(/<SellCapture/)
    expect(PAGE).not.toMatch(/id="communities"/)
    expect(PAGE).toMatch(/HomeFeaturedCommunity/)
    expect(PAGE).toMatch(/loadHomeFeaturedCommunitySlides/)
        expect(PAGE).toMatch(/featured-community/)
    // Always mount — never omit #featured-community when slides miss.
    expect(PAGE).not.toMatch(/featuredCommunitySlides\.length > 0 \?/)
    expect(PAGE).toMatch(/pictogram: 'buy'/)
    expect(PAGE).toMatch(/pictogram: 'work'/)
    expect(PAGE).toMatch(/loadOpenHouseBadgeLabels/)
    expect(PAGE).toMatch(/openHouseLabels/)
    expect(PAGE).not.toMatch(/getPublicPlaceSegments/)
    expect(PAGE).not.toMatch(/bend-drake-park-aerial\.jpg/)
    expect(PAGE).not.toMatch(/tetherow-golf-aerial\.jpg/)
    expect(PAGE).not.toMatch(/smith-rock-terrebonne\.jpg/)
    expect(PAGE).toMatch(/pictogram: 'buy'/)
    expect(PAGE).not.toMatch(/\/images\/homepage\/doors\/buy\.png/)
    const stageAt = PAGE.indexOf('<V3Stage')
    const railsAt = PAGE.indexOf('<HomeHomesRails')
    const featuredAt = PAGE.indexOf('<HomeFeaturedCommunity')
    const doorsAt = PAGE.indexOf('<V3Doors')
    const facesAt = PAGE.indexOf('Talk to a broker')
    const placesAt = PAGE.indexOf('<HomeBrowsePlaces')
    const proofAt = PAGE.indexOf('<V3Proof')
    expect(stageAt).toBeGreaterThan(-1)
    expect(railsAt).toBeGreaterThan(stageAt)
    expect(featuredAt).toBeGreaterThan(railsAt)
    expect(doorsAt).toBeGreaterThan(featuredAt)
    expect(facesAt).toBeGreaterThan(doorsAt)
    expect(placesAt).toBeGreaterThan(facesAt)
    expect(proofAt).toBeGreaterThan(placesAt)
  })

  // 2026-09-08 evaluator: #places was twelve identical empty boxes with nothing
  // telling a town from a resort. Two labelled runs now, and the town run
  // carries the same live active count /cities publishes per city.
  it('browses places as two labelled runs, with the live count on the towns', () => {
    expect(PAGE).toMatch(/<HomeBrowsePlaces[^>]*runs=\{placeRuns\}/)
    expect(PAGE).toContain("name: 'Towns'")
    expect(PAGE).toContain("name: 'Resorts and communities'")
    expect(PAGE).toContain("unit: 'houses for sale'")
    expect(PAGE).toContain("seeAll: { label: 'Every city', href: '/cities' }")
    expect(PAGE).toContain("seeAll: { label: 'Every community', href: '/communities' }")
    // Section 0: a null or non-finite activeCount prints nothing, never a zero.
    expect(PAGE).toContain("typeof active === 'number' && Number.isFinite(active)")
    expect(PLACES).toMatch(/home-browse-places__run\b/)
    expect(PLACES).toMatch(/home-browse-places__runname/)
    expect(PLACES).toMatch(/home-browse-places__unit/)
    expect(PLACES).toMatch(/home-browse-places__count/)
    // The resorts run ships no figure at all — this page holds no per-resort read.
    expect(PAGE).toMatch(/RESORT_DOORS\.map\(\(r\) => \(\{ label: r\.label, href: r\.href \}\)\)/)
  })

  it('does not print the regional remainder paragraph', () => {
    expect(PAGE).not.toContain('townRemainder')
    expect(PAGE).not.toContain('namePulseCityRemainder')
    expect(PAGE).not.toContain('Also in the leftover regional count')
    expect(PAGE).not.toContain('Also in the regional count')
  })
})
