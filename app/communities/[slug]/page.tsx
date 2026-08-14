/**
 * /communities/<slug> — master-plan grain. Tetherow is the exemplar, not a
 * one-off. Opens Stage (owned place photo) then one Field. No owned asset →
 * Instrument of belonging, then Field. Amenities, membership, STR, and child
 * plats are doors. Not a neighborhood. Not a city stamp twin.
 * The old line "Places first screenful opens the Field" is retired.
 * Parity: design_system/ryan-realty/ui_kits/community/parity.json.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata forwarding to
 * pageMetadata, generateStaticParams over the resort registry, dynamicParams,
 * revalidate 60, both canonical-slug redirects, MetadataBlock JSON-LD
 * (BreadcrumbList, Place, Dataset, FAQPage), a rendered V3SectionTracker, and
 * CommunityPageTracker with the same five props. MetadataBlock stays on the
 * legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh
 * pattern.
 *
 * THE DATA INVARIANTS, all preserved, each enforced at its own site:
 *
 *  1. ALIAS-AWARE RESORT COUNT. A resort's homes are MLS-tagged under many
 *     subdivision names, so the literal-name query undercounts every resort
 *     (Widgi Creek 0 against a true 48). A resort in its city counts through the
 *     city's alias-aware set, which is what makes the figure match the city
 *     ledger, gated on a NON-EMPTY tile set so a timed-out fetch cannot publish 0.
 *  2. BOUNDARY RELIABILITY. Several stored hulls are oversized (Broken Top
 *     11,496 acres against ~450 real). An unreliable hull may not draw and may
 *     not drive the count; the MLS subdivision-name listings do both instead.
 *     The county plat union, when one exists, always draws.
 *  3. ONE PAIR, ONE TRACE, ONE STAMP — resolveLivePair in _v3/community-figures.
 *  4. ABSENT IS NOT ZERO. Every source is guarded, and when all are silent the
 *     page says it has no live figures rather than publishing 0.
 *  5. ONE PRIMARY PER VIEWPORT. The opening is Stage (owned photo) or a
 *     belonging Instrument, then one Field. The Stage action is the first house.
 *     Chrome Value my home is not this page's ask.
 *  6. ONE INVENTORY PER FIGURE SET. The Field lists and plots the same homes
 *     its caption counts. Months of supply publishes only when its numerator is
 *     that count.
 *
 * ONE PUBLISHED FIGURE CHANGED, because it was wrong: the reliable-boundary
 * branch published `listings_in_boundary`'s pin count under the label "Active
 * single-family", and that RPC filters on status only, so the number counted
 * condos, land, and townhomes. It is now the single-family actives inside the
 * same boundary — the set the label claimed and the set its median comes from.
 *
 * WHAT THE 2026-08-12 REPAIR PASS CHANGED, all of it published copy this page was
 * getting wrong, none of it a gate that moved:
 *
 *  - Months of supply prints through lib/format/months-of-supply (the one
 *    boundary-safe rule) instead of Math.round, which had put three values of one
 *    statistic on one page: 4.0 in the Instrument, 4.1 in the FAQ, 4.1 in the
 *    Dataset.
 *  - Months of supply and the H1 verdict publish only when the pulse row's own
 *    active count IS the count this page publishes. It never was on a resort, and
 *    the arithmetic showed: vandevert-ranch printed "a buyer's market" and "72.0
 *    months" over "0 homes for sale", tetherow printed "a balanced market" where
 *    its own 36 actives against the same denominator give 9.0.
 *  - The Field is fed the counted set, so the list, the map, and the count cannot
 *    describe three populations, and the footnote counts against the list's own
 *    denominator instead of the plotted subset.
 *  - No copy claims the browse page carries these homes. It does not: that route
 *    filters on the literal MLS subdivision name, which is the undercount invariant
 *    1 exists to correct.
 *  - The visible freshness line is back, carrying the same clock the Dataset's
 *    dateModified publishes.
 *  - The alert sheet's honeypot and its frequency and unsubscribe disclosure are
 *    back, and the route to manage a subscription is a door in the closing block.
 *  - The opening is Stage then Field when an owned photo exists.
 *  - The Dataset's description is derived from the variables it publishes, so the
 *    sentence a crawler reads cannot name a metric the payload does not carry.
 *
 * Data ONLY through @/lib/data, @/app/actions/communities, and the in-repo
 * registries. No raw .from() calls.
 */

