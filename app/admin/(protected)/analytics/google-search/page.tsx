// /admin/analytics/google-search - surfaces GSC data from marketing_channel_daily.
// Top queries, top pages, easy wins.
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only — every query, aggregation, filter, expected-CTR constant and
// date-range contract below is carried over verbatim from the legacy version.
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { DataList, Figures, Loading } from '../_components/v2/kit'
import { RangeControl } from '../_components/v2/RangeControl'
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
  const client = sup()
  // Paged read — PostgREST caps single responses at 1,000 rows, so the old
  // .limit(50000) silently truncated the GSC aggregate there. Ordered on the
  // composite PK (date, channel/scope fixed, scope_id, metric) for stability.
  const { rows: data } = await fetchPagedRows(
    (from, to) => {
      const q = client.from('marketing_channel_daily')
        .select('scope_id, metric, value')
        .eq('channel', 'gsc').eq('scope', scope)
        .in('metric', ['clicks', 'impressions', 'ctr', 'position'])
        .gte('date', sinceDate)
      return (untilDate ? q.lte('date', untilDate) : q)
        .order('date', { ascending: true })
        .order('scope_id', { ascending: true })
        .order('metric', { ascending: true })
        .range(from, to)
    },
    50000,
  )
  const m = new Map<string, Agg>()
  for (const raw of data) {
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
    <>
      <VerdictLine tone={c.clicks > 0 ? 'ok' : 'attention'}>
        {c.clicks > 0 ? (
          <>
            <b>{fmt(c.clicks)} clicks</b> from Google search, {sinceDate} to {endDate}.
          </>
        ) : (
          <>
            <b>No Google clicks recorded</b> for {sinceDate} to {endDate}. GSC lands 2–3 days behind — widen the range.
          </>
        )}
      </VerdictLine>
      <Figures
        figures={[
          { label: `Clicks (${sinceDate} to ${endDate})`, value: fmt(c.clicks) },
          { label: 'Impressions', value: fmt(c.impressions) },
          { label: 'Avg CTR', value: pct(c.ctr) },
          { label: 'Avg position', value: pos(c.pos) },
        ]}
      />
    </>
  )
}

async function TopQueries({ sinceDate, endDate }: { sinceDate: string; endDate: string }) {
  const rows = await aggBy('campaign', sinceDate, endDate)
  const top = rows.sort((a, b) => b.clicks - a.clicks)
  return (
    <section aria-label="Top queries by clicks">
      <SectionHead>Top queries by clicks</SectionHead>
      <p className="av2-note">
        What people typed in Google that brought them to ryan-realty.com. Average position 1-10 is page one; 11-20 is page two.
      </p>
      <DataList
        label="Top queries by clicks"
        rows={top}
        cap={10}
        rowKey={(r) => r.key}
        columns={[
          { key: 'query', header: 'Query', lead: true, cell: (r) => stripQ(r.key) },
          { key: 'clicks', header: 'Clicks', num: true, cell: (r) => fmt(r.clicks) },
          { key: 'impr', header: 'Impressions', num: true, cell: (r) => fmt(r.impressions) },
          { key: 'ctr', header: 'CTR', num: true, cell: (r) => pct(r.ctr) },
          { key: 'pos', header: 'Position', num: true, cell: (r) => pos(r.position) },
        ]}
        empty={<>No GSC query data for this date range. The GSC snapshot cron has a 2-3 day processing lag, so very recent ranges can be empty. Widen the date range above.</>}
      />
    </section>
  )
}

