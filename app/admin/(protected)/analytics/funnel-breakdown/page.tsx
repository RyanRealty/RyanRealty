/**
 * /admin/analytics/funnel-breakdown — intent split + stage drop-offs +
 * actionable recommendations.
 *
 * Three sections:
 *   1. INTENT SPLIT — visitor_sessions grouped by intent_tags
 *      (seller_intent vs buyer_intent vs unknown). Per bucket: count,
 *      top source, identification rate, hot rate.
 *   2. FUNNEL STAGES per traffic source — landing → engaged (score>=20) →
 *      seller-intent reached → identified → hot. Drop-off % at each
 *      stage. The biggest drop is highlighted so you know where to fix.
 *   3. ACTIONABLE INSIGHTS — auto-generated copy based on the data.
 *      "Your seller LP loses X% at stage Y from source Z. Fix it by..."
 *
 * Data: visitor_sessions + visitor_events (our own tables). No GA4
 * latency. Updates the moment events land.
 */
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v
  }
  return out
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPct(n: number, total: number): string {
  if (total === 0) return '—'
  return `${((n / total) * 100).toFixed(1)}%`
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

type SessionRow = {
  session_id: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  ip_city: string | null
  engagement_score: number
  peak_score: number
  intent_tags: string[]
  identified_at: string | null
  fub_person_id: number | null
  hot_lead_fired_at: string | null
  source_domain: string
}

type IntentBucket = {
  label: string
  count: number
  identified: number
  hot: number
  topSource: string
  topCity: string
  identifyRate: number
  hotRate: number
}

type FunnelStage = {
  label: string
  count: number
  fromPrev: number  // % of immediately prior stage
  fromStart: number // % of total
}

type SourceFunnel = {
  source: string
  totalSessions: number
  stages: FunnelStage[]
  biggestDropLabel: string
  biggestDropPct: number
}

type Insight = {
  severity: 'critical' | 'warning' | 'info'
  message: string
}

function classifyIntent(tags: string[]): 'seller' | 'buyer' | 'both' | 'browsing' | 'unknown' {
  const hasSeller = tags.includes('seller_intent')
  const hasBuyer  = tags.includes('buyer_intent')
  if (hasSeller && hasBuyer) return 'both'
  if (hasSeller) return 'seller'
  if (hasBuyer)  return 'buyer'
  if (tags.length > 0) return 'browsing'  // has listing_viewer / area_researcher / mortgage_curious
  return 'unknown'
}

function topByCount<T>(items: T[], key: (t: T) => string | null | undefined, fallback = '—'): string {
  const tally = new Map<string, number>()
  for (const item of items) {
    const k = key(item)?.trim().toLowerCase()
    if (!k) continue
    tally.set(k, (tally.get(k) ?? 0) + 1)
  }
  let bestK = fallback
  let bestCount = 0
  for (const [k, count] of tally) {
    if (count > bestCount) { bestK = k; bestCount = count }
  }
  return bestK
}

function buildIntentBuckets(rows: SessionRow[]): IntentBucket[] {
  const groups = new Map<string, SessionRow[]>()
  for (const r of rows) {
    const k = classifyIntent(r.intent_tags)
    const list = groups.get(k) ?? []
    list.push(r)
    groups.set(k, list)
  }
  const order = ['seller', 'both', 'buyer', 'browsing', 'unknown']
  return order.flatMap((k) => {
    const list = groups.get(k) ?? []
    if (list.length === 0) return []
    const identified = list.filter((r) => r.identified_at).length
    const hot        = list.filter((r) => r.hot_lead_fired_at).length
    const topSource  = topByCount(list, (r) => r.utm_source)
    const topCity    = topByCount(list, (r) => r.ip_city)
    return [{
      label: k === 'both' ? 'seller + buyer' : k,
      count: list.length,
      identified,
      hot,
      topSource,
      topCity,
      identifyRate: list.length > 0 ? identified / list.length : 0,
      hotRate:      list.length > 0 ? hot / list.length : 0,
    }]
  })
}

function buildSourceFunnels(rows: SessionRow[]): SourceFunnel[] {
  // Group sessions by utm_source (treating null as 'direct')
  const bySrc = new Map<string, SessionRow[]>()
  for (const r of rows) {
    const src = (r.utm_source ?? 'direct').toLowerCase()
    const list = bySrc.get(src) ?? []
    list.push(r)
    bySrc.set(src, list)
  }

  const funnels: SourceFunnel[] = []
  for (const [source, sessions] of bySrc) {
    if (sessions.length < 3) continue  // ignore noise

    const totalSessions = sessions.length
    const engaged       = sessions.filter((s) => s.engagement_score >= 20).length
    const sellerIntent  = sessions.filter((s) => s.intent_tags.includes('seller_intent') || s.intent_tags.includes('buyer_intent')).length
    const identified    = sessions.filter((s) => s.identified_at).length
    const hot           = sessions.filter((s) => s.hot_lead_fired_at).length

    const stages: FunnelStage[] = [
      { label: 'Landed',             count: totalSessions, fromPrev: 100,                              fromStart: 100 },
      { label: 'Engaged (score 20+)', count: engaged,      fromPrev: totalSessions ? (engaged / totalSessions) * 100 : 0,        fromStart: totalSessions ? (engaged / totalSessions) * 100 : 0 },
      { label: 'Intent signal',      count: sellerIntent,  fromPrev: engaged       ? (sellerIntent / engaged) * 100 : 0,         fromStart: totalSessions ? (sellerIntent / totalSessions) * 100 : 0 },
      { label: 'Identified',         count: identified,    fromPrev: sellerIntent  ? (identified / sellerIntent) * 100 : 0,      fromStart: totalSessions ? (identified / totalSessions) * 100 : 0 },
      { label: 'Hot lead',           count: hot,           fromPrev: identified    ? (hot / identified) * 100 : 0,               fromStart: totalSessions ? (hot / totalSessions) * 100 : 0 },
    ]

    // Find the biggest drop between adjacent stages (excluding the 100% start)
    let biggestDropLabel = ''
    let biggestDropPct = 0
    for (let i = 1; i < stages.length; i++) {
      const drop = 100 - stages[i].fromPrev
      if (drop > biggestDropPct) {
        biggestDropPct = drop
        biggestDropLabel = `${stages[i - 1].label} → ${stages[i].label}`
      }
    }

    funnels.push({ source, totalSessions, stages, biggestDropLabel, biggestDropPct })
  }
  return funnels.sort((a, b) => b.totalSessions - a.totalSessions)
}

function generateInsights(buckets: IntentBucket[], funnels: SourceFunnel[]): Insight[] {
  const out: Insight[] = []

  // 1. Seller-funnel conversion red flag
  const sellerBucket = buckets.find((b) => b.label === 'seller')
  if (sellerBucket) {
    if (sellerBucket.identifyRate < 0.05 && sellerBucket.count >= 20) {
      out.push({
        severity: 'critical',
        message: `Only ${(sellerBucket.identifyRate * 100).toFixed(1)}% of seller-intent visitors identify (${sellerBucket.identified} of ${sellerBucket.count}). Soft-wall threshold may be too high, or the sign-in modal is being dismissed. Lower softWallScoreThreshold from 30 to 15 and re-measure for a week.`,
      })
    }
    if (sellerBucket.count >= 10 && sellerBucket.hotRate === 0) {
      out.push({
        severity: 'warning',
        message: `${sellerBucket.count} seller-intent visitors but zero hot leads fired. Either score threshold (100) is too high for the current volume, or the seller LP is not generating enough engagement events. Review the scoring weights.`,
      })
    }
  }

  // 2. Source efficiency comparison
  if (funnels.length >= 2) {
    const sorted = funnels
      .filter((f) => f.totalSessions >= 10)
      .sort((a, b) => {
        const aRate = a.stages[3].fromStart  // identified rate
        const bRate = b.stages[3].fromStart
        return bRate - aRate
      })
    if (sorted.length >= 2) {
      const best  = sorted[0]
      const worst = sorted[sorted.length - 1]
      const bestRate  = best.stages[3].fromStart
      const worstRate = worst.stages[3].fromStart
      if (bestRate > worstRate * 2 && bestRate >= 1) {
        out.push({
          severity: 'info',
          message: `${best.source} converts ${bestRate.toFixed(1)}% of visitors to identified leads, ${worst.source} converts ${worstRate.toFixed(1)}%. ${best.source} is ${(bestRate / Math.max(worstRate, 0.01)).toFixed(1)}x more efficient. Shift spend from ${worst.source} to ${best.source} until rates equalize.`,
        })
      }
    }
  }

  // 3. Big drop-off callouts
  for (const f of funnels.slice(0, 5)) {
    if (f.biggestDropPct >= 80 && f.totalSessions >= 20) {
      out.push({
        severity: 'critical',
        message: `${f.source}: ${f.biggestDropPct.toFixed(0)}% drop at "${f.biggestDropLabel}". ${f.totalSessions} sessions, ${f.stages[f.stages.length - 1].count} hot leads. Investigate the page that the stage transition fires on.`,
      })
    }
  }

  // 4. Single-source dominance
  const totalAllSessions = funnels.reduce((acc, f) => acc + f.totalSessions, 0)
  const topFunnel = funnels[0]
  if (topFunnel && totalAllSessions > 0 && topFunnel.totalSessions / totalAllSessions >= 0.6) {
    out.push({
      severity: 'info',
      message: `${topFunnel.source} drives ${((topFunnel.totalSessions / totalAllSessions) * 100).toFixed(0)}% of all sessions. Single-channel concentration risk. Diversify before any algorithm or audience shift cuts off the pipeline.`,
    })
  }

  if (out.length === 0) {
    out.push({
      severity: 'info',
      message: 'No urgent issues detected. Either traffic is flowing cleanly or there is not enough data yet to spot patterns. Re-check after 7 days of activity.',
    })
  }

  return out
}

async function FunnelContent() {
  const supabase = getServiceSupabase()
  const lookbackDays = 30
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, utm_source, utm_medium, utm_campaign, ip_city, engagement_score, peak_score, intent_tags, identified_at, fub_person_id, hot_lead_fired_at, source_domain')
    .gte('first_seen_at', cutoff)
    .limit(5000)

  if (error) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-destructive">Failed to load visitor sessions: {error.message}</CardContent></Card>
    )
  }

  const rows = (data ?? []) as SessionRow[]
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No visitor sessions in the last {lookbackDays} days yet. Once the WordPress snippet starts firing tracked events to /api/visitors/track, sessions appear here and the funnel populates in real time.
        </CardContent>
      </Card>
    )
  }

  const buckets  = buildIntentBuckets(rows)
  const funnels  = buildSourceFunnels(rows)
  const insights = generateInsights(buckets, funnels)
  const totalSessions = rows.length

  return (
    <div className="space-y-6">

      {/* 1. Insights — top of page so it cannot be missed */}
      <Card>
        <CardHeader><CardTitle>What the data says (last {lookbackDays} days)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {insights.map((ins, i) => (
            <Alert key={i} variant={ins.severity === 'critical' ? 'destructive' : 'default'}>
              <AlertDescription className="text-sm">
                <Badge variant={ins.severity === 'critical' ? 'destructive' : ins.severity === 'warning' ? 'default' : 'outline'} className="mr-2">
                  {ins.severity}
                </Badge>
                {ins.message}
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>

      {/* 2. Intent split */}
      <Card>
        <CardHeader>
          <CardTitle>Intent split — who is looking to do what</CardTitle>
          <p className="text-xs text-muted-foreground">
            Visitors classified by behavioral intent (which categories of pages they engaged with). Seller intent = visited /free-home-valuation or similar. Buyer intent = visited /buyers, /relocation, /explore. Browsing = viewed listings but did not signal seller/buyer. Total sessions: {formatInt(totalSessions)}.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Intent</TableHead>
                <TableHead className="text-right tabular-nums">Sessions</TableHead>
                <TableHead className="text-right tabular-nums">Identified</TableHead>
                <TableHead className="text-right tabular-nums">Identify rate</TableHead>
                <TableHead className="text-right tabular-nums">Hot leads</TableHead>
                <TableHead className="text-right tabular-nums">Hot rate</TableHead>
                <TableHead>Top source</TableHead>
                <TableHead>Top city</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buckets.map((b) => (
                <TableRow key={b.label}>
                  <TableCell>
                    <Badge variant={b.label === 'seller' ? 'default' : b.label === 'buyer' ? 'secondary' : 'outline'}>
                      {b.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(b.count)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(b.identified)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(b.identified, b.count)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(b.hot)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(b.hot, b.count)}</TableCell>
                  <TableCell className="text-xs">{b.topSource}</TableCell>
                  <TableCell className="text-xs">{b.topCity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 3. Funnel by source */}
      <Card>
        <CardHeader>
          <CardTitle>Funnel breakpoints by traffic source</CardTitle>
          <p className="text-xs text-muted-foreground">
            Stage-by-stage drop-off. Bigger %s = more visitors keep going. Look at where the cliff is — that is what to fix first. Sources with fewer than 3 sessions are hidden.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right tabular-nums">Landed</TableHead>
                <TableHead className="text-right tabular-nums">Engaged</TableHead>
                <TableHead className="text-right tabular-nums">Intent</TableHead>
                <TableHead className="text-right tabular-nums">Identified</TableHead>
                <TableHead className="text-right tabular-nums">Hot lead</TableHead>
                <TableHead>Biggest drop</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnels.map((f) => (
                <TableRow key={f.source}>
                  <TableCell className="font-medium">{f.source}</TableCell>
                  {f.stages.map((stage) => (
                    <TableCell key={stage.label} className="text-right tabular-nums">
                      <div>{formatInt(stage.count)}</div>
                      <div className="text-[10px] text-muted-foreground">{stage.fromStart.toFixed(1)}%</div>
                    </TableCell>
                  ))}
                  <TableCell className="text-xs">
                    <Badge variant={f.biggestDropPct >= 80 ? 'destructive' : f.biggestDropPct >= 50 ? 'default' : 'outline'}>
                      {f.biggestDropLabel || '—'} ({f.biggestDropPct.toFixed(0)}%)
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Stage rules: Engaged = score ≥ 20. Intent = visitor hit a seller_intent or buyer_intent page. Identified = signed in via One-Tap, FB, or form. Hot lead = score crossed 100 and the FUB hot-lead task fired.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function FunnelBreakdownPage(_: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Funnel breakdown</h1>
        <p className="text-sm text-muted-foreground">
          Where visitors enter the funnel, where they drop out, and what to do about it. Powered by visitor_sessions + visitor_events (the real-time tables, not GA4). Updates the moment events land.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <FunnelContent />
      </Suspense>
    </div>
  )
}
