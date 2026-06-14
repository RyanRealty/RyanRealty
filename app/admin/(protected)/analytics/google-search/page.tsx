// /admin/analytics/google-search - surfaces 60 days of GSC data already
// ingesting into marketing_channel_daily. Top queries, top pages, easy wins.
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

async function aggBy(scope: 'campaign' | 'page', sinceDate: string): Promise<Row[]> {
  const { data } = await sup().from('marketing_channel_daily')
    .select('scope_id, metric, value')
    .eq('channel', 'gsc').eq('scope', scope)
    .in('metric', ['clicks', 'impressions', 'ctr', 'position'])
    .gte('date', sinceDate).limit(50000)
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

async function HeadlineKpis() {
  const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
  const { data: cur } = await sup().from('marketing_channel_daily').select('metric, value')
    .eq('channel', 'gsc').eq('scope', 'account').gte('date', since)
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Clicks (30d)</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(c.clicks)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Impressions (30d)</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(c.impressions)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg CTR</p><p className="mt-1 text-2xl font-semibold tabular-nums">{pct(c.ctr)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg position</p><p className="mt-1 text-2xl font-semibold tabular-nums">{pos(c.pos)}</p></CardContent></Card>
    </div>
  )
}

async function TopQueries() {
  const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
  const rows = await aggBy('campaign', since)
  const top = rows.sort((a, b) => b.clicks - a.clicks).slice(0, 30)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top queries by clicks (30d)</CardTitle>
        <p className="text-xs text-muted-foreground">What people typed in Google that brought them to ryan-realty.com. Average position 1-10 is page one; 11-20 is page two.</p>
      </CardHeader>
      <CardContent className="p-0">
        {top.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No GSC query data in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <Table>
              <TableHeader><TableRow><TableHead className="whitespace-nowrap">Query</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Clicks</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Impressions</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">CTR</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Position</TableHead></TableRow></TableHeader>
              <TableBody>{top.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{stripQ(r.key)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">{fmt(r.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{fmt(r.impressions)}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{pct(r.ctr)}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap"><Badge variant={r.position <= 10 ? 'default' : r.position <= 20 ? 'secondary' : 'outline'}>{pos(r.position)}</Badge></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function OpportunityQueries() {
  const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
  const rows = await aggBy('campaign', since)
  // High impressions, low CTR, decent rank (page 1 or 2). Easy SEO wins.
  const opp = rows
    .filter((r) => r.impressions >= 30 && r.ctr < 0.02 && r.position > 0 && r.position <= 20)
    .sort((a, b) => b.impressions - a.impressions).slice(0, 20)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Opportunity queries (easy SEO wins)</CardTitle>
        <p className="text-xs text-muted-foreground">Queries you already RANK for (position 1-20) and get IMPRESSIONS for (30+), but visitors are not clicking (CTR under 2%). Fix the page title and meta description and the clicks usually jump in days.</p>
      </CardHeader>
      <CardContent className="p-0">
        {opp.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No opportunity queries surfaced.</p>
        ) : (
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <Table>
              <TableHeader><TableRow><TableHead className="whitespace-nowrap">Query</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Impressions</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">CTR</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Position</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Potential clicks</TableHead></TableRow></TableHeader>
              <TableBody>{opp.map((r) => {
                // Industry CTR by position: pos 1 ~30%, pos 5 ~8%, pos 10 ~3%
                const expectedCtr = r.position <= 3 ? 0.20 : r.position <= 5 ? 0.10 : r.position <= 10 ? 0.05 : 0.02
                const potential = Math.round(r.impressions * expectedCtr)
                return (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{stripQ(r.key)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">{fmt(r.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive whitespace-nowrap">{pct(r.ctr)}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap"><Badge variant={r.position <= 10 ? 'default' : 'secondary'}>{pos(r.position)}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-green-600 whitespace-nowrap">+{fmt(Math.max(0, potential - r.clicks))}</TableCell>
                  </TableRow>
                )
              })}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

async function TopPages() {
  const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
  const rows = await aggBy('page', since)
  const top = rows.sort((a, b) => b.clicks - a.clicks).slice(0, 20)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top pages by clicks (30d)</CardTitle>
        <p className="text-xs text-muted-foreground">Which pages on ryan-realty.com pulled the most organic traffic from Google.</p>
      </CardHeader>
      <CardContent className="p-0">
        {top.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No GSC page data in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <Table>
              <TableHeader><TableRow><TableHead className="whitespace-nowrap">Page</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Clicks</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Impressions</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">CTR</TableHead><TableHead className="text-right tabular-nums whitespace-nowrap">Position</TableHead></TableRow></TableHeader>
              <TableBody>{top.map((r) => (
                <TableRow key={r.key}>
                  <TableCell><a href={r.key} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs whitespace-nowrap">{stripP(r.key)}</a></TableCell>
                  <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">{fmt(r.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{fmt(r.impressions)}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{pct(r.ctr)}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">{pos(r.position)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default async function GscPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Google Search</h1>
        <p className="text-sm text-muted-foreground">
          What people search to find Ryan Realty, which pages rank for what, and where the easy SEO wins are. Sourced from the GSC snapshot cron, last 30 days. GSC data has a 2-3 day processing lag.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}><HeadlineKpis /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><OpportunityQueries /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><TopQueries /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><TopPages /></Suspense>
    </div>
  )
}