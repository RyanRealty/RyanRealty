/**
 * Results scoreboard — the honest weekly funnel for Ryan Realty.
 *
 * One page that answers "is the work moving leads?" It reads the channel-level
 * metrics that are actually flowing into `marketing_channel_daily` (GA4, GSC,
 * GBP, FUB, Meta Ads — all fresh daily) and lays them out as the real results
 * funnel: get found -> traffic -> convert -> leads -> pipeline -> close -> paid.
 *
 * Design intent (see the "recursive process" discussion 2026-06-06): this is the
 * MEASUREMENT layer, not an autonomous decider. At this lead volume the human is
 * the learning loop — the scoreboard's job is to show honest numbers + trend so
 * Matt can pick the next bet each week. It deliberately does NOT read
 * content_performance (the per-post brain loop that never closed).
 *
 * Targets come from the active marketing_strategy (2026Q3). Each row shows the
 * last-30-day actual, the trend vs the prior 30 days, the target, and a status.
 * Metrics with no target show trend only. Stale metrics are flagged honestly.
 *
 * §0: every number traces to marketing_channel_daily (account/campaign scope),
 * which the snapshot crons populate from the platform APIs. No invented figures.
 *
 * Server component, force-dynamic. Auth via app/admin/(protected)/layout.tsx.
 */
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createServiceClient } from '@/lib/supabase/service'

export const metadata = { title: 'Results scoreboard | Admin' }
export const dynamic = 'force-dynamic'

// ── time windows ────────────────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000
function isoDay(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * DAY).toISOString().slice(0, 10)
}
const TODAY = isoDay(0)
const D30 = isoDay(30) // start of current 30d window
const D60 = isoDay(60) // start of prior 30d window

// ── metric store: one query, in-memory aggregation ──────────────────────────
type Row = { metric: string; scope: string; date: string; value: number | null }
type Series = Map<string, { date: string; value: number }[]> // key: `${channel}|${metric}|${scope}`

function keyOf(channel: string, metric: string, scope: string) {
  return `${channel}|${metric}|${scope}`
}

function windowRows(series: Series, channel: string, metric: string, scope: string, from: string, to: string) {
  const rows = series.get(keyOf(channel, metric, scope)) ?? []
  return rows.filter((r) => r.date >= from && r.date < to)
}

function sumIn(series: Series, channel: string, metric: string, scope: string, from: string, to: string): number | null {
  const rows = windowRows(series, channel, metric, scope, from, to)
  if (rows.length === 0) return null
  return rows.reduce((s, r) => s + r.value, 0)
}

function avgIn(series: Series, channel: string, metric: string, scope: string, from: string, to: string): number | null {
  const rows = windowRows(series, channel, metric, scope, from, to)
  if (rows.length === 0) return null
  return rows.reduce((s, r) => s + r.value, 0) / rows.length
}

// For GSC avg_position a value of 0 means "no impressions that day" (rank
// undefined), NOT "rank 0". Averaging the 0s makes the rank look far better
// than it is (§0). Exclude them so the number is honest.
function avgNonZeroIn(series: Series, channel: string, metric: string, scope: string, from: string, to: string): number | null {
  const rows = windowRows(series, channel, metric, scope, from, to).filter((r) => r.value > 0)
  if (rows.length === 0) return null
  return rows.reduce((s, r) => s + r.value, 0) / rows.length
}

// 75th percentile — the statistic Google uses for Core Web Vitals.
function p75(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.75) - 1)]
}

function latest(series: Series, channel: string, metric: string, scope: string): { date: string; value: number } | null {
  const rows = series.get(keyOf(channel, metric, scope)) ?? []
  if (rows.length === 0) return null
  return rows.reduce((a, b) => (b.date > a.date ? b : a))
}

