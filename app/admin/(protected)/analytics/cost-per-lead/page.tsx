/**
 * /admin/analytics/cost-per-lead - the number that decides paid-spend strategy.
 *
 * Joins Meta Ads spend (from marketing_channel_daily, channel=meta_ads,
 * scope=campaign, metric=spend) with FUB qualified seller leads
 * (channel=fub, scope=account, metric=qualified_seller_leads).
 *
 * Headline: $X per qualified seller lead from FB this week.
 * Drill-down: by campaign and by week so the trend is visible.
 */
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
function formatInt(n: number): string { return new Intl.NumberFormat('en-US').format(n) }

function isoWeekStart(dateStr: string): string {
  // Treat the date as UTC midnight. Find the Monday of that week.
  const d = new Date(`${dateStr}T00:00:00Z`)
  const dow = d.getUTCDay() // 0 = Sun
  const offsetToMonday = (dow + 6) % 7
  d.setUTCDate(d.getUTCDate() - offsetToMonday)
  return d.toISOString().slice(0, 10)
}

type DailyRow = { date: string; value: number; campaign?: string; scope_id?: string; metadata?: Record<string, unknown> | null }

async function CostPerLead() {
  const supabase = getServiceSupabase()
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Pull all the relevant rows in parallel.
  // Spend pulls BOTH Meta + Google Ads so cost-per-lead is computed against
  // total paid spend, not Meta-only. Channel column is preserved per row so
  // we can break out by platform in the table.
  const [spendRes, gadsSpendRes, fubQualRes, fubNewRes, identifiedRes, closedWonRes, closedVolRes] = await Promise.all([
    supabase.from('marketing_channel_daily')
      .select('date, scope_id, value, metadata')
      .eq('channel', 'meta_ads').eq('scope', 'campaign').eq('metric', 'spend')
      .gte('date', cutoff),
    supabase.from('marketing_channel_daily')
      .select('date, scope_id, value, metadata')
      .eq('channel', 'google_ads').eq('scope', 'campaign').eq('metric', 'spend')
      .gte('date', cutoff),
    supabase.from('marketing_channel_daily')
      .select('date, value')
      .eq('channel', 'fub').eq('scope', 'account').eq('metric', 'qualified_seller_leads')
      .gte('date', cutoff),
    supabase.from('marketing_channel_daily')
      .select('date, value')
      .eq('channel', 'fub').eq('scope', 'account').eq('metric', 'new_leads')
      .gte('date', cutoff),
    // From visitor_sessions: identified-from-FB count per day (last 90 days)
    supabase.from('visitor_sessions')
      .select('first_seen_at, utm_source, identified_at, hot_lead_fired_at')
      .gte('first_seen_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(20000),
    supabase.from('marketing_channel_daily')
      .select('date, value')
      .eq('channel', 'fub').eq('scope', 'account').eq('metric', 'deals_closed_won')
      .gte('date', cutoff),
    supabase.from('marketing_channel_daily')
      .select('date, value')
      .eq('channel', 'fub').eq('scope', 'account').eq('metric', 'closed_deal_volume_usd')
      .gte('date', cutoff),
  ])

  if (spendRes.error) return <Card><CardContent className="p-6 text-sm text-destructive">spend read failed: {spendRes.error.message}</CardContent></Card>

  // ─── Per-week roll-up: spend (Meta + Google), qualified leads, identified ────
  // metaSpend + googleSpend tracked separately so the table shows per-platform.
  // spend = sum of both = total paid spend driving cost-per-lead math.
  const byWeek = new Map<string, { spend: number; metaSpend: number; googleSpend: number; qualifiedLeads: number; newLeads: number; fbIdentified: number; fbHot: number; fbSessions: number; closedWon: number; closedVolume: number; campaigns: Map<string, number> }>()
  function bucket(weekStart: string) {
    let b = byWeek.get(weekStart)
    if (!b) { b = { spend: 0, metaSpend: 0, googleSpend: 0, qualifiedLeads: 0, newLeads: 0, fbIdentified: 0, fbHot: 0, fbSessions: 0, closedWon: 0, closedVolume: 0, campaigns: new Map() }; byWeek.set(weekStart, b) }
    return b
  }

  for (const r of (spendRes.data ?? []) as DailyRow[]) {
    const wk = isoWeekStart(r.date)
    const b = bucket(wk)
    const v = Number(r.value) || 0
    b.spend += v
    b.metaSpend += v
    const campName = (r.metadata as { campaign_name?: string } | null)?.campaign_name || r.scope_id || 'unknown'
    b.campaigns.set(`[Meta] ${campName}`, (b.campaigns.get(`[Meta] ${campName}`) ?? 0) + v)
  }
  for (const r of (gadsSpendRes.data ?? []) as DailyRow[]) {
    const wk = isoWeekStart(r.date)
    const b = bucket(wk)
    const v = Number(r.value) || 0
    b.spend += v
    b.googleSpend += v
    const campName = (r.metadata as { campaign_name?: string } | null)?.campaign_name || r.scope_id || 'unknown'
    b.campaigns.set(`[Google] ${campName}`, (b.campaigns.get(`[Google] ${campName}`) ?? 0) + v)
  }
  for (const r of (fubQualRes.data ?? []) as DailyRow[]) {
    bucket(isoWeekStart(r.date)).qualifiedLeads += Number(r.value) || 0
  }
  for (const r of (fubNewRes.data ?? []) as DailyRow[]) {
    bucket(isoWeekStart(r.date)).newLeads += Number(r.value) || 0
  }
  for (const r of (closedWonRes.data ?? []) as DailyRow[]) {
    bucket(isoWeekStart(r.date)).closedWon += Number(r.value) || 0
  }
  for (const r of (closedVolRes.data ?? []) as DailyRow[]) {
    bucket(isoWeekStart(r.date)).closedVolume += Number(r.value) || 0
  }
  for (const raw of (identifiedRes.data ?? [])) {
    const row = raw as { first_seen_at: string; utm_source: string | null; identified_at: string | null; hot_lead_fired_at: string | null }
    const src = (row.utm_source || '').toLowerCase()
    const isFb = /(^|[\s_/-])(facebook|fb|instagram)([\s_/-]|$)/.test(src) || src === 'facebook' || src === 'instagram' || src === 'fb'
    if (!isFb) continue
    const wk = isoWeekStart(row.first_seen_at.slice(0, 10))
    const b = bucket(wk)
    b.fbSessions += 1
    if (row.identified_at) b.fbIdentified += 1
    if (row.hot_lead_fired_at) b.fbHot += 1
  }

  const weeks = Array.from(byWeek.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  // Headline numbers (last 7 days)
  const last7Spend = weeks[0]?.[1].spend ?? 0
  const last7Qualified = weeks[0]?.[1].qualifiedLeads ?? 0
  const last7Cpl = last7Qualified > 0 ? last7Spend / last7Qualified : null
  const last7FbIdentified = weeks[0]?.[1].fbIdentified ?? 0
  const last7CplIdentified = last7FbIdentified > 0 ? last7Spend / last7FbIdentified : null

  // 4-week aggregate for trend
  const last4Sum = weeks.slice(0, 4).reduce((acc, [, b]) => ({
    spend: acc.spend + b.spend,
    qualifiedLeads: acc.qualifiedLeads + b.qualifiedLeads,
    fbIdentified: acc.fbIdentified + b.fbIdentified,
  }), { spend: 0, qualifiedLeads: 0, fbIdentified: 0 })
  const last4Cpl = last4Sum.qualifiedLeads > 0 ? last4Sum.spend / last4Sum.qualifiedLeads : null

  // 90-day closed-deal outcomes. Closings are sparse, so the meaningful
  // aggregation is the full window, not per-week. Blended metric: total paid
  // spend ÷ all closings regardless of source (the label carries the caveat).
  const totals90 = Array.from(byWeek.values()).reduce(
    (acc, b) => ({
      spend: acc.spend + b.spend,
      closedWon: acc.closedWon + b.closedWon,
      closedVolume: acc.closedVolume + b.closedVolume,
    }),
    { spend: 0, closedWon: 0, closedVolume: 0 }
  )
  const costPerClosed90 = totals90.closedWon > 0 ? totals90.spend / totals90.closedWon : null

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Paid spend this week</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatUsd(last7Spend)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">Meta {formatUsd(weeks[0]?.[1].metaSpend ?? 0)} · Google {formatUsd(weeks[0]?.[1].googleSpend ?? 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Qualified leads this week</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInt(last7Qualified)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Cost per qualified lead (this week)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{last7Cpl == null ? '—' : formatUsd(last7Cpl)}</p>
          {last4Cpl != null && <p className="text-xs text-muted-foreground tabular-nums">4-wk avg: {formatUsd(last4Cpl)}</p>}
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">FB identified visitors this week</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInt(last7FbIdentified)}</p>
          {last7CplIdentified != null && <p className="text-xs text-muted-foreground tabular-nums">{formatUsd(last7CplIdentified)} per identification</p>}
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Closed deals (90d)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatInt(totals90.closedWon)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Closed volume (90d)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatUsd(totals90.closedVolume)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Paid spend per closing (90d, blended)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{costPerClosed90 == null ? '—' : formatUsd(costPerClosed90)}</p>
          <p className="text-xs text-muted-foreground">Total paid spend across all closings, every source. The by-source split builds in channel data as closings land.</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly trend (last 12 weeks)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Combined paid spend (Meta + Google Ads, broken out per column) joined with FUB qualified seller leads. Cost-per-qualified-lead is the headline column. If you spent $400 last week and got 4 qualified seller leads, you paid $100 per. Compare week-over-week and against the 4-week average above.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {weeks.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No paid-ad spend or qualified lead data in the last 90 days.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week of</TableHead>
                  <TableHead className="text-right tabular-nums">Spend</TableHead>
                  <TableHead className="text-right tabular-nums">Qualified leads</TableHead>
                  <TableHead className="text-right tabular-nums">Cost / qualified lead</TableHead>
                  <TableHead className="text-right tabular-nums">Closed deals</TableHead>
                  <TableHead className="text-right tabular-nums">All new leads (FUB)</TableHead>
                  <TableHead className="text-right tabular-nums">FB sessions</TableHead>
                  <TableHead className="text-right tabular-nums">FB identified</TableHead>
                  <TableHead className="text-right tabular-nums">FB hot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks.slice(0, 12).map(([wk, b]) => {
                  const cpl = b.qualifiedLeads > 0 ? b.spend / b.qualifiedLeads : null
                  const cplVariant: 'default' | 'destructive' | 'secondary' | 'outline' = cpl == null ? 'outline' : cpl < 75 ? 'default' : cpl < 150 ? 'secondary' : 'destructive'
                  return (
                    <TableRow key={wk}>
                      <TableCell className="font-medium">{wk}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsd(b.spend)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(b.qualifiedLeads)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={cplVariant} className="tabular-nums">{cpl == null ? '—' : formatUsd(cpl)}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(b.closedWon)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{formatInt(b.newLeads)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(b.fbSessions)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(b.fbIdentified)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatInt(b.fbHot)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <p className="px-4 pb-4 pt-2 text-xs text-muted-foreground">
            Cost-per-lead badge: green &lt; $75, amber $75-$150, red &gt;= $150. Industry HNW seller benchmarks land in the $80-$120 range; consistent reds mean creative + audience need a rebuild, not more spend.
          </p>
        </CardContent>
      </Card>

      {weeks[0] && weeks[0][1].campaigns.size > 0 && (
        <Card>
          <CardHeader><CardTitle>This week by campaign</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right tabular-nums">Spend this week</TableHead>
                  <TableHead className="text-right tabular-nums">Share of week</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(weeks[0][1].campaigns.entries()).sort((a, b) => b[1] - a[1]).map(([name, spend]) => (
                  <TableRow key={name}>
                    <TableCell className="font-mono text-xs">{name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{weeks[0][1].spend > 0 ? `${((spend / weeks[0][1].spend) * 100).toFixed(1)}%` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

export default async function CostPerLeadPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Cost per qualified lead</h1>
        <p className="text-sm text-muted-foreground">
          The number that decides whether to scale or kill paid spend. Joins Meta Ads spend with FUB qualified seller leads, week by week. Brackets cost-per-lead so you see at-a-glance which weeks were healthy.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CostPerLead />
      </Suspense>
    </div>
  )
}
