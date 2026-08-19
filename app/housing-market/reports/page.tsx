/**
 * /housing-market/reports — Central Oregon market reports hub, on the
 * components/site/v3 barrel.
 *
 * VISITOR OBJECTIVE: pick cities and a range, read live single-family numbers,
 * open a weekly or sales report, or value a home.
 * MACHINE OBJECTIVE: Dataset JSON-LD of the verified city figures, WebPage,
 * BreadcrumbList.
 *
 * E-CUT 2026-08-13 collapsed the dual URL space. Implementation lives here.
 * /reports 308s here. P10 wrap 2026-08-13: KB chrome off, v3 on. Islands
 * (ReportsByCityView, ReportsIndexContent) stay leftover mixed.
 *
 * DROPPED: KbHero, KbBreadcrumb, KbFooter, KbSell, SmoothScrollProvider, kb.css.
 * Capture: submitMarketPageInquiry via ReportsInquirySheet. First-screen ask
 * is the city figures. Value my home lives in Quiet. D9: city Ledger stays type; the range table is an island, not a
 * flattened series. D11: copy states the fact.
 *
 * MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a
 * v3 island, not a seventh pattern. pageType='market-reports'.
 */

import type { Metadata } from 'next'
import { getMarketPulse } from '@/lib/data'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE } from '@/lib/market/classify'
import { formatDate } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3SectionTracker,
} from '@/components/site/v3'
import { ReportsInquirySheet } from './_v3/ReportsInquirySheet.client'
import { CityHeadlineSection, RangeTableSection, SalesAndWeeklySection } from './_v3/ReportsIslands'
import { CANONICAL_PATH, SELL_HREF, siteUrl } from './_v3/hub-constants'
import { parseReportsParams, buildRegionFigures } from './_v3/hub-sections'

const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Central Oregon market reports',
  description:
    'Sold volume, median price, days on market, and inventory by Central Oregon city. Pick cities and a time range. Weekly reports included.',
  alternates: { canonical: `${siteUrl}${CANONICAL_PATH}` },
  openGraph: {
    title: 'Central Oregon market reports',
    description:
      'Sold volume, median price, days on market, and inventory by city. Weekly reports included.',
    url: `${siteUrl}${CANONICAL_PATH}`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty market reports' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Central Oregon market reports',
    description:
      'Sold volume, median price, days on market, and inventory by city. Weekly reports included.',
    images: [defaultOgImage],
  },
}

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

export default async function ReportsIndexPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { cities: selectedCities, period } = parseReportsParams(params ?? null)
  const regionPulse = await getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' })

  const mosRaw =
    regionPulse?.monthsOfSupply != null && regionPulse.monthsOfSupply > 0
      ? regionPulse.monthsOfSupply
      : null
  const verdict = marketVerdict(mosRaw)
  const regionFigures = buildRegionFigures(regionPulse)
  const [firstFigure, ...restFigures] = regionFigures
  const refreshedAt = regionPulse?.refreshedAt ?? null
  const mosText = mosRaw == null ? null : formatMonthsOfSupply(mosRaw)

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock
          schemas={[
            {
              type: 'breadcrumb',
              items: [
                { name: 'Home', url: '/' },
                { name: 'Market reports', url: CANONICAL_PATH },
              ],
            },
            {
              type: 'webPage',
              name: 'Central Oregon real estate market reports',
              description:
                'Housing market report by city: sold volume, median price, days on market, inventory. Choose cities and time range.',
              url: CANONICAL_PATH,
            },
          ]}
        />
        <V3Breadcrumb
          trail={[{ label: 'Home', href: '/' }, { label: 'Market reports' }]}
        />

        {firstFigure ? (
          <V3Instrument
            id="reports"
            level={1}
            eyebrow={v3Text('Central Oregon')}
            headline={v3Text(
              `Central Oregon market reports${verdict.kind === 'unknown' ? '' : `: a ${verdict.label}`}`,
            )}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              `live MLS through Oregon Data Share, market_pulse_live, geo_type=region, geo_slug=central-oregon, property_type=A. ${MOS_METHODOLOGY_CLAUSE}${
                mosText ? ` This refresh: ${mosText} months of supply.` : ''
              }`,
            )}
            updated={refreshedAt ? v3Text(formatDate(refreshedAt)) : undefined}
            action={{
              label: v3Text('Live figures by city'),
              href: '#cities',
            }}
          />
        ) : (
          <V3Quiet
            id="reports"
            heading="Central Oregon market reports"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No live region figures right now',
                body: 'The Central Oregon market row did not return on this refresh, so this page is not printing a region median or a verdict. City rows below carry their own live figures.',
              },
            ]}
          />
        )}

        <CityHeadlineSection selectedCities={selectedCities} />
        <RangeTableSection selectedCities={selectedCities} period={period} />
        <SalesAndWeeklySection />

        <ReportsInquirySheet /> {/* hydration-safe: visitor-caused sheet state */}

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Keep reading"
          items={[
            { label: 'Housing market hub', href: '/housing-market' },
            { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
            { label: 'Months of supply', href: '/months-of-supply' },
            { label: 'Value my home', href: SELL_HREF },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
