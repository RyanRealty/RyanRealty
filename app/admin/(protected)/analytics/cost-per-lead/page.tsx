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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

async function CostPerLead({ range }: { range: { startDate: string; endDate: string } }) {
  const supabase = getServiceSupabase()
  const cutoff = range.startDate
  const sinceTs = `${range.startDate}T00:00:00.000Z`
  const endTs = `${range.endDate}T23:59:59.999Z`

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
    // From visitor_sessions: identified-from-FB count per day
    supabase.from('visitor_sessions')
      .select('first_seen_at, utm_source, identified_at, hot_lead_fired_at')
      .gte('first_seen_at', sinceTs)
      .lte('first_seen_at', endTs)
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

  const sessionsCapped = (identifiedRes.data ?? []).length === 20000

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
      {sessionsCapped && (
        <p className="text-xs text-warning">
          Showing first 20,000 visitor sessions — result capped. Narrow the date range to see complete data.
        </p>
      )}
      <DashboardSummaryStrip
        stats={[
          { label: 'Cost / qualified lead (wk)', value: last7Cpl == null ? null : formatUsd(last7Cpl), caption: last4Cpl != null ? `4-wk avg ${formatUsd(last4Cpl)}` : undefined },
          { label: 'Paid spend this week', value: formatUsd(last7Spend), caption: `Meta ${formatUsd(weeks[0]?.[1].metaSpend ?? 0)} · Google ${formatUsd(weeks[0]?.[1].googleSpend ?? 0)}` },
          { label: 'Qualified leads (wk)', value: formatInt(last7Qualified) },
          { label: 'FB identified (wk)', value: formatInt(last7FbIdentified), caption: last7CplIdentified != null ? `${formatUsd(last7CplIdentified)} / id` : undefined },
          { label: 'Closed deals (90d)', value: formatInt(totals90.closedWon), caption: `${formatUsd(totals90.closedVolume)} volume` },
          { label: 'Spend / closing (90d)', value: costPerClosed90 == null ? null : formatUsd(costPerClosed90), caption: 'blended, all sources' },
        ]}
      />

      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Weekly trend</h2>
          <p className="text-xs text-muted-foreground">
            Combined paid spend (Meta + Google Ads, broken out per column) joined with FUB qualified seller leads. Cost-per-qualified-lead is the headline column. If you spent $400 last week and got 4 qualified seller leads, you paid $100 per. Compare week-over-week and against the 4-week average above.
          </p>
        </div>
        <TableWithMobileCards
          rows={weeks.map(([wk, b]) => ({ wk, b }))}
          cap={12}
          getRowKey={(r) => r.wk}
          columns={[
            { key: 'week', header: 'Week of', className: 'whitespace-nowrap font-medium', cell: (r) => r.wk },
            { key: 'spend', header: 'Spend', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatUsd(r.b.spend) },
            { key: 'qual', header: 'Qualified leads', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.b.qualifiedLeads) },
            { key: 'cpl', header: 'Cost / qualified lead', className: 'whitespace-nowrap text-right', cell: (r) => { const cpl = r.b.qualifiedLeads > 0 ? r.b.spend / r.b.qualifiedLeads : null; const v: 'default' | 'destructive' | 'secondary' | 'outline' = cpl == null ? 'outline' : cpl < 75 ? 'default' : cpl < 150 ? 'secondary' : 'destructive'; return <Badge variant={v} className="tabular-nums">{cpl == null ? '—' : formatUsd(cpl)}</Badge> } },
            { key: 'closed', header: 'Closed deals', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.b.closedWon) },
            { key: 'newLeads', header: 'All new leads (FUB)', className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', cell: (r) => formatInt(r.b.newLeads) },
            { key: 'fbSessions', header: 'FB sessions', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.b.fbSessions) },
            { key: 'fbId', header: 'FB identified', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.b.fbIdentified) },
            { key: 'fbHot', header: 'FB hot', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.b.fbHot) },
          ]}
          renderCard={(r) => {
            const cpl = r.b.qualifiedLeads > 0 ? r.b.spend / r.b.qualifiedLeads : null
            const v: 'default' | 'destructive' | 'secondary' | 'outline' = cpl == null ? 'outline' : cpl < 75 ? 'default' : cpl < 150 ? 'secondary' : 'destructive'
            return (
              <Card>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium tabular-nums">{r.wk}</span>
                    <Badge variant={v} className="tabular-nums">{cpl == null ? '—' : `${formatUsd(cpl)} / lead`}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatUsd(r.b.spend)} spend · {formatInt(r.b.qualifiedLeads)} qualified · {formatInt(r.b.closedWon)} closed · {formatInt(r.b.fbIdentified)} FB id</p>
                </CardContent>
              </Card>
            )
          }}
          empty={<>No paid-ad spend or qualified lead data in the last 90 days. Once the Meta/Google spend cron and FUB lead snapshots populate, weekly cost-per-lead appears here.</>}
        />
        <p className="text-xs text-muted-foreground">
          Cost-per-lead badge: green &lt; $75, amber $75-$150, red &gt;= $150. Industry HNW seller benchmarks land in the $80-$120 range; consistent reds mean creative + audience need a rebuild, not more spend.
        </p>
      </section>

      {weeks[0] && weeks[0][1].campaigns.size > 0 && (() => {
        const weekSpend = weeks[0][1].spend
        const campaignRows = Array.from(weeks[0][1].campaigns.entries()).sort((a, b) => b[1] - a[1]).map(([name, spend]) => ({ name, spend }))
        return (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">This week by campaign</h2>
            <TableWithMobileCards
              rows={campaignRows}
              cap={10}
              getRowKey={(r) => r.name}
              columns={[
                { key: 'name', header: 'Campaign', className: 'font-mono text-xs', cell: (r) => r.name },
                { key: 'spend', header: 'Spend this week', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatUsd(r.spend) },
                { key: 'share', header: 'Share of week', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => weekSpend > 0 ? `${((r.spend / weekSpend) * 100).toFixed(1)}%` : '—' },
              ]}
              renderCard={(r) => (
                <Card>
                  <CardContent className="space-y-1">
                    <p className="font-mono text-xs">{r.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatUsd(r.spend)} · {weekSpend > 0 ? `${((r.spend / weekSpend) * 100).toFixed(1)}% of week` : '—'}</p>
                  </CardContent>
                </Card>
              )}
              empty={<>No campaign-level spend recorded this week.</>}
            />
          </section>
        )
      })()}
    </>
  )
}

export default async function CostPerLeadPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Cost per qualified lead</h1>
        <p className="text-sm text-muted-foreground">
          The number that decides whether to scale or kill paid spend. Joins Meta Ads spend with FUB qualified seller leads, week by week. Brackets cost-per-lead so you see at-a-glance which weeks were healthy.
        </p>
        <DateRangePicker current={sp.range ?? '90d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CostPerLead range={range} />
      </Suspense>
    </div>
  )
}
