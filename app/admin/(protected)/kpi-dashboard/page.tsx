/**
 * KPI dashboard — live view of every metric in the active marketing_strategy
 * channel_targets alongside actuals computed from marketing_channel_daily
 * and content_performance.
 *
 * Six panels matching the Q3 2026 strategy §4 six-layer model:
 *   1. North star (qualified seller leads)
 *   2. Brand position (follower counts, GBP rating)
 *   3. Channel growth (save/share/comment rates)
 *   4. Site health (GA4 conversion, GSC ranking)
 *   5. Ad health (Meta CPL, CTR, ROAS)
 *   6. Operational hygiene (FUB tagging, email deliverability, GBP rating)
 *
 * Server component. Queries Supabase on render. Auth is handled by the
 * shared app/admin/(protected)/layout.tsx guard. If the session check
 * is unavailable at build time this page returns a skeleton placeholder.
 *
 * Data refreshes every 60 seconds via a lightweight client-side timer
 * that calls router.refresh().
 */
import { Suspense } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { createServiceClient } from '@/lib/supabase/service'
import { KpiAutoRefresh } from './_components/KpiAutoRefresh'

export const metadata = { title: 'KPI Dashboard | Admin' }
export const dynamic = 'force-dynamic'

// Color pill variant mapping.
function statusVariant(status: 'on_track' | 'at_risk' | 'below_target' | 'no_data' | 'no_target') {
  switch (status) {
    case 'on_track': return 'success' as const
    case 'at_risk': return 'warning' as const
    case 'below_target': return 'destructive' as const
    default: return 'secondary' as const
  }
}

function statusLabel(status: 'on_track' | 'at_risk' | 'below_target' | 'no_data' | 'no_target') {
  switch (status) {
    case 'on_track': return 'On track'
    case 'at_risk': return 'At risk'
    case 'below_target': return 'Below target'
    case 'no_data': return 'No data'
    case 'no_target': return 'No target'
  }
}

function computeGapPct(target: number | null, actual: number | null): number | null {
  if (target === null || actual === null || target === 0) return null
  return ((actual - target) / target) * 100
}

function deriveStatus(
  gap: number | null,
  isInverted = false
): 'on_track' | 'at_risk' | 'below_target' | 'no_data' {
  if (gap === null) return 'no_data'
  const effective = isInverted ? -gap : gap
  if (effective >= 0) return 'on_track'
  if (effective >= -10) return 'at_risk'
  return 'below_target'
}

interface MetricRowProps {
  label: string
  actual: number | null
  target: number | null
  formatValue?: (v: number) => string
  isInverted?: boolean
  unit?: string
}

function MetricRow({ label, actual, target, formatValue, isInverted = false, unit = '' }: MetricRowProps) {
  const gap = computeGapPct(target, actual)
  const status = target === null
    ? ('no_target' as const)
    : deriveStatus(gap, isInverted)
  const variant = statusVariant(status)

  const fmt = formatValue ?? ((v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 }))
  const actualDisplay = actual !== null ? `${fmt(actual)}${unit}` : '--'
  const targetDisplay = target !== null ? `${fmt(target)}${unit}` : '--'
  const gapDisplay = gap !== null ? `${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%` : '--'

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="min-w-0 flex-1 text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-3 font-mono text-sm tabular-nums">
        <span className="w-24 text-right text-muted-foreground">{targetDisplay}</span>
        <span className="w-24 text-right font-medium">{actualDisplay}</span>
        <span className="w-16 text-right text-muted-foreground">{gapDisplay}</span>
        <Badge variant={variant} className="w-24 justify-center">
          {statusLabel(status)}
        </Badge>
      </div>
    </div>
  )
}

interface PanelProps {
  title: string
  children: React.ReactNode
}