import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getCommunityBySlug, getCommunityListings } from '@/app/actions/communities'
import {
  getMarketPulse,
  getMarketStats,
  getListingTiles,
  getGeoSnapshot,
  getGeoBoundaryMapData,
  getResortBoundaryGeoJSON,
  getResortCommunityBySlug,
  getBlogPostsBySlugs,
} from '@/lib/data'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { getCommunitySeoAbout } from '@/lib/community-seo-content'
import boundarySanityBaseline from '@/data/boundary-sanity-baseline.json' assert { type: 'json' }
import { GOLF_COURSES } from '@/data/golf/courses'
import { cityResorts, resortActiveSfrCounts, resortTilesForSlug } from '@/lib/kb/resort-active-counts'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { getDistrictForCity } from '@/data/co-schools'
import { homesForSalePath, slugify } from '@/lib/slug'
import { communityImage } from '@/lib/geo-images'
import { getCanonicalCityForSubdivision, getAllResortCommunities } from '@/lib/data/communities/registry'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3Stage,
  V3SectionTracker,
} from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import CommunityPageTracker from '@/components/community/CommunityPageTracker'
import { CommunityAlertSheet } from './_v3/CommunityAlertSheet.client'
import { buildCommunitySchemas, communityMetadataInput } from './_v3/community-metadata'
import { buildClosedFigures, buildExploreEdges, resolveLivePair } from './_v3/community-figures'
import { buildPlaceKnowledge } from './_v3/place-knowledge'
import {
  belongingFigures,
  belongingHeadline,
  belongingTrace,
  communityFieldItems,
} from './_v3/community-opening'
import { CommunityStage } from './_v3/CommunityStage'

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Seed the curated resort-community set (finite, in-repo registry) so the
  // flagship pages get build-time SSG instead of cold-rendering every 60s.
  // Long-tail subdivision slugs still SSR on demand via dynamicParams below.
  return getAllResortCommunities().map((c) => ({ slug: c.slug }))
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

/** The most rows the in-boundary queries return. Named so the trace can say it. */
const BOUNDARY_ROW_CAP = 200

/** How many homes the Field lists. Every one with coordinates still pins. */
const FIELD_LIST_CAP = 24

