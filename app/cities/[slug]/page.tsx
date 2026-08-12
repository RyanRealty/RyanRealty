/**
 * /cities/[slug] - the city node, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. Places
 * destinations open on Instrument (the place verdict) then Field (the inventory). The
 * section order and the per-section reasoning are the parity contract, not this
 * comment: design_system/ryan-realty/ui_kits/city/parity.json.
 *
 * LEDGER IS THE PATTERN THIS ROUTE SPENDS ITS FIFTH SLOT ON, DELIBERATELY. An earlier
 * revision of this migration deferred V3Ledger to hold the page inside the four-of-six
 * rhythm rule, and deleting the ledgers deleted six Matt-issued product directives with
 * them: the designated-neighborhood set (D83), the separate golf and master-planned
 * section (D85), the city guides (D80), the other-cities exit (D84), the full
 * communities rail (D88), and the live activity feed (D93). Those directives outrank a
 * rhythm preference and each is a contract test in
 * components/site/__tests__/site-contracts.test.ts, so the ledgers are back - on the
 * barrel's own Ledger primitive, not on the retired KB sections. The rhythm conflict is
 * declared in parity.json rather than hidden.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through pageMetadata,
 * generateStaticParams over PRIMARY_CITIES with dynamicParams, revalidate 60, the route
 * and its params, MetadataBlock JSON-LD, a rendered CityPageTracker, and a rendered
 * KbSectionTracker with pageType="city". MetadataBlock and KbSectionTracker stay on
 * their registers deliberately: both are wiring, neither is visual language.
 *
 * The invariants this file is written to hold, each enforced at its own site:
 *
 *  1. ONE DERIVATION PER VERDICT, AND IT IS THE ONE THE REST OF THE SITE USES. `mosRaw`
 *     is the stored months-of-supply value, untouched. marketVerdict classifies THAT
 *     value, formatMonthsOfSupply renders it, and buildMarketFaq gets the raw value and
 *     runs the same pair. Rounding before a threshold comparison moves a verdict in both
 *     directions (4.02 rounds to 4.0 and reads as a seller's market; 5.97 rounds to 6.0
 *     and reads as a buyer's market), so nothing here rounds first.
 *  2. ONE GUARD PER FIGURE, SHARED WITH ITS CONSUMER. `mosRaw` is null unless the stored
 *     value is above 0, which is buildMarketFaq's own condition, so the H1 cannot assert
 *     a verdict the shared builder declined to answer.
 *  3. ONE TRACE PER QUERY, AND A TRACE ASSERTS ONLY WHAT THE CODE GUARANTEES. See
 *     cityInventory in ./_v3/city-sections.ts: getGeoSnapshot is NOT a plain
 *     geo_snapshot_mv read (withPulseOverride applies the live city market row over the
 *     MV row on every city read, matching geo_slug OR geo_label - broader than this
 *     page's getMarketPulse), so the fallback trace names both sources and confines its
 *     negative claim to this page's own read.
 *  4. ABSENT IS NOT ZERO, AND UNTRACED IS NOT PUBLISHED (CLAUDE.md section 0). No live
 *     pulse row means no verdict, no market figures, and a stated reason, never a
 *     synthesized 0 under a live-MLS source line. The same rule governs every ledger:
 *     each publishes a value column only when the read behind that column succeeded, and
 *     drops the column - not the rows - when it did not. buildDataDrivenCityAbout stays
 *     out of this route for the second half of that rule: its market sentence published
 *     the active count and the median a second time, untraced, inside a V3Quiet.
 *  5. ONE PRIMARY PER VIEWPORT, COUNTING VISIBLE FILLED CONTROLS (PUBLIC_UI.md
 *     section 1). This page used to demote its own ask on the ground that "the sticky
 *     public header carries a filled valuation CTA at every scroll position." That
 *     premise is false at 390: the header's nav-cta is display:none below 880px and its
 *     twin sits inside the collapsed menu, so the demotion shipped a first viewport
 *     with no ask at all. The opening Instrument's action is therefore PRIMARY and is
 *     the page's one filled control above the fold. Every Ledger action stays a ghost
 *     and V3Footer carries no button. At 880px and up the header's CTA is the second
 *     filled control in that viewport, which is the chrome unit's conflict to resolve
 *     (decisions.md), never a reason for a content page to ship no ask. DECLARED GAP:
 *     the stated-absence branch renders no Instrument and V3Quiet carries no action by
 *     contract, so that render has no filled control above the fold. The page will not
 *     invent a figure to earn an Instrument. Reported as a barrel gap.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  getGeoSnapshot,
  getMarketPulse,
  getCityListings,
  getBendNeighborhoodLedger,
  getAllCitySnapshots,
  getCityCommunitySnapshots,
  getRecentBlogPosts,
} from '@/lib/data'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getCityContent } from '@/lib/city-content'
import { CITY_QUICK_FACTS, PRIMARY_CITIES } from '@/lib/cities'
import { cityResorts, resortActiveSfrCounts, resortLabelToSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { CITY_MARQUEE_COMMUNITIES, communityVideoUrl } from '@/lib/kb/city-page-config'
// Row shaping shared with the neighborhood + community place pages - one copy, so a
// fix cannot land on one of the three and drift on the others.
import { buildActivityItems, buildArticlePosts, buildOtherCityItems } from '@/lib/kb/place-sections'
import { GOLF_COMMUNITY_IMAGES } from '@/lib/geo-images'
import { getPlaceLinks } from '@/lib/place-links'
import { homesForSalePath, slugify } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { marketVerdict } from '@/lib/market/classify'
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import CityPageTracker from '@/components/city/CityPageTracker'
import { CityAlertSheet } from './_v3/CityAlertSheet.client'
import { cityFieldItems } from './_v3/city-field-items'
import { bendNeighborhoodPlaces } from './_v3/city-places'
import { CITY_FIELD_POOL, CITY_FIELD_ROWS } from './_v3/city-constants'
import {
  activityRows,
  articleRows,
  cityAboutItems,
  cityActivityTrace,
  cityExploreItems,
  cityFieldEmptyMessage,
  cityInventory,
  cityMarketTrace,
  communityRows,
  PLACE_COUNT_TRACE,
  marketAbsenceItems,
  marketFigures,
  placeFigureRows,
  type CityCommunityItem,
  type CityPlaceItem,
} from './_v3/city-sections'
import { buildCitySchemas } from './_v3/city-metadata'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Seed the primary Central Oregon cities (finite, in-repo). Long-tail city
  // slugs still SSR on demand via dynamicParams. Build-verified resolvable.
  return PRIMARY_CITIES.map((name) => ({ slug: slugify(name) }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

/**
 * Hover photo for each resort / golf community in the master-planned ledger, keyed by
 * the RESORT-REGISTRY slug (data/resort-communities.json), not the community-index
 * slug. A resort's listings are MLS-tagged under alias subdivisions ("Inn Of The 7th",
 * "Elkai Woods"), so a literal-name image lookup misses for every resort. Every path is
 * a verified file under public/, and the golf entries come from the canonical
 * GOLF_COMMUNITY_IMAGES registry D86 requires geo imagery to resolve through. A resort
 * with no entry renders NO photo rather than a wrong-place one. Declared HERE and not
 * in ./_v3/city-constants.ts because ci:resort-definitions (G53) locks this wiring to
 * this file.
 */
