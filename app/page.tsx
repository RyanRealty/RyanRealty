/**
 * / - Homes destination, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. Homes
 * destinations open on Instrument then Field. Five of the six patterns, no two
 * adjacent alike. D11 lead + the on-page alert Sheet outrank the four-pattern
 * preference, the same way city pages spend a fifth slot on Matt-issued
 * product. The section order, the sections this migration DELETED, and the
 * leftover HUD are the parity contract:
 * design_system/ryan-realty/ui_kits/homepage-v6/parity.json.
 *
 * THE PAGE CONTRACT, carried across unchanged: metadata title leading
 * "Homes for Sale", canonical origin, revalidate 60, V3SectionTracker
 * pageType="homepage". No page-level JSON-LD (layout still emits Organization
 * / WebSite). MetadataBlock is not added because this route never computed
 * a market FAQ set. V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * D11 LOCK (Layer A), literals in this file so ci:seo-shell can see them:
 *   H1: Homes for Sale in Central Oregon
 *   Lead: Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list
 *   prices and days on market.
 *
 * DATES RENDER IN PACIFIC. The KB HUD month labels used
 * `toLocaleDateString(..., { timeZone: 'UTC' })`. formatDate is pinned to
 * America/Los_Angeles, so a periodStart between 00:00 and 08:00 UTC now shows
 * the previous calendar month-day in Pacific, which is the correct day in the
 * market this page covers. ci:date-format requires the canonical formatter.
 *
 * LEFTOVER, not a v3 atom: KbMarketHud (trend, byTown, yearSeries). Flattening
 * that series is a D9 defect. The chart atom is E-CHART's lease. kb.css stays
 * for that leftover. Do not invent a chart primitive here.
 *
 * KB-era deletions this migration made: KbHero film split H1 (titleTop /
 * titleBottom), KbExploreTowns, KbCommunities (and its autoplay community
 * videos), KbFeatured 9-card grid, KbListingMap (3000-pin region box),
 * KbTicker, KbSell, KbTestimonials, KbTeam, SmoothScrollProvider, KbFooter
 * (replaced by V3Footer outside main). Orphaned modules deleted with this
 * change: KbCommunities.client.tsx, KbTicker.client.tsx. curateFeaturedTiles
 * stays: it now feeds the Field so it is not a new orphan.
 *
 * Chrome: app/layout.tsx mounts V3Chrome. This page does not remount it.
 * V3Footer sits outside <main> so HTML-AAM maps it to contentinfo.
 */

import type { Metadata } from 'next'
import {
  getRegionPulse,
  getMarketPulseCitySnapshots,
  getListingTiles,
  getMarketStatsCacheRowForGeo,
  getPriceHistory,
} from '@/lib/data'
import { curateFeaturedTiles } from '@/lib/kb/curate-featured'
import { buildYearSeries } from '@/lib/kb/year-series'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
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
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import type { KbMarketData } from '@/components/site/kb/types'
import { HomeAlertSheet } from './_v3/HomeAlertSheet.client'
import {
  D11_TOWNS,
  D11_TOWN_SLUG,
  D11_TOWN_IMG,
  HOME_COMMUNITY_EDGES,
  HOME_FIELD_LIMIT,
  HOME_TILE_FETCH,
  HOME_PULSE_TRACE,
  HOME_TOWN_TRACE,
  HOME_FIELD_TRACE,
} from './_v3/home-constants'
import { homeFieldItems } from './_v3/home-field-items'
import { livePrice, liveStamp, liveMonthLabel } from './_v3/live-format'
import '@/components/site/kb/kb.css'

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
  const [pulse, citySnapshots, tiles, mktStats, priceHist] = await Promise.all([
    getRegionPulse(),
    getMarketPulseCitySnapshots([...D11_TOWNS]),
    getListingTiles({ status: 'active', propertyType: 'A', limit: HOME_TILE_FETCH }),
    getMarketStatsCacheRowForGeo({ geoType: 'region', geoSlug: 'central-oregon' }),
    getPriceHistory('region', 'central-oregon', 'monthly', 60),
  ])

  const snapshotByLabel = new Map(citySnapshots.map((s) => [s.geo_label, s]))
  const townMedians = D11_TOWNS.map((label) => ({
    name: label,
    medianPrice: snapshotByLabel.get(label)?.median_list_price ?? null,
  }))

  const curated = curateFeaturedTiles(tiles, townMedians, HOME_FIELD_LIMIT)
  const fieldItems = homeFieldItems(curated, HOME_FIELD_LIMIT)

  const regionFigures: V3InstrumentFigure[] = []
  if (pulse != null) {
    regionFigures.push({
      value: v3Text(pulse.activeCount.toLocaleString('en-US')),
      label: v3Text('homes for sale'),
      href: listingsBrowsePath(),
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

  const sltRaw = mktStats?.avg_sale_to_list_ratio ?? null
  const marketData: KbMarketData = {
    active: pulse?.activeCount ?? null,
    closed30: pulse?.soldCount30d ?? null,
    new30: pulse?.newCount30d ?? null,
    medianList: pulse?.medianListPrice ?? null,
    saleToList: sltRaw != null ? (sltRaw < 2 ? sltRaw * 100 : sltRaw) : null,
    daysToPending: pulse?.medianDaysToPending ?? null,
    monthsSupply: pulse?.monthsOfSupply ?? null,
    trend: priceHist
      .slice(-13)
      .filter((p) => p.medianSalePrice != null)
      .flatMap((p) => {
        const label = liveMonthLabel(p.periodStart)
        if (!label || p.medianSalePrice == null) return []
        return [{ label, value: p.medianSalePrice }]
      }),
    byTown: D11_TOWNS.flatMap((label) => {
      const median = snapshotByLabel.get(label)?.median_list_price
      if (median == null) return []
      return [{ name: label, median }]
    }),
    countyMedian: pulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(priceHist, 5),
  }

  const exploreItems: V3QuietItem[] = [
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

        {firstRegionFigure ? (
          <V3Instrument
            id="homes"
            level={1}
            eyebrow={v3Text('Central Oregon')}
            headline={v3Text('Homes for Sale in Central Oregon')}
            figures={[firstRegionFigure, ...restRegionFigures]}
            source={v3Text(HOME_PULSE_TRACE)}
            updated={liveStamp(pulse?.updatedAt ?? null)}
            action={{
              label: v3Text('See homes for sale'),
              href: listingsBrowsePath(),
              variant: 'primary',
            }}
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

        <V3Quiet
          id="lead"
          ariaLabel="Towns on this list"
          items={[
            {
              kind: 'prose',
              body: 'Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.',
            },
          ]}
        />

        <V3Field
          id="listed"
          ariaLabel="Homes for sale in Central Oregon"
          items={fieldItems}
          count={
            pulse != null
              ? {
                  value: pulse.activeCount.toLocaleString('en-US'),
                  label: 'homes for sale in Central Oregon',
                  source: HOME_FIELD_TRACE,
                  updatedAt: pulse.updatedAt || null,
                }
              : undefined
          }
          footNote={
            fieldItems.length > 0
              ? `Map shows ${fieldItems.length} homes from the live list. The count above is the region total, not a total of these rows.`
              : undefined
          }
          emptyMessage="No photographed active single-family home with a list price and a street address returned on this refresh."
        />

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

        <HomeAlertSheet />

        <V3Quiet
          id="explore"
          eyebrow="More on this list"
          heading="Communities, market, and selling"
          items={exploreItems}
        />

        <KbMarketHud data={marketData} asOf={pulse?.updatedAt ?? null} />
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
