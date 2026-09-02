// /admin/analytics/google-search - surfaces GSC data from marketing_channel_daily.
// Top queries, top pages, easy wins.
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Data access moved into lib/data/analytics/getGscMetrics.ts (G1 DAL boundary) —
// every query, aggregation, filter, expected-CTR constant and date-range
// contract is carried over verbatim, just relocated.
import { Suspense } from 'react'
import { getGscAccountTotals, getGscScopeAggregate } from '@/lib/data/analytics/getGscMetrics'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { DataList, Figures, Loading, Trouble } from '../_components/v2/kit'
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

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)
const pct = (n: number) => `${(n * 100).toFixed(2)}%`
const pos = (n: number) => n > 0 ? n.toFixed(1) : '—'
const stripQ = (s: string) => s.startsWith('query:') ? s.slice(6) : s
const stripP = (s: string) => { try { return new URL(s).pathname || '/' } catch { return s } }

async function HeadlineKpis({ sinceDate, endDate }: { sinceDate: string; endDate: string }) {
  const c = await getGscAccountTotals(sinceDate, endDate)
  if (c.unreadable) {
    return (
      <Trouble>
        Could not load Search Console totals from marketing_channel_daily. Retry — until it reads,
        treat this page&apos;s figures as unknown, not as zero.
      </Trouble>
    )
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
  const { rows: agg, unreadable } = await getGscScopeAggregate('campaign', sinceDate, endDate)
  if (unreadable) {
    return <Trouble>Could not load top queries from marketing_channel_daily. Retry before trusting this section.</Trouble>
  }
  const top = agg.sort((a, b) => b.clicks - a.clicks)
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
  const [earlierRes, laterRes] = await Promise.all([
    getGscScopeAggregate('campaign', sinceDate, mid),
    getGscScopeAggregate('campaign', mid, endDate),
  ])
  if (earlierRes.unreadable || laterRes.unreadable) {
    return <Trouble>Could not load slipping queries from marketing_channel_daily. Retry before trusting this section.</Trouble>
  }
  const earlier = earlierRes.rows
  const later = laterRes.rows
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
  const { rows, unreadable } = await getGscScopeAggregate('campaign', sinceDate, endDate)
  if (unreadable) {
    return <Trouble>Could not load opportunity queries from marketing_channel_daily. Retry before trusting this section.</Trouble>
  }
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
  const { rows, unreadable } = await getGscScopeAggregate('page', sinceDate, endDate)
  if (unreadable) {
    return <Trouble>Could not load top pages from marketing_channel_daily. Retry before trusting this section.</Trouble>
  }
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
