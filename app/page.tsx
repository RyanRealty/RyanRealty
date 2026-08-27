import type { Metadata } from 'next'

import { getListingTiles, getDetachedOverlays } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import {
  formatPulseCityRemainderPublic,
  namePulseCityRemainder,
  pulseCityHrefSlug,
} from '@/lib/market/pulse-city-remainder'
import { curateFeaturedTiles } from '@/lib/kb/curate-featured'
import { buildYearSeries } from '@/lib/kb/year-series'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'
import { homesForSalePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { getPublicDetachedMonthly, leftoverOrCacheMonthly, dropCurrentMonth } from '@/lib/data/market-truth/public-monthly'
import {
  placeFigureRows,
  communityRows,
  marketAbsenceItems,
  leftoverMarketFigures,
  CITY_PACE_KEYS_ON_THE_HUD,
  placeMedianChart,
  PLACE_COUNT_TRACE,
  type CityPlaceItem,
  type CityCommunityItem,
} from '@/app/cities/[slug]/_v3/city-sections'
import { zonedDateKey } from '@/lib/format/date'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Stage,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  type V3QuietItem,
} from '@/components/site/v3'
import { HomeHomesField } from './_v3/HomeHomesField'
import { homeFieldItems } from './_v3/home-field-items'
import { liveStamp } from './_v3/live-format'
import {
  HERO_VIDEO,
  HERO_POSTER,
  HOME_FIELD_LIMIT,
  HOME_TILE_FETCH,
  HOME_COUNT_TRACE,
  HOME_COMMUNITY_TRACE,
  HOME_MARKET_TRACE,
  homeFieldNote,
} from './_v3/home-constants'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
// THE FOUR SECTIONS THE PATTERN CAP HAD DELETED (Matt 2026-08-27). Every one of
// them is an EXISTING v3 treatment mounted here, not a new component: the ban on
// growing the shop still stands, and it never needed to be broken -- the cap
// did the deleting, not a missing primitive.
import { getBrokers } from '@/lib/data'
import { TESTIMONIALS } from '@/lib/testimonials'
import { AboutFaces } from '@/app/about/_v3/AboutFaces'
import { aboutFaceFromBroker, type AboutFace } from '@/app/about/_v3/about-faces'
import { TEAM_RANK } from '@/app/team/_v3/team-constants'
import { SellValueForm } from '@/app/sell/_v3/SellValueForm'
import { HomeAlertSheet } from './_v3/HomeAlertSheet.client'
import communityVideoManifest from '@/data/city-hero-videos.resolved.json'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`
// D11 seo-shell lock: this exact town list stays in source. The live hero
// count is leftover region inventory, so the count sentence names that grain.
const D11_HOMEPAGE_LEAD =
  'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.'
// D19 + ci:seo-shell: the count is the leftover region HUD row, and the
// sentence it sits in names the regional grain, never a town door from
// TOWN_ORDER below. ci:pulse-city-remainder reads both out of this file.
const HERO_COUNT_LEAD = 'homes for sale across Central Oregon. Live list prices and days on market.'

/**
 * Homepage — Homes destination on the components/site/v3 barrel, Broadside
 * register (PUBLIC_UI §9). CHROME: app/layout.tsx mounts V3Chrome; this page
 * renders V3Footer outside <main> (contentinfo landmark) and nothing else.
 *
 * FOUR PATTERNS (the homepage is not in the place-family fifth-pattern
 * exception): Stage (the Bend flyover hero Matt keeps — 0af80821: the drone
 * footage, not the rejected 3D-tiles render) · Field (map + the curated listed
 * set) · Ledger (towns, then communities — non-adjacent) · Instrument (the
 * market, then once per other property type, the ZIP/plat grouping). The
 * absence branch swaps Instrument for a Quiet that states the miss.
 * No two adjacent sections share a pattern in any branch.
 *
 * Every figure is live from the DAL (§0); the leftover Market Truth row is the
 * one source for the region KPIs (D78), and a missing cell is omitted, never
 * zero-filled. ISR cache at 60s.
 */
export const revalidate = 60

export const metadata: Metadata = {
  // Layer A discovery shell (Matt 2026-08-10): exact-match money query language.
  title: 'Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver',
  description:
    `Active homes for sale in ${D11_HOMEPAGE_LEAD} Closed comps from the regional MLS.`,
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Homes for Sale in Central Oregon | Ryan Realty',
    description:
      'Active homes for sale in Bend, Redmond, Sisters, and Sunriver. Live list prices, days on market, and closed comps.',
    url: siteUrl,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630, alt: 'Homes for Sale in Central Oregon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver',
    description: 'Active Central Oregon homes for sale. List prices and days on market, town by town.',
  },
}

const TOWN_ORDER = ['bend', 'la-pine', 'redmond', 'sunriver', 'sisters', 'terrebonne']
const TOWN_IMG: Record<string, string> = {
  bend: '/images/kb/bend-drake-park-aerial.jpg',
  'la-pine': '/images/kb/vandevert-ranch.jpg',
  redmond: '/images/kb/redmond-downtown-aerial.jpg',
  sunriver: '/images/kb/sunriver-deschutes-river.jpg',
  sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}

// Each featured community keeps its silent Area Guide clip flag (graded + hosted
// by scripts/sync-city-videos.mjs) via `videoSlug` → data/city-hero-videos.resolved.json.
// The clip plays on the community's own node; here the flag marks the row.
const COMM_FEATURED = [
  { match: 'tetherow', town: 'Bend', img: '/images/kb/tetherow-golf-aerial.jpg', videoSlug: 'tetherow' },
  { match: 'caldera', town: 'Sunriver', img: '/images/kb/caldera-springs.jpg', videoSlug: 'caldera-springs' },
  { match: 'broken top', town: 'Bend', img: '/images/kb/broken-top.jpg', videoSlug: 'broken-top' },
  { match: 'northwest crossing', town: 'Bend', img: '/images/kb/northwest-crossing.jpg', videoSlug: 'northwest-crossing' },
]

export default async function Home() {
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [cities, communities, tiles, priceHist, cityPulse, publicPace, leftoverMonthly, regionOverlays, brokers] = await Promise.all([
    getCitiesForIndex().catch(() => []),
    getCommunitiesForIndex().catch(() => []),
    // SFR sub-type since C-02: the sibling geo Fields all pull Single Family
    // Residence so the listed set matches the detached grain the count states.
    getListingTiles({ status: 'active', propertySubType: 'Single Family Residence', limit: HOME_TILE_FETCH }).catch(() => []),
    getPriceHistory('region', 'central-oregon', 'monthly', 60).catch(() => []),
    getMarketPulseAllCitySnapshots().catch(() => []),
    getPublicDetachedPace({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => EMPTY_PUBLIC_PACE),
    getPublicDetachedMonthly({
      geoType: 'region',
      geoSlug: 'central-oregon',
      currentMonthKey,
    }).catch(() => []),
    getDetachedOverlays([{ geoType: 'region', geoSlug: 'central-oregon' }]).catch(() => new Map()),
    getBrokers().catch(() => []),

  ])
  const regionMt = regionOverlays.get('region:central-oregon')
  const chartMonths = leftoverOrCacheMonthly(leftoverMonthly, dropCurrentMonth(priceHist, currentMonthKey))
  const hud = leftoverHudKpis({
    grain: 'region',
    headlines: regionMt?.headlines ?? null,
    inventory: regionMt?.inventory ?? null,
    pace: publicPace,
  })
  const leftoverStamp = regionMt?.headlines?.computedAt ?? regionMt?.inventory?.computedAt ?? null

  // ── Towns (Ledger 1) — the same rows the KB town cards carried ────────────
  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const townItems: CityPlaceItem[] = TOWN_ORDER.flatMap((slug): CityPlaceItem[] => {
    const c = cityBySlug.get(slug)
    if (!c) return []
    return [{ name: c.name, activeCount: c.activeCount, medianPrice: c.medianPrice, href: `/cities/${slug}`, img: TOWN_IMG[slug] ?? '' }]
  })
  // The three brokers, in the order /team and /about publish them, through the
  // same adapter both of those pages use.
  const faces: AboutFace[] = [...brokers]
    .sort((a, b) => (TEAM_RANK[a.slug.split('-')[0] ?? ''] ?? 9) - (TEAM_RANK[b.slug.split('-')[0] ?? ''] ?? 9))
    .map((b) => aboutFaceFromBroker(b))
    .filter((face): face is AboutFace => face !== null)

  // The reviews, in the shape /team renders them in.
  const testimonialItems: V3QuietItem[] = TESTIMONIALS.slice(0, 8).map((t) => ({
    kind: 'prose' as const,
    term: t.author,
    body: t.quote,
  }))

  const townRemainder = formatPulseCityRemainderPublic(
    namePulseCityRemainder({
      regionActive: hud.active,
      displayedLabels: townItems.map((t) => t.name),
      allCities: cityPulse.map((row) => ({
        label: row.geo_label,
        active: row.active_count,
        slug: pulseCityHrefSlug(row.geo_slug || row.geo_label),
      })),
    }),
  ).join(' ')
  const [firstTownRow, ...restTownRows] = placeFigureRows(townItems, 'City')

  // ── Communities (Ledger 2) — the index count, verbatim (ci:publish-resort-index-figures)
  const communityVideos = communityVideoManifest as Record<string, { video?: string } | undefined>
  // DB rows carry raw MLS casing ("caldera springs") — display gets title case;
  // already-cased names (NorthWest Crossing) pass through.
  const titleCaseName = (s: string) => s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase())
  const communityItems: CityCommunityItem[] = COMM_FEATURED.flatMap((f): CityCommunityItem[] => {
    const c = communities.find((x) => x.subdivision.toLowerCase().includes(f.match))
    if (!c) return []
    const cv = communityVideos[f.videoSlug]
    return [{
      name: titleCaseName(c.subdivision),
      activeCount: c.activeCount,
      medianPrice: c.medianPrice ?? null,
      town: f.town,
      href: `/communities/${c.slug}`,
      img: f.img,
      video: cv?.video ? { url: cv.video, embedType: 'video-tag' as const } : null,
    }]
  })
  const [firstCommunityRow, ...restCommunityRows] = communityRows(communityItems)

  // ── The Field — the curated listed set + the map plotting that same set ───
  const curated = curateFeaturedTiles(
    tiles,
    townItems.map((t) => ({ name: t.name, medianPrice: t.medianPrice })),
    HOME_FIELD_LIMIT,
  )
  const fieldItems = homeFieldItems(curated, HOME_FIELD_LIMIT)
  const pins = fieldItems.flatMap((i) =>
    i.lat != null && i.lng != null
      ? [{ id: i.id, href: i.href, priceLabel: i.priceLabel, title: i.title, lat: i.lat, lng: i.lng }]
      : [],
  )

  // ── The market (Instrument) — ONE verdict derivation off the leftover row ──
  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const verdict = marketVerdict(mosRaw)
  const mosLabel = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null
  const hasVerdict = verdict.kind !== 'unknown' && mosLabel != null
  const marketHeadline = hasVerdict
    ? `Is Central Oregon a buyer's or seller's market?`
    : 'The Central Oregon market'
  const verdictSentence = hasVerdict
    ? `Central Oregon has ${mosLabel} months of supply, which is a ${verdict.label}.`
    : null
  // THE ANSWER, NOT THE REPORT (2026-08-27, closing this page's recorded
  // defect: "SIXTEEN market figures in one row... the answer is lost inside
  // it"). The homepage owes the verdict plus the handful of figures a buyer
  // actually reads; /housing-market owns the full set and is the door below.
  // Every figure still arrives through leftoverMarketFigures off the ONE
  // leftover hud row, which is the mechanism the publish gates pin.
  const HOME_FIGURE_LABELS = new Set([
    'median list price',
    'detached homes for sale',
    'months of supply',
    'median to pending · 90 days',
    'sale to list',
  ])
  const figures = leftoverMarketFigures(hud, {
    browse: publishRegionalSearchHref(),
    monthsOfSupply: '/months-of-supply',
  }).filter((f) => HOME_FIGURE_LABELS.has(String(f.label)))
  const [firstMarketFigure, ...restMarketFigures] = figures
  const medianChart = placeMedianChart(
    buildYearSeries(chartMonths.months, 5),
    `Median close by month, ${chartMonths.leftoverUsed ? 'Market Truth leftover' : 'single-family'}, Central Oregon`,
  )
  const marketSource = `${HOME_MARKET_TRACE}${mosLabel != null ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : ''}`

  // The KbFooter per-town fine print, carried onto V3Footer's note slot. Towns
  // missing a figure are omitted rather than dashed.
  const footerFine = townItems
    .filter((t) => t.activeCount != null && t.medianPrice != null)
    .map((t) => `${t.name} ${(t.activeCount as number).toLocaleString('en-US')} / ${formatPriceExact(t.medianPrice as number)}`)
    .join(' · ')

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />

        {/* Pattern 4, Stage — the hero Matt keeps: the Bend flyover clip over
            the Old Mill still, the D11 H1, one primary. Stage carries no
            figures (never over a number); the count line opens the Field. */}
        <V3Stage
          id="hero"
          headingLevel={1}
          eyebrow="Central Oregon Real Estate"
          headline={v3Text('Homes for Sale in Central Oregon')}
          posterSrc={HERO_POSTER}
          videoSrc={HERO_VIDEO}
          action={{ label: 'See homes', href: publishRegionalSearchHref(), variant: 'primary' }}
        />

        {/* Pattern 2, Field — houses fill the fold: the count line is the
            leftover region row (D19/D78), towns are ghost filters, and the map
            plots exactly the homes the list shows. */}
        <HomeHomesField
          fieldItems={fieldItems}
          towns={townItems.map((t) => ({ label: t.name, href: homesForSalePath(t.name) }))}
          count={
            hud.active != null
              ? {
                  value: hud.active.toLocaleString('en-US'),
                  label: HERO_COUNT_LEAD,
                  source: HOME_COUNT_TRACE,
                  updatedAt: leftoverStamp,
                }
              : undefined
          }
          mapSlot={
            pins.length > 0
              ? <PlaceFieldMap pins={pins} placeName="Central Oregon" posterSrc={fieldItems[0]?.photoSrc} />
              : undefined
          }
          mapNote={fieldItems.length > 0 ? homeFieldNote(fieldItems.length) : undefined}
          emptyMessage="No photographed active single-family home with a list price and a street address returned on this refresh."
        />

        {/* Pattern 3, Ledger — the towns, with the leftover remainder named so
            the region total and the town table cannot silently disagree (D21). */}
        {/* The heading names ACTIVE INVENTORY, because that is what the rows are:
            each town's active single-family count and its median LIST price, under
            PLACE_COUNT_TRACE ("active single-family listings, counted per place").
            It read "Where the sales are happening" until 2026-08-27 -- a sales
            claim over listing data, which is the label-versus-behaviour defect
            Matt named. Nothing about the data changed; the label stopped lying. */}
        {firstTownRow ? (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon · By town')}
            heading={v3Text('Where the homes are, and what they cost')}
            rows={[firstTownRow, ...restTownRows]}
            note={townRemainder ? v3Text(townRemainder) : undefined}
            source={v3Text(PLACE_COUNT_TRACE)}
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        ) : (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon · By town')}
            heading={v3Text('Where the homes are, and what they cost')}
            rows={[]}
            emptyMessage={v3Text('No town returned a live market row on this refresh.')}
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        )}

        {/* Pattern 1, Instrument — the market question (the family template),
            the verdict as the answer beneath it, the KPI row off the ONE
            leftover pile, the median-close year overlay, and the seller ask as
            the ghost action (the KbSell destination + ?from= attribution). */}
        {firstMarketFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text('Central Oregon · The market')}
            headline={v3Text(marketHeadline)}
            note={verdictSentence ? v3Text(verdictSentence) : undefined}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(marketSource)}
            chart={medianChart}
            updated={liveStamp(leftoverStamp)}
            action={{ label: v3Text('Full market report'), href: '/housing-market', variant: 'ghost' }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading="The Central Oregon market"
            items={marketAbsenceItems('Central Oregon', fieldItems.length > 0)}
          />
        )}

        {/* NO PROPERTY-TYPE RUN HERE (Matt 2026-08-27, on the search data).
            It rendered EIGHT sections -- condos, townhomes, manufactured on land,
            manufactured in parks, 2-4 unit, lots, farms, commercial, business --
            region-scoped, between the inventory and every ask on the page. Three
            reasons it went:
              1. It is a search filter rendered as page content. /homes-for-sale
                 exists to filter; this duplicated it as eight headings.
              2. The city pages carry the SAME run city-scoped
                 (app/cities/[slug]/page.tsx), which is the stronger surface for
                 "condos in Bend" than a region-wide "condos in Central Oregon".
                 Nothing is lost to search; it moves to where it ranks better.
              3. Search Console, 28 days to 2026-08-24: this page sits at average
                 position 34.1 on 490 impressions. It is not a ranking surface and
                 will not become one against Zillow on the head term. Its traffic
                 arrives from the Google Business Profile and converts at 2.2%,
                 the best on the site. So the homepage is judged on CONVERSION,
                 and eight filter sections between the houses and the ask are
                 conversion drag. */}

        {/* Pattern 3 again, non-adjacent — the featured communities, printing
            the index count (ci:publish-resort-index-figures pins the wiring). */}
        {firstCommunityRow ? (
          <V3Ledger
            id="communities"
            eyebrow={v3Text('Central Oregon · Communities')}
            heading={v3Text('Resorts and planned communities')}
            rows={[firstCommunityRow, ...restCommunityRows]}
            source={v3Text(HOME_COMMUNITY_TRACE)}
            action={{ label: v3Text('Every community'), href: '/communities' }}
          />
        ) : null}

        {/* ── ORDERED FOR CONVERSION (Matt 2026-08-27, on the search data) ──
            The alert capture used to be LAST, below the seller form, the reviews
            and the brokers, and below eight property-type sections. On a page
            whose job is turning an arrival into a lead, the low-friction ask sat
            at the very bottom of the scroll.

            The order now follows what a visitor is doing: houses, then where and
            what they cost, then the market answer, then the communities -- and
            the moment they have finished browsing, the cheapest possible ask
            (tell me when a new one lists). Proof follows it. The SELLER ask goes
            last on purpose: it is a different audience, and /sell is its page.

            Still holding "no two adjacent share a pattern":
              Ledger (communities) -> Sheet (alerts) -> Quiet (reviews)
              -> Faces (brokers) -> Sheet (sell) -> Footer                    */}

        {/* THE ASK, where the browsing ends. HomeAlertSheet carries the capture
            contract unchanged: same server action, same payload, same field and
            trap names. */}
        <HomeAlertSheet />



        {/* Pattern 6, Quiet — the reviews, in the shape /team renders them in. */}
        {testimonialItems.length > 0 ? (
          <V3Quiet
            id="reviews"
            heading="What clients say"
            items={testimonialItems}
          />
        ) : null}

        {/* The brokers. AboutFaces is the treatment /about and /team already
            publish; level 2 here because this page's H1 is the Stage and a
            second H1 on one document is an outline defect. */}
        {faces.length > 0 ? (
          <AboutFaces people={faces} heading="The brokers" headingLevel={2} />
        ) : null}

        {/* The seller ask, last on purpose -- a different audience from the one
            this page is built for, and /sell is its page. Same form component
            /sell opens on, pagePath '/' so attribution stays honest about where
            the address was typed, its own formId so two forms on one document
            cannot collide on element ids. */}
        <section id="sell" className={V3_ROOT_CLASS}>
          <SellValueForm pagePath="/" formId="home-get-value" />
        </section>

      </main>

      {/* Outside <main> on purpose: HTML-AAM maps <footer> to contentinfo only
          when it is NOT nested in sectioning content. */}
      <V3Footer
        columns={V3_FOOTER_COLUMNS}
        note={footerFine ? `Active single-family by town: ${footerFine}. Figures from the MLS.` : undefined}
      />
    </>
  )
}
