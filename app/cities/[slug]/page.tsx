/**
 * /cities/[slug] - the city node, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: locked city PNG + tokens.css. First screen is the Stage:
 * live hero_image_url, H1 "{City} homes for sale", type-and-go search with
 * one Type control. Chart Room is V3Chart Time/Relate/Rank mid-page. Buyer
 * voice on the face. Child neighborhoods and master-plans are doors below
 * the fold. Section order: design_system/ryan-realty/ui_kits/city/parity.json.
 *
 * LEDGER IS THE PATTERN THIS ROUTE SPENDS ITS FIFTH SLOT ON, under the
 * 2026-08-26 place-family exception (PUBLIC_UI.md §3, Matt). The 2026-08-12
 * migration deferred V3Ledger to hold the four-of-six cap and deleting the
 * ledgers deleted six Matt-issued product directives with them: the
 * designated-neighborhood set (D83), the separate golf and master-planned
 * section (D85), the city guides (D80), the other-cities exit (D84), the full
 * communities rail (D88), and the live activity feed (D93). Matt ruled
 * 2026-08-26 that those directives outrank the rhythm preference on exactly
 * this family, so the ledgers are back - on the barrel's own Ledger primitive.
 * The fifth slot is declared in parity.json. No two adjacent sections share a
 * pattern when every section renders; the residual conditional collisions are
 * declared there too, the way the plat page declares its own.
 *
 * THE MARKET SECTION IS THE LEFTOVER HUD, NOT PULSE (MARKET_TRUTH D19/D26/D78,
 * all post-2026-08-15 - the reverted draft predates them and was corrected, not
 * restored). leftoverHudKpis is the one pile: the hero count is hud.active, a
 * missing cell is omitted, pulse and the stats cache never fill a tile, and
 * buildMarketFaq is called UNCONDITIONALLY with source 'market-truth' so the
 * Dataset/FAQPage JSON-LD survives a leftover miss at the cost of one figure,
 * never the markup (D91). The one verdict derivation: hud.monthsSupply is the
 * PUBLISHED raw value (publishMonthsOfSupply ran inside leftoverHudKpis),
 * marketVerdict classifies it, formatMonthsOfSupply displays it, and
 * buildMarketFaq repeats the same two steps on the same raw value.
 *
 * Buyer/seller is not a heading. Months of supply lives in Chart Room Rank
 * as seller / balanced / buyer bands. The H1 stays the money head term on
 * the Stage. Warehouse names stay in collapsed Source, not on the face.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata, generateStaticParams over PRIMARY_CITIES with dynamicParams,
 * revalidate 60, MetadataBlock JSON-LD, a rendered CityPageTracker, and a
 * rendered V3SectionTracker (page_type derives from the path taxonomy). MetadataBlock stays on the
 * legacy register (JSON-LD, pinned by ci:ai-structured-data). V3SectionTracker
 * is a v3 island, not a seventh pattern.
 *
 * Invariants, each enforced at its own site:
 *  1. ABSENT IS NOT ZERO, AND UNTRACED IS NOT PUBLISHED (CLAUDE.md §0). No
 *     leftover cell means no figure and a stated reason, never a synthesized 0
 *     under a live-MLS source line. Every ledger publishes a value column only
 *     when the read behind it succeeded, and drops the column - not the rows -
 *     when it did not.
 *  2. ONE POPULATION PER FIGURE, NAMED. The Field caption counts ITS OWN
 *     listed set (active single-family with a price and a street); the
 *     Instrument's "detached homes for sale" is the leftover membership count.
 *     Two counts, two labels, each under its own trace.
 *  3. ONE PRIMARY PER VIEWPORT, COUNTING VISIBLE FILLED CONTROLS (PUBLIC_UI.md
 *     §1). The first viewport is the Stage search. Homes sit in the Field
 *     below. Every Ledger action stays a ghost and V3Footer carries no button.
 */

