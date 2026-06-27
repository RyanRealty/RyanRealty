// /admin/analytics/google-business-profile - GBP dashboard
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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

function sup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const METRICS: Array<{ key: string; label: string; help: string }> = [
  { key: 'business_impressions_desktop_search', label: 'Desktop Search impressions', help: 'Profile appeared in Google Search on desktop' },
  { key: 'business_impressions_mobile_search', label: 'Mobile Search impressions', help: 'Profile appeared in Google Search on mobile' },
  { key: 'business_impressions_desktop_maps', label: 'Desktop Maps impressions', help: 'Profile appeared in Google Maps on desktop' },
  { key: 'business_impressions_mobile_maps', label: 'Mobile Maps impressions', help: 'Profile appeared in Google Maps on mobile' },
  { key: 'website_clicks', label: 'Website clicks', help: 'Clicked website link from GBP' },
  { key: 'call_clicks', label: 'Phone calls', help: 'Tapped call button (mobile)' },
  { key: 'business_direction_requests', label: 'Direction requests', help: 'Asked for driving directions' },
  { key: 'business_bookings', label: 'Bookings', help: 'Via GBP booking widget' },
  { key: 'business_conversations', label: 'GBP chats', help: 'Messages sent via GBP chat' },
]

async function fetchPeriod(sinceDate: string, untilDate?: string) {
  const q = sup().from('marketing_channel_daily').select('metric, value')
    .eq('channel', 'gbp').eq('scope', 'account').gte('date', sinceDate)
  const { data } = await (untilDate ? q.lt('date', untilDate) : q)
  const out: Record<string, number> = {}
  for (const r of ((data ?? []) as Array<{ metric: string; value: number }>)) {
    out[r.metric] = (out[r.metric] ?? 0) + (Number(r.value) || 0)
  }
  return out
}

async function Headlines({ startDate, endDate }: { startDate: string; endDate: string }) {
  // Compute prior period of same length for comparison
  const startMs = new Date(`${startDate}T00:00:00Z`).getTime()
  const endMs = new Date(`${endDate}T00:00:00Z`).getTime()
  const windowMs = endMs - startMs
  const priorEndDate = startDate
  const priorStartDate = new Date(startMs - windowMs).toISOString().slice(0, 10)
  const [cur, prior] = await Promise.all([fetchPeriod(startDate, endDate), fetchPeriod(priorStartDate, priorEndDate)])
  const totalImpressions = (cur.business_impressions_desktop_search || 0) + (cur.business_impressions_mobile_search || 0)
    + (cur.business_impressions_desktop_maps || 0) + (cur.business_impressions_mobile_maps || 0)
  const priorImpressions = (prior.business_impressions_desktop_search || 0) + (prior.business_impressions_mobile_search || 0)
    + (prior.business_impressions_desktop_maps || 0) + (prior.business_impressions_mobile_maps || 0)
  const actions = (cur.website_clicks || 0) + (cur.call_clicks || 0) + (cur.business_direction_requests || 0)
  const priorActions = (prior.website_clicks || 0) + (prior.call_clicks || 0) + (prior.business_direction_requests || 0)
  const actionRate = totalImpressions > 0 ? actions / totalImpressions : 0
  const priorActionRate = priorImpressions > 0 ? priorActions / priorImpressions : 0

  function delta(cur: number, prior: number) {
    if (prior === 0) return null
    const d = ((cur - prior) / prior) * 100
    return { arrow: d > 0 ? '↑' : d < 0 ? '↓' : '→', pct: `${Math.abs(d).toFixed(0)}%`, up: d > 0 }
  }
  function T(cur: number, prior: number, betterUp = true) {
    const t = delta(cur, prior); if (!t) return null
    const good = betterUp ? t.up : !t.up
    return <p className={`text-xs tabular-nums ${good ? 'text-green-600' : 'text-destructive'}`}>{t.arrow} {t.pct} vs prior period</p>
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total impressions</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(totalImpressions)}</p>{T(totalImpressions, priorImpressions)}</CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Actions taken</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(actions)}</p>{T(actions, priorActions)}</CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Action rate</p><p className="mt-1 text-2xl font-semibold tabular-nums">{(actionRate * 100).toFixed(2)}%</p>{T(actionRate, priorActionRate)}</CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Phone calls</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(cur.call_clicks || 0)}</p>{T(cur.call_clicks || 0, prior.call_clicks || 0)}</CardContent></Card>
    </div>
  )
}

async function MetricBreakdown({ startDate, endDate }: { startDate: string; endDate: string }) {
  const cur = await fetchPeriod(startDate, endDate)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Full metric breakdown ({startDate} to {endDate})</CardTitle>
        <p className="text-xs text-muted-foreground">Every GBP signal we collect. Mobile Search impressions usually dominates for local real estate (most &ldquo;realtor near me&rdquo; searches happen on phone).</p>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {METRICS.map((m) => (
            <div key={m.key} className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{fmt(cur[m.key] || 0)}</dd>
              <p className="mt-1 text-xs text-muted-foreground">{m.help}</p>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

export default async function GbpPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Google Business Profile</h1>
        <p className="text-sm text-muted-foreground">
          What Google Maps + local Search is doing for Ryan Realty. Profile impressions, calls, direction requests, website clicks. Comparison to the prior period of equal length.
        </p>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}><Headlines startDate={range.startDate} endDate={range.endDate} /></Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}><MetricBreakdown startDate={range.startDate} endDate={range.endDate} /></Suspense>
    </div>
  )
}