async function fetchScoreboard() {
  const supabase = createServiceClient()

  // Targets from the active strategy.
  const { data: stratRows } = await supabase
    .from('marketing_strategy')
    .select('quarter, channel_targets, north_star_target')
    .eq('status', 'active')
    .order('generated_at', { ascending: false })
    .limit(1)
  const strategy = stratRows?.[0] ?? null
  const ct = (strategy?.channel_targets ?? {}) as Record<string, unknown>
  const path = (obj: unknown, ...keys: string[]): unknown => {
    let cur: unknown = obj
    for (const k of keys) {
      if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[k]
      } else return undefined
    }
    return cur
  }
  const numAt = (...keys: string[]): number | null => {
    const v = path(ct, ...keys)
    return typeof v === 'number' ? v : null
  }

  // One pull: account-scope rows for the funnel channels, last 60 days. Plus the
  // campaign-scope pipeline rows (small). Aggregated in memory below.
  const FUNNEL_CHANNELS = ['gsc', 'ga4', 'fub', 'gbp', 'meta_ads']
  const [{ data: accountRows }, { data: pipelineRows }, { data: aiEngineRows }] = await Promise.all([
    supabase
      .from('marketing_channel_daily')
      .select('channel, metric, scope, date, value')
      .in('channel', FUNNEL_CHANNELS)
      .eq('scope', 'account')
      .gte('date', D60),
    supabase
      .from('marketing_channel_daily')
      .select('channel, metric, scope, date, value')
      .eq('channel', 'fub')
      .eq('scope', 'campaign')
      .in('metric', ['pipeline_count', 'pipeline_value'])
      .gte('date', D60),
    // AI-assistant traffic by engine (which LLMs send visitors), last 30d.
    supabase
      .from('marketing_channel_daily')
      .select('scope_id, value')
      .eq('channel', 'ga4')
      .eq('metric', 'ai_assistant_sessions')
      .eq('scope', 'source')
      .gte('date', D30),
  ])

  const aiByEngine = new Map<string, number>()
  for (const r of (aiEngineRows ?? []) as { scope_id: string; value: number | null }[]) {
    if (typeof r.value !== 'number') continue
    aiByEngine.set(r.scope_id, (aiByEngine.get(r.scope_id) ?? 0) + r.value)
  }
  const aiEngines = [...aiByEngine.entries()]
    .map(([engine, sessions]) => ({ engine, sessions }))
    .sort((a, b) => b.sessions - a.sessions)

  // Real-user Core Web Vitals — field p75 over 30d (the number Google ranks on,
  // vs the throttled lab numbers). Empty until RUM samples accumulate.
  const { data: cwvRows } = await supabase
    .from('web_vitals')
    .select('metric, value')
    .in('metric', ['LCP', 'INP', 'CLS'])
    .gte('created_at', `${D30}T00:00:00Z`)
    .limit(50000)
  const cwvByMetric = new Map<string, number[]>()
  for (const r of (cwvRows ?? []) as { metric: string; value: number | null }[]) {
    if (typeof r.value !== 'number') continue
    if (!cwvByMetric.has(r.metric)) cwvByMetric.set(r.metric, [])
    cwvByMetric.get(r.metric)!.push(r.value)
  }
  const cwv = {
    lcp: p75(cwvByMetric.get('LCP') ?? []),
    inp: p75(cwvByMetric.get('INP') ?? []),
    cls: p75(cwvByMetric.get('CLS') ?? []),
    samples: (cwvRows ?? []).length,
  }

  const series: Series = new Map()
  for (const r of [...(accountRows ?? []), ...(pipelineRows ?? [])] as (Row & { channel: string })[]) {
    if (typeof r.value !== 'number') continue
    const k = keyOf(r.channel, r.metric, r.scope)
    if (!series.has(k)) series.set(k, [])
    series.get(k)!.push({ date: r.date, value: r.value })
  }

  // helpers bound to the windows
  const sum30 = (c: string, m: string, s = 'account') => sumIn(series, c, m, s, D30, TODAY)
  const sumPrior = (c: string, m: string, s = 'account') => sumIn(series, c, m, s, D60, D30)
  const avg30 = (c: string, m: string, s = 'account') => avgIn(series, c, m, s, D30, TODAY)
  const avgPrior = (c: string, m: string, s = 'account') => avgIn(series, c, m, s, D60, D30)

  // GBP impressions = sum of the four impression metrics; GBP actions = calls +
  // website clicks + direction requests.
  const gbpImpr = (from: string, to: string) =>
    (['business_impressions_desktop_maps', 'business_impressions_desktop_search', 'business_impressions_mobile_maps', 'business_impressions_mobile_search'] as const)
      .map((m) => sumIn(series, 'gbp', m, 'account', from, to) ?? 0)
      .reduce((a, b) => a + b, 0)
  const gbpActions = (from: string, to: string) =>
    (['call_clicks', 'website_clicks', 'business_direction_requests'] as const)
      .map((m) => sumIn(series, 'gbp', m, 'account', from, to) ?? 0)
      .reduce((a, b) => a + b, 0)

  const sellerLeadsLatest = latest(series, 'fub', 'qualified_seller_leads', 'account')
  const gaSessions30 = sum30('ga4', 'sessions')
  const gaLeadEvents30 = sum30('ga4', 'total_lead_events')
  const metaSpend30 = sum30('meta_ads', 'spend')
  const metaConv30 = sum30('meta_ads', 'conversions')
  const newLeads30 = sum30('fub', 'new_leads')

  return {
    quarter: strategy?.quarter ?? null,
    cwv,
    targets: {
      northStar: typeof strategy?.north_star_target === 'number' ? strategy.north_star_target : 18,
      sellerRank: numAt('site_health', 'organic_seller_query_rank_avg', 'target_avg_position'),
      valuationConv: numAt('site_health', 'home_valuation_form_conversion_rate', 'target'),
      metaCpl: numAt('ad_health', 'fb_seller_funnel_cpl_ceiling_usd'),
      listingsQtr: numAt('north_star', 'quarterly_listings_signed', 'target'),
    },
    metrics: {
      // North star (daily counts summed to a 30d total vs the monthly target)
      sellerLeads: { cur: sum30('fub', 'qualified_seller_leads'), prior: sumPrior('fub', 'qualified_seller_leads') },
      sellerLeadsLatest,
      newLeads: { cur: newLeads30, prior: sumPrior('fub', 'new_leads') },
      // Get found
      gscPosition: {
        cur: avgNonZeroIn(series, 'gsc', 'avg_position', 'account', D30, TODAY),
        prior: avgNonZeroIn(series, 'gsc', 'avg_position', 'account', D60, D30),
      },
      gscImpressions: { cur: sum30('gsc', 'impressions'), prior: sumPrior('gsc', 'impressions') },
      gscClicks: { cur: sum30('gsc', 'clicks'), prior: sumPrior('gsc', 'clicks') },
      gbpImpressions: { cur: gbpImpr(D30, TODAY) || null, prior: gbpImpr(D60, D30) || null },
      gbpActions: { cur: gbpActions(D30, TODAY) || null, prior: gbpActions(D60, D30) || null },
      // AI-referred traffic — the forward-looking "future of search" signal
      aiTraffic: { cur: sum30('ga4', 'ai_assistant_sessions'), prior: sumPrior('ga4', 'ai_assistant_sessions') },
      aiEngines,
      // Traffic
      sessions: { cur: gaSessions30, prior: sumPrior('ga4', 'sessions') },
      newUsers: { cur: sum30('ga4', 'new_users'), prior: sumPrior('ga4', 'new_users') },
      engagementRate: { cur: avg30('ga4', 'engagement_rate'), prior: avgPrior('ga4', 'engagement_rate') },
      // Convert
      leadEvents: { cur: gaLeadEvents30, prior: sumPrior('ga4', 'total_lead_events') },
      convRate: {
        cur: gaSessions30 && gaLeadEvents30 != null ? gaLeadEvents30 / gaSessions30 : null,
        prior: null as number | null,
      },
      // Leads & pipeline
      pipelineCount: latest(series, 'fub', 'pipeline_count', 'campaign'),
      pipelineValue: latest(series, 'fub', 'pipeline_value', 'campaign'),
      appointments: { cur: sum30('fub', 'appointments_booked'), prior: sumPrior('fub', 'appointments_booked') },
      dealsCreated: { cur: sum30('fub', 'deals_created'), prior: sumPrior('fub', 'deals_created') },
      // Close
      dealsWon: { cur: sum30('fub', 'deals_closed_won'), prior: sumPrior('fub', 'deals_closed_won') },
      dealsLost: { cur: sum30('fub', 'deals_lost'), prior: sumPrior('fub', 'deals_lost') },
      // Paid
      metaSpend: { cur: metaSpend30, prior: sumPrior('meta_ads', 'spend') },
      metaClicks: { cur: sum30('meta_ads', 'clicks'), prior: sumPrior('meta_ads', 'clicks') },
      metaCtr: { cur: avg30('meta_ads', 'ctr'), prior: avgPrior('meta_ads', 'ctr') },
      metaCpl: {
        cur: metaSpend30 && metaConv30 ? metaSpend30 / metaConv30 : null,
        prior: null as number | null,
      },
    },
  }
}

