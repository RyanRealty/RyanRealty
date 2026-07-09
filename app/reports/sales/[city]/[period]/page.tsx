/**
 * /reports/sales/[city]/[period] — closed + pending sales report for one city
 * over a fixed period (this week / last week / last month / last year).
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE. Every piece of content is preserved:
 *   - Dataset (schema.org) JSON-LD with variableMeasured sourced ONLY from the
 *     fetched closed/pending data (closed count, pending count, median price,
 *     median DOM) — never fabricated (CLAUDE.md §0)
 *   - the hero (city + period label + date range + Download PDF + All reports)
 *   - the four stat cards (closed, pending, median price, median DOM)
 *   - SalesReportCharts (interactive client) when there are closed sales
 *   - the full Closed sales table (address link, sold date, DOM, type, price)
 *   - the full Went pending table (address link, pending date, type, price)
 *   - the empty state ("No closed or pending sales in this period")
 *   - generateMetadata (async) + canonical
 *   - the DAL read (getMarketReportDataForLocation) + FUB tracking
 *   - the PDF export href
 *
 * Only presentation changed: KB shell, Amboqia display headings, hard-edge
 * navy-on-cream surfaces, mono-num figures. The shadcn Table primitives are
 * kept (semantic table markup) and KB-skinned. The SalesReportCharts client
 * keeps its logic intact.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { SALES_PERIODS, getDateRangeForPeriod, getPeriodLabel, type SalesPeriodSlug } from '@/lib/sales-report-periods'
import { getMarketReportDataForLocation, type ReportListing } from '@/app/actions/market-reports'
import { getPropertyTypeLabel } from '@/lib/property-type-labels'
import { PRIMARY_CITIES } from '@/lib/cities'
import { cityEntityKey, listingDetailPath } from '@/lib/slug'
import SalesReportCharts from '@/components/reports/SalesReportCharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function resolveCityFromSlug(slug: string): string | null {
  const decoded = decodeURIComponent(slug).trim().toLowerCase()
  const found = PRIMARY_CITIES.find((c) => cityEntityKey(c) === decoded)
  return found ?? null
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

/** Parse ISO date string safely (handles with or without Z). */
function parseReportDate(s: string | null | undefined): Date | null {
  if (!s || typeof s !== 'string') return null
  const trimmed = s.trim()
  if (!trimmed) return null
  const normalized = trimmed.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed) ? trimmed : trimmed + 'Z'
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Format sold date for display. */
function formatSoldDate(s: string | null | undefined): string {
  const d = parseReportDate(s)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
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
  const title = `${cityName} — ${periodLabel} | Ryan Realty`
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

  const [session, fubPersonId] = await Promise.all([getSession(), getPersonIdFromCookie()])
  const pageUrl = `${siteUrl}/reports/sales/${encodeURIComponent(cityEntityKey(cityName))}/${periodSlug}`
  const periodLabel = getPeriodLabel(periodSlug)
  const pageTitle = `${cityName} — ${periodLabel} | Ryan Realty`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  const { start, end } = getDateRangeForPeriod(periodSlug)
  const { closed, pending } = await getMarketReportDataForLocation(cityName, start, end)

  const prices = closed.map((c) => c.price).filter((p): p is number => p != null && Number.isFinite(p))
  const doms = closed.map((c) => c.days_on_market).filter((d): d is number => d != null && Number.isFinite(d))
  const medianPrice = prices.length > 0 ? (() => { const s = [...prices].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2 })() : null
  const medianDom = doms.length > 0 ? (() => { const s = [...doms].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2 })() : null

  const dateRangeStr = formatDateRange(start, end)
  const pdfHref = `/api/pdf/report?geoName=${encodeURIComponent(cityName)}&period=${encodeURIComponent(periodLabel + ' — ' + dateRangeStr)}`

  // Dataset JSON-LD — variableMeasured comes only from the fetched closed/pending
  // data. Numbers are the same values shown in the StatCards above.
  const datasetVariables: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Closed sales', value: closed.length },
    { name: 'Pending sales', value: pending.length },
  ]
  if (medianPrice != null) {
    datasetVariables.push({ name: 'Median sale price', value: Math.round(medianPrice), unitText: 'USD' })
  }
  if (medianDom != null) {
    datasetVariables.push({ name: 'Median days on market', value: medianDom, unitText: 'days' })
  }

  const canonicalLiveUrl = `${siteUrl}/housing-market/reports/sales/${encodeURIComponent(cityEntityKey(cityName))}/${periodSlug}`

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="reports" />
      <MetadataBlock
        schema={{
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
        }}
      />
      <KbBreadcrumb
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Market reports', href: '/housing-market/reports' },
          { label: cityName, href: `/housing-market/${encodeURIComponent(cityEntityKey(cityName))}` },
          { label: periodLabel },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — city + period + date range, with PDF + all-reports CTAs. */}
        <section className="section" id="sales-report-hero" aria-label="Sales report header">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Sales report · {dateRangeStr}</span>
            </div>
            <div className="pt-7">
              <h1 className="display" style={{ fontSize: 'clamp(2.2rem,7vw,4.6rem)', lineHeight: 0.92 }}>
                {cityName},<br />{periodLabel}
              </h1>
              <p
                className="mono-num mt-4"
                style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)', letterSpacing: '.02em' }}
              >
                {dateRangeStr}
              </p>
              <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 'clamp(20px,3vw,30px)' }}>
                <a href={pdfHref} className="btn alt">
                  Download PDF <span className="arr">→</span>
                </a>
                <Link href="/housing-market/reports" className="btn alt" style={{ background: 'transparent', color: 'var(--navy)' }}>
                  All reports <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Headline stats — closed, pending, median price, median DOM. Hard-edge
            ledger cells, Amboqia figures, mono-num tabular numerals. */}
        <section className="section" id="sales-stats" aria-label="Headline statistics">
          <div className="wrap">
            <div
              className="grid grid-cols-2 lg:grid-cols-4"
              style={{ borderTop: 'var(--edge) solid var(--navy)', borderLeft: 'var(--edge) solid var(--navy)' }}
            >
              <StatCell label="Closed sales" value={closed.length} />
              <StatCell label="Pending" value={pending.length} />
              <StatCell label="Median sale price" value={medianPrice != null ? formatPrice(medianPrice) : '—'} />
              <StatCell label="Median days on market" value={medianDom != null ? `${medianDom} days` : '—'} />
            </div>
          </div>
        </section>

        {closed.length > 0 && (
          <>
            {/* Trend charts — interactive client, preserved. Wrapped in a navy
                panel that matches the KB market register. */}
            <section className="section" id="sales-charts" aria-label="Sales charts">
              <div className="wrap">
                <SalesReportCharts closed={closed} periodStart={start} periodEnd={end} />
              </div>
            </section>

            {/* Closed sales table — every row preserved. */}
            <section className="section" id="closed-sales" aria-label="Closed sales">
              <div className="wrap">
                <div className="sec-head">
                  <span className="sec-index">Closed</span>
                  <h2 className="sec-title display">Closed sales ({closed.length})</h2>
                </div>
                <p className="pt-5 text-sm" style={{ color: 'var(--navy-70)', lineHeight: 1.55 }}>
                  Address, sold date, days on market, property type, and sale price. Select a row to view the listing.
                </p>
                <div className="mt-5 overflow-x-auto" style={{ border: 'var(--edge) solid var(--navy)' }}>
                  <Table className="w-full min-w-[640px] text-left text-sm">
                    <TableHeader>
                      <TableRow className="kb-thead-row">
                        <TableHead className="kb-th">Address</TableHead>
                        <TableHead className="kb-th">Sold date</TableHead>
                        <TableHead className="kb-th">Days on market</TableHead>
                        <TableHead className="kb-th">Property type</TableHead>
                        <TableHead className="kb-th text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closed.map((item) => (
                        <ListingTableRow key={item.listing_key} item={item} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </section>
          </>
        )}

        {pending.length > 0 && (
          <section className="section" id="pending-sales" aria-label="Went pending">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Pending</span>
                <h2 className="sec-title display">Went pending ({pending.length})</h2>
              </div>
              <div className="mt-5 overflow-x-auto" style={{ border: 'var(--edge) solid var(--navy)' }}>
                <Table className="w-full min-w-[520px] text-left text-sm">
                  <TableHeader>
                    <TableRow className="kb-thead-row">
                      <TableHead className="kb-th">Address / listing</TableHead>
                      <TableHead className="kb-th">Pending date</TableHead>
                      <TableHead className="kb-th">Property type</TableHead>
                      <TableHead className="kb-th text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((item) => (
                      <PendingTableRow key={item.listing_key} item={item} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        )}

        {closed.length === 0 && pending.length === 0 && (
          <section className="section" id="no-sales" aria-label="No sales">
            <div className="wrap">
              <p className="pt-6 pb-2" style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)' }}>
                No closed or pending sales in this period for {cityName}.
              </p>
            </div>
          </section>
        )}

        <KbFooter towns={[]} />
      </SmoothScrollProvider>

      {/* KB table skin — scoped to this page via kb-root. Hard navy edges, cream
          header row, tabular numerals on every cell, no shadcn card chrome. */}
      <style>{`
        .kb-root .kb-thead-row{background:var(--navy);border:0;}
        .kb-root .kb-th{color:var(--cream);font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:.68rem;padding:13px 16px;}
        .kb-root #closed-sales table tbody tr,
        .kb-root #pending-sales table tbody tr{border-bottom:1px solid var(--navy-12);}
        .kb-root #closed-sales table tbody tr:last-child,
        .kb-root #pending-sales table tbody tr:last-child{border-bottom:0;}
        .kb-root .kb-td{padding:13px 16px;color:var(--navy-70);font-variant-numeric:tabular-nums;}
        .kb-root .kb-td-addr a{color:var(--navy);font-weight:600;}
        .kb-root .kb-td-addr a:hover{text-decoration:underline;text-underline-offset:2px;}
        .kb-root .kb-td-price{text-align:right;color:var(--navy);font-weight:700;font-variant-numeric:tabular-nums;}
      `}</style>
    </main>
  )
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex flex-col"
      style={{
        borderRight: 'var(--edge) solid var(--navy)',
        borderBottom: 'var(--edge) solid var(--navy)',
        padding: 'clamp(18px,2.6vw,26px)',
      }}
    >
      <span
        className="display mono-num"
        style={{ fontSize: 'clamp(1.7rem,4.4vw,2.6rem)', lineHeight: 0.92 }}
      >
        {value}
      </span>
      <span
        className="mt-3"
        style={{ fontSize: '.66rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--navy-70)' }}
      >
        {label}
      </span>
    </div>
  )
}

