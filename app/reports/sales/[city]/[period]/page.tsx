import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { SALES_PERIODS, getDateRangeForPeriod, getPeriodLabel, type SalesPeriodSlug } from '@/lib/sales-report-periods'
import { getMarketReportDataForLocation, type ReportListing } from '@/app/actions/market-reports'
import { getPropertyTypeLabel } from '@/lib/property-type-labels'
import { PRIMARY_CITIES } from '@/lib/cities'
import { cityEntityKey } from '@/lib/slug'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import SalesReportCharts from '@/components/reports/SalesReportCharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
  return {
    title,
    description: `Sales report for ${cityName}: ${periodLabel}. Closed and pending sales with prices, days on market, and property types.`,
    alternates: {
      canonical: `${siteUrl}/reports/sales/${encodeURIComponent(cityEntityKey(cityName))}/${periodSlug}`,
    },
  }
}

export default async function SalesReportPage({ params }: PageProps) {
  const { city: citySlug, period } = await params
  const cityName = resolveCityFromSlug(citySlug)
  const periodSlug = period as SalesPeriodSlug
  if (!cityName || !SALES_PERIODS.includes(periodSlug)) notFound()

  const [session, fubPersonId] = await Promise.all([getSession(), getFubPersonIdFromCookie()])
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

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title={`${cityName} — ${periodLabel}`}
        subtitle={dateRangeStr}
        imageUrl={CONTENT_HERO_IMAGES.reports}
        ctas={[
          { label: 'Download PDF', href: pdfHref, primary: true },
          { label: 'All Reports', href: '/reports', primary: false },
        ]}
      />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Closed sales" value={closed.length} />
          <StatCard label="Pending" value={pending.length} />
          <StatCard label="Median sale price" value={medianPrice != null ? formatPrice(medianPrice) : '—'} />
          <StatCard label="Median days on market" value={medianDom != null ? `${medianDom} days` : '—'} />
        </div>

        {closed.length > 0 && (
          <>
            <SalesReportCharts closed={closed} periodStart={start} periodEnd={end} />

            <h2 className="mt-14 text-xl font-bold text-primary">
              Closed sales ({closed.length})
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Address, sold date, days on market, property type, and sale price. Click a row to view the listing.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <Table className="w-full min-w-[640px] text-left text-sm">
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted">
                      <TableHead className="px-4 py-3 font-semibold text-primary">Address</TableHead>
                      <TableHead className="px-4 py-3 font-semibold text-primary">Sold date</TableHead>
                      <TableHead className="px-4 py-3 font-semibold text-primary">Days on market</TableHead>
                      <TableHead className="px-4 py-3 font-semibold text-primary">Property type</TableHead>
                      <TableHead className="px-4 py-3 font-semibold text-primary text-right">Price</TableHead>
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
          </>
        )}

        {pending.length > 0 && (
          <>
            <h2 className="mt-14 text-xl font-bold text-primary">
              Went pending ({pending.length})
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <Table className="w-full min-w-[520px] text-left text-sm">
                  <TableHeader>
                    <TableRow className="border-b border-border bg-muted">
                      <TableHead className="px-4 py-3 font-semibold text-primary">Address / listing</TableHead>
                      <TableHead className="px-4 py-3 font-semibold text-primary">Pending date</TableHead>
                      <TableHead className="px-4 py-3 font-semibold text-primary">Property type</TableHead>
                      <TableHead className="px-4 py-3 font-semibold text-primary text-right">Price</TableHead>
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
          </>
        )}

        {closed.length === 0 && pending.length === 0 && (
          <p className="text-muted-foreground">No closed or pending sales in this period for {cityName}.</p>
        )}

        <p className="mt-14">
          <Link href="/reports" className="font-semibold text-primary hover:underline">
            ← Back to Market Reports
          </Link>
        </p>
      </section>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  )
}

function ListingTableRow({ item }: { item: ReportListing }) {
  const href = `/listing/${encodeURIComponent(item.listing_key)}`
  const address = item.description?.trim() || 'Address not available'
  return (
    <TableRow className="group border-b border-border last:border-b-0">
      <TableCell className="px-4 py-3">
        <Link href={href} className="font-medium text-primary hover:text-accent-foreground hover:underline">
          {address}
        </Link>
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">{formatSoldDate(item.event_date)}</TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">
        {item.days_on_market != null && Number.isFinite(item.days_on_market) ? `${item.days_on_market} days` : '—'}
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">{getPropertyTypeLabel(item.property_type)}</TableCell>
      <TableCell className="px-4 py-3 text-right font-semibold text-primary">{formatPrice(item.price)}</TableCell>
    </TableRow>
  )
}

function PendingTableRow({ item }: { item: ReportListing }) {
  const href = `/listing/${encodeURIComponent(item.listing_key)}`
  const address = item.description?.trim() || `Listing ${item.listing_key}`
  return (
    <TableRow className="group border-b border-border last:border-b-0">
      <TableCell className="px-4 py-3">
        <Link href={href} className="font-medium text-primary hover:text-accent-foreground hover:underline">
          {address}
        </Link>
      </TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">{formatSoldDate(item.event_date)}</TableCell>
      <TableCell className="px-4 py-3 text-muted-foreground">{getPropertyTypeLabel(item.property_type)}</TableCell>
      <TableCell className="px-4 py-3 text-right font-semibold text-primary">{formatPrice(item.price)}</TableCell>
    </TableRow>
  )
}
