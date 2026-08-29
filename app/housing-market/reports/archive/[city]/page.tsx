// @no-parity — data-archive surface on the shared v3 pattern; no bespoke mockup contract.
/**
 * /housing-market/reports/archive/[city] — the decade market archive for one
 * report city (W8.5), on the components/site/v3 barrel.
 *
 * The live CONSUMER of the W2.6 monthly-cache backfill: it reads the full monthly
 * market_stats_cache series (2016 to present) through getCityArchive and renders
 * per-year aggregate statistics. Static route (generateStaticParams over the
 * REPORT_CITIES registry), so a bad slug is a 404, not a soft-empty page.
 *
 * D9: CityArchiveSection is a year table (chart inventory A19) and stays an
 * island so the price column can remain a range of monthly medians, not a
 * fabricated yearly median. Homes sold by year is a real series and passes
 * `chart` on Instrument. Do not flatten that series to a figure.
 *
 * DROPPED: KbBreadcrumb, KbFooter, SmoothScrollProvider, MarketSources (the
 * Oregon Data Share citation is a Quiet edge). The en-dash year span is now
 * "to".
 *
 * Data ONLY through @/lib/data (G8).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCityArchive, type CityArchive } from '@/lib/data/market/getCityArchive'
import { REPORT_CITIES, REPORT_CITY_SLUGS } from '@/lib/data/geo/report-cities'
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
  type V3ChartProps,
  type V3ChartPoint,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'
import { ArchiveYearTable } from './_v3/ArchiveYearTable'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function buildArchiveSoldChart(archive: CityArchive): V3ChartProps | undefined {
  const points: V3ChartPoint[] = [...archive.years]
    .sort((a, b) => a.year - b.year)
    .flatMap((year) => {
      if (year.homesSold <= 0) return []
      return [
        {
          value: year.homesSold,
          tick: v3Text(String(year.year)),
          label: v3Text(year.homesSold.toLocaleString('en-US')),
          at: year.year,
        },
      ]
    })
  if (points.length < 2) return undefined
  return {
    caption: v3Text(`Closed single-family sales by year, ${archive.label}`),
    series: [{ name: v3Text('Homes sold'), points }],
  }
}

type PageProps = { params: Promise<{ city: string }> }

export function generateStaticParams(): Array<{ city: string }> {
  return REPORT_CITY_SLUGS.map((city) => ({ city }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const entry = REPORT_CITIES.find((c) => c.slug === city)
  if (!entry) return { title: 'Archive Not Found | Ryan Realty' }
  const title = `${entry.label} home sales archive | Ryan Realty`
  const description = `A decade of single-family home sales in ${entry.label}, Oregon: closed sales and median sale price by year.`
  const canonical = `${siteUrl}/housing-market/reports/archive/${entry.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'article', siteName: 'Ryan Realty' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function CityArchivePage({ params }: PageProps) {
  const { city } = await params
  const archive = await getCityArchive(city)
  if (!archive) notFound()

  const yearsCovered = archive.years.filter((y) => y.homesSold > 0).length
  const span =
    archive.earliestYear != null && archive.latestYear != null && archive.earliestYear !== archive.latestYear
      ? `${archive.earliestYear} to ${archive.latestYear}`
      : archive.latestYear != null
        ? String(archive.latestYear)
        : archive.earliestYear != null
          ? String(archive.earliestYear)
          : null

  const canonical = `${siteUrl}/housing-market/reports/archive/${archive.slug}`
  const liveHref = `/housing-market/${archive.slug}`

  const figures: V3InstrumentFigure[] = [
    {
      value: v3Text(archive.totalSold.toLocaleString('en-US')),
      label: v3Text('closed single-family sales'),
      href: liveHref,
    },
  ]
  if (yearsCovered > 0) {
    figures.push({
      value: v3Text(String(yearsCovered)),
      label: v3Text('years with recorded closes'),
      href: liveHref,
    })
  }
  const [firstFigure, ...restFigures] = figures

  const datasetVariables: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Total closed single-family sales', value: archive.totalSold },
    { name: 'Years covered', value: yearsCovered },
  ]

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
                { name: 'Market reports', url: '/housing-market/reports' },
                { name: archive.label, url: liveHref },
                { name: 'Sales archive', url: canonical },
              ],
            },
            {
              type: 'dataset',
              name: `${archive.label} single-family home sales archive`,
              description:
                `Closed single-family home sales for ${archive.label}, Oregon by year, with the range of ` +
                `monthly median sale prices. Sourced from Oregon Data Share via Ryan Realty.`,
              url: canonical,
              temporalCoverage:
                archive.earliestYear != null && archive.latestYear != null
                  ? `${archive.earliestYear}/${archive.latestYear}`
                  : undefined,
              spatialCoverageName: `${archive.label}, OR`,
              variableMeasured: datasetVariables,
            },
          ]}
        />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Market reports', href: '/housing-market/reports' },
            { label: archive.label, href: liveHref },
            { label: 'Sales archive' },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="archive"
            level={1}
            eyebrow={v3Text(span ? `Market archive ${span}` : 'Market archive')}
            headline={v3Text(`${archive.label} home sales by year`)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              archive.leftoverYears.length > 0
                ? archive.leftoverYears.length === 1
                  ? `Year ${archive.leftoverYears[0]} is monthly median close rolled to a calendar year. Earlier years are monthly rows rolled to calendar years. The price column is the range of monthly medians, not a median of medians`
                  : `Years ${archive.leftoverYears[archive.leftoverYears.length - 1]} to ${archive.leftoverYears[0]} are monthly median close rolled to calendar years. Earlier years are monthly rows rolled to calendar years. The price column is the range of monthly medians, not a median of medians`
                : 'closed single-family sales through Oregon Data Share, monthly market_stats_cache rows rolled to calendar years. The price column in the table below is the range of monthly medians, not a median of medians',
            )}
            action={{
              label: v3Text('Current market'),
              href: liveHref,
              variant: 'primary',
            }}
            chart={buildArchiveSoldChart(archive)}
          />
        ) : null}

        <ArchiveYearTable archive={archive} />

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Keep reading"
          items={[
            { label: `${archive.label} market report`, href: liveHref },
            { label: 'All reports', href: '/housing-market/reports' },
            { label: 'Closed sales explorer', href: '/housing-market/history' },
            { label: 'Value my home', href: valuationHref(`/housing-market/reports/archive/${archive.slug}`) },
            { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
          ]}
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
