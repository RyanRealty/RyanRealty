import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { communityImage } from '@/lib/geo-images'
import type { ListingTile } from '@/lib/data/types/listing'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import {
  nbhFieldItems,
  neighborhoodAboutItems,
  neighborhoodFieldCaption,
  neighborhoodHeadline,
  neighborhoodMarketTrace,
} from '@/app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections'
import { dailyLifeRows } from '@/app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-daily-life'
import {
  belongingCaption,
  belongingFigures,
  belongingHeadline,
  communityFieldItems,
  stagePoster,
} from '@/app/communities/[slug]/_v3/community-opening'
import { belongingLine, resortIndexRow } from '@/app/communities/_v3/community-index-rows'
import { homesLedgerTrace } from '@/app/subdivisions/[slug]/_v3/subdivision-traces'
import { platHomesMode, toLedgerRows, type FieldEntry } from '@/app/subdivisions/[slug]/_v3/subdivision-rows'

const links = {
  browse: '/homes-for-sale/bend',
  cityReport: '/housing-market/bend',
  monthsOfSupply: '/months-of-supply',
}

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    listPrice: 500000,
    streetNumber: '100',
    streetName: 'Main',
    streetSuffix: 'St',
    city: 'Bend',
    photoUrl: null,
    lat: 44.05,
    lng: -121.3,
    beds: 3,
    baths: 2,
    sqft: 1800,
    subdivisionName: 'Tetherow',
    ...partial,
  } as ListingTile
}

