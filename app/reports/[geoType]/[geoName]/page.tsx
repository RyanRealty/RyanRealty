import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { classifyMarketCondition } from '@/lib/market-condition'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

type PageProps = { params: Promise<{ geoType: string; geoName: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { geoType, geoName } = await params
  const name = decodeURIComponent(geoName)
  const title = `${name} Real Estate Market Report | Ryan Realty`
  return {
    title,
    description: `Current market stats and trends for ${name}. Median price, inventory, days on market.`,
    alternates: { canonical: `${siteUrl}/reports/${geoType}/${encodeURIComponent(geoName)}` },
  }
}

export default async function ReportGeoPage({ params }: PageProps) {
  const { geoType, geoName } = await params
  const decodedName = decodeURIComponent(geoName)
  const supabase = getSupabase()
  if (!supabase) notFound()

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
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-zinc-600">
        <Link href="/reports" className="hover:text-zinc-900">Market Reports</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">{decodedName}</span>
      </nav>
      <h1 className="text-2xl font-bold text-zinc-900">{decodedName} Market Report</h1>
      <p className="mt-1 text-zinc-600">
        {periodStart} through {periodEnd}
      </p>
      <div className="mt-6 inline-block rounded-full bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800">
        {condition.label}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {medianPrice != null && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Median Price</p>
            <p className="text-xl font-semibold text-zinc-900">
              ${medianPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        )}
        {currentListings != null && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Active Listings</p>
            <p className="text-xl font-semibold text-zinc-900">{currentListings}</p>
          </div>
        )}
        {medianDom != null && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Median DOM</p>
            <p className="text-xl font-semibold text-zinc-900">{medianDom} days</p>
          </div>
        )}
        {soldCount != null && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-zinc-500">Sold (period)</p>
            <p className="text-xl font-semibold text-zinc-900">{soldCount}</p>
          </div>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        <a
          href={`/api/pdf/report?geoName=${encodeURIComponent(decodedName)}&period=${periodStart}`}
          className="inline-flex rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Download as PDF
        </a>
        <Link
          href="/listings"
          className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          View Listings
        </Link>
        <Link
          href="/tools/mortgage-calculator"
          className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          What&apos;s Your Home Worth?
        </Link>
      </div>
    </main>
  )
}