// ── presentation ────────────────────────────────────────────────────────────
type Status = 'on_track' | 'at_risk' | 'below_target' | 'no_target' | 'stale'
function statusVariant(s: Status) {
  return s === 'on_track' ? ('success' as const)
    : s === 'at_risk' ? ('warning' as const)
    : s === 'below_target' ? ('destructive' as const)
    : ('secondary' as const)
}
function statusLabel(s: Status) {
  return { on_track: 'On track', at_risk: 'At risk', below_target: 'Below', no_target: '—', stale: 'Stale' }[s]
}

function fmtInt(v: number) { return Math.round(v).toLocaleString('en-US') }
function fmtUsd(v: number) { return `$${Math.round(v).toLocaleString('en-US')}` }
function fmtUsd1(v: number) { return `$${v.toFixed(2)}` }
function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%` }
function fmtNum1(v: number) { return v.toFixed(1) }

type Series2 = { cur: number | null; prior: number | null }

function trend(m: Series2, inverted = false): { arrow: string; pct: string; cls: string } | null {
  if (m.cur == null || m.prior == null || m.prior === 0) return null
  const change = (m.cur - m.prior) / Math.abs(m.prior)
  const good = inverted ? change < 0 : change > 0
  const flat = Math.abs(change) < 0.005
  return {
    arrow: flat ? '→' : change > 0 ? '▲' : '▼',
    pct: `${change >= 0 ? '+' : ''}${(change * 100).toFixed(0)}%`,
    cls: flat ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
  }
}

function statusFor(actual: number | null, target: number | null, inverted: boolean): Status {
  if (target == null) return 'no_target'
  if (actual == null) return 'stale'
  const gap = inverted ? (target - actual) / target : (actual - target) / target
  if (gap >= 0) return 'on_track'
  if (gap >= -0.15) return 'at_risk'
  return 'below_target'
}

function Row({
  label, value, m, fmt, target, inverted = false, unit = '', note,
}: {
  label: string
  value: number | null
  m?: Series2
  fmt: (v: number) => string
  target?: number | null
  inverted?: boolean
  unit?: string
  note?: string
}) {
  const t = m ? trend(m, inverted) : null
  const status = target !== undefined ? statusFor(value, target ?? null, inverted) : 'no_target'
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 flex-1 text-sm text-foreground">
        {label}
        {note && <span className="ml-2 text-xs text-muted-foreground">{note}</span>}
      </span>
      <div className="flex items-center gap-3 font-mono text-sm tabular-nums">
        <span className="w-24 text-right font-medium">{value != null ? `${fmt(value)}${unit}` : '—'}</span>
        <span className={`w-16 text-right text-xs ${t?.cls ?? 'text-muted-foreground'}`}>
          {t ? `${t.arrow} ${t.pct}` : ''}
        </span>
        <span className="w-20 text-right text-xs text-muted-foreground">
          {target != null ? `tgt ${fmt(target)}${unit}` : ''}
        </span>
        {target !== undefined && (
          <Badge variant={statusVariant(status)} className="w-20 justify-center">
            {statusLabel(status)}
          </Badge>
        )}
      </div>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{title}</h2>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        <Separator className="mt-2" />
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

export default async function ResultsScoreboardPage() {
  let data: Awaited<ReturnType<typeof fetchScoreboard>> | null = null
  let fetchError: string | null = null
  try {
    data = await fetchScoreboard()
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load scoreboard'
  }

  const sellerLatest = data?.metrics.sellerLeadsLatest
  const sellerStale = !sellerLatest || sellerLatest.date < D30

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Results scoreboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last 30 days vs prior 30 days{data?.quarter ? ` · targets from ${data.quarter} strategy` : ''}.
            The honest funnel: get found → traffic → convert → leads → pipeline → close.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground font-mono">{TODAY}</div>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">{fetchError}</div>
      )}

      {data && (
        <div className="space-y-4">
          <Panel title="North star — seller leads" subtitle="the number that matters">
            <Row
              label="Qualified seller leads (30d)"
              value={data.metrics.sellerLeads.cur}
              m={data.metrics.sellerLeads}
              fmt={fmtInt}
              target={data.targets.northStar}
              note={sellerStale ? `refreshing — last write ${sellerLatest?.date ?? 'none'}; daily snapshot fix shipped 2026-06-06` : undefined}
            />
            <Row label="New leads, all (30d)" value={data.metrics.newLeads.cur} m={data.metrics.newLeads} fmt={fmtInt} />
          </Panel>

          <Panel title="1 · Get found" subtitle="rankings + local visibility">
            <Row label="Avg Google rank (seller queries)" value={data.metrics.gscPosition.cur} m={data.metrics.gscPosition} fmt={fmtNum1} target={data.targets.sellerRank} inverted />
            <Row label="Search impressions (30d)" value={data.metrics.gscImpressions.cur} m={data.metrics.gscImpressions} fmt={fmtInt} />
            <Row label="Search clicks (30d)" value={data.metrics.gscClicks.cur} m={data.metrics.gscClicks} fmt={fmtInt} />
            <Row label="Google Business impressions (30d)" value={data.metrics.gbpImpressions.cur} m={data.metrics.gbpImpressions} fmt={fmtInt} />
            <Row label="Google Business actions — calls/dir/web (30d)" value={data.metrics.gbpActions.cur} m={data.metrics.gbpActions} fmt={fmtInt} />
          </Panel>

          <Panel title="AI-referred traffic" subtitle="the future of search — which LLMs send visitors">
            <Row label="AI-assistant sessions (30d)" value={data.metrics.aiTraffic.cur} m={data.metrics.aiTraffic} fmt={fmtInt} />
            {data.metrics.aiEngines.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No AI-assistant referrals captured yet. Instrumented daily across ChatGPT, Perplexity, Gemini,
                Claude, Copilot and 7 more engines, classified out of GA4&apos;s generic Referral bucket —
                captured forward from today (GA4&apos;s own AI channel has no backfill).
              </p>
            ) : (
              data.metrics.aiEngines.map((e) => (
                <Row key={e.engine} label={e.engine} value={e.sessions} fmt={fmtInt} />
              ))
            )}
          </Panel>

          <Panel title="2 · Traffic" subtitle="GA4">
            <Row label="Sessions (30d)" value={data.metrics.sessions.cur} m={data.metrics.sessions} fmt={fmtInt} />
            <Row label="New users (30d)" value={data.metrics.newUsers.cur} m={data.metrics.newUsers} fmt={fmtInt} />
            <Row label="Engagement rate (avg)" value={data.metrics.engagementRate.cur} m={data.metrics.engagementRate} fmt={fmtPct} />
          </Panel>

          <Panel title="3 · Convert" subtitle="site → lead">
            <Row label="Lead events (30d)" value={data.metrics.leadEvents.cur} m={data.metrics.leadEvents} fmt={fmtInt} />
            <Row label="Session → lead conversion" value={data.metrics.convRate.cur} fmt={fmtPct} target={data.targets.valuationConv} />
          </Panel>

          <Panel title="4 · Leads & pipeline" subtitle="FUB">
            <Row label="New leads (30d)" value={data.metrics.newLeads.cur} m={data.metrics.newLeads} fmt={fmtInt} />
            <Row label="Pipeline — open deals" value={data.metrics.pipelineCount?.value ?? null} fmt={fmtInt} />
            <Row label="Pipeline value" value={data.metrics.pipelineValue?.value ?? null} fmt={fmtUsd} />
            <Row label="Appointments booked (30d)" value={data.metrics.appointments.cur} m={data.metrics.appointments} fmt={fmtInt} />
            <Row label="Deals created (30d)" value={data.metrics.dealsCreated.cur} m={data.metrics.dealsCreated} fmt={fmtInt} />
          </Panel>

          <Panel title="5 · Close" subtitle="target 12 listings / quarter">
            <Row label="Deals won (30d)" value={data.metrics.dealsWon.cur} m={data.metrics.dealsWon} fmt={fmtInt} />
            <Row label="Deals lost (30d)" value={data.metrics.dealsLost.cur} m={data.metrics.dealsLost} fmt={fmtInt} inverted />
          </Panel>

          <Panel title="6 · Paid (Meta)" subtitle="efficiency">
            <Row label="Spend (30d)" value={data.metrics.metaSpend.cur} m={data.metrics.metaSpend} fmt={fmtUsd} inverted />
            <Row label="Clicks (30d)" value={data.metrics.metaClicks.cur} m={data.metrics.metaClicks} fmt={fmtInt} />
            <Row label="CTR (avg)" value={data.metrics.metaCtr.cur} m={data.metrics.metaCtr} fmt={(v) => `${v.toFixed(2)}%`} />
            <Row label="Cost per conversion" value={data.metrics.metaCpl.cur} fmt={fmtUsd1} target={data.targets.metaCpl} inverted />
          </Panel>

          <Panel title="Site speed — real users (CWV)" subtitle="field p75, last 30d — the number Google ranks on">
            {data.cwv.samples === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Collecting. Real-user Core Web Vitals start landing as visitors load pages (just instrumented).
                Lab tests overstate slowness under throttling — this field p75 is what actually affects ranking + UX.
              </p>
            ) : (
              <>
                <Row label="LCP — largest contentful paint" value={data.cwv.lcp} fmt={(v) => `${(v / 1000).toFixed(2)}s`} target={2500} inverted />
                <Row label="INP — responsiveness" value={data.cwv.inp} fmt={(v) => `${Math.round(v)}ms`} target={200} inverted />
                <Row label="CLS — layout shift" value={data.cwv.cls} fmt={(v) => v.toFixed(3)} target={0.1} inverted />
                <p className="pt-1 text-xs text-muted-foreground">
                  {data.cwv.samples} samples · p75 · good thresholds LCP ≤2.5s / INP ≤200ms / CLS ≤0.1
                </p>
              </>
            )}
          </Panel>

          <p className="text-xs text-muted-foreground">
            Source: marketing_channel_daily (account + campaign scope), populated daily by the snapshot crons from
            GA4 / Search Console / Google Business / FUB / Meta. Trend compares the last 30 days with the prior 30.
            This is the measurement layer — pick one bet against it each week.
          </p>
        </div>
      )}
    </div>
  )
}
