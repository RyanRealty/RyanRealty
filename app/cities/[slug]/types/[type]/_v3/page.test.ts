import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cityTypeMetaWhere,
  cityTypeScopeNote,
  placeTypeAtlasEyebrow,
  placeTypeClaim,
  placeTypeMetadataCopy,
  resolvePlaceTypePage,
} from '@/lib/place/place-type-page'
import {
  PLACE_TYPE_SORTS,
  isPlaceTypeSort,
  placeTypeSortFromSearch,
  sortPlaceTypeRows,
} from '@/lib/place/place-type-sort'
import type { V3ListingRowData } from '@/components/site/v3'

const CITY = readFileSync(resolve('app/cities/[slug]/types/[type]/page.tsx'), 'utf8')
const COMM = readFileSync(resolve('app/communities/[slug]/types/[type]/page.tsx'), 'utf8')
const FIELD = readFileSync(
  resolve('app/cities/[slug]/types/[type]/_v3/PlaceTypeField.client.tsx'),
  'utf8',
)
const SECTION = readFileSync(
  resolve('app/cities/[slug]/types/[type]/_v3/PlaceTypeAtlasSection.tsx'),
  'utf8',
)
const ATLAS = readFileSync(resolve('components/site/v3/V3Atlas.client.tsx'), 'utf8')

