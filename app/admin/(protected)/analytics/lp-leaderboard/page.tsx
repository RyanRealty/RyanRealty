/**
 * /admin/analytics/lp-leaderboard - which landing page converts the best.
 *
 * Per-LP-variant table: visits, form_start count, generate_lead count,
 * conversion rate, identified rate, top traffic source, top city.
 *
 * The number that matters: conversion rate. Tells Matt which LP to send
 * paid spend to and which to fix or kill. Pairs with the funnel-breakdown
 * page which shows WHY the conversion rate is what it is.
 */
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import DashboardSummaryStrip from '@/components/admin/DashboardSummaryStrip'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function formatInt(n: number): string { return new Intl.NumberFormat('en-US').format(n) }
function formatPct(num: number, den: number): string {
  if (den === 0) return '—'
  return `${((num / den) * 100).toFixed(1)}%`
}

// Pull the LP slug out of a URL path like /lp/seller-home-value/, /lp/buyer-listing-alerts, /lp/expired-listing
// Treats /home-valuation as the seller LP also (legacy alias).
function lpVariantFromPath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  let p = pathOrUrl
  try { p = new URL(pathOrUrl).pathname } catch { /* already a path */ }
  p = p.toLowerCase().replace(/\/+$/, '')
  if (p === '/home-valuation') return 'seller-home-value'
  const m = p.match(/^\/lp\/([a-z0-9-]+)/)
  if (m) return m[1]
  return null
}

type LpRow = {
  variant: string
  visits: number
  identified: number
  hot: number
  scoreSum: number
  topSourceCounts: Map<string, number>
  topCityCounts: Map<string, number>
}

