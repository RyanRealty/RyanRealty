// /admin/analytics/google-search - surfaces GSC data from marketing_channel_daily.
// Top queries, top pages, easy wins.
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

function sup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)
const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const pos = (n: number) => n > 0 ? n.toFixed(1) : '—'
const stripQ = (s: string) => s.startsWith('query:') ? s.slice(6) : s
const stripP = (s: string) => { try { return new URL(s).pathname || '/' } catch { return s } }

type Agg = { clicks: number; impressions: number; ctrSum: number; ctrN: number; posSum: number; posN: number }
type Row = { key: string; clicks: number; impressions: number; ctr: number; position: number }

async function aggBy(scope: 'campaign' | 'page', sinceDate: string, untilDate?: string): Promise<Row[]> {
  const q = sup().from('marketing_channel_daily')
    .select('scope_id, metric, value')
    .eq('channel', 'gsc').eq('scope', scope)
    .in('metric', ['clicks', 'impressions', 'ctr', 'position'])
    .gte('date', sinceDate).limit(50000)
  const { data } = await (untilDate ? q.lte('date', untilDate) : q)
  const m = new Map<string, Agg>()
  for (const raw of (data ?? [])) {
    const r = raw as { scope_id: string; metric: string; value: number }
    const a = m.get(r.scope_id) ?? { clicks: 0, impressions: 0, ctrSum: 0, ctrN: 0, posSum: 0, posN: 0 }
    const v = Number(r.value) || 0
    if (r.metric === 'clicks') a.clicks += v
    else if (r.metric === 'impressions') a.impressions += v
    else if (r.metric === 'ctr') { a.ctrSum += v; a.ctrN += 1 }
    else if (r.metric === 'position') { a.posSum += v; a.posN += 1 }
    m.set(r.scope_id, a)
  }
  return Array.from(m.entries()).map(([key, a]) => ({
    key,
    clicks: a.clicks,
    impressions: a.impressions,
    ctr: a.impressions > 0 ? a.clicks / a.impressions : (a.ctrN > 0 ? a.ctrSum / a.ctrN : 0),
    position: a.posN > 0 ? a.posSum / a.posN : 0,
  }))
}

async function HeadlineKpis({ sinceDate, endDate }: { sinceDate: string; endDate: string }) {
  const { data: cur } = await sup().from('marketing_channel_daily').select('metric, value')
    .eq('channel', 'gsc').eq('scope', 'account').gte('date', sinceDate).lte('date', endDate)
  const acc = { clicks: 0, impressions: 0, ctrSum: 0, ctrN: 0, posSum: 0, posN: 0 }
  for (const r of (cur ?? []) as Array<{ metric: string; value: number }>) {
    const v = Number(r.value) || 0
    if (r.metric === 'clicks') acc.clicks += v
    else if (r.metric === 'impressions') acc.impressions += v
    else if (r.metric === 'avg_ctr') { acc.ctrSum += v; acc.ctrN += 1 }
    else if (r.metric === 'avg_position') { acc.posSum += v; acc.posN += 1 }
  }
  const c = {
    clicks: acc.clicks,
    impressions: acc.impressions,
    ctr: acc.ctrN > 0 ? acc.ctrSum / acc.ctrN : 0,
    pos: acc.posN > 0 ? acc.posSum / acc.posN : 0,
  }
  return (
    <DashboardSummaryStrip
      stats={[
        { label: `Clicks (${sinceDate} to ${endDate})`, value: fmt(c.clicks) },
        { label: 'Impressions', value: fmt(c.impressions) },
        { label: 'Avg CTR', value: pct(c.ctr) },
        { label: 'Avg position', value: pos(c.pos) },
      ]}
    />
  )
}

async function TopQueries({ sinceDate, endDate }: { sinceDate: string; endDate: string }) {
  const rows = await aggBy('campaign', sinceDate, endDate)
  const top = rows.sort((a, b) => b.clicks - a.clicks)
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Top queries by clicks</h2>
        <p className="text-xs text-muted-foreground">What people typed in Google that brought them to ryan-realty.com. Average position 1-10 is page one; 11-20 is page two.</p>
      </div>
      <TableWithMobileCards
        rows={top}
        cap={10}
        getRowKey={(r) => r.key}
        columns={[
          { key: 'query', header: 'Query', className: 'font-medium', cell: (r) => stripQ(r.key) },
          { key: 'clicks', header: 'Clicks', className: 'text-right tabular-nums font-semibold whitespace-nowrap', cell: (r) => fmt(r.clicks) },
          { key: 'impr', header: 'Impressions', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => fmt(r.impressions) },
          { key: 'ctr', header: 'CTR', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => pct(r.ctr) },
          { key: 'pos', header: 'Position', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => <Badge variant={r.position <= 10 ? 'default' : r.position <= 20 ? 'secondary' : 'outline'}>{pos(r.position)}</Badge> },
        ]}
        renderCard={(r) => (
          <Card>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{stripQ(r.key)}</span>
                <span className="text-sm font-semibold tabular-nums">{fmt(r.clicks)} <span className="text-xs font-normal text-muted-foreground">clicks</span></span>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                {fmt(r.impressions)} impr · {pct(r.ctr)} CTR
                <Badge variant={r.position <= 10 ? 'default' : r.position <= 20 ? 'secondary' : 'outline'} className="text-xs">pos {pos(r.position)}</Badge>
              </p>
            </CardContent>
          </Card>
        )}
        empty={<>No GSC query data for this date range. The GSC snapshot cron has a 2-3 day processing lag, so very recent ranges can be empty.</>}
      />
    </section>
  )
}