describe('city opening', () => {
  const page = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')

  it('draws leftover MOS in the city hero, not a listing_tile_mv count', () => {
    expect(page).toMatch(/buildPlaceMosView\(\{/)
    expect(page).toMatch(/grain: 'city'/)
    expect(page).toMatch(/<PlaceAreaHero posterSrc=\{stagePosterSrc\} mos=\{placeMos\} \/>/)
    expect(page).toMatch(/types=\{alertTypes\}/)
    expect(page).toMatch(/getPlaceOpeningListings\(\{ city: cityName \}\)/)
    expect(page).not.toMatch(/listing_tile_mv[\s\S]{0,80}monthsSupply/)
  })

  it('opens on leftover city face + PlaceSplitView, not Stage or CityHomesField', () => {
    expect(page).toMatch(/place-opening--media/)
    expect(page).toMatch(/leftoverHudKpis\(\{/)
    expect(page).toMatch(/publishPlaceFace\(\{\s*grain:\s*'city',/)
    expect(page).toMatch(/const headline = `\$\{cityName\} real estate`/)
    expect(page).not.toMatch(/<PlaceFaceStrip/)
    expect(page).toMatch(/<PlaceSplitView/)
    expect(page).toMatch(/getBoundaryGeoJSON\(\{\s*geoType:\s*'city'/)
    expect(page).not.toMatch(/<CityHomesField/)
    expect(page).not.toMatch(/<V3Stage/)
    expect(page).not.toMatch(/searchParams[^;]{0,80}shapes/)
    expect(page).not.toMatch(/\b728\b|\$760k/)
    expect(page).toMatch(/getCityDetachedMarket\(slug\)/)
    expect(page).toMatch(/getCityDetachedInventory\(slug\)/)
    expect(page).toMatch(/getPublicDetachedPace\(\{\s*geoType:\s*'city',\s*geoSlug:\s*slug/)
  })

  it('does not re-ask the market question the hero already answered', () => {
    expect(page).toMatch(/const marketHeadline = `Typical price in \$\{cityName\}`/)
    expect(page).not.toMatch(/Is \$\{cityName\} a buyer's or seller's market\?/)
    expect(page).toMatch(/placeMedianChartCaption\(cityName\)/)
    expect(page).toMatch(/browsePath: homesForSalePath\(cityName\)/)
    expect(page).toMatch(/layout="pulse"/)
  })

  it('folds leftover market figures behind the one cost chart and does not title the about as in plain words', () => {
    expect(page).toMatch(/chartFirst/)
    expect(page).toMatch(/foldAfter=\{0\}/)
    expect(page).toMatch(/cityVerdictCaption/)
    expect(page).not.toMatch(/in plain words/)
  })
})

describe('neighborhood opening MOS', () => {
  const page = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')

  it('adds the MOS overlay from leftover HUD, not a second valuation card', () => {
    expect(page).toMatch(/buildPlaceMosView\(\{/)
    expect(page).toMatch(/grain: 'neighborhood'/)
    expect(page).toMatch(/<PlaceAreaHero posterSrc=\{stagePosterSrc\} mos=\{placeMos\} \/>/)
    expect(page).not.toMatch(/<V3PlaceValue/)
    expect(page).not.toMatch(/<V3PlaceDoor/)
  })
})

describe('neighborhood pace', () => {
  // The pulse-figure builders (liveFigures, liveFallbackFigures) are gone with
  // the 2026-08-26 barrel migration: neighborhood is a sold-attribution
  // UNTRUSTED grain (lib/market/geo-grain-trust.ts), so every market figure
  // now comes off leftoverHudKpis through the shared leftoverMarketFigures
  // builder, whose MoS is already publish-gated upstream. What is tested here
  // is what stayed neighborhood-shaped: the Field rows, the caption's grain,
  // and the trace's clause discipline.

  it('caption names the neighborhood and states the cap when it binds', () => {
    expect(
      neighborhoodFieldCaption({ placeName: 'Awbrey Butte', count: 24, totalQualifying: 62 }),
    ).toBe('The 24 highest-priced single-family listings in Awbrey Butte')
    expect(
      neighborhoodFieldCaption({ placeName: 'Awbrey Butte', count: 9, totalQualifying: 9 }),
    ).toBe('9 single-family homes for sale in Awbrey Butte')
    expect(neighborhoodFieldCaption({ placeName: 'Awbrey Butte', count: 0, totalQualifying: 0 })).toBeNull()
  })

  it('headline is the neighborhood name', () => {
    expect(neighborhoodHeadline('Awbrey Butte')).toBe('Awbrey Butte')
  })

  it('about is one paragraph', () => {
    expect(
      neighborhoodAboutItems({
        curatedProse: ['First.', 'Second.'],
        description: 'Fallback.',
        cityName: 'Bend',
      }),
    ).toEqual([{ kind: 'prose', body: 'First.' }])
  })

  it('recites the MoS clauses only beside a published supply figure', () => {
    const withMos = neighborhoodMarketTrace('Awbrey Butte', true)
    const withoutMos = neighborhoodMarketTrace('Awbrey Butte', false)
    expect(withMos).toMatch(/Months of supply/)
    expect(withoutMos).not.toMatch(/seller's|buyer's|balanced|threshold/)
    expect(withoutMos).toMatch(/Awbrey Butte/)
  })

  it('keeps the counted set even when a tile has no photograph', () => {
    const items = nbhFieldItems([
      {
        listingKey: 'a',
        listNumber: '1',
        listPrice: 800_000,
        beds: 3,
        baths: 2,
        sqft: 1800,
        streetNumber: '10',
        streetName: 'Pine',
        city: 'Bend',
        subdivisionName: 'Awbrey Butte',
        photoUrl: 'https://img.example/house.jpg',
        lat: 44.1,
        lng: -121.3,
      },
      {
        listingKey: 'b',
        listNumber: '2',
        listPrice: 900_000,
        beds: 4,
        baths: 3,
        sqft: 2200,
        streetNumber: '11',
        streetName: 'Pine',
        city: 'Bend',
        subdivisionName: 'Awbrey Butte',
        photoUrl: null,
        lat: 44.1,
        lng: -121.3,
      },
    ])
    // Both qualify (price + street). Highest price first; the photo rides when
    // it exists and its absence never drops a counted home.
    expect(items).toHaveLength(2)
    expect(items[0]?.title).toBe('11 Pine, Bend')
    expect(items[0]?.photoSrc).toBeUndefined()
    expect(items[1]?.photoSrc).toBe('https://img.example/house.jpg')
    expect(items[1]?.title).toBe('10 Pine, Bend')
  })

  it('drops a home with no list price or no street', () => {
    const items = nbhFieldItems([
      {
        listingKey: 'a',
        listNumber: '1',
        listPrice: null,
        beds: 3,
        baths: 2,
        sqft: 1800,
        streetNumber: '10',
        streetName: 'Pine',
        city: 'Bend',
        subdivisionName: 'Awbrey Butte',
        photoUrl: null,
        lat: 44.1,
        lng: -121.3,
      },
    ])
    expect(items).toEqual([])
  })
})

describe('neighborhood daily life', () => {
  it('opens Awbrey Butte on High Lakes, Cascade, and Summit, not golf or /parks stubs', async () => {
    const content = await getResortCommunityContent('bend-awbrey-butte')
    const rows = dailyLifeRows(content, 'Bend')
    const names = rows.map((row) => String(row.what))
    expect(names).toContain('High Lakes Elem')
    expect(names).toContain('Cascade Middle')
    expect(names).toContain('Summit High')
    expect(names).not.toContain('Sylvan Park')
    expect(names).not.toContain('Summit Park')
    expect(names.some((name) => /golf|membership/i.test(name))).toBe(false)
    expect(rows.every((row) => row.href !== '/parks')).toBe(true)
    expect(rows.find((row) => String(row.what) === 'High Lakes Elem')?.href).toBe('/schools/high-lakes-elem')
  })
})

describe('master-plan opening', () => {
  const content = {
    membershipTiers: [{ name: 'Golf' }, { name: 'Social' }],
    hoaMasterAnnual: 2400,
    acres: 700,
    amenities: [{ name: 'Golf course' }],
  } as ResortCommunityContent

  it('uses the owned Tetherow aerial, never an invented photo', () => {
    const owned = communityImage('tetherow')
    expect(owned).toBeTruthy()
    expect(owned).toMatch(/tetherow/)
    expect(stagePoster('tetherow')).toBe(owned)
    expect(stagePoster('no-such-community')).toBeNull()
    expect(stagePoster('tetherow', 'https://cdn.example/live.jpg')).toBe('https://cdn.example/live.jpg')
    expect(stagePoster('no-such-community', 'https://cdn.example/live.jpg')).toBe(
      'https://cdn.example/live.jpg',
    )
    expect(stagePoster('tetherow', null, 'https://cdn.example/library.jpg')).toBe(
      'https://cdn.example/library.jpg',
    )
    expect(stagePoster('tetherow', 'https://cdn.example/live.jpg', 'https://cdn.example/library.jpg')).toBe(
      'https://cdn.example/live.jpg',
    )
    expect(
      stagePoster(
        'tetherow',
        'https://cdn.example/etherow-monument-crop.jpg',
        'https://cdn.example/imagine-place-community-tetherow.png',
      ),
    ).toBe('https://cdn.example/imagine-place-community-tetherow.png')
  })

  it('names the place in the heading and leaves belonging to the figures', () => {
    // The H1 is the community's name, the same shape every other place grain
    // uses. It must never be a belonging fact: this page headlined "Master HOA
    // is $4,380 a year." on Caldera Springs and "Membership is separate from
    // the home." on Tetherow and Black Butte Ranch, live (Matt 2026-08-27).
    expect(belongingHeadline('Tetherow', content)).toBe('Tetherow homes for sale')
    expect(belongingHeadline('Caldera Springs', content)).toBe('Caldera Springs homes for sale')
    expect(belongingHeadline('Black Butte Ranch', null)).toBe('Black Butte Ranch homes for sale')
    // the belonging facts are still published — beside the heading, as figures
    expect(belongingFigures(content).map((figure) => figure.label)).toEqual([
      'master HOA a year',
      'membership tiers',
      'acres',
    ])
    expect(belongingCaption(belongingFigures(content))).toBe(
      '$2,400 master HOA a year. 2 membership tiers. 700 acres',
    )
  })

  it('wires MOS and the activity spark on the valuation card', () => {
    const page = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
    expect(page).toMatch(/buildPlaceMosView\(\{/)
    expect(page).toMatch(/grain: 'community'/)
    expect(page).toMatch(/mos=\{placeMos\}/)
    expect(page).toMatch(/activity=\{placeActivitySpark\}/)
    expect(page).toMatch(/buildSparkPlot/)
  })

  it('puts belonging on the still as a caption, then Atlas, then one sold chart', () => {
    const page = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
    expect(page).toMatch(/belongingCaption\(/)
    expect(page).toMatch(/place-opening__caption/)
    expect(page).not.toMatch(/id="facts"/)
    expect(page).toMatch(/<V3Atlas/)
    expect(page).toMatch(/placeMedianChart\(/)
    expect(page).toMatch(/chartFirst/)
    expect(page).toMatch(/foldAfter=\{0\}/)
    expect(page.indexOf('place-opening__caption')).toBeLessThan(page.indexOf('<V3Atlas'))
    expect(page.indexOf('<V3Atlas')).toBeLessThan(page.indexOf('id="market"'))
    expect(page.indexOf('id="subdivisions"')).toBeLessThan(page.indexOf('id="market"'))
    expect(page).not.toMatch(/cityStagePoster\(cityHeroes/)
  })

  it('keeps the counted set even when a tile has no photograph', () => {
    const items = communityFieldItems(
      [tile({ listingKey: 'a', photoUrl: null }), tile({ listingKey: 'b', photoUrl: 'https://img.example/h.jpg' })],
      24,
    )
    expect(items).toHaveLength(2)
    expect(items[0]?.photoSrc).toBeUndefined()
    expect(items[1]?.photoSrc).toBe('https://img.example/h.jpg')
  })
})

describe('place door (SITE-03, city grain only this round)', () => {
  const cityPage = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
  const nbhPage = readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8')
  const communityPage = readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8')
  const subdivisionPage = readFileSync(resolve('app/subdivisions/[slug]/page.tsx'), 'utf8')
  const cityStrip = readFileSync(resolve('app/cities/[slug]/_v3/CityAlertSheet.client.tsx'), 'utf8')
  const primitive = readFileSync(resolve('components/site/v3/V3PlaceDoor.tsx'), 'utf8')
  const doorCss = readFileSync(resolve('components/site/v3/V3PlaceDoor.css'), 'utf8')
  const openingCss = readFileSync(resolve('components/place/place-opening.css'), 'utf8')

  it('mounts the door under the city H1, off the face the page already publishes', () => {
    expect(cityPage).toMatch(/<V3PlaceDoor/)
    // The door reads the face this page already computed, under the city grain,
    // which derives the trace. A NEW market read for the opening is the thing
    // this node was not allowed to add.
    expect(cityPage).toMatch(/publishPlaceDoor\(\{\n\s+face,\n\s+grain: 'city',\n\s+placeName: cityName,/)
    expect(cityPage).not.toMatch(/\.from\('market_stats_cache'\)/)
    expect(cityPage).not.toMatch(/\.from\('market_pulse_live'\)/)
    // It sits inside the opening's copy block, after the heading.
    expect(cityPage.indexOf('place-opening__copy')).toBeLessThan(cityPage.indexOf('<V3PlaceDoor'))
    expect(cityPage.indexOf('<V3Heading level={1}')).toBeLessThan(cityPage.indexOf('<V3PlaceDoor'))
    // The page hands in no trace it built beside the call.
    expect(cityPage).not.toMatch(/placeDoorTrace/)
  })

  it('does NOT mount the door on the neighborhood, community or subdivision openings', () => {
    // Decided 2026-09-08: SITE-03 ships on the city grain only this round. At
    // community grain the door's boundary-membership count can exceed the
    // destination search's City+SubdivisionName count (a section 0
    // contradiction one click apart), and three grains wearing one first
    // screen is a PUBLIC_UI section 3 lock break that needs the owner's
    // decision. Those questions sit on the node, not in code. The publisher
    // stays grain-aware so a later round can wire it without redesign; no
    // sub-city page imports it now, and this test locks that.
    for (const page of [nbhPage, communityPage, subdivisionPage]) {
      expect(page).not.toMatch(/<V3PlaceDoor/)
      expect(page).not.toMatch(/publishPlaceDoor/)
      expect(page).not.toMatch(/publish-place-door/)
    }
  })

  it('states the verdict ONCE on the city page, in the caption and not on the door', () => {
    expect(cityPage).toMatch(/cityVerdictCaption/)
    // The door comes first, then the line that states the supply figure and the
    // verdict. The door itself carries neither.
    expect(cityPage.indexOf('<V3PlaceDoor')).toBeLessThan(cityPage.indexOf('place-opening__caption'))
    expect(cityPage).not.toMatch(/verdict=\{placeDoor/)
  })

  it('gives the primitive no way to render a second figure or a verdict', () => {
    // The primitive can only render what its props allow. No verdict, no
    // median, no months of supply, no days-to-pending prop exists, so neither
    // the strip nor the duplicated verdict can be built.
    expect(primitive).toMatch(/count: string/)
    expect(primitive).toMatch(/countLabel: string/)
    // No verdict PROP and no verdict markup. The words survive in the header
    // comment that explains why the prop is gone; the type and the JSX do not.
    expect(primitive).not.toMatch(/verdict\??: string/)
    expect(primitive).not.toMatch(/v3-place-door__verdict/)
    expect(primitive).not.toMatch(/\{verdict/)
    expect(primitive).not.toMatch(/medianList|monthsOfSupply|daysToPending/)
    // The trace is the existing atom, never a new trace control.
    expect(primitive).toMatch(/V3SourceDisclosure/)
    // No formatting inside the primitive (ci:public-v3 rule 3).
    expect(primitive).not.toMatch(/toLocaleString|Intl\.NumberFormat|toLocaleDateString/)
  })

  it('uses the site freshness idiom, not a stamp of its own', () => {
    expect(primitive).toMatch(/updated \$\{stamp\}/)
    expect(doorCss).not.toMatch(/text-transform: uppercase/)
    expect(doorCss).not.toMatch(/v3-place-door__read/)
  })

  it('does not paint a surface over the opening photograph', () => {
    // The wrapper carries V3_ROOT_CLASS, and `.v3` in tokens.css sets a cream
    // background. Unset it, or the door slabs a band across the still and its
    // own on-media (white) lines land on cream.
    expect(doorCss).toMatch(/\.v3\.v3-place-door \{[^}]*background: transparent;/)
  })

  it('stamps the door with the read that made the count', () => {
    // The city count and its stamp both come off leftover Market Truth
    // (leftoverStamp is that read's own computed_at); nothing borrowed.
    expect(cityPage).toMatch(/readDate: leftoverStamp \? formatDate\(leftoverStamp\) : null,/)
  })

  it('keeps ONE filled control in the first viewport, and never none', () => {
    // The door is the fold's primary, so the alerts strip that mounts right
    // after the opening steps down, but ONLY when a door actually rendered. A
    // city whose Market Truth read withheld the active count draws no door,
    // and an unconditional ghost would ship that fold with no filled control.
    expect(cityStrip).toMatch(/emphasis=\{demote \? 'ghost' : 'primary'\}/)
    expect(cityStrip).not.toMatch(/emphasis="ghost"/)
    expect(cityStrip).not.toMatch(/emphasis="primary"/)
    expect(cityPage).toMatch(/<CityAlertsStrip[\s\S]{0,700}demote=\{placeDoor != null\}/)
    expect(cityPage.indexOf('<V3PlaceDoor')).toBeLessThan(cityPage.indexOf('<CityAlertsStrip'))
  })

  it('owns the browse destination: the market Instrument draws no second filled button to the same href', () => {
    // /cities/bend rendered the door at /homes-for-sale/bend AND, inside
    // .v3-instrument__action, a second v3-btn--primary at the identical href
    // ("See every Bend home for sale"). One destination, one filled control.
    const instrumentAction = cityPage.match(
      /action=\{\{\n\s+label: v3Text\(`See every \$\{cityName\} home for sale`\),\n\s+href: homesForSalePath\(cityName\),\n\s+variant: '(\w+)',/,
    )
    expect(instrumentAction?.[1]).toBe('ghost')
    // And no other filled action is written anywhere in the page source.
    expect(cityPage).not.toMatch(/variant: 'primary'/)
    expect(cityPage).not.toMatch(/variant="primary"/)
  })

  it('keeps the count subordinate to the H1 and the arrow beside the label', () => {
    // (c) The place leads the Stage, not the number. For one round the numeral
    // wore --v3-size-num-lead because the alerts strip's count beneath it
    // measured 55px against the door's 30px; at the lead size it measured 55px
    // against the H1's 27px cap and the Stage had become a number hero, which
    // PUBLIC_UI section 3 forbids. The door is a control naming one fact on its
    // way somewhere: it wears --v3-size-num and never the lead size.
    expect(doorCss).toMatch(/\.v3-place-door__count \{[^}]*font-size: var\(--v3-size-num\);/)
    // The comment above the rule may name the lead token as history; the rule may not.
    expect(doorCss).not.toMatch(/font-size: var\(--v3-size-num-lead\)/)
    // (a) place-opening.css makes the plate full-width under 40rem, so the label
    // must not own the flexible track or the arrow lands at the far edge: the
    // slack trails the arrow.
    expect(openingCss).toMatch(/@media \(max-width: 39\.99rem\) \{[\s\S]*?\.v3-place-door \.v3-btn \{\s*width: 100%;/)
    expect(doorCss).toMatch(/\.v3-place-door__door \{[^}]*grid-template-columns: auto auto 1fr;/)
    expect(doorCss).not.toMatch(/grid-template-columns: auto minmax\(0, 1fr\) auto/)
    expect(doorCss).toMatch(/\.v3-place-door__arrow \{[^}]*justify-self: start;/)
    // The plate's floor and corner stay the atom's and the register's: no
    // literal radius, no raw color, no min-height of its own.
    expect(doorCss).not.toMatch(/border-radius:\s*\d/)
    expect(doorCss).not.toMatch(/min-height:/)
    expect(doorCss).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })
})

describe('communities index rows', () => {
  it('puts the live count on the door and belonging in the detail', () => {
    const content = {
      membershipTiers: [{ name: 'Golf membership' }],
      amenities: [{ name: '18-hole course' }],
    } as ResortCommunityContent
    expect(belongingLine(content)).toBe('Golf membership. 18-hole course.')
    const row = resortIndexRow({
      slug: 'tetherow',
      name: 'Tetherow',
      city: 'Bend',
      belonging: belongingLine(content),
      photoSrc: communityImage('tetherow'),
      activeCount: 17,
      medianLine: 'Median list $1,200,000',
    })
    expect(row?.what).toBe('Tetherow')
    expect(row?.value).toBe('17 for sale')
    expect(row?.detail).toBe('Median list $1,200,000 · Golf membership. 18-hole course.')
    expect(row?.href).toBe('/communities/tetherow')
  })
})

describe('subdivision ledger', () => {
  it('treats a timed-out count as unknown, not a giant zero', () => {
    expect(platHomesMode({ activeCount: null, homeRows: 0, pinCount: 0 })).toBe('unknown')
    expect(platHomesMode({ activeCount: 0, homeRows: 0, pinCount: 0 })).toBe('empty')
    expect(platHomesMode({ activeCount: 6, homeRows: 6, pinCount: 6 })).toBe('field')
    expect(platHomesMode({ activeCount: 2, homeRows: 2, pinCount: 2 })).toBe('ledger')
  })

  it('keeps address and price as the row, with a photo when one exists', () => {
    const item: FieldEntry = {
      id: 'a',
      href: '/homes-for-sale/listing/1',
      title: '12 Sunrise Loop',
      priceLabel: '$895,000',
      meta: '3 bd · 2 ba',
      photoSrc: 'https://img.example/h.jpg',
      lat: 44.1,
      lng: -121.3,
    }
    const [row] = toLedgerRows([item])
    expect(row?.what).toBe('12 Sunrise Loop')
    expect(row?.value).toBe('$895,000')
    expect(row?.media?.src).toBe('https://img.example/h.jpg')
  })

  it('keeps the homes trace to one line without methodology thresholds', () => {
    const trace = homesLedgerTrace({ kind: 'boundary', displayName: 'Sunrise Village' })
    expect(trace).toMatch(/Sunrise Village/)
    expect(trace.split('.').length).toBeLessThanOrEqual(3)
    expect(trace).not.toMatch(/methodology|threshold|seller's|buyer's/)
  })
})
