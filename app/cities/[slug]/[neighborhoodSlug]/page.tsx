/**
 * /cities/<city>/<neighborhood> — the neighborhood grain.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md §3. Opens Instrument
 * (this neighborhood's pace) then Field of its houses. Daily life (schools,
 * parks) on the first path. Inventory is a Field caption, never the hero.
 * The old line "Places open Instrument then Field" is retired.
 * Parity: design_system/ryan-realty/ui_kits/neighborhood/parity.json.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata (same title, same description, same guard, same canonical path),
 * MetadataBlock JSON-LD (BreadcrumbList, Neighborhood Place, Dataset, FAQPage),
 * a rendered V3SectionTracker with pageType="neighborhood", generateStaticParams
 * returning [] with dynamicParams, revalidate 60, and the route's two params.
 * MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * THE PLACE LADDER STILL CLIMBS. Up is the breadcrumb (Home · city ·
 * neighborhood) and the city rows in the closing Quiet block; down is the
 * subdivision set; sideways is the peer-neighborhood set. Every rung is a real
 * link built from lib/slug or from the row's own href, so the graph
 * lib/data/geo/resolvePlaceContext describes is walkable in both directions
 * from this node.
 *
 * THE FIVE INVARIANTS THIS FILE IS WRITTEN TO HOLD:
 *
 *  1. ONE POPULATION PER SECTION, WITH ITS OWN TRACE AND ITS OWN STAMP. Three
 *     populations answer for this place and they do not agree, because they are
 *     not measuring the same thing: the market_pulse_live neighborhood row
 *     (live inventory), the market_stats_cache rolling-365d row (closed sales),
 *     and the recorded boundary polygon joined to the live listing index (what
 *     is actually plotted). Each one gets its own section, its own source line,
 *     and its own timestamp. None borrows another's, and every one of the three
 *     names Oregon Data Share, including the block that renders individual
 *     listing records.
 *  2. NO VERDICT OF THIS PAGE'S OWN. buildMarketFaq is the single derivation of
 *     the buyer's/seller's verdict for this geography, and it is the only thing
 *     on the page that states one. This page prints the months-of-supply FIGURE
 *     and the canonical clauses from lib/market/classify.ts, never a restated
 *     threshold and never a second classification that could disagree with the
 *     shared builder's. The figure goes through formatMonthsOfSupply, the one
 *     display rule, which is boundary-safe by construction, so the printed digits
 *     cannot classify differently from the raw value the builder classifies and
 *     there is nothing to suppress. An earlier revision rounded the figure here
 *     and withheld it whenever that rounding disagreed, on the written premise
 *     that "there is no third number to print". formatMonthsOfSupply is that
 *     number, and the page was already printing it in the closing Q&A.
 *  3. ABSENT IS NOT ZERO. A boundary read that timed out, a missing polygon, and
 *     a genuinely empty boundary are three different facts, and the Field says
 *     which one it is instead of rendering "0" under a live-MLS trace. Pace
 *     figures may be absent. When they are, a Quiet says so. Inventory never
 *     opens the page as a hero number.
 *  4. TWO COUNTS, TWO NAMES, AND THE PAGE SAYS WHY THEY DIFFER. The level-1
 *     figure and the Field's figure come off the SAME recorded polygon and the
 *     same feed. The only difference is the property population, and it is
 *     large: refresh_community_market_pulse() narrows to PropertyType A AND the
 *     'Single Family Residence' subtype, while listings_in_boundary joined to
 *     getListingTiles narrows to PropertyType A, a bucket that also holds
 *     townhouses and condominiums. Verified live 2026-08-12: Southern Crossing
 *     is 2 single-family against 16 in the bucket, 10 townhouses and 4 condos.
 *     Old Bend is 7 against 8. Both numbers are true. Publishing both under the
 *     words "active single-family listings", which this page did, made one of
 *     them false in the H1, in the visible Q&A, and in the FAQPage and Dataset
 *     markup. So: the headline figure reads "single-family homes for sale", the
 *     Field's reads "active homes inside the boundary", each source line states
 *     its own filter, the Field's line reconciles itself to the figure above it,
 *     and every Field row carries its home type. The KB page's own version of
 *     this bug is recorded in parity.json: it published the raw pin count, which
 *     the RPC returns for every property type, including land.
 *     A THIRD POPULATION USED TO SHIP UNDER THOSE WORDS TOO, on the branch with
 *     no pulse row: getNeighborhoodBySlug's name-matched, every-residential-type
 *     count, published as "single-family" by the meta description, the visible
 *     Q&A, the FAQPage markup and the Dataset variables. It is now named for what
 *     it is in all four, and the Field's empty message no longer calls the
 *     PropertyType A bucket single-family either. app/.../_v3/neighborhood-claims.ts
 *     holds every one of those sentences, so the population and the words that
 *     name it are chosen in one file.
 *  5. ONE PRIMARY PER VIEWPORT (PUBLIC_UI.md section 1) IS A VIEWPORT RULE, NOT A
 *     PAGE RULE, AND THE HEADER DOES NOT COVER MOBILE. Verified in the stylesheet
 *     and in a browser at 390x844: components/site/kb/kb.css declares
 *     `.topbar a.nav-cta { display:none }` and restores it only at
 *     `@media(min-width:880px)`, so the header's filled valuation CTA does not
 *     exist below 880px. The second copy sits inside a closed overlay menu. An
 *     earlier revision downgraded this Instrument's ask to a ghost on the stated
 *     premise that the header always carries the primary. That premise was false
 *     at the width most visitors arrive on, and it shipped the money route with
 *     no filled seller CTA at all, on a page whose KB predecessor carried three.
 *     The Instrument's ask is therefore PRIMARY. The alert Sheet's submit is the
 *     page's other solid control and sits several viewports below it, so no
 *     viewport carries two. V3Footer still carries no button.
 *
 * Data ONLY through @/lib/data and @/app/actions/cities. No raw .from() calls.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getNeighborhoodBySlug } from '@/app/actions/cities'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import {
  getMarketPulse,
  getMarketStats,
  getGeoBoundaryMapData,
  getListingTiles,
  getRecentBlogPosts,
  getCommunitiesInNeighborhoodLite,
} from '@/lib/data'
import { getCoMarketAnnual } from '@/lib/data/analytics/getCoMarketAnnual'
import { PLACE_MART_YEAR, placeMartCompositionChart, placeMartFigures, presentPlaceMart, regionMartContextTrace } from '@/app/cities/[slug]/_v3/city-mart'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { peerNeighborhoodTowns } from '@/lib/explore/neighborhood-peers'
// Row shaping shared with the city + community place pages — one copy, so a fix
// cannot land on one of the three and drift on the others.
import { buildActivityItems } from '@/lib/kb/place-sections'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildMarketFaq } from '@/lib/site/market-faq'
import type { SchemaInput } from '@/lib/site/json-ld'
import { formatDate } from '@/lib/format/date'
import { slugify, subdivisionListingsPath } from '@/lib/slug'
// The ONE way to build a valuation link on a content surface. It carries
// ?from=<this path>, which app/lp/seller-home-value/actions.ts turns into the
// lead's CRM source attribution. A bare /sell/valuation still converts; it just
// stops saying which page produced the seller, and completed valuations per page
// is what this route is measured on (migration-recipe.md addendum 1).
import { valuationHref } from '@/lib/site/valuation-href'
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
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { NeighborhoodAlertsSheet } from './_v3/NeighborhoodAlertsSheet.client'
import {
  aboutItems,
  BANNED_DESCRIPTION_RE,
  BOUNDARY_PIN_CAP,
  edge,
  fieldCountTrace,
  fieldItems,
  liveFallbackFigures,
  liveFallbackTrace,
  liveFigures,
  livePulseTrace,
  neighborhoodActivityRows,
  shipsFigure,
  soldFigures,
} from './_v3/neighborhood-sections'
import { dailyLifeRows } from './_v3/neighborhood-daily-life'
import { NeighborhoodActivityLedger } from './_v3/NeighborhoodActivityLedger'
// Every sentence this page publishes ABOUT a figure. See that file's header for
// the one rule they all obey: no claim may outrun its payload.
import {
  fallbackFaqSet,
  fieldEmptyMessage,
  fieldFootNote,
  neighborhoodDescription,
  neighborhoodSchemas,
} from './_v3/neighborhood-claims'

export async function generateStaticParams(): Promise<Array<{ slug: string; neighborhoodSlug: string }>> {
  return []
}
export const dynamicParams = true
export const revalidate = 60

type Props = { params: Promise<{ slug: string; neighborhoodSlug: string }> }

// Metadata — the banned-cliche guard that keeps a curated seo_description
// carrying "charming" off the SERP is unchanged from the KB page. The generated
// description is NOT: it named the wrong population. See below.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: citySlug, neighborhoodSlug } = await params
  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const title =
    neighborhood.seoTitle?.trim() ||
    `${neighborhood.name} homes for sale | ${neighborhood.cityName}, Oregon`

  // THE SAME ROW THE PAGE'S H1 FIGURE COMES OFF, read here for one reason: the
  // description publishes a count, and a count in a snippet carries no source
  // line to reconcile it. Describing getNeighborhoodBySlug's all-residential-type
  // number under the words "single-family" was false on every neighborhood, and
  // on the 28 that carry a pulse row it also disagreed with the figure the page
  // itself prints. Same cache key and same cache window as the page's own read,
  // so this is one cached row, not a second query per render.
  const pulse = await withTimeoutFallback(
    getMarketPulse({ geoType: 'neighborhood', geoSlug: `${citySlug}-${neighborhoodSlug}` }),
    null,
    3000,
    'nbh:meta-pulse',
  )
  const description =
    neighborhood.seoDescription && !BANNED_DESCRIPTION_RE.test(neighborhood.seoDescription)
      ? neighborhood.seoDescription
      : neighborhoodDescription(neighborhood, pulse)

  return pageMetadata({
    title,
    description,
    path: `/cities/${citySlug}/${neighborhoodSlug}`,
  })
}

export default async function NeighborhoodDetailPage({ params }: Props) {
  const { slug: citySlug, neighborhoodSlug } = await params

  const neighborhood = await getNeighborhoodBySlug(citySlug, neighborhoodSlug)
  if (!neighborhood) notFound()

  const cityName = neighborhood.cityName
  // A blank name would throw inside v3Text, which is the correct behavior for a
  // heading that names a region — but not worth a 500 on a public URL.
  const placeName = neighborhood.name?.trim() || 'This neighborhood'
  // Boundary + cache slug for a neighborhood is "{citySlug}-{neighborhoodSlug}".
  // Verified live 2026-08-12: market_pulse_live carries 28 neighborhood rows on
  // this key (bend-awbrey-butte, …) and market_stats_cache carries 74
  // rolling-365d rows per neighborhood on the same key. The bare slug carries
  // none, so the city qualifier is load-bearing.
  const geoSlug = `${citySlug}-${neighborhoodSlug}`

  // THE THIRD POPULATION'S STAMP. The pulse row and the stats row each carry a
  // refreshed_at written by the job that computed them, and each Instrument
  // prints its own. The boundary set has no such column: it is a join executed on
  // THIS render, so the moment of the read is the only honest freshness claim
  // available, and it is taken here rather than after the awaits so it names when
  // the reads were issued. Without it the one block that renders individual
  // listing records was the only live figure on the page a reader could not date
  // (invariant 1: its own section, its own source line, its own timestamp).
  const readAt = new Date().toISOString()

  const [pulseRead, stats, boundaryRead, blogPosts, communities, richContent, peers, activity, regionMartRow] =
    await Promise.all([
      // Result variant, because the branch this read selects also selects the
      // SENTENCE printed under the figures. "No market-pulse row is published for
      // this neighborhood" is a claim about the world; a 3.5s deadline is a fact
      // about this render, and the two must not be spelled the same way.
      withTimeoutFallbackResult(getMarketPulse({ geoType: 'neighborhood', geoSlug }), null, 3500, 'nbh:pulse'),
      withTimeoutFallback(
        getMarketStats({ geoType: 'neighborhood', geoSlug, periodType: 'rolling_365d' }),
        null,
        3500,
        'nbh:stats',
      ),
      // Result variant: a timed-out boundary yields `{ pins: [] }`, which is
      // indistinguishable from a genuinely empty neighborhood. `.ok` keeps them
      // apart so a degraded read can never publish a count (section 0).
      withTimeoutFallbackResult(
        getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug }),
        { polygon: null, pins: [] },
        4500,
        'nbh:boundary',
      ),
      withTimeoutFallback(getRecentBlogPosts({ cityName, limit: 3 }), [], 3000, 'nbh:blog'),
      withTimeoutFallback(getCommunitiesInNeighborhoodLite(neighborhood.id), [], 3500, 'nbh:communities'),
      // Verified neighborhood depth from
      // data/resort-community-{citySlug}-{neighborhoodSlug}.json — the same curated
      // source the resort pages render, keyed by the boundary slug. Null until
      // authored, and the About block then falls back to the table description.
      withTimeoutFallback(getResortCommunityContent(geoSlug), null, 2500, 'nbh:content'),
      withTimeoutFallback(peerNeighborhoodTowns(citySlug, neighborhoodSlug), [], 3500, 'nbh:peers'),
      // The live feed for this city. Scoped to the boundary below when the polygon
      // returns membership keys, and LABELLED with whichever scope it actually got —
      // a city-wide feed under a neighborhood's name is the mislabelling that took
      // this section off the community node (D93, §0).
      withTimeoutFallback(
        getActivityFeedWithFallbackMulti({ cities: [cityName], limit: 8 }),
        [],
        3500,
        'nbh:activity',
      ),
      getCoMarketAnnual({ year: PLACE_MART_YEAR, typeScope: 'all' }),
    ])

  const pulse = pulseRead.value
  const boundary = boundaryRead.value
  const boundaryKeys = boundary.pins.map((p) => p.listingKey)
  // The RPC filters only StandardStatus='Active', so the single-family narrowing
  // has to happen here or every count and every row below is a different claim
  // from the one the page makes (invariant 4).
  //
  // Result variant for the same reason the boundary read uses one: this read's
  // ROW COUNT is the figure the Field publishes, and its timeout fallback is the
  // empty array, which is indistinguishable from a boundary that really holds no
  // single-family listing. Guarding only the boundary read was not enough — a
  // 4.5s tiles timeout under a healthy boundary printed "0 active single-family
  // listings inside the Old Bend boundary" under a live-MLS trace, on a
  // neighborhood that had seven (caught in browser verification, 2026-08-12).
  const tilesRead =
    boundaryKeys.length > 0
      ? await withTimeoutFallbackResult(
          getListingTiles({ listingKeys: boundaryKeys, status: 'active', propertyType: 'A', limit: 250 }),
          [],
          4500,
          'nbh:tiles',
        )
      : { value: [], ok: boundaryRead.ok }
  const tiles = tilesRead.value

  const browsePath = subdivisionListingsPath(cityName, placeName)
  const cityReportPath = `/housing-market/${citySlug}`

  /* ── SECTION 1 · pace ───────────────────────────────────────────────────── */
  // Months of supply ships through formatMonthsOfSupply. The pace figure carries
  // the verdict. Inventory is a Field caption, never the hero.
  const mosShips = shipsFigure(pulse?.monthsOfSupply)

  const liveSet = pulse
    ? liveFigures(pulse, { browse: browsePath, cityReport: cityReportPath, monthsOfSupply: '/months-of-supply' })
    : liveFallbackFigures(neighborhood, browsePath)

  // Trace and stamp follow the same branch as the figures. The pulse line is
  // short: the pace figure carries the verdict, and the MoS threshold essay
  // stays off this page.
  const liveTrace = pulse
    ? livePulseTrace(placeName, {
        // shipsFigure is the SAME predicate liveFigures renders on, so the trace
        // covers exactly the figures that shipped: no argument for a figure that
        // is absent, no figure without the argument that covers it.
        showDaysToPending: shipsFigure(pulse.medianDaysToPending),
        showMonthsOfSupply: mosShips,
      })
    : liveFallbackTrace(placeName, cityName, pulseRead.ok ? 'ok' : 'timeout')
  const liveStamp = pulse?.refreshedAt ?? null

  /* ── SECTION 2 · the boundary set ───────────────────────────────────────── */
  // A count publishes only from a read that SUCCEEDED, against a polygon that
  // exists, below the RPC's row cap. At the cap the true total is higher than
  // the rows returned, so the figure would understate (invariant 3).
  const countIsHonest =
    boundaryRead.ok && tilesRead.ok && boundary.polygon != null && boundary.pins.length < BOUNDARY_PIN_CAP
  const rows = fieldItems(tiles)
  const hasGoogleMap = false
  const emptyMessage = fieldEmptyMessage(placeName, {
    boundaryOk: boundaryRead.ok,
    hasPolygon: boundary.polygon != null,
    tilesOk: tilesRead.ok,
  })

  /* ── SECTION 3 · closed sales, rolling 12 months ────────────────────────── */
  const regionMart = presentPlaceMart(regionMartRow, 'region')
  const martSet = placeMartFigures(regionMart, `/housing-market/history?year=${PLACE_MART_YEAR}`)
  const soldSet = stats ? [...soldFigures(stats), ...martSet] : []
  const paceSet = soldSet.length > 0 ? liveSet : [...liveSet, ...martSet]
  const [firstLive, ...restLive] = paceSet
  const [firstSold, ...restSold] = soldSet

  /* ── SECTION 3b · the live feed ─────────────────────────────────────────── */
  // Prefer the IN-BOUNDARY events when the polygon gave us membership keys, and fall
  // back to the city-wide feed otherwise — with the eyebrow naming whichever scope was
  // actually used. The label follows the data; the data never follows the label (§0).
  const boundaryKeySet = new Set(boundaryKeys)
  const activityScoped = activity.filter((a) => boundaryKeySet.has(a.listing_key))
  const activityIsScoped = activityScoped.length > 0
  const [firstAct, ...restAct] = neighborhoodActivityRows(
    buildActivityItems(activityIsScoped ? activityScoped : activity, { staleNewAfterDays: 21 }),
  )

  /* ── SECTION 4 · verified depth ─────────────────────────────────────────── */
  const about = aboutItems(richContent, neighborhood.description)
  const [firstDaily, ...restDaily] = dailyLifeRows(richContent, cityName)
  const hasDaily = firstDaily != null
  const hasSold = firstSold != null && stats != null
  const hasActivity = firstAct != null
  const activityAfterSold = hasActivity && (hasSold || hasDaily === false)
  const activityAfterAbout = hasActivity && hasSold === false && hasDaily && about.length > 0
  const activityAfterSheet = hasActivity && hasSold === false && hasDaily && about.length === 0
  const activitySource = activityIsScoped
    ? `live MLS through Oregon Data Share, new listings, price changes, pendings, and closings on homes inside the recorded ${placeName} boundary`
    : `live MLS through Oregon Data Share, new listings, price changes, pendings, and closings across ${cityName}. No event landed inside the recorded ${placeName} boundary on this refresh, so this feed is the city's, and it is labelled as the city's.`

  /* ── AI-citable verified Q&A + structured data ──────────────────────────── */
  // ONE DERIVATION PER BRANCH, AND EACH ONE NAMES THE POPULATION IT READ.
  // buildMarketFaq is the single derivation for the pulse row, including the
  // buyer's/seller's verdict, and it is the only thing on this page that states
  // one (invariant 2). Its prose is written for the single-family population, so
  // it is the right builder for that row and the wrong one for the other branch:
  // handing it getNeighborhoodBySlug's all-residential-type numbers published
  // them as "active single-family listings" in the visible Q&A, the FAQPage
  // markup and the Dataset variables at once, on the same page whose own source
  // line says that count is not the single-family subtype. That branch now
  // builds its own pair, in its own words, with no verdict to state because the
  // months-of-supply column lives only on the pulse row.
  const { faqs, datasetVariables, asOfIso, asOfLabel } = pulse
    ? buildMarketFaq(placeName, pulse)
    : fallbackFaqSet(placeName, cityName, neighborhood)

  /* ── SECTION 5 · the graph's outbound edges ─────────────────────────────── */
  const exploreItems: V3QuietItem[] = [
    ...faqs.map((item) => ({ kind: 'prose' as const, term: item.question, body: item.answer })),
    ...edge(`Every ${placeName} home for sale`, browsePath),
    ...edge(`${cityName} overview`, `/cities/${citySlug}`),
    ...edge(`All ${cityName} homes for sale`, `/homes-for-sale/${citySlug}`),
    ...edge(`${cityName} market report`, cityReportPath),
    ...(mosShips ? edge('Months of supply, defined', '/months-of-supply') : []),
    ...communities
      .slice(0, 12)
      .flatMap((c) => edge(`${c.name} homes for sale`, c.name?.trim() ? `/subdivisions/${slugify(c.name)}` : null)),
    ...peers.slice(0, 12).flatMap((p) => edge(`${p.name} homes for sale`, p.href)),
    ...edge('Every Central Oregon city', '/cities'),
    ...edge(`Open houses in ${cityName}`, `/open-houses/${citySlug}`),
    ...edge('Recent price drops', '/price-drops'),
    ...blogPosts.flatMap((p) => edge(p.title, p.slug?.trim() ? `/blog/${p.slug}` : null)),
    ...edge('Value my home', valuationHref(`/cities/${citySlug}/${neighborhoodSlug}`)),
    // The destination the KB alert block's post-submit line carried. A terminal
    // V3Sheet step takes prose and no links, so the anchor could not survive
    // inside the Sheet. It survives here, in the block that holds this page's
    // outbound edges, with the same label and the same href.
    ...edge('Sign in to manage alerts', '/login?returnUrl=%2Faccount%2Fsaved-searches'),
    // The outbound MLS citation the KB page rendered through MarketSources.
    // Same anchor text, same href, same reason: every listing count, median,
    // and days figure above traces to Oregon Data Share. MarketSources also
    // carried a clause naming what Oregon Data Share IS, and that clause is not
    // lost either: it opens the Field's source line, over the block that renders
    // individual listing records.
    ...edge('Oregon Data Share', 'https://www.oregondatashare.com'),
  ]

  /* ── JSON-LD ────────────────────────────────────────────────────────────── */
  // All four payloads, built beside the sentences that describe them (the
  // Dataset's description is derived from the variables it carries). Still
  // emitted only through MetadataBlock, below.
  const schemas: SchemaInput[] = neighborhoodSchemas({
    placeName,
    cityName,
    citySlug,
    neighborhoodSlug,
    hasPulse: pulse != null,
    hasMap: hasGoogleMap,
    pins: boundary.pins,
    faqs,
    datasetVariables,
    asOfIso,
    asOfLabel,
  })

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />

        <V3SectionTracker pageType="neighborhood" />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: cityName, href: `/cities/${citySlug}` },
            { label: placeName },
          ]}
        />

        {firstLive ? (
          <V3Instrument
            id="market"
            level={1}
            eyebrow={v3Text(`${placeName} · ${cityName}, Oregon`)}
            headline={v3Text(`${placeName} homes for sale`)}
            figures={[firstLive, ...restLive]}
            source={v3Text(soldSet.length > 0 || regionMart == null ? liveTrace : `${liveTrace} ${regionMartContextTrace(regionMart)}`)}
            updated={liveStamp ? v3Text(formatDate(liveStamp)) : undefined}
            action={
              rows[0]
                ? { label: v3Text(rows[0].title), href: rows[0].href, variant: 'ghost' }
                : { label: v3Text(`Save ${placeName}`), href: '#alerts', variant: 'ghost' }
            }
          />
        ) : (
          <V3Quiet
            id="market"
            heading={`${placeName} homes for sale`}
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No pace figure on this refresh',
                body: `The ${placeName} market row did not return a months-of-supply or days-to-pending figure, so this page is not printing one.`,
              },
            ]}
          />
        )}

        <V3Field
          id="homes"
          ariaLabel={`Homes for sale in ${placeName}`}
          items={rows}
          count={
            countIsHonest
              ? {
                  value: tiles.length.toLocaleString('en-US'),
                  label: `active homes inside the ${placeName} boundary`,
                  source: fieldCountTrace(placeName),
                  updatedAt: readAt,
                }
              : undefined
          }
          footNote={fieldFootNote(rows.length, tiles.length, countIsHonest)}
          emptyMessage={emptyMessage}
        />

        {firstDaily ? (
          <V3Ledger
            id="daily-life"
            eyebrow={v3Text(`${placeName} · Daily life`)}
            heading={v3Text(`Schools and parks in ${placeName}`)}
            rows={[firstDaily, ...restDaily]}
          />
        ) : null}

        {firstSold && stats ? (
          <V3Instrument
            id="sold"
            level={2}
            eyebrow={v3Text('Closed sales')}
            headline={v3Text(`What sold in ${placeName} over the last 12 months`)}
            figures={[firstSold, ...restSold]}
            source={v3Text(`closed MLS sales through Oregon Data Share, single-family, ${placeName}, rolling 12 months ending ${formatDate(stats.periodEnd)}. Methodology ${stats.methodologyVersion}. Not active inventory.` + (regionMart ? ` ${regionMartContextTrace(regionMart)}` : ''))}
            chart={placeMartCompositionChart(regionMart)}
            updated={stats.refreshedAt ? v3Text(formatDate(stats.refreshedAt)) : undefined}
          />
        ) : null}

        {activityAfterSold && firstAct ? (
          <NeighborhoodActivityLedger
            placeName={placeName}
            cityName={cityName}
            scoped={activityIsScoped}
            rows={[firstAct, ...restAct]}
            source={activitySource}
          />
        ) : null}

        {about.length > 0 ? (
          <V3Quiet id="about" eyebrow={`${placeName} · ${cityName}`} heading={`About ${placeName}`} items={about} />
        ) : null}

        {activityAfterAbout && firstAct ? (
          <NeighborhoodActivityLedger
            placeName={placeName}
            cityName={cityName}
            scoped={activityIsScoped}
            rows={[firstAct, ...restAct]}
            source={activitySource}
          />
        ) : null}

        <NeighborhoodAlertsSheet cityName={cityName} neighborhoodName={placeName} />

        {activityAfterSheet && firstAct ? (
          <NeighborhoodActivityLedger
            placeName={placeName}
            cityName={cityName}
            scoped={activityIsScoped}
            rows={[firstAct, ...restAct]}
            source={activitySource}
          />
        ) : null}

        {/* ONE SECTION, AND ITS NAME COVERS BOTH HALVES OF WHAT IS IN IT. Four
            verified questions, then roughly thirty outbound edges. An earlier
            revision named this block "Common questions", which described the
            first four rows and misdescribed every row after them, including the
            accessible name a screen reader announces for the landmark.

            It is one section rather than four because PUBLIC_UI.md section 3
            caps a page at four of the six patterns and forbids two adjacent
            sections sharing one, and this node already spends its four on
            Instrument, Field, Sheet, and Quiet. That leaves exactly two Quiet
            slots, one on each side of the Sheet, and the About block holds the
            other. Splitting the FAQ off would put two Quiets side by side on any
            neighborhood with no closed-sales row. The cost is recorded in
            parity.json under barrelGaps. */}
        <V3Quiet
          id="explore"
          eyebrow="Questions and next steps"
          heading={`Questions about ${placeName}, and where to go next`}
          items={exploreItems}
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
