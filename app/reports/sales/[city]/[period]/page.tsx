/**
 * /reports/sales/[city]/[period] — closed + pending sales report for one city
 * over a fixed period, on the components/site/v3 barrel.
 *
 * THE PAGE CONTRACT: Dataset JSON-LD with variableMeasured sourced ONLY from
 * the fetched closed/pending data, generateMetadata + canonical, the DAL read
 * (getMarketReportDataForLocation) plus session/identity-bridge reads, the PDF
 * export href, and the literal "Closed sales" marker (ci:lead-funnels).
 *
 * PENDING COVERAGE (§0.7, 2026-08-19). activity_events — the pending source —
 * begins 2026-03-12, so `last-year` (calendar 2025) has no pending rows to
 * count. This page published "0" as a Pending sales figure, as a Dataset
 * variableMeasured value, and as "No pending sales in this period" on all
 * seven PRIMARY_CITIES. A zero the source cannot measure is a fabricated fact.
 * The figure, the JSON-LD variable, and the empty-state claim are now all
 * gated on isPendingWindowCovered; the closed side is untouched. Locked by
 * ci:publish-report-city-scope.
 *
 * D9: SalesReportCharts stays an island (chart inventory B5). Do not flatten
 * the daily / price-band / DOM series to a figure.
 *
 * DROPPED: KbBreadcrumb, KbFooter, SmoothScrollProvider, shadcn Table, the
 * inline <style> KB table skin, StatCell. Closed and pending rows are Ledgers,
 * every row a door via listingDetailPath. Date range uses formatDate and "to",
 * never an en-dash.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { SALES_PERIODS, getDateRangeForPeriod, getPeriodLabel, type SalesPeriodSlug } from '@/lib/sales-report-periods'
import { getMarketReportDataForLocation, type ReportListing } from '@/app/actions/market-reports'
import {
  isPendingWindowCovered,
  PENDING_SOURCE_COVERAGE_START_ISO,
} from '@/lib/data/listings/getWentPendingInWindow'
import { getPropertyTypeLabel } from '@/lib/property-type-labels'
import { PRIMARY_CITIES } from '@/lib/cities'
import { cityEntityKey, listingDetailPath } from '@/lib/slug'
import SalesReportCharts from '@/components/reports/SalesReportCharts'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { formatDate } from '@/lib/format/date'
import { formatPriceExact } from '@/lib/format/money'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
} from '@/components/site/v3'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function resolveCityFromSlug(slug: string): string | null {
  const decoded = decodeURIComponent(slug).trim().toLowerCase()
  const found = PRIMARY_CITIES.find((c) => cityEntityKey(c) === decoded)
  return found ?? null
}

function parseReportDate(s: string | null | undefined): Date | null {
  if (!s || typeof s !== 'string') return null
  const trimmed = s.trim()
  if (!trimmed) return null
  const normalized = trimmed.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : `${trimmed}Z`
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

function listingWhen(s: string | null | undefined): string {
  const d = parseReportDate(s)
  return d ? formatDate(d) : 'Date not recorded'
}

function listingRows(items: ReportListing[]): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const item of items) {
    const address = item.description?.trim() || 'Address not available'
    const href = listingDetailPath(item.listing_key)
    const typeLabel = getPropertyTypeLabel(item.property_type)
    const dom =
      item.days_on_market != null && Number.isFinite(item.days_on_market)
        ? `${item.days_on_market} days on market`
        : null
    const detail = [typeLabel, dom].filter((part): part is string => Boolean(part)).join(' · ')
    const priceLabel =
      item.price != null && Number.isFinite(item.price)
        ? formatPriceExact(item.price)
        : 'Price not recorded'
    rows.push({
      href,
      when: v3Text(listingWhen(item.event_date)),
      what: v3Text(address),
      detail: detail ? v3Text(detail) : undefined,
      value: v3Text(priceLabel),
      id: item.listing_key,
    })
  }
  return rows
}

type PageProps = { params: Promise<{ city: string; period: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug, period } = await params
  const cityName = resolveCityFromSlug(citySlug)
  const periodSlug = period as SalesPeriodSlug
  if (!cityName || !SALES_PERIODS.includes(periodSlug)) {
    return { title: 'Report Not Found | Ryan Realty' }
  }
  const periodLabel = getPeriodLabel(periodSlug)
  const title = `${cityName}: ${periodLabel} | Ryan Realty`
  const description = `Sales report for ${cityName}: ${periodLabel}. Closed and pending sales with prices, days on market, and property types.`
  const canonical = `${siteUrl}/reports/sales/${encodeURIComponent(cityEntityKey(cityName))}/${periodSlug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      siteName: 'Ryan Realty',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function SalesReportPage({ params }: PageProps) {
  const { city: citySlug, period } = await params
  const cityName = resolveCityFromSlug(citySlug)
  const periodSlug = period as SalesPeriodSlug
  if (!cityName || !SALES_PERIODS.includes(periodSlug)) notFound()

  await Promise.all([getSession(), getPersonIdFromCookie()])
  const periodLabel = getPeriodLabel(periodSlug)

  const { start, end } = getDateRangeForPeriod(periodSlug)
  const { closed, pending } = await getMarketReportDataForLocation(cityName, start, end)

  const prices = closed.map((c) => c.price).filter((p): p is number => p != null && Number.isFinite(p))
  const doms = closed.map((c) => c.days_on_market).filter((d): d is number => d != null && Number.isFinite(d))
  const medianPrice =
    prices.length > 0
      ? (() => {
          const s = [...prices].sort((a, b) => a - b)
          const m = Math.floor(s.length / 2)
          return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
        })()
      : null
  const medianDom =
    doms.length > 0
      ? (() => {
          const s = [...doms].sort((a, b) => a - b)
          const m = Math.floor(s.length / 2)
          return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
        })()
      : null

  const dateRangeStr = `${formatDate(start)} to ${formatDate(end)}`
  const pdfHref = `/api/pdf/report?geoName=${encodeURIComponent(cityName)}&period=${encodeURIComponent(`${periodLabel} / ${dateRangeStr}`)}`
  const cityPath = `/housing-market/${encodeURIComponent(cityEntityKey(cityName))}`

  // §0.7 — the pending source (activity_events) begins 2026-03-12. Over an
  // earlier window it returns nothing, and a published 0 would be a fabricated
  // fact, not a measurement. /reports/sales/<city>/last-year shipped exactly
  // that over calendar 2025. Withhold the figure instead.
  const pendingCovered = isPendingWindowCovered(start.toISOString())
  const pendingSourceStartLabel = formatDate(PENDING_SOURCE_COVERAGE_START_ISO)

  const datasetVariables: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Closed sales', value: closed.length },
  ]
  if (pendingCovered) {
    datasetVariables.push({ name: 'Pending sales', value: pending.length })
  }
  if (medianPrice != null) {
    datasetVariables.push({ name: 'Median sale price', value: Math.round(medianPrice), unitText: 'USD' })
  }
  if (medianDom != null) {
    datasetVariables.push({ name: 'Median days on market', value: medianDom, unitText: 'days' })
  }

  const canonicalLiveUrl = `${siteUrl}/housing-market/reports/sales/${encodeURIComponent(cityEntityKey(cityName))}/${periodSlug}`

  const figures: V3InstrumentFigure[] = [
    {
      value: v3Text(String(closed.length)),
      label: v3Text('Closed sales'),
      href: '#closed-sales',
    },
  ]
  if (pendingCovered) {
    figures.push({
      value: v3Text(String(pending.length)),
      label: v3Text('Pending sales'),
      href: '#pending-sales',
    })
  }
  if (medianPrice != null) {
    figures.push({
      value: v3Text(formatPriceExact(medianPrice)),
      label: v3Text('median sale price'),
      href: cityPath,
    })
  }
  if (medianDom != null) {
    figures.push({
      value: v3Text(`${medianDom} days`),
      label: v3Text('median days on market'),
      href: cityPath,
    })
  }
  const [firstFigure, ...restFigures] = figures

  const closedRows = listingRows(closed)
  const pendingRows = listingRows(pending)
  const [firstClosed, ...restClosed] = closedRows
  const [firstPending, ...restPending] = pendingRows

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
                { name: cityName, url: cityPath },
                { name: periodLabel, url: canonicalLiveUrl },
              ],
            },
            {
              type: 'dataset',
              name: `${cityName} real estate sales report, ${periodLabel}`,
              description:
                `Closed and pending residential home sales for ${cityName}, Oregon. ` +
                `Includes sale count, median sale price, and median days on market. ` +
                `Sourced from Oregon Data Share via Ryan Realty.`,
              url: canonicalLiveUrl,
              temporalCoverage: `${start.toISOString().slice(0, 10)}/${end.toISOString().slice(0, 10)}`,
              spatialCoverageName: `${cityName}, OR`,
              variableMeasured: datasetVariables,
            },
          ]}
        />
        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Market reports', href: '/housing-market/reports' },
            { label: cityName, href: cityPath },
            { label: periodLabel },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="sales-stats"
            level={1}
            eyebrow={v3Text(`Sales report · ${dateRangeStr}`)}
            headline={v3Text(`${cityName}, ${periodLabel}`)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(
              `${pendingCovered ? 'closed and pending' : 'closed'} residential sales for ${cityName}, Oregon, ${dateRangeStr}. Median sale price and median days on market are computed from the closed rows on this page. Sourced from Oregon Data Share via Ryan Realty`,
            )}
            action={{
              label: v3Text('Download PDF'),
              href: pdfHref,
              variant: 'primary',
            }}
          />
        ) : null}

        {closed.length > 0 ? (
          <section id="sales-charts" aria-label="Sales charts">
            <SalesReportCharts closed={closed} periodStart={start} periodEnd={end} />
          </section>
        ) : null}

        {firstClosed ? (
          <V3Ledger
            id="closed-sales"
            eyebrow={v3Text('Closed')}
            heading={v3Text('Closed sales')}
            note={v3Text(
              'Address, sold date, days on market, property type, and sale price. Select a row to view the listing.',
            )}
            rows={[firstClosed, ...restClosed]}
            source={v3Text(
              `closed residential sales for ${cityName}, ${dateRangeStr}. Each row is one listing. Price is the recorded close price in whole dollars`,
            )}
          />
        ) : (
          <V3Ledger
            id="closed-sales"
            eyebrow={v3Text('Closed')}
            heading={v3Text('Closed sales')}
            rows={[]}
            emptyMessage={v3Text(`No closed sales in this period for ${cityName}.`)}
          />
        )}

        <V3Quiet
          id="between"
          ariaLabel="How to read this report"
          items={[
            {
              kind: 'prose',
              body: 'Pending rows are homes that went under contract in the same window. They are a different population from the closed sales above.',
            },
          ]}
        />

        {firstPending ? (
          <V3Ledger
            id="pending-sales"
            eyebrow={v3Text('Pending')}
            heading={v3Text('Went pending')}
            rows={[firstPending, ...restPending]}
            source={v3Text(
              `homes that went pending in ${cityName}, ${dateRangeStr}. Price is the list price at pending, in whole dollars`,
            )}
          />
        ) : (
          <V3Ledger
            id="pending-sales"
            eyebrow={v3Text('Pending')}
            heading={v3Text('Went pending')}
            rows={[]}
            emptyMessage={v3Text(
              pendingCovered
                ? `No pending sales in this period for ${cityName}.`
                : `Pending records start ${pendingSourceStartLabel}. This window is earlier.`,
            )}
          />
        )}

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Keep reading"
          items={[
            { label: `${cityName} market report`, href: cityPath },
            { label: 'All reports', href: '/housing-market/reports' },
            { label: 'Value my home', href: valuationHref(`/reports/sales/${cityEntityKey(cityName)}/${periodSlug}`) },
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