async function SlippingQueries({ sinceDate, endDate }: { sinceDate: string; endDate: string }) {
  const start = new Date(`${sinceDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  const mid = new Date((start + end) / 2).toISOString().slice(0, 10)
  const [earlier, later] = await Promise.all([
    aggBy('campaign', sinceDate, mid),
    aggBy('campaign', mid, endDate),
  ])
  const laterByKey = new Map(later.map((r) => [r.key, r]))
  const slipping = earlier
    .filter((a) => a.clicks >= 3)
    .map((a) => {
      const b = laterByKey.get(a.key)
      const laterClicks = b?.clicks ?? 0
      return {
        key: a.key,
        earlier: a.clicks,
        later: laterClicks,
        delta: laterClicks - a.clicks,
      }
    })
    .filter((r) => r.later < r.earlier)
    .sort((a, b) => a.delta - b.delta)
  return (
    <section aria-label="Slipping queries">
      <SectionHead>Slipping queries</SectionHead>
      <p className="av2-note">
        Queries that lost clicks from the first half of this range ({sinceDate} to {mid}) to the
        second half ({mid} to {endDate}). Same GSC snapshot. A class fix, not a new page.
      </p>
      <DataList
        label="Slipping queries"
        rows={slipping}
        cap={10}
        rowKey={(r) => r.key}
        columns={[
          { key: 'query', header: 'Query', lead: true, cell: (r) => stripQ(r.key) },
          { key: 'earlier', header: 'Clicks first half', num: true, cell: (r) => fmt(r.earlier) },
          { key: 'later', header: 'Clicks second half', num: true, cell: (r) => fmt(r.later) },
          {
            key: 'delta',
            header: 'Change',
            num: true,
            cell: (r) => <span style={{ color: 'var(--a-warn)' }}>{fmt(r.delta)}</span>,
          },
        ]}
        empty={<>No query lost clicks across the two halves of this range, or GSC has not synced yet.</>}
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
    <section aria-label="Opportunity queries">
      <SectionHead>Opportunity queries — easy SEO wins</SectionHead>
      <p className="av2-note">
        Queries you already RANK for (position 1-20) and get IMPRESSIONS for (30+), but visitors are not clicking (CTR under 2%). Fix the page title and meta description and the clicks usually jump in days.
      </p>
      <DataList
        label="Opportunity queries"
        rows={opp}
        cap={10}
        rowKey={(r) => r.key}
        columns={[
          { key: 'query', header: 'Query', lead: true, cell: (r) => stripQ(r.key) },
          { key: 'impr', header: 'Impressions', num: true, cell: (r) => fmt(r.impressions) },
          { key: 'ctr', header: 'CTR', num: true, cell: (r) => <span style={{ color: 'var(--a-warn)' }}>{pct(r.ctr)}</span> },
          { key: 'pos', header: 'Position', num: true, cell: (r) => pos(r.position) },
          { key: 'potential', header: 'Potential clicks', num: true, cell: (r) => <span style={{ color: 'var(--a-ok)', fontWeight: 600 }}>{`+${fmt(r.potential)}`}</span> },
        ]}
        empty={<>No opportunity queries surfaced. Either nothing has a high-impression low-CTR gap right now, or GSC data has not synced for this range.</>}
      />
    </section>
  )
}

async function TopPages({ sinceDate, endDate }: { sinceDate: string; endDate: string }) {
  const rows = await aggBy('page', sinceDate, endDate)
  const top = rows.sort((a, b) => b.clicks - a.clicks)
  return (
    <section aria-label="Top pages by clicks">
      <SectionHead>Top pages by clicks</SectionHead>
      <p className="av2-note">Which pages on ryan-realty.com pulled the most organic traffic from Google.</p>
      <DataList
        label="Top pages by clicks"
        rows={top}
        cap={10}
        rowKey={(r) => r.key}
        columns={[
          {
            key: 'page',
            header: 'Page',
            lead: true,
            cell: (r) => (
              <a href={r.key} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--a-accent)' }}>
                {stripP(r.key)}
              </a>
            ),
          },
          { key: 'clicks', header: 'Clicks', num: true, cell: (r) => fmt(r.clicks) },
          { key: 'impr', header: 'Impressions', num: true, cell: (r) => fmt(r.impressions) },
          { key: 'ctr', header: 'CTR', num: true, cell: (r) => pct(r.ctr) },
          { key: 'pos', header: 'Position', num: true, cell: (r) => pos(r.position) },
        ]}
        empty={<>No GSC page data for this date range.</>}
      />
    </section>
  )
}

export default async function GscPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <p className="av2-note">
        What people search to find Ryan Realty, which pages rank for what, and where the easy SEO wins are. Sourced from the GSC snapshot cron. GSC data has a 2-3 day processing lag.
      </p>
      <RangeControl current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      <Suspense fallback={<Loading what="Search Console totals" />}><HeadlineKpis sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
      <Suspense fallback={<Loading what="slipping queries" />}><SlippingQueries sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
      <Suspense fallback={<Loading what="opportunity queries" />}><OpportunityQueries sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
      <Suspense fallback={<Loading what="top queries" />}><TopQueries sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
      <Suspense fallback={<Loading what="top pages" />}><TopPages sinceDate={range.startDate} endDate={range.endDate} /></Suspense>
    </div>
  )
}