function Panel({ title, children }: PanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
        </div>
        <div className="mt-1 hidden text-xs text-muted-foreground sm:flex gap-3 font-mono">
          <span className="flex-1" />
          <span className="w-24 text-right">Target</span>
          <span className="w-24 text-right">Actual</span>
          <span className="w-16 text-right">Gap</span>
          <span className="w-24 text-center">Status</span>
        </div>
        <Separator />
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

async function fetchActuals() {
  const supabase = createServiceClient()

  // Load active strategy for targets.
  const { data: stratRows } = await supabase
    .from('marketing_strategy')
    .select('id, quarter, channel_targets, north_star_target')
    .eq('status', 'active')
    .order('generated_at', { ascending: false })
    .limit(1)

  const strategy = stratRows?.[0] ?? null
  const ct = (strategy?.channel_targets ?? {}) as Record<string, Record<string, number>>

  // Date window: last 30 days for actuals.
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  async function latestMetric(channel: string, metric: string): Promise<number | null> {
    const { data } = await supabase
      .from('marketing_channel_daily')
      .select('value')
      .eq('channel', channel)
      .eq('metric', metric)
      .gte('date', since30)
      .order('date', { ascending: false })
      .limit(1)
    return data?.[0]?.value ?? null
  }

  async function sumMetric(channel: string, metric: string): Promise<number | null> {
    const { data } = await supabase
      .from('marketing_channel_daily')
      .select('value')
      .eq('channel', channel)
      .eq('metric', metric)
      .gte('date', since30)
    if (!data?.length) return null
    return data.reduce((s, r) => s + (typeof r.value === 'number' ? r.value : 0), 0)
  }

  async function avgMetric(channel: string, metric: string): Promise<number | null> {
    const { data } = await supabase
      .from('marketing_channel_daily')
      .select('value')
      .eq('channel', channel)
      .eq('metric', metric)
      .gte('date', since30)
    if (!data?.length) return null
    const total = data.reduce((s, r) => s + (typeof r.value === 'number' ? r.value : 0), 0)
    return total / data.length
  }

  // North star.
  const sellerLeads30d = await sumMetric('fub', 'qualified_seller_leads')

  // Brand position.
  const igFollowers = await latestMetric('instagram', 'followers')
  const ytSubscribers = await latestMetric('youtube', 'subscribers')
  const fbFollowers = await latestMetric('meta_page', 'followers')
  const liConnections = await latestMetric('linkedin', 'followers')
  const gbpRating = await latestMetric('gbp', 'average_rating')

  // Channel growth.
  const igSaveRate = await avgMetric('instagram', 'save_rate')
  const igShareRate = await avgMetric('instagram', 'share_rate')
  const igCommentRate = await avgMetric('instagram', 'comment_rate')
  const ytAvgViewDuration = await avgMetric('youtube', 'avg_view_duration_pct')

  // Site health.
  const gaConversionRate = await avgMetric('ga4', 'valuation_form_conversion_rate')
  const gaOrganicSessions = await sumMetric('ga4', 'organic_sessions')
  const gscTop10Keywords = await latestMetric('gsc', 'top10_keyword_count')

  // Ad health.
  const metaCpl = await avgMetric('meta_ads', 'cost_per_lead')
  const metaCtr = await avgMetric('meta_ads', 'ctr')
  const metaRoas = await avgMetric('meta_ads', 'roas')

  // Operational hygiene.
  const fubTaggingLag = await avgMetric('fub', 'avg_tagging_lag_hours')
  const emailDeliverability = await avgMetric('email', 'deliverability_rate')

  // Targets from channel_targets JSONB.
  const tNorthStar = typeof strategy?.north_star_target === 'number'
    ? strategy.north_star_target
    : ct.north_star?.monthly_seller_leads_target ?? null

  return {
    strategy,
    targets: {
      northStar: tNorthStar,
      igFollowers: ct.instagram?.followers_target ?? 5000,
      ytSubscribers: ct.youtube?.subscribers_target ?? 3000,
      fbFollowers: ct.facebook?.followers_target ?? 2000,
      liConnections: ct.linkedin?.connections_target ?? 1000,
      gbpRating: ct.gbp?.rating_floor ?? 4.9,
      igSaveRate: ct.instagram?.save_rate_floor ?? 0.02,
      igShareRate: ct.instagram?.share_rate_floor ?? 0.005,
      igCommentRate: ct.instagram?.comment_rate_floor ?? 0.01,
      ytAvgViewDuration: ct.youtube?.avg_view_duration_floor ?? 0.35,
      gaConversionRate: ct.ga4?.valuation_form_conversion_rate_target ?? 0.03,
      gaOrganicSessions: ct.ga4?.organic_sessions_monthly_target ?? null,
      gscTop10Keywords: ct.gsc?.top10_keyword_target ?? 10,
      metaCpl: ct.meta_ads?.cpl_ceiling ?? 65,
      metaCtr: ct.meta_ads?.ctr_floor ?? 0.018,
      metaRoas: ct.meta_ads?.roas_floor ?? 2.0,
      fubTaggingLag: ct.fub?.tagging_lag_ceiling_hours ?? 24,
      emailDeliverability: ct.email?.deliverability_rate_floor ?? 0.97,
    },
    actuals: {
      sellerLeads30d,
      igFollowers,
      ytSubscribers,
      fbFollowers,
      liConnections,
      gbpRating,
      igSaveRate,
      igShareRate,
      igCommentRate,
      ytAvgViewDuration,
      gaConversionRate,
      gaOrganicSessions,
      gscTop10Keywords,
      metaCpl,
      metaCtr,
      metaRoas,
      fubTaggingLag,
      emailDeliverability,
    },
  }
}

export default async function KpiDashboardPage() {
  let data: Awaited<ReturnType<typeof fetchActuals>> | null = null
  let fetchError: string | null = null

  try {
    data = await fetchActuals()
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load KPI data'
  }

  const now = new Date().toUTCString()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">KPI dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.strategy
              ? `Active strategy: ${data.strategy.quarter ?? 'unknown quarter'}. Actuals are the last 30 days.`
              : 'No active strategy found. Showing raw actuals.'}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Refreshes every 60s</div>
          <div className="font-mono">{now}</div>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </div>
      )}

      {!data && !fetchError && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Panel 1: North star */}
          <Panel title="1. North star — qualified seller leads">
            <MetricRow
              label="Qualified seller leads (last 30 days)"
              actual={data.actuals.sellerLeads30d}
              target={data.targets.northStar}
              formatValue={(v) => String(Math.round(v))}
            />
          </Panel>

          {/* Panel 2: Brand position */}
          <Panel title="2. Brand position — follower counts and GBP">
            <MetricRow
              label="Instagram followers (@ryanrealtybend)"
              actual={data.actuals.igFollowers}
              target={data.targets.igFollowers}
              formatValue={(v) => Math.round(v).toLocaleString()}
            />
            <MetricRow
              label="YouTube subscribers"
              actual={data.actuals.ytSubscribers}
              target={data.targets.ytSubscribers}
              formatValue={(v) => Math.round(v).toLocaleString()}
            />
            <MetricRow
              label="Facebook followers"
              actual={data.actuals.fbFollowers}
              target={data.targets.fbFollowers}
              formatValue={(v) => Math.round(v).toLocaleString()}
            />
            <MetricRow
              label="LinkedIn connections"
              actual={data.actuals.liConnections}
              target={data.targets.liConnections}
              formatValue={(v) => Math.round(v).toLocaleString()}
            />
            <MetricRow
              label="GBP average rating"
              actual={data.actuals.gbpRating}
              target={data.targets.gbpRating}
              formatValue={(v) => v.toFixed(1)}
              unit=" stars"
            />
          </Panel>

          {/* Panel 3: Channel growth */}
          <Panel title="3. Channel growth — engagement rates">
            <MetricRow
              label="Instagram save rate (30d avg)"
              actual={data.actuals.igSaveRate !== null ? data.actuals.igSaveRate * 100 : null}
              target={data.targets.igSaveRate * 100}
              formatValue={(v) => v.toFixed(2)}
              unit="%"
            />
            <MetricRow
              label="Instagram share rate (30d avg)"
              actual={data.actuals.igShareRate !== null ? data.actuals.igShareRate * 100 : null}
              target={data.targets.igShareRate * 100}
              formatValue={(v) => v.toFixed(2)}
              unit="%"
            />
            <MetricRow
              label="Instagram comment rate (30d avg)"
              actual={data.actuals.igCommentRate !== null ? data.actuals.igCommentRate * 100 : null}
              target={data.targets.igCommentRate * 100}
              formatValue={(v) => v.toFixed(2)}
              unit="%"
            />
            <MetricRow
              label="YouTube avg view duration (30d avg)"
              actual={data.actuals.ytAvgViewDuration !== null ? data.actuals.ytAvgViewDuration * 100 : null}
              target={data.targets.ytAvgViewDuration * 100}
              formatValue={(v) => v.toFixed(1)}
              unit="%"
            />
          </Panel>

          {/* Panel 4: Site health */}
          <Panel title="4. Site health — GA4 and GSC">
            <MetricRow
              label="Valuation form conversion rate (30d avg)"
              actual={data.actuals.gaConversionRate !== null ? data.actuals.gaConversionRate * 100 : null}
              target={data.targets.gaConversionRate * 100}
              formatValue={(v) => v.toFixed(2)}
              unit="%"
            />
            <MetricRow
              label="Organic sessions (last 30 days)"
              actual={data.actuals.gaOrganicSessions}
              target={data.targets.gaOrganicSessions}
              formatValue={(v) => Math.round(v).toLocaleString()}
            />
            <MetricRow
              label="Top-10 GSC keywords"
              actual={data.actuals.gscTop10Keywords}
              target={data.targets.gscTop10Keywords}
              formatValue={(v) => String(Math.round(v))}
            />
          </Panel>

          {/* Panel 5: Ad health */}
          <Panel title="5. Ad health — Meta Ads">
            <MetricRow
              label="Cost per qualified lead (CPL) — ceiling"
              actual={data.actuals.metaCpl}
              target={data.targets.metaCpl}
              formatValue={(v) => `$${v.toFixed(0)}`}
              isInverted
            />
            <MetricRow
              label="Click-through rate (CTR) — floor"
              actual={data.actuals.metaCtr !== null ? data.actuals.metaCtr * 100 : null}
              target={data.targets.metaCtr * 100}
              formatValue={(v) => v.toFixed(2)}
              unit="%"
            />
            <MetricRow
              label="Return on ad spend (ROAS) — floor"
              actual={data.actuals.metaRoas}
              target={data.targets.metaRoas}
              formatValue={(v) => `${v.toFixed(1)}x`}
            />
          </Panel>

          {/* Panel 6: Operational hygiene */}
          <Panel title="6. Operational hygiene — FUB and email">
            <MetricRow
              label="FUB avg tagging lag — ceiling"
              actual={data.actuals.fubTaggingLag}
              target={data.targets.fubTaggingLag}
              formatValue={(v) => v.toFixed(1)}
              unit=" h"
              isInverted
            />
            <MetricRow
              label="Email deliverability rate — floor"
              actual={data.actuals.emailDeliverability !== null ? data.actuals.emailDeliverability * 100 : null}
              target={data.targets.emailDeliverability * 100}
              formatValue={(v) => v.toFixed(1)}
              unit="%"
            />
          </Panel>
        </div>
      )}

      <Suspense fallback={null}>
        <KpiAutoRefresh intervalMs={60_000} />
      </Suspense>
    </div>
  )
}