// Boundaries listed in the sanity baseline are oversized or un-corrected
// (broken-top is 11,496 acres against ~450 real), so anything keyed off the
// polygon — the in-boundary listings, the count, the drawn shape — is wrong: it
// swallows Tetherow and west Bend.
const UNRELIABLE_BOUNDARY_SLUGS = new Set(boundarySanityBaseline.allowed as string[])
function isBoundaryReliable(slug: string): boolean {
  return !UNRELIABLE_BOUNDARY_SLUGS.has(slug)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()
  return pageMetadata(communityMetadataInput({ slug, name: community.name, city: community.city }))
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params

  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const cityName = community.city
  const citySlug = community.citySlug

  // A resort has ONE canonical URL: its bare registry slug. A compound slug
  // (/communities/bend-tetherow) resolves to the same community but bypasses the
  // alias-aware path, publishes the literal-name undercount, and duplicates the
  // bare-slug page. Member subdivisions consolidate for the same reason: GSC
  // 2026-07 showed "broken top homes for sale" split across two member slugs at
  // position ~25 while the one real page sat unranked.
  const subdivisionLc = community.subdivision.toLowerCase().trim()
  const resortMatch = cityResorts(citySlug).find(
    (r) =>
      r.slug === slug ||
      r.label.toLowerCase().trim() === subdivisionLc ||
      (r.subdivision_aliases ?? []).some((a) => a.toLowerCase().trim() === subdivisionLc),
  )
  if (resortMatch && slug !== resortMatch.slug) redirect(`/communities/${resortMatch.slug}`)

  // Some subdivisions carry listings whose raw MLS City disagrees with the
  // registry city (hundreds of Crosswater listings say "Bend" though Crosswater
  // is a Sunriver-area resort), and a slug parsed from the wrong city still
  // resolved to a real page with real, partial stats.
  const canonicalCity = getCanonicalCityForSubdivision(community.subdivision)
  if (canonicalCity && canonicalCity.toLowerCase() !== cityName.toLowerCase()) {
    redirect(`/communities/${slugify(canonicalCity)}-${slugify(community.subdivision)}`)
  }

  // The resort registry entry is the source of truth for is_resort,
  // sub_neighborhoods, and subdivision_aliases. Pure and synchronous (registry JSON).
  const resortSlug = resortMatch?.slug ?? slug
  const registryEntry = getResortCommunityBySlug(resortSlug)
  const isResort = registryEntry?.is_resort === true || community.isResort
  const isResortInCity = Boolean(resortMatch)

  // Community geo snapshot keys are stored as "city:subdivision" lowercase;
  // market_stats_cache and market_pulse_live neighborhood rows are keyed by the
  // bare community slug.
  const communityGeoKey = `${cityName.toLowerCase().trim()}:${community.subdivision.toLowerCase().trim()}`
  const neighborhoodSlug = slug

  const [snapshot, pulse, stats, boundaryMapData, _resortBoundary, citySfrTiles, richContent] =
    await Promise.all([
      // Always-present community snapshot — the JSON-LD and Place fallback source. (§0)
      withTimeoutFallback(getGeoSnapshot({ geoType: 'community', geoKey: communityGeoKey }), null, 3000, 'comm:snapshot'),
      withTimeoutFallback(getMarketPulse({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), null, 3500, 'comm:pulse'),
      // Closed-sale stats from market_stats_cache: market_pulse_live carries no
      // neighborhood rows, so this is the verified source for days on market,
      // median sold, and the 12-month sold count.
      withTimeoutFallback(getMarketStats({ geoType: 'neighborhood', geoSlug: neighborhoodSlug, periodType: 'rolling_365d' }), null, 3500, 'comm:stats'),
      withTimeoutFallback(getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: neighborhoodSlug }), { polygon: null, pins: [] }, 4500, 'comm:boundary'),
      withTimeoutFallback(getResortBoundaryGeoJSON(slug), null, 4500, 'comm:resortBoundary'),
      // Uncapped active SFR tiles for EVERY MLS city this community lists under
      // (registry mls_cities): the registry-city-only pull rendered 0 of Caldera's
      // 31 real homes, because Caldera lists under Bend (2026-07-29). (§0)
      isResortInCity
        ? withTimeoutFallback(
            Promise.all(
              [...new Set([cityName, ...(registryEntry?.mls_cities ?? [])])].map((c) => fetchAllCityActiveSfr(c)),
            ).then((sets) => sets.flat()),
            [], 9000, 'comm:citySfr',
          )
        : Promise.resolve([] as Awaited<ReturnType<typeof getListingTiles>>),
      // Verified resort content (amenities, drive times, course, membership,
      // builders) from data/resort-community-<slug>.json. Null with no config,
      // and the page then shows fewer rows rather than inventing them. (§0)
      withTimeoutFallback(getResortCommunityContent(resortSlug), null, 2500, 'comm:content'),
    ])

  // Amenity to blog-post edges. Only PUBLISHED posts come back, so an amenity
  // pointing at a draft produces no dead door.
  const amenityBlogSlugs = (richContent?.amenities ?? [])
    .map((a) => a.blog_slug)
    .filter((s): s is string => Boolean(s))
  const amenityPosts =
    amenityBlogSlugs.length > 0
      ? await withTimeoutFallback(getBlogPostsBySlugs(amenityBlogSlugs), {}, 2500, 'comm:amenityPosts')
      : {}

  // ── BOUNDARY RELIABILITY (invariant 2) ────────────────────────────────────
  const boundaryReliable = isBoundaryReliable(slug)
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)

  // ALIAS-AWARE LISTINGS (invariant 1): the city's active SFR tiles matching this
  // resort's aliases, the SAME set the count comes from, so map, list, and count agree.
  const resortTiles = isResortInCity ? resortTilesForSlug(citySlug, resortSlug, citySfrTiles) : []
  const useResortTiles = resortTiles.length > 0

  // The community's own tiles. Resort: alias-matched. Trustworthy boundary:
  // in-polygon. Oversized: the city pull, narrowed below by subdivision name.
  // propertyType 'A' throughout: every label here says single-family (§0).
  let communityTiles: Awaited<ReturnType<typeof getListingTiles>> = useResortTiles
    ? resortTiles
    : boundaryReliable && boundaryListingKeys.length > 0
      ? await withTimeoutFallback(
          getListingTiles({ listingKeys: boundaryListingKeys, status: 'active', propertyType: 'A', limit: BOUNDARY_ROW_CAP }),
          [],
          4500,
          'comm:tiles',
        )
      : await withTimeoutFallback(
          getListingTiles({ city: cityName, status: 'active', propertyType: 'A', limit: 1500 }),
          [],
          4500,
          'comm:tiles-fallback',
        )
  const usedSubdivisionNarrowing = !useResortTiles && (!boundaryReliable || boundaryListingKeys.length === 0)
  if (usedSubdivisionNarrowing) {
    const subListings = await withTimeoutFallback(
      getCommunityListings(cityName, community.subdivision, BOUNDARY_ROW_CAP),
      [],
      4500,
      'comm:sub-listings',
    )
    const subKeys = new Set(subListings.map((r) => r.ListingKey).filter(Boolean) as string[])
    communityTiles = communityTiles.filter((t) => subKeys.has(t.listingKey))
  }

  // Gate the alias count on a NON-EMPTY tile set: a timed-out city SFR fetch must
  // not publish an alias count of 0, so it falls through to the branches below.
  const haveCityTiles = isResortInCity && citySfrTiles.length > 0
  const resortSfrCounts = haveCityTiles ? resortActiveSfrCounts(citySlug, citySfrTiles) : new Map<string, number>()
  const aliasAwareCount = haveCityTiles ? resortSfrCounts.get(resortSlug) ?? null : null

  // ── THE LIVE PAIR (invariants 3 and 4) ────────────────────────────────────
  const live = resolveLivePair({
    communityName: community.name,
    subdivision: community.subdivision,
    boundaryRowCap: BOUNDARY_ROW_CAP,
    aliasAwareCount,
    resortTiles,
    communityTiles,
    boundaryReliable,
    usedSubdivisionNarrowing,
    pulse,
    snapshot,
  })
  const activeCount: number | null = live.count
  // Zero for sale means there is no asking price to publish: vandevert-ranch
  // rendered "0 homes for sale" beside a "Median list" figure.
  const medianListPrice = activeCount == null || activeCount <= 0 ? null : live.median

  // THE ONE MONTHS-OF-SUPPLY DERIVATION. Classify the RAW value, format only to
  // display it, and hand the RAW value to buildMarketFaq so the shared builder
  // repeats the same two steps in the same order. Rounding first is what this
  // ordering prevents: 4.02 rounds to 4.0, and "4.0 <= 4" prints a seller's
  // market where lib/market/classify.ts calls the raw value balanced.
  const mosRaw = pulse?.monthsOfSupply != null && pulse.monthsOfSupply > 0 ? pulse.monthsOfSupply : null

  // A RATIO IS ONLY ABOUT THE INVENTORY IT WAS COMPUTED FROM, AND THIS PAGE PRINTS
  // THE FORMULA, SO THE READER CAN CHECK IT. Months of supply is active listings
  // over average monthly closings, and the pulse row computed it from ITS OWN
  // active count — the literal-subdivision-name count for this slug. That is a
  // different number from the alias-aware count this page publishes, and on
  // 2026-08-12 it was different on every community carrying a pulse row:
  // tetherow 20 against the 36 here, vandevert-ranch 12 against 0. Publishing the
  // pulse's ratio beside this page's count merges two inventories under one
  // headline, and the arithmetic refutes it in both directions:
  //
  //   vandevert-ranch: "0 homes for sale" beside "72.0 months of supply" under an
  //     H1 reading "a buyer's market". With 0 actives the printed formula yields
  //     0, and zero inventory is definitionally not a buyer's market.
  //   tetherow: 36 actives against the same denominator is 9.0 months, a BUYER'S
  //     market, printed under an H1 reading "a balanced market".
  //
  // So the figure and the verdict it drives publish only when the pulse row's own
  // numerator IS the count on this page — which is exactly the case where the
  // pair itself came from that row. Otherwise the statistic cannot be verified
  // against what this page publishes and it does not ship (§0: cut it, never
  // approximate it). Days to pending survives the same disagreement because it is
  // a timing median over homes that went pending, carries no printed formula, and
  // drives no verdict; its trace names the pulse row as its source.
  const mosPublishable =
    mosRaw != null && activeCount != null && pulse?.activeCount === activeCount ? mosRaw : null
  // ── THE FIELD: the homes, as a spatial surface ────────────────────────────
  // ONE SET, COUNTED AND SHOWN. The Field plots and lists the SAME homes the
  // Instrument counts, so the two can never publish two inventories: when the
  // alias-aware branch produced the count, the alias tiles are the set, even when
  // that set is empty — listing subdivision-name tiles under a published 0 would
  // be the same merge defect one section lower. Every other branch that produces a
  // count from tiles produces it from communityTiles, and the two mart branches
  // produce a count with no tiles at all, so `rows.length === activeCount`
  // whenever live.fromTiles and `rows` is empty whenever it is not.
  const fieldTiles = aliasAwareCount != null ? resortTiles : communityTiles
  const fieldItems = communityFieldItems(fieldTiles, FIELD_LIST_CAP)
  const mapPins = fieldMapPins(fieldItems)
  const mapPolygon = _resortBoundary ?? (boundaryReliable ? boundaryMapData.polygon : null)
  const hasMap = mapPins.length > 0 || Boolean(mapPolygon)
  const posterSrc = communityImage(slug)
  const belongFigures = belongingFigures(richContent)
  const [firstBelong, ...restBelong] = belongFigures

  const browseHref = homesForSalePath(cityName, community.subdivision)
  const cityReportHref = citySlug ? `/housing-market/${citySlug}` : '/housing-market'

  // WHERE THE COUNT'S DOOR GOES. A figure reading "36 homes for sale" may only
  // link somewhere that publishes those 36. The subdivision browse page filters on
  // the literal MLS SubdivisionName, which is the undercount the alias-aware set
  // exists to correct — 36 here against 30 there on 2026-08-12 — so it is not that
  // door. When the count is a tile set, the set is on THIS page, in the Field, and
  // the Field is the door. When it came from a mart row instead, this page holds
  // no such list and the subdivision browse is the closest node that does.
  const closedFigures = buildClosedFigures({
    medianSalePrice: stats?.medianSalePrice ?? null,
    soldCount: stats?.soldCount ?? null,
    medianDaysOnMarket: stats?.medianDaysOnMarket ?? null,
    cityReportHref,
  })
  const [firstClosedFigure, ...restClosedFigures] = closedFigures

  // ── STRUCTURED DATA + FAQ ────────────────────────────────────────────────
  // HOA: the top-level registry estimate, falling back to the lowest
  // sub-neighborhood estimate when the parent carries none. Registry only, never
  // from the pulse row and never invented. (§0)
  const registryHoa = registryEntry?.hoa_annual_estimate ?? null
  const subNeighborhoodMinHoa =
    !registryHoa && registryEntry?.sub_neighborhoods?.length
      ? Math.min(
          ...registryEntry.sub_neighborhoods
            .map((s) => s.hoa_annual_estimate ?? Infinity)
            .filter((n) => n < Infinity),
        ) || null
      : null
  const faqHoaEstimate =
    registryHoa ?? (subNeighborhoodMinHoa !== null && isFinite(subNeighborhoodMinHoa) ? subNeighborhoodMinHoa : null)

  // School district — from the verified city-to-district registry in
  // data/co-schools.ts, the ONLY source allowed (§0). It answers undefined for a
  // city outside the service area, and the schools row and FAQ are then omitted
  // rather than fabricated.
  const schoolDistrictInfo = getDistrictForCity(cityName)

  // The pulse row is optional on a community (market_pulse_live carries no
  // neighborhood rows today), so the fields it would fill fall back to the
  // always-present snapshot. Written as one object so the JSON-LD below survives
  // a slow or missing market row instead of vanishing.
  const pulseFacts = pulse ?? {
    monthsOfSupply: null,
    medianDaysToPending: null,
    refreshedAt: snapshot?.refreshedAt ?? null,
  }

  const marketFaqInput: MarketFaqInput = {
    // The SAME figures the Instrument renders, so the answer, the Dataset, and
    // the page cannot disagree. The old chain ran separately and ended at a
    // closed-sale median, so the wrong number reached the structured data too.
    activeCount,
    medianListPrice,
    // The PUBLISHABLE months of supply, not the raw pulse value: the visible FAQ
    // answer, the FAQPage JSON-LD, and the Dataset's variableMeasured are the same
    // claim the Instrument makes. Feeding the raw value here republished the
    // contradiction the figure above no longer prints — vandevert-ranch answered
    // "72.0 months of supply, which is a buyer's market" on a page publishing 0
    // homes for sale, and shipped 72 as a machine-readable variable.
    monthsOfSupply: mosPublishable,
    medianDaysToPending: pulseFacts.medianDaysToPending,
    medianDaysOnMarket: stats?.medianDaysOnMarket ?? null,
    refreshedAt: pulseFacts.refreshedAt ?? live.stamp,
    soldCount12mo: stats?.soldCount ?? null,
    subdivisionAliases: registryEntry?.subdivision_aliases?.length ? registryEntry.subdivision_aliases : null,
    hoaAnnualEstimate: faqHoaEstimate,
    schoolDistrictName: schoolDistrictInfo?.district ?? null,
    schoolDistrictSlug: schoolDistrictInfo?.districtSlug ?? null,
  }
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(community.name, marketFaqInput)

  const communitySchemas = buildCommunitySchemas({
    slug,
    name: community.name,
    cityName,
    citySlug,
    hasMap,
    centerLonLat: registryEntry?.center_lon_lat ?? null,
    datasetVariables,
    asOfIso,
    asOfLabel,
    faqs,
  })

  // ── THE AUTHORED KNOWLEDGE + THE OUTBOUND EDGES ──────────────────────────
  const seoAbout = getCommunitySeoAbout(slug)
  const aboutParagraphs: string[] =
    seoAbout ??
    (richContent?.aboutProse.length
      ? richContent.aboutProse
      : [community.description ?? registryEntry?.description ?? ''].filter((p): p is string => Boolean(p && p.trim())))

  const knowledgeItems = buildPlaceKnowledge({
    name: community.name,
    city: cityName,
    aboutParagraphs,
    content: richContent,
    registry: registryEntry ?? null,
    schoolDistrictName: schoolDistrictInfo?.district ?? null,
    schoolDistrictSlug: schoolDistrictInfo?.districtSlug ?? null,
    isResort,
    // Only the alias-aware branch builds the published count out of these names.
    // three-rivers publishes its count from the market pulse row, and the Field
    // says so in its empty state, so the knowledge row may not tell the same
    // reader that every alias counts toward it.
    countIsAliasAware: aliasAwareCount != null,
    contactHref: `/contact?inquiryType=Buying&message=${encodeURIComponent(
      `I have questions about short-term rental rules in ${community.name}.`,
    )}`,
    amenityPosts,
  })

  const exploreItems = buildExploreEdges({
    communityName: community.name,
    cityName,
    citySlug,
    browseHref,
    cityReportHref,
    pagePath: `/communities/${slug}`,
    faqs,
    golfCourses: GOLF_COURSES.filter((c) => c.communitySlug === slug),
  })

  const trail = [
    { label: 'Home', href: '/' },
    { label: 'Communities', href: '/communities' },
    ...(cityName ? [{ label: cityName, href: citySlug ? `/cities/${citySlug}` : '/cities' }] : []),
    { label: community.name },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <CommunityPageTracker
          slug={slug}
          communityName={community.name}
          city={cityName}
          activeCount={activeCount}
          medianPrice={medianListPrice}
        />
        <V3SectionTracker pageType="community" />
        <MetadataBlock schemas={communitySchemas} />

        {posterSrc ? (
          <CommunityStage
            Stage={V3Stage}
            trail={trail}
            name={community.name}
            cityName={cityName}
            headline={belongingHeadline(community.name, richContent)}
            posterSrc={posterSrc}
            action={{
              label: fieldItems[0]?.title || `See ${community.name} houses`,
              href: fieldItems[0]?.href || '#homes',
            }}
          />
        ) : firstBelong ? (
          <>
          <V3Breadcrumb trail={trail} />
          <V3Instrument
            id="place"
            level={1}
            eyebrow={v3Text(`${community.name} · ${cityName}`)}
            headline={v3Text(belongingHeadline(community.name, richContent))}
            figures={[firstBelong, ...restBelong]}
            source={v3Text(belongingTrace(community.name))}
            action={{
              label: v3Text(`See ${community.name} houses`),
              href: '#homes',
              variant: 'ghost',
            }}
          />
          </>
        ) : (
          <>
          <V3Breadcrumb trail={trail} />
          <V3Quiet
            id="place"
            heading={belongingHeadline(community.name, richContent)}
            headingLevel={1}
            items={[{ label: `See ${community.name} houses`, href: '#homes' }]}
          />
          </>
        )}

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale in ${community.name}`}
          items={fieldItems}
          mapSlot={
            hasMap ? (
              <PlaceFieldMap
                pins={mapPins}
                boundary={mapPolygon ?? undefined}
                placeName={community.name}
                centerLonLat={registryEntry?.center_lon_lat ?? undefined}
              />
            ) : undefined
          }
          count={
            activeCount != null
              ? {
                  value: activeCount.toLocaleString('en-US'),
                  label: activeCount === 1 ? 'home for sale' : 'homes for sale',
                  source: live.trace,
                  updatedAt: live.stamp,
                }
              : undefined
          }
          emptyMessage={
            activeCount === 0
              ? `No single-family home is listed for sale in ${community.name} right now.`
              : activeCount == null
                ? `No active single-family listing in ${community.name} came back on this refresh.`
                : `The inventory count on this page comes from the ${community.name} market row, which carries the number without the listings behind it.`
          }
          footNote={
            fieldItems.length > 0
              ? `Listed here: ${community.name} homes. Map and list are the same set.`
              : undefined
          }
        />

        {knowledgeItems.length > 0 ? (
          <V3Quiet
            id="belonging"
            eyebrow={`${community.name} · Belonging`}
            heading={`Living in ${community.name}`}
            items={knowledgeItems}
          />
        ) : null}

        {firstClosedFigure ? (
          <V3Instrument
            id="closed-sales"
            level={2}
            eyebrow={v3Text(`${community.name} · Last 12 months`)}
            headline={v3Text(`What ${community.name} homes sold for`)}
            figures={[firstClosedFigure, ...restClosedFigures]}
            source={v3Text(
              `closed MLS sales through Oregon Data Share, ${community.name} single-family homes, rolling 365 days. Closed sales, not active inventory`,
            )}
            action={{ label: v3Text(`${cityName} market report`), href: cityReportHref, variant: 'ghost' }}
          />
        ) : null}

        <CommunityAlertSheet
          communityName={community.name}
          city={cityName}
          subdivision={community.subdivision}
        />

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading={`${community.name} real estate questions`}
          items={exploreItems}
          // THE VISIBLE FRESHNESS SIGNAL, AND IT IS THE SAME CLOCK THE MARKUP
          // PUBLISHES. The KB page rendered "Market data updated <label>" as its
          // own element; the migration replaced it with the Instrument's `updated`
          // prop, which reads live.stamp — and the pair carries no stamp on the
          // alias, boundary, and subdivision-name branches, so it never rendered on
          // a resort or a plain subdivision while the Dataset went on publishing
          // dateModified. asOfLabel and asOfIso come from one buildMarketFaq call,
          // so the sentence a human reads and the date a crawler reads are the same
          // value. It sits with the provenance line rather than under the figures
          // because it dates the market rows, not the live tile count beside them:
          // borrowing it upward would date one query's figures with another's clock.
          note={`Market figures on this page come from the regional MLS through Oregon Data Share.${
            asOfLabel ? ` Market data updated ${asOfLabel}.` : ''
          }`}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content, and <main> is
          sectioning content, so inside it the element is a generic and the page
          ships no contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