function ListingTableRow({ item }: { item: ReportListing }) {
  const href = listingDetailPath(item.listing_key)
  const address = item.description?.trim() || 'Address not available'
  return (
    <TableRow>
      <TableCell className="kb-td kb-td-addr">
        <Link href={href}>{address}</Link>
      </TableCell>
      <TableCell className="kb-td">{formatSoldDate(item.event_date)}</TableCell>
      <TableCell className="kb-td">
        {item.days_on_market != null && Number.isFinite(item.days_on_market) ? `${item.days_on_market} days` : '—'}
      </TableCell>
      <TableCell className="kb-td">{getPropertyTypeLabel(item.property_type)}</TableCell>
      <TableCell className="kb-td kb-td-price">{formatPrice(item.price)}</TableCell>
    </TableRow>
  )
}

function PendingTableRow({ item }: { item: ReportListing }) {
  const href = listingDetailPath(item.listing_key)
  const address = item.description?.trim() || `Listing ${item.listing_key}`
  return (
    <TableRow>
      <TableCell className="kb-td kb-td-addr">
        <Link href={href}>{address}</Link>
      </TableCell>
      <TableCell className="kb-td">{formatSoldDate(item.event_date)}</TableCell>
      <TableCell className="kb-td">{getPropertyTypeLabel(item.property_type)}</TableCell>
      <TableCell className="kb-td kb-td-price">{formatPrice(item.price)}</TableCell>
    </TableRow>
  )
}
