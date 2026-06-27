/**
 * /admin/analytics/listing-performance - which listings get the most attention.
 *
 * Aggregates visitor_events of type listing_view by MLS number (last 30
 * days). Surfaces: total views, unique sessions, identified visitors,
 * hot leads, average price, top traffic source. Tells the broker which
 * listings to lean into for marketing and which are underperforming.
 */
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import DashboardSummaryStrip from '@/components/admin/DashboardSummaryStrip'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'
import { DateRangePicker } from '../_components/DateRangePicker'
import { resolveDateRange } from '../_lib/queries'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>
function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v
  return out
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function fmtInt(n: number): string { return new Intl.NumberFormat('en-US').format(n) }
function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

async function ListingLeaderboard({ range }: { range: { startDate: string; endDate: string } }) {
  const supabase = getSupabase()
  const since = `${range.startDate}T00:00:00.000Z`
  const until = `${range.endDate}T23:59:59.999Z`

  // Pull listing_view events for the selected range, then aggregate in JS
  const { data: events, error } = await supabase
    .from('visitor_events')
    .select('session_id, listing_mls, listing_street, listing_city, listing_state, listing_price, page_url, event_at, source_domain')
    .eq('event_type', 'listing_view')
    .not('listing_mls', 'is', null)
    .gte('event_at', since)
    .lte('event_at', until)
    .limit(50000)
  if (error) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Could not load listing events: {error.message}</CardContent></Card>
  }
  const evRows = (events ?? []) as Array<{ session_id: string; listing_mls: string; listing_street: string | null; listing_city: string | null; listing_state: string | null; listing_price: number | null; page_url: string; event_at: string; source_domain: string }>
  const eventsCapped = evRows.length === 50000
  if (evRows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No listing-detail page views captured for {range.startDate} to {range.endDate} yet. Once visitors browse listings with consent granted, the leaderboard fills in. Listing views weight 10 points each in the engagement score.
        </CardContent>
      </Card>
    )
  }

  // Pull session join data so we can compute identified + hot per listing
  const sessionIds = Array.from(new Set(evRows.map((e) => e.session_id)))
  const { data: sessRows } = await supabase
    .from('visitor_sessions')
    .select('session_id, identified_at, hot_lead_fired_at, utm_source, ip_city')
    .in('session_id', sessionIds)
  const sessMap = new Map<string, { identified: boolean; hot: boolean; utm_source: string | null; ip_city: string | null }>()
  for (const s of (sessRows ?? []) as Array<{ session_id: string; identified_at: string | null; hot_lead_fired_at: string | null; utm_source: string | null; ip_city: string | null }>) {
    sessMap.set(s.session_id, {
      identified: s.identified_at != null,
      hot: s.hot_lead_fired_at != null,
      utm_source: s.utm_source,
      ip_city: s.ip_city,
    })
  }

  type ListingAgg = {
    mls: string
    address: string
    city: string
    price: number | null
    views: number
    uniqueSessions: Set<string>
    identifiedSessions: Set<string>
    hotSessions: Set<string>
    sources: Map<string, number>
    pageUrl: string
  }
  const byListing = new Map<string, ListingAgg>()
  for (const e of evRows) {
    const mls = e.listing_mls!
    let a = byListing.get(mls)
    if (!a) {
      const addr = e.listing_street || ''
      a = {
        mls,
        address: addr,
        city: e.listing_city || '',
        price: e.listing_price,
        views: 0,
        uniqueSessions: new Set(),
        identifiedSessions: new Set(),
        hotSessions: new Set(),
        sources: new Map(),
        pageUrl: e.page_url,
      }
      byListing.set(mls, a)
    }
    a.views += 1
    a.uniqueSessions.add(e.session_id)
    const sess = sessMap.get(e.session_id)
    if (sess?.identified) a.identifiedSessions.add(e.session_id)
    if (sess?.hot) a.hotSessions.add(e.session_id)
    if (sess?.utm_source) a.sources.set(sess.utm_source, (a.sources.get(sess.utm_source) ?? 0) + 1)
    // Prefer most-complete price/address record we see
    if (a.price == null && e.listing_price != null) a.price = e.listing_price
    if (!a.address && e.listing_street) a.address = e.listing_street
    if (!a.city && e.listing_city) a.city = e.listing_city
  }

  function topSource(m: Map<string, number>): string {
    let bestK = '—'
    let bestN = 0
    for (const [k, n] of m) { if (n > bestN) { bestK = k; bestN = n } }
    return bestK
  }

  const rows = Array.from(byListing.values()).map((a) => ({
    mls: a.mls,
    address: a.address,
    city: a.city,
    price: a.price,
    views: a.views,
    uniqueVisitors: a.uniqueSessions.size,
    identified: a.identifiedSessions.size,
    hot: a.hotSessions.size,
    identifyRate: a.uniqueSessions.size ? a.identifiedSessions.size / a.uniqueSessions.size : 0,
    topSource: topSource(a.sources),
    pageUrl: a.pageUrl,
  })).sort((a, b) => b.views - a.views)

  // Summary band totals
  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const totalIdentified = rows.reduce((s, r) => s + r.identified, 0)
  const totalHot = rows.reduce((s, r) => s + r.hot, 0)

  return (
    <div className="space-y-6">
      {eventsCapped && (
        <p className="text-xs text-warning">
          Showing first 50,000 events — result capped. Narrow the date range to see complete data.
        </p>
      )}
      <DashboardSummaryStrip
        stats={[
          { label: 'Listings viewed', value: fmtInt(rows.length) },
          { label: `Total views (${range.startDate} to ${range.endDate})`, value: fmtInt(totalViews) },
          { label: 'Identified', value: fmtInt(totalIdentified) },
          { label: 'Hot leads', value: fmtInt(totalHot), tone: totalHot > 0 ? 'success' : 'default' },
        ]}
      />

      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Listing performance ({range.startDate} to {range.endDate})</h2>
          <p className="text-xs text-muted-foreground">
            Ranked by total views. Identify rate is the share of unique visitors who signed in or converted while viewing this listing. Hot column is sessions that crossed score 100 anywhere in the funnel and viewed this listing along the way.
          </p>
        </div>
        <TableWithMobileCards
          rows={rows}
          cap={12}
          getRowKey={(r) => r.mls}
          columns={[
            { key: 'listing', header: 'Listing', className: 'whitespace-nowrap', cell: (r) => {
              const i = rows.indexOf(r)
              return (
                <>
                  <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">MLS {r.mls}</a>
                  <div className="text-[10px] text-muted-foreground">{r.address}</div>
                  {i < 3 && <Badge variant="default" className="mt-1 text-[10px]">top {i + 1}</Badge>}
                </>
              )
            } },
            { key: 'city', header: 'City', className: 'text-xs whitespace-nowrap', cell: (r) => r.city },
            { key: 'price', header: 'Price', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => fmtUsd(r.price) },
            { key: 'views', header: 'Views', className: 'text-right tabular-nums font-semibold whitespace-nowrap', cell: (r) => fmtInt(r.views) },
            { key: 'unique', header: 'Unique', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => fmtInt(r.uniqueVisitors) },
            { key: 'identified', header: 'Identified', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => fmtInt(r.identified) },
            { key: 'idrate', header: 'ID rate', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => `${(r.identifyRate * 100).toFixed(1)}%` },
            { key: 'hot', header: 'Hot', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => fmtInt(r.hot) },
            { key: 'source', header: 'Top source', className: 'text-xs whitespace-nowrap', cell: (r) => r.topSource },
          ]}
          renderCard={(r) => {
            const i = rows.indexOf(r)
            return (
              <Card>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">MLS {r.mls}</a>
                      {i < 3 && <Badge variant="default" className="ml-2 text-xs">top {i + 1}</Badge>}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{fmtInt(r.views)} <span className="text-xs font-normal text-muted-foreground">views</span></span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.address}{r.city ? ` · ${r.city}` : ''} · {fmtUsd(r.price)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{fmtInt(r.uniqueVisitors)} unique · {fmtInt(r.identified)} identified ({(r.identifyRate * 100).toFixed(1)}%) · {fmtInt(r.hot)} hot · {r.topSource}</p>
                </CardContent>
              </Card>
            )
          }}
          empty={<>No listing-detail page views captured in the last 30 days yet. Once visitors browse listings with consent granted, the leaderboard fills in.</>}
        />
        <p className="text-xs text-muted-foreground">
          If a listing is repeatedly getting many views but a low identify rate, the listing detail page is hooking attention without converting. Worth reviewing the photo gallery, description, or video tour for that listing.
        </p>
      </section>
    </div>
  )
}

export default async function ListingPerformancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Listing performance</h1>
        <p className="text-sm text-muted-foreground">
          Which listings drive the most engagement, and which converted visitors into identified leads. Sourced from <code>visitor_events</code> where event_type = listing_view.
        </p>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ListingLeaderboard range={range} />
      </Suspense>
    </div>
  )
}
