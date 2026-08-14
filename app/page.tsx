/**
 * / - Homes destination, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. Homes
 * destinations open on Field. Houses fill the fold. Towns are filters. Five of
 * the six patterns, no two adjacent alike. D11 lead + the on-page alert Sheet
 * outrank the four-pattern preference, the same way city pages spend a fifth
 * slot on Matt-issued product. The section order is the parity contract:
 * design_system/ryan-realty/ui_kits/homepage-v6/parity.json.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata title leading
 * "Homes for Sale", canonical origin, revalidate 60, V3SectionTracker
 * pageType="homepage". No page-level JSON-LD (layout still emits Organization
 * / WebSite). MetadataBlock is not added because this route never computed
 * a market FAQ set. V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * Field first (2026-08-14): compact D11 H1, town name filters, then photographed
 * homes. The region count is a Field caption, not a number hero. Chart atom
 * stays on a level-2 Instrument UNDER those jobs. Chrome fills Value my home
 * only on Sell.
 *
 * D11 LOCK (Layer A), literals in this file so ci:seo-shell can see them:
 *   H1: Homes for Sale in Central Oregon
 *   Lead: Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list
 *   prices and days on market.
 *
 * DATES RENDER IN PACIFIC. liveStamp uses formatDate. Chart month ticks are
 * built in market-charts (same as the market hub). The in-progress Pacific
 * month is dropped via zonedDateKey before buildRegionMedianChart so a
 * partial month cannot draw as a dip.
 *
 * SERIES: year overlay on the level-2 Instrument (buildRegionMedianChart),
 * under the homes-and-towns jobs. Not a flattened polyline. Not a seventh
 * pattern. E-CHART owns the atom. This page mounts it. Do not remount
 * V3Chrome. Do not add NewsletterSignup to the footer.
 *
 * KB-era deletions this migration made: KbHero film split H1 (titleTop /
 * titleBottom), KbExploreTowns, KbCommunities (and its autoplay community
 * videos), KbFeatured 9-card grid, KbListingMap (3000-pin region box),
 * KbTicker, KbSell, KbTestimonials, KbTeam, SmoothScrollProvider, KbFooter
 * (replaced by V3Footer outside main). KbMarketHud.client.tsx is gone: this
 * page was its last mount. KbMarketChart stays on disk for
 * ci:market-chart-honesty. Orphaned modules deleted with E-HOMES-HOME:
 * KbCommunities.client.tsx, KbTicker.client.tsx. curateFeaturedTiles stays:
 * it feeds the Field so it is not a new orphan.
 *
 * Chrome: app/layout.tsx mounts V3Chrome. This page does not remount it.
 * V3Footer sits outside <main> so HTML-AAM maps it to contentinfo.
 */