async function OpportunityQueries({ sinceDate, endDate }: { sinceDate: string; endDate: string }) {
  const rows = await aggBy('campaign', sinceDate, endDate)
  // High impressions, low CTR, decent rank (page 1 or 2). Easy SEO wins.
  const opp = rows
    .filter((r) => r.impressions >= 30 && r.ctr < 0.02 && r.position > 0 && r.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .map((r) => {
      // Industry CTR by position: pos 1 ~30%, pos 5 ~8%, pos 10 ~3%
      const expectedCtr = r.position <= 3 ? 0.20 : r.position <= 5 ? 0.10 : r.position <= 10 ? 0.05 : 0.02
      const potential = Math.round(r.impressions * expectedCtr)
      return { ...r, potential: Math.max(0, potential - r.clicks) }
    })
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Opportunity queries (easy SEO wins)</h2>
        <p className="text-xs text-muted-foreground">Queries you already RANK for (position 1-20) and get IMPRESSIONS for (30+), but visitors are not clicking (CTR under 2%). Fix the page title and meta description and the clicks usually jump in days.</p>
      </div>
      <TableWithMobileCards
        rows={opp}
        cap={10}
        getRowKey={(r) => r.key}
        columns={[
          { key: 'query', header: 'Query', className: 'font-medium', cell: (r) => stripQ(r.key) },
          { key: 'impr', header: 'Impressions', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => fmt(r.impressions) },
          { key: 'ctr', header: 'CTR', className: 'text-right tabular-nums text-destructive whitespace-nowrap', cell: (r) => pct(r.ctr) },
          { key: 'pos', header: 'Position', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => <Badge variant={r.position <= 10 ? 'default' : 'secondary'}>{pos(r.position)}</Badge> },
          { key: 'potential', header: 'Potential clicks', className: 'text-right tabular-nums font-semibold text-success whitespace-nowrap', cell: (r) => `+${fmt(r.potential)}` },
        ]}
        renderCard={(r) => (
          <Card>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{stripQ(r.key)}</span>
                <span className="text-sm font-semibold tabular-nums text-success">+{fmt(r.potential)} <span className="text-xs font-normal text-muted-foreground">clicks</span></span>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                {fmt(r.impressions)} impr · <span className="text-destructive">{pct(r.ctr)} CTR</span>
                <Badge variant={r.position <= 10 ? 'default' : 'secondary'} className="text-xs">pos {pos(r.position)}</Badge>
              </p>
            </CardContent>
          </Card>
        )}
        empty={<>No opportunity queries surfaced. Either nothing has a high-impression low-CTR gap right now, or GSC data has not synced for this range.</>}
      />
    </section>
  )
}

async function TopPages({ sinceDate, endDate }: { sinceDate: string; endDate: string }) {
  const rows = await aggBy('page', sinceDate, endDate)
  const top = rows.sort((a, b) => b.clicks - a.clicks)
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Top pages by clicks</h2>
        <p className="text-xs text-muted-foreground">Which pages on ryan-realty.com pulled the most organic traffic from Google.</p>
      </div>
      <TableWithMobileCards
        rows={top}
        cap={10}
        getRowKey={(r) => r.key}
        columns={[
          { key: 'page', header: 'Page', className: 'whitespace-nowrap', cell: (r) => <a href={r.key} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs">{stripP(r.key)}</a> },
          { key: 'clicks', header: 'Clicks', className: 'text-right tabular-nums font-semibold whitespace-nowrap', cell: (r) => fmt(r.clicks) },
          { key: 'impr', header: 'Impressions', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => fmt(r.impressions) },
          { key: 'ctr', header: 'CTR', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => pct(r.ctr) },
          { key: 'pos', header: 'Position', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => pos(r.position) },
        ]}
        renderCard={(r) => (
          <Card>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <a href={r.key} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-xs text-primary hover:underline">{stripP(r.key)}</a>
                <span className="text-sm font-semibold tabular-nums">{fmt(r.clicks)} <span className="text-xs font-normal text-muted-foreground">clicks</span></span>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">{fmt(r.impressions)} impr · {pct(r.ctr)} CTR · pos {pos(r.position)}</p>
            </CardContent>
          </Card>
        )}
        empty={<>No GSC page data for this date range.</>}
      />
    </section>
  )
}

export default async function GscPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Google Search</h1>
        <p className="text-sm text-muted-foreground">
          What people search to find Ryan Realty, which pages rank for what, and where the easy SEO wins are. Sourced from the GSC snapshot cron. GSC data has a 2-3 day processing lag.
        </p>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}><HeadlineKpis sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><OpportunityQueries sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><TopQueries sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><TopPages sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
    </div>
  )
}