import { notFound } from 'next/navigation'
import { readCityOpenHouses, openHouseRows, OPEN_HOUSE_TRACE } from '@/lib/kb/place-open-houses'
import type { Metadata } from 'next'
import {
  getGeoSnapshot,
  getCityListings,
  getBendNeighborhoodLedger,
  getAllCitySnapshots,
  getCityCommunitySnapshots,
  getRecentBlogPosts,
  getCityDetachedMarket,
  getCityDetachedInventory,
  getAreaGuideVideo,
  getNeighborhoodDirectory,
  getCityHeroUrlsBySlug,
} from '@/lib/data'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { CITY_TILE_FETCH_LIMIT } from '@/lib/market/publish-city-inventory'
import { CITY_PLACE_LIST_CAP } from '@/lib/explore/subdivision-page-extras'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getCityContent } from '@/lib/city-content'
import { CITY_QUICK_FACTS, PRIMARY_CITIES } from '@/lib/cities'
import { cityResorts, resortActiveSfrCounts, resortLabelToSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { CITY_MARQUEE_COMMUNITIES, CITY_RESORT_LEDGER_IMG, communityVideoUrl } from '@/lib/kb/city-page-config'
import { cityHero, preferPlaceHero } from '@/lib/geo-images'
// Row shaping shared with the neighborhood + community place pages - one copy, so a
// fix cannot land on one of the three and drift on the others.
import { buildActivityItems, buildArticlePosts, buildOtherCityItems } from '@/lib/kb/place-sections'
import { getPlaceLinks } from '@/lib/place-links'
import { homesForSalePath, slugify } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { marketVerdict } from '@/lib/market/classify'
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { skippableRail } from '@/lib/build-phase'
import {
  v3Text,
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  V3Stage,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import CityPageTracker from '@/components/city/CityPageTracker'
import { CityAlertSheet } from './_v3/CityAlertSheet.client'
import { CityHeroSearch } from './_v3/CityHeroSearch.client'
import { CityHomesField, CityMap, CityPhotoField } from './_v3/CityHomesField'
import { cityFieldItems, nearbyFieldItems, soldFieldItems } from './_v3/city-field-items'
import { cityGroundItems, citySchoolItems } from './_v3/city-place-face'
import { bendNeighborhoodPlaces } from './_v3/city-places'
import {
  activityRows,
  areaGuideRow,
  articleRows,
  cityAboutItems,
  cityActivityTrace,
  cityBuyerFigures,
  cityExploreItems,
  cityFieldCaption,
  cityFieldTrace,
  cityMarketTrace,
  MAP_TRACE,
  marketAbsenceItems,
  placeFigureRows,
  PLACE_COUNT_TRACE,
  SOLD_TRACE,
  type CityCommunityItem,
  type CityPlaceItem,
} from './_v3/city-sections'
import { cityMarketChartCards } from './_v3/city-market-charts'
import { cityChartRoomCards } from './_v3/city-chart-room'
import { buildCitySchemas } from './_v3/city-metadata'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Seed the primary Central Oregon cities (finite, in-repo). Long-tail city
  // slugs still SSR on demand via dynamicParams. Build-verified resolvable.
  return PRIMARY_CITIES.map((name) => ({ slug: slugify(name) }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

// Metadata - unchanged from the KB page.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  return pageMetadata({
    title: `Homes for Sale in ${cityName}, Oregon`,
    description: `Active single-family homes in ${cityName}, Oregon. Live list prices, neighborhoods, open houses, and recent market activity from the regional MLS.`,
    path: `/cities/${slug}`,
  })
}

export default async function CityDetailPage({ params }: Props) {
  const { slug } = await params

  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: slug })
  if (!snapshot) notFound()
  const cityName = snapshot.geoLabel
  // market_pulse_live + market_stats_cache store city geo_slug SPACE-separated
  // ("la pine") - normalize for those reads. Market Truth reads take the
  // hyphenated route slug. Keep `slug` for URLs.
  const geoSlug = canonicalCityCacheSlug(slug)

  const isBend = slug === 'bend'
  const hasResorts = cityResorts(slug).length > 0

  // Data, all through the DAL (G8). The reads the page's own answer depends on
  // are resilient-cached with documented fallbacks; the LEDGER reads are
  // wrapped so a slow community index cannot hold the fold, and a ledger whose
  // count read degraded keeps its rows and drops its value column (invariant 1).
  const [
    detached,
    detachedInv,
    publicPace,
    tiles,
    soldTiles,
    bendNeighborhoods,
    communities,
    allCitySnapshots,
    communitySnapshots,
    blogPosts,
    activity,
    resortRead,
    indexCities,
    neighborhoodDirectory,
  ] = await Promise.all([
    withTimeoutFallback(getCityDetachedMarket(slug), null, 3000, 'city:detached'),
    withTimeoutFallback(getCityDetachedInventory(slug), null, 3000, 'city:detachedInv'),
    withTimeoutFallback(getPublicDetachedPace({ geoType: 'city', geoSlug: slug }), EMPTY_PUBLIC_PACE, 3000, 'city:publicPace'),
    // THE FIELD'S SET - SFR only (C-02): every sibling geo map is the Single
    // Family Residence sub-type, and the caption beside this map counts THIS
    // set. An all-types pool put a 1,000-home badge beside a 491 hero on Bend.
    withTimeoutFallback(
      getCityListings(cityName, {
        status: 'active',
        sort: 'newest',
        propertyType: 'A',
        propertySubType: 'Single Family Residence',
        limit: CITY_TILE_FETCH_LIMIT,
      }),
      [],
      4500,
      'city:mapTiles',
    ),
    skippableRail(
      () =>
        getCityListings(cityName, {
          status: 'closed',
          sort: 'close-newest',
          propertyType: 'A',
          propertySubType: 'Single Family Residence',
          limit: 8,
        }),
      [],
      3500,
      'city:sold',
    ),
    isBend
      ? withTimeoutFallback(getBendNeighborhoodLedger(), [], 5000, 'city:nbhStats')
      : Promise.resolve([] as Awaited<ReturnType<typeof getBendNeighborhoodLedger>>),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'city:communities'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
    withTimeoutFallback(getCityCommunitySnapshots(slug), [], 3000, 'city:commSnaps'),
    skippableRail(() => getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'city:blog'),
    skippableRail(
      () => getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }),
      [],
      3500,
      'city:activity',
    ),
    // UNCAPPED active SFR, paginated past PostgREST's 1000-row cap (Bend has
    // ~1044): the alias-aware counts must see the COMPLETE active set or they
    // undercount every resort whose older listings fall past page one. The
    // Result variant is load-bearing - an empty array from a TIMEOUT reads as a
    // city with no inventory, and that all-zero map would put "0 active" under
    // a live-MLS trace (§0).
    hasResorts
      ? withTimeoutFallbackResult(fetchAllCityActiveSfr(cityName), [], 6000, 'city:resortTiles')
      : Promise.resolve({ value: [] as Awaited<ReturnType<typeof fetchAllCityActiveSfr>>, ok: true }),
    withTimeoutFallback(getCityHeroUrlsBySlug(), {}, 3000, 'city:liveHeroes'),
    withTimeoutFallback(getNeighborhoodDirectory(), [], 3000, 'city:nbhDir'),
  ])

  // The approved area-guide clip - a guides-Ledger door on this node (the
  // pattern set holds no mid-page media slot here); it plays full-bleed on the
  // community Stage. Null when the geo has none, and the row is then absent.
  const areaGuideVideo = await withTimeoutFallback(getAreaGuideVideo(slug), null, 3000, 'area-guide-video')

  const resortTiles = resortRead.value

  /* ── The market, off the ONE leftover pile ─────────────────────────────── */

  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: detached,
    inventory: detachedInv,
    pace: publicPace,
  })

  // §0 UNKNOWN IS NOT ZERO (D78): the hero count is leftover HUD - never tiles,
  // never a snapshot all-count, never a `?? 0`.
  const activeCount: number | null = hud.active

  // THE ONE VERDICT DERIVATION. hud.monthsSupply is the published raw value;
  // classify raw, format only for display.
  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const verdict = marketVerdict(mosRaw)
  const mosLabel = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null

  // The as-of stamp is leftover membership's own computed_at, so it names the
  // population the figures came from (§0).
  const leftoverStamp = detached?.computedAt ?? detachedInv?.computedAt ?? null

  // buildMarketFaq - the single source for the visible FAQ, the FAQPage
  // JSON-LD, and the Dataset variableMeasured. Called unconditionally with an
  // all-nullable leftover input: a miss omits one figure, never the markup.
  const marketFaqInput: MarketFaqInput = {
    grain: 'city',
    source: 'market-truth',
    activeCount: hud.active,
    pulseActiveCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: mosRaw,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: hud.sold12mo,
    refreshedAt: leftoverStamp,
  }
  const marketFaq = buildMarketFaq(cityName, marketFaqInput)
  const { faqs } = marketFaq
  const faceFaqs = faqs.filter(
    (item) =>
      !/leftover|methodology v|Market Truth|city_quarter|sale_pricing_facts|buyer's or seller's market/i.test(
        `${item.question} ${item.answer}`,
      ),
  )

  const figures = cityBuyerFigures(hud, {
    browse: homesForSalePath(cityName),
    monthsOfSupply: '/months-of-supply',
  }).slice(0, 1)
  const [firstMarketFigure] = figures

  const townCards = await cityMarketChartCards({
    citySlug: slug,
    geoSlug,
    cityName,
    publishedMos: hud.monthsSupply,
    publishedDtp: hud.daysToPending,
    displayedActiveCount: hud.active,
  })
  const marketCards = cityChartRoomCards(townCards)
  const posterSrc = preferPlaceHero(indexCities[slug], cityHero(slug).src)

  /* ── The Field ─────────────────────────────────────────────────────────── */

  // Explicit preview cap: the Field lists (and plots) the newest
  // CITY_PLACE_LIST_CAP qualifying homes, the same cap the KB dual-pane list
  // carried, so a 1,000-listing city does not ship a 1,000-row DOM. The full
  // count is the Instrument's figure; its action is the view-all door.
  const fieldItems = cityFieldItems(tiles, CITY_PLACE_LIST_CAP)
  const fieldCaption = cityFieldCaption({
    cityName,
    count: fieldItems.length,
  })

  /* ── The place ledgers ──────────────────────────────────────────────────── */

  // Communities in this city. Reused for the rail AND as neighborhood hover
  // imagery where a neighborhood shares a community's name.
  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
  const commImgByName = new Map(cityComms.map((c) => [c.subdivision.toLowerCase(), c.heroImageUrl]))
  const commImgBySlug = new Map(cityComms.map((c) => [c.slug, c.heroImageUrl]))

  // ALIAS-AWARE ACTIVE SFR PER RESORT (§0). A resort's homes are MLS-tagged
  // under many subdivision names (Widgi Creek -> "Inn Of The 7th", "Elkai
  // Woods", ...), so a literal-name count undercounts every resort (Widgi 0 vs
  // true 48, Tetherow 14 vs 43). Counted from the UNCAPPED active tiles through
  // the registry aliases - the canonical number used by BOTH the golf ledger
  // and the rail, so no community shows two figures. The map is EMPTY when the
  // uncapped read degraded, not zero-filled: every consumer below then falls
  // through to its next source and finally to null, so a timeout withholds the
  // figure instead of publishing "0 active" under a live-MLS trace (§0).
  const resortSfrCounts = resortRead.ok
    ? resortActiveSfrCounts(slug, resortTiles)
    : new Map<string, number>()
  const resortSlugByLabel = resortLabelToSlug(slug)

  // The community snapshot's own SFR count, the golf ledger's second source.
  // geo_key arrives SPACE-separated for a multi-word community, so it is
  // slugified before the lookup or every multi-word community silently misses (D87).
  const communitySfrBySlug = new Map<string, number>()
  for (const s of communitySnapshots) {
    const rawSlug = s.geoKey.includes(':') ? s.geoKey.split(':')[1]! : s.geoKey
    if (s.activeSfrCount != null) {
      communitySfrBySlug.set(rawSlug.replace(/\s+/g, '-').toLowerCase(), s.activeSfrCount)
    }
  }

  // NEIGHBORHOODS - the DESIGNATED Bend polygons only, never sibling cities and
  // never raw subdivision-plat noise (D83). Every designated district is
  // listed, with a boundary-verified hover photo (D89). The count is withheld
  // rather than zero-filled when the ledger read did not answer - see
  // ./_v3/city-places.ts for that rule.
  const neighborhoodHeroBySlug = new Map(
    neighborhoodDirectory
      .filter((d) => d.citySlug === slug)
      .map((d) => [d.neighborhoodSlug, d.heroImageUrl]),
  )
  const bendNeighborhoodItems: CityPlaceItem[] = bendNeighborhoodPlaces({
    isBend,
    ledgerRows: bendNeighborhoods,
    mapTiles: tiles,
    communityImageByName: commImgByName,
    neighborhoodHeroBySlug,
  })

  // GOLF AND MASTER-PLANNED COMMUNITIES - a SEPARATE ledger from neighborhoods
  // (D85). Membership comes from the registry (is_resort), which drops Three
  // Rivers, and the count is the alias-aware one so the ledger and the rail agree.
  const golfCommunityItems: CityPlaceItem[] = cityResorts(slug).map((c) => ({
    name: c.label,
    href: getPlaceLinks({ type: 'community', slug: c.slug, citySlug: slug }).placeUrl,
    activeCount: resortSfrCounts.get(c.slug) ?? communitySfrBySlug.get(c.slug) ?? null,
    medianPrice: null,
    img: preferPlaceHero(
      commImgBySlug.get(c.slug) ?? commImgByName.get(c.label.toLowerCase().trim()),
      CITY_RESORT_LEDGER_IMG[c.slug] ?? '',
    ),
  }))

  // THE COMMUNITIES RAIL - every community in this city that has a photo, with
  // the curated marquee set (hand-picked still + silent Area Guide clip)
  // floated to the front and the rest by active count (D88). Built from
  // cityComms, never from a curated three.
  const curatedComms = CITY_MARQUEE_COMMUNITIES[slug] ?? []
  const communityItems: CityCommunityItem[] = cityComms
    .map((c): CityCommunityItem | null => {
      const curated = curatedComms.find((f) => c.subdivision.toLowerCase().includes(f.match))
      const cvUrl = communityVideoUrl(curated?.videoSlug)
      const img = preferPlaceHero(c.heroImageUrl, curated?.img ?? '') || null
      if (!img) return null
      // When this community is a resort, show its ALIAS-AWARE count, so the
      // rail card matches the golf ledger and the real MLS total rather than
      // the literal-name undercount (§0).
      const resortSlug = resortSlugByLabel.get(c.subdivision.toLowerCase().trim())
      const activeCount = resortSlug ? resortSfrCounts.get(resortSlug) ?? c.activeCount : c.activeCount
      return {
        name: c.subdivision,
        activeCount,
        medianPrice: null,
        town: cityName,
        href: getPlaceLinks({ type: 'community', slug: resortSlug ?? c.slug, citySlug: slug }).placeUrl,
        img,
        video: cvUrl ? { url: cvUrl, embedType: 'video-tag' as const } : null,
      }
    })
    .filter((x): x is CityCommunityItem => x !== null)
    .sort((a, b) => (a.video ? 0 : 1) - (b.video ? 0 : 1) || (b.activeCount ?? 0) - (a.activeCount ?? 0))
    // ONE ROW PER RESOLVED DOOR: two index rows (a resort and one of its member
    // subdivisions) can both resolve to the same registry slug, and two rows
    // with one href are one place listed twice — and a duplicated React key.
    // The sort above has already put the marquee/high-count row first.
    .filter((item, i, arr) => arr.findIndex((x) => x.href === item.href) === i)

  // Dedupe the ledger against the rail by NAME, not href: the rail's hrefs are
  // city-prefixed index slugs while the ledger's are plain registry slugs for
  // the SAME physical place.
  const railNames = new Set(communityItems.map((c) => c.name.toLowerCase().trim()))
  const golfLedgerItems = golfCommunityItems.filter((t) => !railNames.has(t.name.toLowerCase().trim()))

  // EXPLORE OTHER CITIES - its own section, distinct from every within-city
  // ledger (D84). buildOtherCityItems owns the geo_key slugify, the
  // service-area allowlist, and the verified-cityHero-only imagery rule
  // (D86/D87), shared with the neighborhood and community nodes so one fix
  // lands on all three.
  const otherCityItems: CityPlaceItem[] = buildOtherCityItems(allCitySnapshots, {
    excludeSlug: slug,
    liveHeroBySlug: indexCities,
  })

  // Live activity and city guides.
  const activityItems = buildActivityItems(activity, { staleNewAfterDays: 21 })
  const articlePosts = buildArticlePosts(blogPosts)

  // V3Ledger's rows prop is a non-empty tuple, so each section destructures a
  // head and renders nothing when there is none.
  const [firstNbh, ...restNbh] = placeFigureRows(bendNeighborhoodItems, `${cityName} neighborhood`)
  const [firstGolf, ...restGolf] = placeFigureRows(golfLedgerItems, 'Golf and master-planned')
  const [firstOther, ...restOther] = placeFigureRows(otherCityItems, 'Central Oregon city')
  const soldItems = soldFieldItems(soldTiles)
  const nearbyItems = nearbyFieldItems([
    ...communityItems,
    ...golfCommunityItems.filter(
      (item) => !communityItems.some((c) => c.name.toLowerCase().trim() === item.name.toLowerCase().trim()),
    ),
  ])
  const cityContent = getCityContent(cityName)
  const quickFacts = CITY_QUICK_FACTS[cityName] ?? null
  const groundItems = cityGroundItems(cityName, quickFacts)
  const schoolItems = citySchoolItems(cityName)
  const description = cityContent?.description?.trim()
  const aboutItems = cityAboutItems(description, quickFacts)
  // D94 restored 2026-08-27. The feed is CITY-scoped, which is what this page is,
  // so the eyebrow and the door both name the city honestly.
  const openHouses = await readCityOpenHouses(cityName)
  const [firstOh, ...restOh] = openHouseRows(openHouses)
  const [firstAct, ...restAct] = activityRows(activityItems)
  const [firstGuide, ...restGuide] = [
    ...areaGuideRow(cityName, areaGuideVideo),
    ...articleRows(articlePosts),
  ]

  const exploreItems = cityExploreItems(
    cityName,
    slug,
    // valuationHref, never a bare path: the closing valuation edge carries
    // ?from=/cities/<slug>, which is the seller lead's stored source_url.
    { browse: homesForSalePath(cityName), valuation: valuationHref(`/cities/${slug}`) },
    Boolean(quickFacts?.population),
  )

  const citySchemas = buildCitySchemas({
    cityName,
    slug,
    faq: marketFaq,
    hasMap: fieldItems.some((item) => item.lat != null && item.lng != null),
  })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <CityPageTracker
          cityName={cityName}
          slug={slug}
          listingCount={activeCount}
          medianPrice={hud.medianList}
          communityCount={communitySnapshots.length}
        />
        <V3SectionTracker />
        <MetadataBlock schemas={citySchemas} />

        <V3Breadcrumb
          tone="on-media"
          trail={[{ label: 'Home', href: '/' }, { label: cityName }]}
        />
        <V3Stage
          id="hero"
          headingLevel={1}
          height="tall"
          headline={v3Text(`${cityName} homes for sale`)}
          posterSrc={posterSrc}
          action={{ label: 'See homes', href: '#homes', variant: 'ghost' }}
        >
          <CityHeroSearch cityName={cityName} />
        </V3Stage>

        <CityHomesField
          cityName={cityName}
          headline={v3Text(`Homes in ${cityName}`)}
          fieldItems={fieldItems}
          tilesLength={tiles.length}
          caption={fieldCaption}
          source={cityFieldTrace(cityName)}
        />

        <CityPhotoField
          id="sold"
          cityName={cityName}
          headline={v3Text('Recently sold')}
          ariaLabel={`Recently sold homes in ${cityName}`}
          fieldItems={soldItems}
          source={SOLD_TRACE}
        />

        <CityMap id="map" cityName={cityName} fieldItems={fieldItems} source={MAP_TRACE} />

        <CityPhotoField
          id="communities"
          cityName={cityName}
          headline={v3Text('Also on the list')}
          ariaLabel={`Places in ${cityName}`}
          fieldItems={nearbyItems}
          source={PLACE_COUNT_TRACE}
        />

        {groundItems.length > 0 ? (
          <V3Quiet id="ground" eyebrow={`${cityName} · On the ground`} heading="On the ground" items={groundItems} />
        ) : null}

        {aboutItems.length > 0 ? (
          <V3Quiet
            id="about"
            eyebrow={`${cityName}, Oregon`}
            heading={`${cityName}, in plain words`}
            items={aboutItems}
          />
        ) : null}

        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text(`${cityName} · Chart Room`)}
            headline={v3Text('Market')}
            figures={[firstMarketFigure]}
            source={v3Text(cityMarketTrace(cityName, mosLabel != null))}
            cards={marketCards.length > 0 ? marketCards : undefined}
            updated={leftoverStamp ? v3Text(formatDate(leftoverStamp)) : undefined}
            action={{
              label: v3Text(`See every ${cityName} home for sale`),
              href: homesForSalePath(cityName),
              variant: 'ghost',
            }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading="Market"
            items={marketAbsenceItems(cityName, Boolean(fieldItems.length))}
          />
        )}

        {schoolItems.length > 0 ? (
          <V3Quiet id="schools" eyebrow={`${cityName} · Schools`} heading="Assigned schools" items={schoolItems} />
        ) : null}

        {/* D83: the DESIGNATED Bend polygons, and only those. */}
        {firstNbh ? (
          <V3Ledger
            id="neighborhoods"
            eyebrow={v3Text(`${cityName} · Neighborhoods`)}
            heading={v3Text('Neighborhoods')}
            rows={[firstNbh, ...restNbh]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{
              label: v3Text(`All ${cityName} homes`),
              href: homesForSalePath(cityName),
            }}
          />
        ) : null}

        {/* D85: golf and master-planned communities are their OWN section,
            never folded into the neighborhoods list. The value column publishes
            only when the alias-aware read returned (invariant 1). */}
        {firstGolf && nearbyItems.length === 0 ? (
          <V3Ledger
            id="communities-ledger"
            eyebrow={v3Text(`${cityName} · Communities`)}
            heading={v3Text('Golf and master-planned communities')}
            rows={[firstGolf, ...restGolf]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        {/* Pattern 5, Sheet. Same server action, same payload, same honeypot. */}
        <CityAlertSheet cityName={cityName} />

        {/* D93: the live feed, every row carrying its listing's own photo. */}
        {firstAct ? (
          <V3Ledger
            id="activity"
            eyebrow={v3Text(`Live · ${cityName}`)}
            heading={v3Text('Latest market activity')}
            rows={[firstAct, ...restAct]}
            source={v3Text(cityActivityTrace(cityName))}
            action={{ label: v3Text('Full market pulse'), href: '/housing-market' }}
          />
        ) : null}

        {firstOh ? (
          <V3Ledger
            id="open-houses"
            eyebrow={v3Text(`This week · ${cityName}`)}
            heading={v3Text('Open houses you can walk through')}
            rows={[firstOh, ...restOh]}
            source={v3Text(OPEN_HOUSE_TRACE)}
            action={{ label: v3Text(`Every open house in ${cityName}`), href: `/open-houses/${slug}` }}
          />
        ) : null}

        {faceFaqs.length > 0 ? (
          <V3Quiet
            id="faq"
            eyebrow="Common questions"
            heading={`Questions about ${cityName}`}
            items={faceFaqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer }))}
          />
        ) : null}

        {/* D80: real published guides for this city, never generated filler. */}
        {firstGuide ? (
          <V3Ledger
            id="guides"
            eyebrow={v3Text('Guides and news')}
            heading={v3Text(`${cityName} guides`)}
            rows={[firstGuide, ...restGuide]}
            action={{ label: v3Text('Every guide'), href: '/blog' }}
          />
        ) : null}

        <V3Quiet id="explore" eyebrow={`${cityName} · Explore`} heading="Where to next" items={exploreItems} />

        {/* D84: Explore other cities - its own section, not a within-city list. */}
        {firstOther ? (
          <V3Ledger
            id="nearby"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Explore other cities')}
            rows={[firstOther, ...restOther]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every city'), href: '/cities' }}
          />
        ) : null}
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content, and <main> is
          sectioning content, so inside it the element is a generic and the page
          ships no contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
