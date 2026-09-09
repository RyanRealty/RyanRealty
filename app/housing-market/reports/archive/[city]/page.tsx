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

import { cache } from 'react'
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
import { countTicks, yearTicks, yoyClaim } from '@/lib/charts/ticks'
import { pageMetadata } from '@/lib/site/page-metadata'
import { getCanonicalSiteUrl } from '@/lib/share-metadata'
import { valuationHref } from '@/lib/site/valuation-href'
import { ArchiveYearTable } from './_v3/ArchiveYearTable'

/**
 * ONE read for the metadata and the body. getCityArchive composes an
 * unstable_cache price-history read with an uncached leftover-monthly read, so
 * a snippet that quotes the archive's own totals would otherwise buy a second
 * round trip. React cache() memoizes it per request across generateMetadata and
 * the render: the figure in the description is the figure in the Instrument.
 */
const loadArchive = cache(async (city: string) => getCityArchive(city))

function archivePath(slug: string): string {
  return `/housing-market/reports/archive/${slug}`
}

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
  const series = [{ name: v3Text('Homes sold'), points }]
  const claim = yoyClaim({ metric: 'Homes sold', unit: 'count', series })
  const yTicks = countTicks(series)
  const xTicks = yearTicks(series)
  return {
    caption: v3Text(`Closed single-family sales by year, ${archive.label}`),
    ...(claim ? { claim: v3Text(claim) } : {}),
    series,
    ...(yTicks.length ? { yTicks } : {}),
    ...(xTicks.length ? { xTicks } : {}),
  }
}

type PageProps = { params: Promise<{ city: string }> }

/** Years with at least one recorded close. Metadata and body read the one rule. */
function archiveYearsCovered(archive: CityArchive): number {
  return archive.years.filter((y) => y.homesSold > 0).length
}

/** The archive's covered span, or null when nothing closed. */
function archiveSpan(archive: CityArchive): string | null {
  if (archive.earliestYear != null && archive.latestYear != null && archive.earliestYear !== archive.latestYear) {
    return `${archive.earliestYear} to ${archive.latestYear}`
  }
  if (archive.latestYear != null) return String(archive.latestYear)
  if (archive.earliestYear != null) return String(archive.earliestYear)
  return null
}

export function generateStaticParams(): Array<{ city: string }> {
  return REPORT_CITY_SLUGS.map((city) => ({ city }))
}

/**
 * The snippet carries the archive's own totals. The old one was a number-free
 * template on a page whose subject is a decade of counts, and its baked
 * "| Ryan Realty" met the layout's own suffix to publish the brand twice.
 */
function archiveDescription(archive: CityArchive, yearsCovered: number, span: string | null): string {
  const sold = archive.totalSold.toLocaleString('en-US')
  const window = span ? `, ${span}` : ''
  const head = `${sold} closed single-family sales in ${archive.label}, Oregon${window}: ${yearsCovered} years of Oregon Data Share closes, with median sale price by year.`
  return head.length <= 155
    ? head
    : `${sold} closed single-family sales in ${archive.label}, Oregon${window}, with median sale price by year, from Oregon Data Share.`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const entry = REPORT_CITIES.find((c) => c.slug === city)
  if (!entry) {
    return pageMetadata({
      title: 'Archive not found',
      description: 'We do not publish a sales archive for this city.',
      path: archivePath(city),
      noindex: true,
    })
  }
  const archive = await loadArchive(city)
  if (!archive) {
    return pageMetadata({
      title: `${entry.label} home sales archive`,
      description: `The ${entry.label}, Oregon sales archive has no recorded closes to publish yet.`,
      path: archivePath(entry.slug),
      noindex: true,
    })
  }
  return pageMetadata({
    title: `${entry.label} home sales archive`,
    description: archiveDescription(archive, archiveYearsCovered(archive), archiveSpan(archive)),
    path: archivePath(archive.slug),
    ogType: 'article',
  })
}

export default async function CityArchivePage({ params }: PageProps) {
  const { city } = await params
  const archive = await loadArchive(city)
  if (!archive) notFound()

  const yearsCovered = archiveYearsCovered(archive)
  const span = archiveSpan(archive)

  const canonical = `${getCanonicalSiteUrl()}${archivePath(archive.slug)}`
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
                  ? `Year ${archive.leftoverYears[0]} is the single-family monthly median close beyond the city rows, rolled to a calendar year. Earlier years are monthly cache rows rolled to calendar years. The price column is the range of monthly medians, not a median of medians`
                  : `Years ${archive.leftoverYears[archive.leftoverYears.length - 1]} to ${archive.leftoverYears[0]} are the single-family monthly median close beyond the city rows, rolled to calendar years. Earlier years are monthly cache rows rolled to calendar years. The price column is the range of monthly medians, not a median of medians`
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
