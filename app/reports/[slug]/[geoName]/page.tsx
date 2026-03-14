import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { classifyMarketCondition } from '@/lib/market-condition'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import {
  TrackedReportDownloadLink,
  TrackedReportExploreLink,
  TrackedReportListingsLink,
  TrackedReportValuationLink,
} from '@/components/reports/TrackedReportActions'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

type PageProps = { params: Promise<{ slug: string; geoName: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, geoName } = await params
  const name = decodeURIComponent(geoName)
  const title = `${name} Real Estate Market Report | Ryan Realty`
  return {
    title,
    description: `Current market stats and trends for ${name}. Median price, inventory, days on market.`,
    alternates: { canonical: `${siteUrl}/reports/${slug}/${encodeURIComponent(geoName)}` },
  }
}

export default async function ReportGeoPage({ params }: PageProps) {
  const { slug, geoName } = await params
  const geoType = slug
  const decodedName = decodeURIComponent(geoName)
  const supabase = getSupabase()
  if (!supabase) notFound()

  const [session, fubPersonId] = await Promise.all([getSession(), getFubPersonIdFromCookie()])
  const pageUrl = `${siteUrl}/reports/${slug}/${encodeURIComponent(decodedName)}`
  const pageTitle = `${decodedName} Market Report | Ryan Realty`
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  const periodStart = startOfMonth.toISOString().slice(0, 10)
  const periodEnd = new Date().toISOString().slice(0, 10)

  const { data: row } = await supabase
    .from('reporting_cache')
    .select('metrics')
    .eq('geo_type', geoType === 'community' ? 'community' : 'city')
    .eq('geo_name', decodedName)
    .eq('period_type', 'monthly')
    .eq('period_start', periodStart)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const metrics = (row?.metrics as Record<string, unknown>) ?? {}
  const medianPrice = metrics.median_price != null ? Number(metrics.median_price) : null
  const soldCount = metrics.sold_count != null ? Number(metrics.sold_count) : null
  const currentListings = metrics.current_listings != null ? Number(metrics.current_listings) : null
  const medianDom = metrics.median_dom != null ? Number(metrics.median_dom) : null
  const inventoryMonths = metrics.inventory_months != null ? Number(metrics.inventory_months) : null
  const condition = classifyMarketCondition({
    monthsOfInventory: inventoryMonths,
    avgDom: medianDom,
    listToSoldRatio: null,
  })

  return (
    <main className="min-h-screen bg-background">
      <section className="bg-primary px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <nav className="mb-4 text-sm text-muted/80" aria-label="Breadcrumb">
            <Link href="/reports" className="hover:text-muted">Market reports</Link>
            <span className="mx-2">/</span>
            <Link href="/reports/explore" className="hover:text-muted">Explore</Link>
            <span className="mx-2">/</span>
            <span className="text-muted">{decodedName}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{decodedName} Market Report</h1>
          <p className="mt-2 text-muted/90">
            {periodStart} through {periodEnd}
          </p>
          <div className="mt-4 inline-block rounded-full bg-card/20 px-4 py-2 text-sm font-medium text-white">
            {condition.label}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {medianPrice != null && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Median Price</p>
              <p className="text-xl font-semibold text-primary">
                ${medianPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
          {currentListings != null && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Active Listings</p>
              <p className="text-xl font-semibold text-primary">{currentListings}</p>
            </div>
          )}
          {medianDom != null && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Median DOM</p>
              <p className="text-xl font-semibold text-primary">{medianDom} days</p>
            </div>
          )}
          {soldCount != null && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Sold (period)</p>
              <p className="text-xl font-semibold text-primary">{soldCount}</p>
            </div>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <TrackedReportDownloadLink
            geoName={decodedName}
            periodStart={periodStart}
            className="inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-primary shadow-sm hover:bg-accent/90"
          >
            Download as PDF
          </TrackedReportDownloadLink>
          <TrackedReportListingsLink className="inline-flex rounded-lg border border-primary/20 bg-card px-4 py-2.5 text-sm font-medium text-primary hover:bg-muted">
            View Listings
          </TrackedReportListingsLink>
          <TrackedReportExploreLink className="inline-flex rounded-lg border border-primary/20 bg-card px-4 py-2.5 text-sm font-medium text-primary hover:bg-muted">
            Explore more data
          </TrackedReportExploreLink>
          <TrackedReportValuationLink className="inline-flex rounded-lg border border-primary/20 bg-card px-4 py-2.5 text-sm font-medium text-primary hover:bg-muted">
            What&apos;s Your Home Worth?
          </TrackedReportValuationLink>
        </div>
      </section>
    </main>
  )
}