import type { Metadata } from 'next'
import {
  getRegionPulse,
  getMarketPulseCitySnapshots,
  getListingTiles,
  getPriceHistory,
} from '@/lib/data'
import { curateFeaturedTiles } from '@/lib/kb/curate-featured'
import { homesForSalePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { zonedDateKey } from '@/lib/format/date'
import { buildRegionMedianChart, dropInProgressMonth } from '@/app/housing-market/_v3/market-charts'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Field,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { HomeAlertSheet } from './_v3/HomeAlertSheet.client'
import { HomeHomesField } from './_v3/HomeHomesField'
import {
  D11_TOWNS,
  D11_TOWN_SLUG,
  D11_TOWN_IMG,
  HOME_COMMUNITY_EDGES,
  HOME_FIELD_LIMIT,
  HOME_TILE_FETCH,
  HOME_PULSE_TRACE,
  HOME_TOWN_TRACE,
} from './_v3/home-constants'
import { homeFieldItems } from './_v3/home-field-items'
import { livePrice, liveStamp } from './_v3/live-format'

void V3Field

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Homes for Sale in Central Oregon | Bend, Redmond, Sisters, Sunriver',
  description:
    'Active homes for sale in Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices, days on market, and closed comps from the regional MLS.',
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

export default async function Home() {
  // No catch-and-swallow: every function below is resilient-cached and answers
  // a transient failure with its own documented fallback.
  const [pulse, citySnapshots, tiles, priceHist] = await Promise.all([
    getRegionPulse(),
    getMarketPulseCitySnapshots([...D11_TOWNS]),
    getListingTiles({ status: 'active', propertyType: 'A', limit: HOME_TILE_FETCH }),
    getPriceHistory('region', 'central-oregon', 'monthly', 60),
  ])

  const snapshotByLabel = new Map(citySnapshots.map((s) => [s.geo_label, s]))
  const townMedians = D11_TOWNS.map((label) => ({
    name: label,
    medianPrice: snapshotByLabel.get(label)?.median_list_price ?? null,
  }))

  const curated = curateFeaturedTiles(tiles, townMedians, HOME_FIELD_LIMIT)
  const fieldItems = homeFieldItems(curated, HOME_FIELD_LIMIT)

  const homeChart = buildRegionMedianChart(
    dropInProgressMonth(priceHist, zonedDateKey(new Date()).slice(0, 7)),
  )

  const townFilters = D11_TOWNS.map((label) => ({
    label,
    href: homesForSalePath(label),
  }))

  const regionFigures: V3InstrumentFigure[] = []
  if (pulse != null) {
    regionFigures.push({
      value: v3Text(pulse.activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: homesForSalePath(),
    })
  }
  const medianLabel = livePrice(pulse?.medianListPrice ?? null)
  if (medianLabel) {
    regionFigures.push({
      value: v3Text(medianLabel),
      label: v3Text('median list price'),
      href: '/housing-market',
    })
  }
  if (pulse?.medianDaysToPending != null && pulse.medianDaysToPending > 0) {
    regionFigures.push({
      value: v3Text(String(pulse.medianDaysToPending)),
      label: v3Text('median days to pending'),
      href: '/housing-market',
    })
  }
  const [firstRegionFigure, ...restRegionFigures] = regionFigures

  const townRows: V3LedgerFigureRow[] = []
  for (const label of D11_TOWNS) {
    const snapshot = snapshotByLabel.get(label)
    const slug = D11_TOWN_SLUG[label]
    const median = livePrice(snapshot?.median_list_price ?? null)
    if (!snapshot || !median) continue
    townRows.push({
      href: `/cities/${slug}`,
      when: v3Text(`${snapshot.active_count.toLocaleString('en-US')} for sale`),
      what: v3Text(label),
      value: v3Text(median),
      id: slug,
      media: { src: D11_TOWN_IMG[label] },
    })
  }
  const [firstTownRow, ...restTownRows] = townRows

  const cityRefreshedAt = citySnapshots
    .map((s) => s.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)

  const exploreItems: V3QuietItem[] = [
    {
      kind: 'prose',
      body: 'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.',
    },
    ...HOME_COMMUNITY_EDGES.map((edge) => ({ label: edge.label, href: edge.href })),
    { label: 'Video tours of homes for sale', href: '/videos' },
    { label: 'Central Oregon housing market', href: '/housing-market' },
    { label: 'Value my home', href: valuationHref('/') },
    { label: 'The brokers', href: '/team' },
    { label: 'Client reviews', href: '/reviews' },
    { label: 'Homes listed by Ryan Realty', href: '/our-homes' },
    { label: 'Every Central Oregon city', href: '/cities' },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="homepage" />

        {fieldItems.length > 0 || pulse ? (
          <HomeHomesField
            heading="Homes for Sale in Central Oregon"
            fieldItems={fieldItems}
            towns={townFilters}
            count={
              pulse
                ? {
                    value: pulse.activeCount.toLocaleString('en-US'),
                    label: 'homes for sale',
                    source: HOME_PULSE_TRACE,
                    updatedAt: pulse.updatedAt,
                  }
                : undefined
            }
          />
        ) : (
          <V3Quiet
            id="homes"
            heading="Homes for Sale in Central Oregon"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No live figures right now',
                body: 'The Central Oregon market row did not return on this refresh, so this page is not printing an inventory count or a median list price.',
              },
            ]}
          />
        )}

        {firstTownRow ? (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Homes for sale by town')}
            rows={[firstTownRow, ...restTownRows]}
            source={v3Text(HOME_TOWN_TRACE)}
            updated={liveStamp(cityRefreshedAt)}
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        ) : (
          <V3Ledger
            id="towns"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Homes for sale by town')}
            rows={[]}
            emptyMessage={v3Text(
              'No D11 town returned a live single-family market row with a median on this refresh.',
            )}
          />
        )}

        {firstRegionFigure ? (
          <V3Instrument
            id="market"
            level={2}
            eyebrow={v3Text('Central Oregon')}
            headline={v3Text('Median sale prices')}
            figures={[firstRegionFigure, ...restRegionFigures]}
            source={v3Text(HOME_PULSE_TRACE)}
            updated={liveStamp(pulse?.updatedAt ?? null)}
            action={{
              label: v3Text('Housing market'),
              href: '/housing-market',
              variant: 'ghost',
            }}
            chart={homeChart}
          />
        ) : null}

        <HomeAlertSheet />

        <V3Quiet
          id="explore"
          eyebrow="More on this list"
          heading="Communities, market, and selling"
          items={exploreItems}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. The KB page nested KbFooter the same way, and
          ci:default-chrome-footer counts footers without checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