describe('place-type pages', () => {
  it('404s unknown types and unknown places', () => {
    expect(CITY).toMatch(/resolvePlaceTypePage\(type\)/)
    expect(CITY).toMatch(/if \(!spec\) notFound\(\)/)
    expect(CITY).toMatch(/getGeoSnapshot\(\{ geoType: 'city', geoKey: slug \}\)/)
    expect(COMM).toMatch(/if \(!spec\) notFound\(\)/)
    expect(COMM).toMatch(/getCommunityBySlug\(slug\)/)
  })

  it('uses generateMetadata with a unique canonical path', () => {
    expect(CITY).toMatch(/export async function generateMetadata/)
    expect(CITY).toMatch(/path: `\/cities\/\$\{slug\}\/types\/\$\{spec\.slug\}`/)
    expect(COMM).toMatch(/path: `\/communities\/\$\{slug\}\/types\/\$\{spec\.slug\}`/)
  })

  it('opens on Type in Place, a claim, the atlas, photographed rows', () => {
    for (const src of [CITY, COMM]) {
      expect(src).toMatch(/placeTypeHeadline/)
      expect(src).not.toMatch(/<PlaceFaceStrip/)
      expect(src).toMatch(/<PlaceTypeAtlasSection/)
      expect(src).toMatch(/place-type-claim/)
      expect(src).toMatch(/id="homes"/)
      expect(src).toMatch(/<PlaceTypeRows/)
      expect(src).toMatch(/<V3Breadcrumb/)
      expect(src).toMatch(/label: cityName/)
      expect(src).not.toMatch(/label: 'Home'/)
    }
    expect(CITY).toMatch(/label: 'For sale'/)
    expect(COMM).toMatch(/label: 'For sale'/)
  })

  it('puts a shadcn carousel rail of photographed listings in the fold (SITE-106 / SITE-107)', () => {
    expect(CITY).toMatch(/<PlaceTypeFilm/)
    expect(CITY).toMatch(/from '\.\/_v3\/PlaceTypeFilm\.client'/)
    expect(COMM).toMatch(/<PlaceTypeFilm/)
    expect(COMM).toMatch(/from '\.\/_v3\/PlaceTypeFilm\.client'/)
    expect(COMM).toMatch(/bandLow=\{lowAsk\}/)
    expect(COMM).toMatch(/bandHigh=\{bandHigh\}/)
    expect(COMM).toMatch(/comm-type:p90/)
    expect(COMM).toMatch(/homes ask/)
    expect(COMM).toMatch(/for nine in ten/)
    const commFilm = readFileSync(
      resolve('app/communities/[slug]/types/[type]/_v3/PlaceTypeFilm.client.tsx'),
      'utf8',
    )
    expect(commFilm).toMatch(/import\s*\{[\s\S]*Carousel[\s\S]*\}\s*from\s*'@\/components\/ui\/carousel'/)
    expect(commFilm).toMatch(/CarouselPrevious/)
    expect(commFilm).toMatch(/CarouselNext/)
    expect(CITY).toMatch(/bandLow=\{lowAsk\}/)
    expect(CITY).toMatch(/bandHigh=\{bandHigh\}/)
    expect(CITY).toMatch(/listingsCount=\{activeCount\}/)
    const film = readFileSync(
      resolve('app/cities/[slug]/types/[type]/_v3/PlaceTypeFilm.client.tsx'),
      'utf8',
    )
    expect(film).toContain("from '@/components/ui/carousel'")
    expect(film).toMatch(/CarouselPrevious/)
    expect(film).toMatch(/CarouselNext/)
    expect(film).toMatch(/md:basis-1\/2/)
    expect(film).toMatch(/LISTING_FIELD_LEAD_PHOTO_SIZE/)
    expect(film).toMatch(/place-type-film__specs/)
    expect(film).toMatch(/place-type-film__addr/)
    expect(film).not.toMatch(/place-type-film__on-photo/)
    expect(film).not.toMatch(/V3Carousel/)
    expect(CITY).toMatch(/placeTypeAtlasEyebrow\(spec, false\)/)
  })

  it('claims count + useful band without repeating the H1 type (SITE-106)', () => {
    expect(CITY).toMatch(/formatPriceExact\(lowAsk\)/)
    expect(CITY).toMatch(/formatPriceExact\(bandHigh\)/)
    expect(CITY).toMatch(/city-type:p90/)
    expect(CITY).not.toMatch(/The map marks for-sale homes inside city limits/)
    // VOICE-7 (2026-09-22): the count names its population beside the number
    // ("758 homes for sale with a Bend address"), and the band is a sentence
    // ("Nine in ten ask between …") rather than "757 homes ask $X to $Y for
    // nine in ten". Claim body: count + "homes", not `${count} ${spec.nounMany}`.
    expect(CITY).toMatch(
      /\$\{activeCount\.toLocaleString\('en-US'\)\} homes for sale with a \$\{cityName\} address\. Nine in ten ask between/,
    )
    expect(CITY).toMatch(/scopeNote: cityTypeScopeNote\(cityName\)/)
    expect(CITY).toMatch(/where: cityTypeMetaWhere\(cityName\)/)
    // SEO increment lives in generateMetadata title + ItemList JSON-LD
    expect(CITY).toMatch(/activeCount\.toLocaleString\('en-US'\)/)
    expect(CITY).toMatch(/placeTypeSchemas/)
  })

  /**
   * THE BUG THE NODE EXISTS FOR. The Atlas used to be
   * `atlasRegions.length > 0 ? <V3Atlas/> : null`, so a guarded boundary read
   * that missed dropped the class's differentiator with no placeholder — the
   * 1440 capture of /communities/tetherow/types/single-family had no map while
   * the 375 capture of the same URL did. There is no ternary now: the section
   * is one Suspense boundary whose fallback and whose miss are both the
   * standin.
   */
  it('never lets the atlas section be absent', () => {
    for (const src of [CITY, COMM]) {
      expect(src).toMatch(/<Suspense[\s\S]*?fallback=\{[\s\S]*?<PlaceTypeAtlasStandin/)
      expect(src).toMatch(/state="loading"/)
      expect(src).not.toMatch(/atlasRegions\.length > 0/)
      expect(src).not.toMatch(/\?\s*<V3Atlas[\s\S]*?:\s*null/)
    }
    // and the resolved branch has a standin of its own when the read misses
    expect(SECTION).toMatch(/if \(!boundary\)/)
    expect(SECTION).toMatch(/state="unavailable"/)
    // unknown is not empty: ISR must not persist a mapless render (SITE-118)
    expect(SECTION).toMatch(/refuseDegradedIsr\(/)
    expect(SECTION).toMatch(/runPublishedPageRender\(/)
  })

  it('does not treat photographed list length as the count', () => {
    expect(CITY).toMatch(/listOk \? placeTypeListingRows/)
    for (const src of [CITY, COMM]) {
      expect(src).not.toMatch(/activeCount = rows\.length/)
      // ci:count-degraded-read — a guarded count must be able to say unknown
      expect(src).toMatch(/const activeCount: number \| null =/)
    }
  })

  /**
   * §0. The count and the price band describe the same set, so they come from
   * the same read. Bend single-family measured 2026-09-09: leftover market
   * truth 658 active, the tile MV 768 — a sentence mixing the two would put a
   * floor price on a set that never contained that listing.
   */
  it('sources the claim count and the band from one read', () => {
    for (const src of [CITY, COMM]) {
      expect(src).toMatch(/getListingTilesCount\(scope\)/)
      expect(src).toMatch(/sort: 'price-asc', limit: 1/)
      expect(src).toMatch(/sort: 'price-desc', limit: 1/)
      expect(src).toMatch(/scopeNote:/)
      // the metadata count is the same read, so the head cannot disagree with
      // the body (check-publish-place-index-truth's founding case)
      expect(src).toMatch(/getListingTilesCount\(/)
    }
    expect(CITY).not.toMatch(/leftoverHudKpis/)
    expect(COMM).not.toMatch(/leftoverHudKpis/)
  })

  it('the atlas opens under the H1 as an eyebrow, not a second display line', () => {
    for (const src of [CITY, COMM]) {
      expect(src).toMatch(/placeTypeAtlasEyebrow/)
    }
    expect(SECTION).toMatch(/headlineTone="eyebrow"/)
    expect(ATLAS).toMatch(/headlineTone\?: 'display' \| 'eyebrow'/)
    // the default is unchanged, so no other caller moves
    expect(ATLAS).toMatch(/headlineTone = 'display'/)
  })

  it('links the rows to the marks in both directions', () => {
    expect(ATLAS).toMatch(/linkedKey\?: string \| null/)
    expect(ATLAS).toMatch(/onLinkedKeyChange\?: \(key: string \| null\) => void/)
    expect(ATLAS).toMatch(/data-atlas-linked=/)
    expect(FIELD).toMatch(/onPointerEnter=\{\(\) => setLinkedKey\(listing\.listingKey\)\}/)
    expect(FIELD).toMatch(/onFocus=\{\(\) => setLinkedKey\(listing\.listingKey\)\}/)
    expect(FIELD).toMatch(/linkedKey=\{linkedKey\} onLinkedKeyChange=\{setLinkedKey\}/)
  })

  it('puts a sort above the list as real anchors', () => {
    for (const src of [CITY, COMM]) {
      expect(src).toMatch(/<PlaceTypeSortBar pagePath=\{pagePath\}/)
    }
    expect(FIELD).toMatch(/href=\{option\.key === 'newest' \? pagePath : `\$\{pagePath\}\?sort=\$\{option\.key\}`\}/)
    expect(FIELD).toMatch(/rel="nofollow"/)
    expect(FIELD).toMatch(/placeTypeSortFromSearch\(window\.location\.search\)/)
  })

  it('labels the list Homes for sale, not photographed listings', () => {
    for (const src of [CITY, COMM]) {
      expect(src).toMatch(/<V3Heading level=\{2\}>Homes for sale<\/V3Heading>/)
      expect(src).toMatch(/label: 'Homes for sale', href: '#homes'/)
      expect(src).toMatch(/ariaLabel="Homes for sale"/)
      expect(src).not.toMatch(/All photographed listings/)
      expect(src).not.toMatch(/ariaLabel="Photographed listings"/)
    }
  })
})

describe('placeTypeClaim', () => {
  const spec = resolvePlaceTypePage('single-family')!

  it('states the count and the band, exact, from one read', () => {
    const claim = placeTypeClaim({
      spec,
      placeName: 'Tetherow',
      inventory: {
        count: 16,
        low: 1_350_000,
        high: 4_250_000,
        stamp: 'Sep 9, 2026, 6:53 AM',
        scopeNote: 'in Tetherow',
      },
    })
    expect(claim?.sentence).toBe(
      '16 single-family homes for sale in Tetherow, asking $1,350,000 to $4,250,000.',
    )
    expect(claim?.source).toContain('in Tetherow')
    expect(claim?.source).toContain('Sep 9, 2026, 6:53 AM')
    // one line, not a paragraph: the trace names the set, the source, the time
    expect(claim?.source.split('. ').length).toBe(1)
    // never rounded: $474,500 as "$475K" is fine on a tile and wrong here
    expect(claim?.sentence).not.toMatch(/[\d.]+M|[\d.]+K/)
  })

  it('says one price when the band has one end', () => {
    const claim = placeTypeClaim({
      spec,
      placeName: 'Sisters',
      inventory: { count: 1, low: 900_000, high: 900_000, stamp: null, scopeNote: 'in Sisters' },
    })
    expect(claim?.sentence).toBe('1 single-family home for sale in Sisters, asking $900,000.')
  })

  it('omits rather than shipping half a claim', () => {
    const base = {
      count: 16,
      low: 1_350_000,
      high: 4_250_000,
      stamp: null,
      scopeNote: 'in Bend',
    }
    expect(placeTypeClaim({ spec, placeName: 'Bend', inventory: { ...base, count: null } })).toBeNull()
    expect(placeTypeClaim({ spec, placeName: 'Bend', inventory: { ...base, count: 0 } })).toBeNull()
    expect(placeTypeClaim({ spec, placeName: 'Bend', inventory: { ...base, low: null } })).toBeNull()
    expect(placeTypeClaim({ spec, placeName: 'Bend', inventory: { ...base, high: null } })).toBeNull()
    // a band that runs backwards is a bad read, not a claim
    expect(
      placeTypeClaim({ spec, placeName: 'Bend', inventory: { ...base, low: 5_000_000 } }),
    ).toBeNull()
  })
})

describe('city type page population words (VOICE-7)', () => {
  const spec = resolvePlaceTypePage('single-family')!

  it('names the MLS-address population and the under-contract listings it includes', () => {
    const claim = placeTypeClaim({
      spec,
      placeName: 'Bend',
      inventory: { count: 758, low: 379_500, high: 2_125_000, stamp: null, scopeNote: cityTypeScopeNote('Bend') },
    })
    expect(claim?.source).toBe(
      'Every active single-family home with a Bend address, including any already under contract that are still listed, from the regional MLS through Oregon Data Share',
    )
  })

  it('says where the counted homes are, and that under-contract ones count, in the meta description', () => {
    const copy = placeTypeMetadataCopy({ spec, placeName: 'Bend', count: 758, where: cityTypeMetaWhere('Bend') })
    expect(copy.description).toBe(
      '758 single-family homes for sale with a Bend, Oregon address, including any under contract. Live list prices from the regional MLS.',
    )
    // without `where`, the community pages read exactly as before
    expect(placeTypeMetadataCopy({ spec, placeName: 'Tetherow', count: 16 }).description).toBe(
      '16 single-family homes for sale in Tetherow, Oregon. Live list prices from the regional MLS.',
    )
  })
})

describe('placeTypeAtlasEyebrow', () => {
  const spec = resolvePlaceTypePage('single-family')!
  it('names the type when the dots are that type, and does not when they are not', () => {
    expect(placeTypeAtlasEyebrow(spec, true)).toBe('Single-family on the map')
    expect(placeTypeAtlasEyebrow(spec, false)).toBe('Listings on the map')
  })

  it('says what the map counts when that is not what the claim counts', () => {
    // Bend: the claim counts 768 with a Bend address, the map clips to the
    // recorded boundary and its legend says 493. Two facts, labelled.
    expect(placeTypeAtlasEyebrow(spec, true, 'inside the Bend city limits')).toBe(
      'Single-family inside the Bend city limits',
    )
  })
})

describe('sortPlaceTypeRows', () => {
  const row = (key: string, price: number, beds: number | null): V3ListingRowData =>
    ({
      listingKey: key,
      href: `/listing/${key}`,
      photoUrl: 'x',
      price,
      addressLine: key,
      cityLine: 'Bend, OR',
      beds,
      baths: null,
      sqft: null,
      pricePerSqft: null,
      propertyType: 'A',
      propertySubType: 'Single Family Residence',
      subdivisionName: null,
      city: 'Bend',
      listNumber: key,
    }) as V3ListingRowData

  const rows = [row('a', 500_000, 3), row('b', 900_000, 5), row('c', 700_000, null)]

  it('leaves the read order alone for newest', () => {
    expect(sortPlaceTypeRows(rows, 'newest')).toBe(rows)
  })

  it('sorts by price both ways and by beds', () => {
    expect(sortPlaceTypeRows(rows, 'price-asc').map((r) => r.listingKey)).toEqual(['a', 'c', 'b'])
    expect(sortPlaceTypeRows(rows, 'price-desc').map((r) => r.listingKey)).toEqual(['b', 'c', 'a'])
    // a missing bed count sorts last, never as a zero-bed home at the top
    expect(sortPlaceTypeRows(rows, 'beds').map((r) => r.listingKey)).toEqual(['b', 'a', 'c'])
  })

  it('knows its own keys', () => {
    expect(PLACE_TYPE_SORTS.map((s) => s.key)).toEqual(['newest', 'price-asc', 'price-desc', 'beds'])
    expect(isPlaceTypeSort('price-asc')).toBe(true)
    expect(isPlaceTypeSort('sqft')).toBe(false)
    expect(isPlaceTypeSort(null)).toBe(false)
  })

  it('reads the real sort off the URL so the lit chip is honest', () => {
    expect(placeTypeSortFromSearch('?sort=price-asc')).toBe('price-asc')
    expect(placeTypeSortFromSearch('sort=price-desc')).toBe('price-desc')
    expect(placeTypeSortFromSearch('?sort=newest')).toBe('newest')
    expect(placeTypeSortFromSearch('')).toBe('newest')
    expect(placeTypeSortFromSearch('?sort=sqft')).toBe('newest')
    expect(placeTypeSortFromSearch(null)).toBe('newest')
  })
})