const RESORT_IMG: Record<string, string> = {
  tetherow: '/images/kb/tetherow-golf-aerial.jpg',
  'broken-top': '/images/kb/broken-top.jpg',
  'northwest-crossing': '/images/kb/northwest-crossing.jpg',
  'vandevert-ranch': '/images/kb/vandevert-ranch.jpg',
  'three-rivers': '/images/kb/three-rivers.jpg',
  'caldera-springs': '/images/kb/caldera-springs.jpg',
  pronghorn: GOLF_COMMUNITY_IMAGES.pronghorn,
  'awbrey-glen': GOLF_COMMUNITY_IMAGES['awbrey-glen'],
  'widgi-creek': GOLF_COMMUNITY_IMAGES['widgi-creek'],
  crosswater: GOLF_COMMUNITY_IMAGES.crosswater,
  'eagle-crest': GOLF_COMMUNITY_IMAGES['eagle-crest'],
  'brasada-ranch': GOLF_COMMUNITY_IMAGES['brasada-ranch'],
}

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
  // market_pulse_live stores city geo_slug SPACE-separated ("la pine", "powell
  // butte") - normalize for that read, or multi-word cities come back stat-dead.
  // Keep the hyphenated `slug` for URLs.
  const geoSlug = slug.replace(/-/g, ' ')

  const isBend = slug === 'bend'
  const hasResorts = cityResorts(slug).length > 0

  // Data, all through the DAL (G8). The reads the page's own answer depends on are
  // unwrapped - each is resilient-cached with a documented fallback, so a timeout
  // wrapper would only hide a real outage behind a confident empty page. The LEDGER
  // reads are wrapped: a slow community index must not hold the market answer above
  // the fold, and a ledger whose count read degraded has a defined behaviour (it keeps
  // its rows and drops its value column, invariant 4).
  const [
    pulse,
    tiles,
    bendNeighborhoods,
    communities,
    allCitySnapshots,
    communitySnapshots,
    blogPosts,
    activity,
    mapTiles,
    resortRead,
  ] = await Promise.all([
    getMarketPulse({ geoType: 'city', geoSlug }),
    getCityListings(cityName, {
      status: 'active',
      sort: 'newest',
      // propertyType 'A' (§0) - the MLS residential BUCKET (single family, townhome,
      // condo), Active by City field, NOT the population market_pulse_live counts
      // (SFR sub-type, Active and Coming Soon, inside the boundary polygon). Verified
      // 2026-08-12: Terrebonne 6 against 71 tiles, Bend 489 against 987.
      propertyType: 'A',
      limit: CITY_FIELD_POOL,
    }),
    isBend
      ? getBendNeighborhoodLedger()
      : Promise.resolve([] as Awaited<ReturnType<typeof getBendNeighborhoodLedger>>),
    withTimeoutFallback(getCommunitiesForIndex(), [], 3500, 'city:communities'),
    withTimeoutFallback(getAllCitySnapshots(), [], 3000, 'city:allCities'),
    withTimeoutFallback(getCityCommunitySnapshots(slug), [], 3000, 'city:commSnaps'),
    withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'city:blog'),
    withTimeoutFallback(
      getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }),
      [],
      3500,
      'city:activity',
    ),
    // Coordinates for the boundary-verified neighborhood photos (D89). Bend only:
    // it is the only city with designated neighborhood polygons.
    isBend
      ? withTimeoutFallback(
          getCityListings(cityName, { status: 'active', sort: 'newest', propertyType: 'A', limit: 1500 }),
          [],
          4500,
          'city:mapTiles',
        )
      : Promise.resolve([] as Awaited<ReturnType<typeof getCityListings>>),
    // UNCAPPED active SFR, paginated past PostgREST's 1000-row cap (Bend has ~1044):
    // the alias-aware counts must see the COMPLETE active set or they undercount every
    // resort whose older listings fall past page one. The Result variant is
    // load-bearing - an empty array from a TIMEOUT reads as a city with no inventory,
    // and that all-zero map would put "0 active" under a live-MLS trace (§0).
    hasResorts
      ? withTimeoutFallbackResult(fetchAllCityActiveSfr(cityName), [], 6000, 'city:resortTiles')
      : Promise.resolve({ value: [] as Awaited<ReturnType<typeof fetchAllCityActiveSfr>>, ok: true }),
  ])

  const resortTiles = resortRead.value

  // §0 UNKNOWN IS NOT ZERO: `?? 0` published a fabricated "0 homes for sale" whenever
  // the market read came back empty. The count comes from getMarketPulse - the row the
  // Field's count and the FAQ answer publish - never a geo_snapshot all-count (D78).
  const activeCount: number | null = pulse?.activeCount ?? null

  // THE ONE DERIVATION (invariants 1 and 2).
  const mosRaw =
    pulse?.monthsOfSupply != null && pulse.monthsOfSupply > 0 ? pulse.monthsOfSupply : null
  const verdict = marketVerdict(mosRaw)
  const mosLabel = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null

  // buildMarketFaq - the single source for the visible FAQ, the FAQPage JSON-LD, and
  // the Dataset variableMeasured. `pulse ?? { snapshot }` is the fallback the page
  // contract requires (G52, D91): those payloads survive a missing city row instead of
  // vanishing. monthsOfSupply passes through RAW, for the reason in invariant 1.
  const marketFaqInput: MarketFaqInput = pulse ?? {
    activeCount: snapshot.activeSfrCount,
    medianListPrice: snapshot.medianListPrice,
    refreshedAt: snapshot.refreshedAt,
  }
  const marketFaq = buildMarketFaq(cityName, marketFaqInput)
  const { faqs } = marketFaq

  const inventory = cityInventory(cityName, pulse, snapshot)

  // Every figure is a door, all three off the one pulse row under the identical
  // predicate as that row's active_count, so one trace covers them.
  const figures = marketFigures(pulse, mosLabel, {
    marketReport: `/housing-market/${slug}`,
    monthsOfSupply: '/months-of-supply',
  })
  const [firstMarketFigure, ...restMarketFigures] = figures

  // The Field's rows, newest first. NOT the same population as the count above them.
  const fieldItems = cityFieldItems(tiles, CITY_FIELD_ROWS)
  const [firstFieldItem] = fieldItems

  /* ── The place ledgers ──────────────────────────────────────────────────── */

  // Communities in this city. Reused for the rail AND as neighborhood hover imagery
  // where a neighborhood shares a community's name.
  const cityComms = communities.filter((c) => c.city?.toLowerCase().trim() === cityName.toLowerCase().trim())
  const commImgByName = new Map(cityComms.map((c) => [c.subdivision.toLowerCase(), c.heroImageUrl]))
  const commImgBySlug = new Map(cityComms.map((c) => [c.slug, c.heroImageUrl]))

  // ALIAS-AWARE ACTIVE SFR PER RESORT (§0). A resort's homes are MLS-tagged under many
  // subdivision names (Widgi Creek -> "Inn Of The 7th", "Elkai Woods", ...), so a
  // literal-name count undercounts every resort (Widgi 0 vs true 48, Tetherow 14 vs 43).
  // Counted from the UNCAPPED active tiles through the registry aliases - the canonical
  // number used by BOTH the golf ledger and the rail, so no community shows two figures.
  // The map is EMPTY when the uncapped read degraded, not zero-filled: every consumer
  // below then falls through to its next source and finally to null, so a timeout
  // withholds the figure instead of publishing "0 active" under a live-MLS trace (§0).
  const resortSfrCounts = resortRead.ok
    ? resortActiveSfrCounts(slug, resortTiles)
    : new Map<string, number>()
  const resortSlugByLabel = resortLabelToSlug(slug)

  // The community snapshot's own SFR count, the golf ledger's second source. geo_key
  // arrives SPACE-separated for a multi-word community, so it is slugified before the
  // lookup or every multi-word community silently misses (D87).
  const communitySfrBySlug = new Map<string, number>()
  for (const s of communitySnapshots) {
    const rawSlug = s.geoKey.includes(':') ? s.geoKey.split(':')[1]! : s.geoKey
    communitySfrBySlug.set(rawSlug.replace(/\s+/g, '-').toLowerCase(), s.activeSfrCount)
  }

  // NEIGHBORHOODS - the DESIGNATED Bend polygons only, never sibling cities and never
  // raw subdivision-plat noise (D83). Every designated district is listed, with a
  // boundary-verified hover photo (D89). The count is withheld rather than zero-filled
  // when the ledger read did not answer - see ./_v3/city-places.ts for that rule.
  const bendNeighborhoodItems: CityPlaceItem[] = bendNeighborhoodPlaces({
    isBend,
    ledgerRows: bendNeighborhoods,
    mapTiles,
    communityImageByName: commImgByName,
  })

  // GOLF AND MASTER-PLANNED COMMUNITIES - a SEPARATE ledger from neighborhoods (D85).
  // Membership comes from the registry (is_resort), which drops Three Rivers, and the
  // count is the alias-aware one so the ledger and the rail agree.
  const golfCommunityItems: CityPlaceItem[] = cityResorts(slug).map((c) => ({
    name: c.label,
    href: getPlaceLinks({ type: 'community', slug: c.slug, citySlug: slug }).placeUrl,
    activeCount: resortSfrCounts.get(c.slug) ?? communitySfrBySlug.get(c.slug) ?? null,
    medianPrice: null,
    img:
      RESORT_IMG[c.slug] ??
      commImgBySlug.get(c.slug) ??
      commImgByName.get(c.label.toLowerCase().trim()) ??
      '',
  }))

  // THE COMMUNITIES RAIL - every community in this city that has a photo, with the
  // curated marquee set (hand-picked still + silent Area Guide clip) floated to the
  // front and the rest by active count (D88). Built from cityComms, never from a
  // curated three.
  const curatedComms = CITY_MARQUEE_COMMUNITIES[slug] ?? []
  const communityItems: CityCommunityItem[] = cityComms
    .map((c): CityCommunityItem | null => {
      const curated = curatedComms.find((f) => c.subdivision.toLowerCase().includes(f.match))
      const cvUrl = communityVideoUrl(curated?.videoSlug)
      const img = curated?.img ?? c.heroImageUrl ?? null
      if (!img) return null
      // When this community is a resort, show its ALIAS-AWARE count, so the rail card
      // matches the golf ledger and the real MLS total rather than the literal-name
      // undercount (§0).
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

  // Dedupe the ledger against the rail by NAME, not href: the rail's hrefs are
  // city-prefixed index slugs (/communities/bend-tetherow) while the ledger's are plain
  // registry slugs (/communities/tetherow) for the SAME physical place.
  const railNames = new Set(communityItems.map((c) => c.name.toLowerCase().trim()))
  const golfLedgerItems = golfCommunityItems.filter((t) => !railNames.has(t.name.toLowerCase().trim()))

  // EXPLORE OTHER CITIES - its own section, distinct from every within-city ledger
  // (D84). buildOtherCityItems owns the geo_key slugify, the service-area allowlist, and
  // the verified-cityHero-only imagery rule (D86/D87), shared with the neighborhood and
  // community nodes so one fix lands on all three.
  const otherCityItems: CityPlaceItem[] = buildOtherCityItems(allCitySnapshots, { excludeSlug: slug })

  // Live activity and city guides.
  const activityItems = buildActivityItems(activity, { staleNewAfterDays: 21 })
  const articlePosts = buildArticlePosts(blogPosts)

  // V3Ledger's rows prop is a non-empty tuple, so each section destructures a head and
  // renders nothing when there is none. A ledger never renders an unexplained blank.
  const [firstNbh, ...restNbh] = placeFigureRows(bendNeighborhoodItems, `${cityName} neighborhood`)
  const [firstRail, ...restRail] = communityRows(communityItems)
  const [firstGolf, ...restGolf] = placeFigureRows(golfLedgerItems, 'Golf and master-planned')
  const [firstOther, ...restOther] = placeFigureRows(otherCityItems, 'Central Oregon city')
  const [firstAct, ...restAct] = activityRows(activityItems)
  const [firstGuide, ...restGuide] = articleRows(articlePosts)

  // About - the hand-written city description where one exists. NO GENERATED
  // PARAGRAPHS AND NO FIGURES (invariant 4).
  const cityContent = getCityContent(cityName)
  const quickFacts = CITY_QUICK_FACTS[cityName] ?? null
  const description = cityContent?.description?.trim()

  // The GA4 view_city community_count. ANALYTICS ONLY - nothing on this page renders
  // it, because a figure with no source line beside it is not published (invariant 4).
  // A CHANGED METRIC, not a changed source for the same metric, so the series steps
  // once at this deploy. Both definitions, both verified populations, and why the
  // uncapped one is kept are in ui_kits/city/parity.json under CityPageTracker.
  const communityCount = snapshot.communityCount

  const aboutItems = cityAboutItems(description, quickFacts)

  const exploreItems = cityExploreItems(
    cityName,
    slug,
    // valuationHref, never a bare path: the closing valuation edge carries
    // ?from=/cities/<slug>, which is the seller lead's stored source_url.
    { browse: homesForSalePath(cityName), valuation: valuationHref(`/cities/${slug}`) },
    Boolean(quickFacts?.population),
  )

  const citySchemas = buildCitySchemas({ cityName, slug, faq: marketFaq })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <CityPageTracker
          cityName={cityName}
          slug={slug}
          listingCount={activeCount}
          medianPrice={pulse?.medianListPrice ?? null}
          communityCount={communityCount}
        />
        <KbSectionTracker pageType="city" />
        <MetadataBlock schemas={citySchemas} />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Cities', href: '/cities' }, { label: cityName }]} />

        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={1}
            eyebrow={v3Text(`${cityName}, Oregon`)}
            headline={v3Text(
              `${cityName} homes for sale${verdict.kind === 'unknown' ? '' : `: a ${verdict.label}`}`,
            )}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(cityMarketTrace(cityName))}
            updated={pulse?.refreshedAt ? v3Text(formatDate(pulse.refreshedAt)) : undefined}
            // PRIMARY by invariant 5: this is the page's own visible filled control,
            // and at 390 it is the only one in the first viewport.
            action={{
              label: v3Text(`See every ${cityName} home for sale`),
              href: homesForSalePath(cityName),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading={`${cityName} homes for sale`}
            headingLevel={1}
            // Keyed on THIS PAGE'S market read, never on the figure array: a row that
            // returns carrying nulls has returned. See marketAbsenceItems.
            items={marketAbsenceItems(cityName, pulse != null, Boolean(firstFieldItem))}
          />
        )}

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale in ${cityName}`}
          items={fieldItems}
          count={{
            value: inventory.count.toLocaleString('en-US'),
            label: `homes for sale in ${cityName}`,
            source: inventory.source,
            updatedAt: inventory.updatedAt,
          }}
          footNote={firstFieldItem ? `The ${fieldItems.length} most recently listed active homes with a ${cityName} address. The count above them is a different measure with its own source line, not a total of these rows.` : undefined}
          emptyMessage={cityFieldEmptyMessage(cityName, tiles.length)}
        />

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

        {/* D88: every community in the city that has a photo, marquee first. */}
        {firstRail ? (
          <V3Ledger
            id="communities"
            eyebrow={v3Text(`${cityName} · Communities`)}
            heading={v3Text('Communities and subdivisions')}
            rows={[firstRail, ...restRail]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        {/* D85: golf and master-planned communities are their OWN section, never folded
            into the neighborhoods list. The value column publishes only when the
            uncapped alias-aware read returned (invariant 4). */}
        {firstGolf ? (
          <V3Ledger
            id="communities-ledger"
            eyebrow={v3Text(`${cityName} · Communities`)}
            heading={v3Text('Golf and master-planned communities')}
            rows={[firstGolf, ...restGolf]}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        {aboutItems.length > 0 ? (
          <V3Quiet
            id="about"
            eyebrow={`${cityName}, Oregon`}
            heading={`${cityName}, in plain words`}
            items={aboutItems}
          />
        ) : null}

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

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading={`Questions about ${cityName}`}
          items={[
            ...faqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer })),
            ...exploreItems,
          ]}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