async function LpLeaderboard() {
  const supabase = getServiceSupabase()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Pull sessions whose first-touch landing page is an LP (or hits one of
  // our LP slugs). We classify the variant from `landing_page` then aggregate
  // in JS. Limit 10000 sessions is well above our actual volume.
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, landing_page, utm_source, utm_medium, utm_campaign, identified_at, hot_lead_fired_at, engagement_score, ip_city')
    .gte('first_seen_at', cutoff)
    .limit(10000)
  if (error) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Could not load sessions: {error.message}</CardContent></Card>
  }

  const byVariant = new Map<string, LpRow>()
  for (const raw of data ?? []) {
    const row = raw as { landing_page: string | null; utm_source: string | null; identified_at: string | null; hot_lead_fired_at: string | null; engagement_score: number; ip_city: string | null }
    const variant = lpVariantFromPath(row.landing_page)
    if (!variant) continue
    const r = byVariant.get(variant) ?? {
      variant,
      visits: 0,
      identified: 0,
      hot: 0,
      scoreSum: 0,
      topSourceCounts: new Map<string, number>(),
      topCityCounts: new Map<string, number>(),
    }
    r.visits += 1
    if (row.identified_at) r.identified += 1
    if (row.hot_lead_fired_at) r.hot += 1
    r.scoreSum += row.engagement_score || 0
    if (row.utm_source) r.topSourceCounts.set(row.utm_source, (r.topSourceCounts.get(row.utm_source) ?? 0) + 1)
    if (row.ip_city) r.topCityCounts.set(row.ip_city, (r.topCityCounts.get(row.ip_city) ?? 0) + 1)
    byVariant.set(variant, r)
  }

  function topOf(m: Map<string, number>): string {
    let best = '—'
    let bestN = 0
    for (const [k, n] of m) { if (n > bestN) { best = k; bestN = n } }
    return best
  }

  const rows = Array.from(byVariant.values())
    .map((r) => ({
      variant: r.variant,
      visits: r.visits,
      identified: r.identified,
      hot: r.hot,
      identifyRate: r.visits ? r.identified / r.visits : 0,
      hotRate: r.visits ? r.hot / r.visits : 0,
      avgScore: r.visits ? r.scoreSum / r.visits : 0,
      topSource: topOf(r.topSourceCounts),
      topCity: topOf(r.topCityCounts),
    }))
    .sort((a, b) => b.identifyRate - a.identifyRate)

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No LP sessions captured in the last 30 days yet. Once visitors arrive at any /lp/[variant] page and consent to tracking, the leaderboard fills in.
        </CardContent>
      </Card>
    )
  }

  // Best vs worst gap for the insights callout
  const best = rows[0]
  const worst = rows[rows.length - 1]
  const gap = best.identifyRate - worst.identifyRate

  // Summary band totals
  const totalVisits = rows.reduce((s, r) => s + r.visits, 0)
  const totalIdentified = rows.reduce((s, r) => s + r.identified, 0)
  const totalHot = rows.reduce((s, r) => s + r.hot, 0)

  return (
    <div className="space-y-6">
      <DashboardSummaryStrip
        stats={[
          { label: 'LP variants', value: formatInt(rows.length) },
          { label: 'Visits (30d)', value: formatInt(totalVisits) },
          { label: 'Identified', value: formatInt(totalIdentified), caption: formatPct(totalIdentified, totalVisits) + ' identify rate' },
          { label: 'Hot leads', value: formatInt(totalHot), tone: totalHot > 0 ? 'success' : 'default' },
          { label: 'Best LP', value: `${(best.identifyRate * 100).toFixed(1)}%`, caption: best.variant, tone: 'success' },
        ]}
      />

      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Landing-page conversion leaderboard (last 30 days)</h2>
          <p className="text-xs text-muted-foreground">
            Ranked by identify rate (visitors who signed in or submitted a form). Identify rate is what tells you whether the LP works. Hot rate is the broker-action signal — sessions that crossed score 100 and fired a FUB task.
          </p>
        </div>
        <TableWithMobileCards
          rows={rows}
          cap={10}
          getRowKey={(r) => r.variant}
          columns={[
            { key: 'variant', header: 'LP variant', className: 'whitespace-nowrap', cell: (r) => {
              const i = rows.indexOf(r)
              return (
                <>
                  <div className="font-medium">{r.variant}</div>
                  <Badge variant={i === 0 ? 'default' : i === rows.length - 1 && rows.length > 2 ? 'destructive' : 'outline'} className="text-[10px]">
                    {i === 0 ? 'best' : i === rows.length - 1 && rows.length > 2 ? 'worst' : `#${i + 1}`}
                  </Badge>
                </>
              )
            } },
            { key: 'visits', header: 'Visits', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.visits) },
            { key: 'identified', header: 'Identified', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.identified) },
            { key: 'idrate', header: 'Identify rate', className: 'text-right tabular-nums font-semibold whitespace-nowrap', cell: (r) => `${(r.identifyRate * 100).toFixed(1)}%` },
            { key: 'hot', header: 'Hot leads', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.hot) },
            { key: 'hotrate', header: 'Hot rate', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => `${(r.hotRate * 100).toFixed(1)}%` },
            { key: 'score', header: 'Avg score', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => r.avgScore.toFixed(1) },
            { key: 'source', header: 'Top source', className: 'text-xs whitespace-nowrap', cell: (r) => r.topSource },
            { key: 'city', header: 'Top city', className: 'text-xs whitespace-nowrap', cell: (r) => r.topCity },
          ]}
          renderCard={(r) => {
            const i = rows.indexOf(r)
            return (
              <Card>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {r.variant}
                      <Badge variant={i === 0 ? 'default' : i === rows.length - 1 && rows.length > 2 ? 'destructive' : 'outline'} className="ml-2 text-xs">
                        {i === 0 ? 'best' : i === rows.length - 1 && rows.length > 2 ? 'worst' : `#${i + 1}`}
                      </Badge>
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{(r.identifyRate * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatInt(r.visits)} visits · {formatInt(r.identified)} identified · {formatInt(r.hot)} hot · score {r.avgScore.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{r.topSource} · {r.topCity}</p>
                </CardContent>
              </Card>
            )
          }}
          empty={<>No LP sessions captured in the last 30 days yet. Once visitors arrive at any /lp/[variant] page and consent to tracking, the leaderboard fills in.</>}
        />
      </section>

      {rows.length >= 2 && best.visits >= 10 && worst.visits >= 10 && gap >= 0.05 && (
        <Card>
          <CardHeader><CardTitle>What this tells you</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>{best.variant}</strong> converts at {(best.identifyRate * 100).toFixed(1)}% vs <strong>{worst.variant}</strong> at {(worst.identifyRate * 100).toFixed(1)}%. That is a {(gap * 100).toFixed(1)}-point gap.
            </p>
            <p>
              Shift paid spend from {worst.variant} toward {best.variant} until the gap closes. If {worst.variant} still hits zero or near-zero after a budget shift, pause that LP entirely and rebuild the hero, form, or audience targeting.
            </p>
            {best.topSource && best.topSource !== '—' && (
              <p className="text-muted-foreground">
                {best.variant}&apos;s best source is <strong>{best.topSource}</strong>. Double down on that channel for this LP specifically.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default async function LpLeaderboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">LP conversion leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          Which landing page actually converts. Pulled directly from <code>visitor_sessions</code> with the landing page mapped back to its LP variant slug. Last 30 days, ranked by identify rate.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LpLeaderboard />
      </Suspense>
    </div>
  )
}
