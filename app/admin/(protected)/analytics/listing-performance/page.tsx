/**
 * /admin/analytics/listing-performance - which listings get the most attention.
 *
 * Aggregates visitor_events of type listing_view by MLS number (last 30
 * days). Surfaces: total views, unique sessions, identified visitors,
 * hot leads, average price, top traffic source. Tells the broker which
 * listings to lean into for marketing and which are underperforming.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Data access moved into lib/data/analytics/getListingPerformance.ts (G1 DAL
 * boundary) — the visitor_events / visitor_sessions reads, the 50,000-row cap,
 * the per-listing aggregation, and the identify-rate computation are carried
 * over verbatim, just relocated.
 */
import { Suspense } from 'react'
import { getListingPerformance } from '@/lib/data/analytics/getListingPerformance'
import { SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'
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

function fmtInt(n: number): string { return new Intl.NumberFormat('en-US').format(n) }
function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

async function ListingLeaderboard({ range }: { range: { startDate: string; endDate: string } }) {
  const { rows, totalViews, totalIdentified, totalHot, eventsCapped, unreadable, errorMessage } =
    await getListingPerformance({ startDate: range.startDate, endDate: range.endDate })

  if (unreadable) {
    return (
      <Trouble>
        Could not load listing events{errorMessage ? `: ${errorMessage}` : ''}. The read hit Supabase directly —
        retry, and if it keeps failing check the service-role key before trusting anything on this page.
      </Trouble>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="av2-empty">
        No listing-detail page views captured for {range.startDate} to {range.endDate} yet. Once visitors browse listings with consent granted, the leaderboard fills in. Listing views weight 10 points each in the engagement score.
      </div>
    )
  }

  return (
    <>
      <VerdictLine tone={totalHot > 0 ? 'attention' : 'ok'}>
        {totalHot > 0 ? (
          <>
            <b>{fmtInt(totalHot)} hot lead{totalHot === 1 ? '' : 's'}</b> viewed a listing in this window, across {fmtInt(rows.length)} listing{rows.length === 1 ? '' : 's'}.
          </>
        ) : (
          <>
            <b>{fmtInt(rows.length)} listing{rows.length === 1 ? '' : 's'} drew views</b> in this window. No session crossed the hot threshold.
          </>
        )}
      </VerdictLine>
      {eventsCapped && (
        <p className="av2-note" style={{ color: 'var(--a-warn)' }}>
          Showing first 50,000 events — result capped. Narrow the date range to see complete data.
        </p>
      )}
      <Figures
        figures={[
          { label: 'Listings viewed', value: fmtInt(rows.length) },
          { label: `Total views (${range.startDate} to ${range.endDate})`, value: fmtInt(totalViews) },
          { label: 'Identified', value: fmtInt(totalIdentified) },
          { label: 'Hot leads', value: fmtInt(totalHot), tone: totalHot > 0 ? 'ok' : undefined },
        ]}
      />

      <section aria-label="Listing performance">
        <SectionHead>Listing performance ({range.startDate} to {range.endDate})</SectionHead>
        <p className="av2-note">
          Ranked by total views. Identify rate is the share of unique visitors who signed in or converted while viewing this listing. Hot column is sessions that crossed score 100 anywhere in the funnel and viewed this listing along the way.
        </p>
        <DataList
          label="Listing performance"
          rows={rows}
          cap={12}
          rowKey={(r) => r.mls}
          columns={[
            {
              key: 'listing',
              header: 'Listing',
              lead: true,
              cell: (r, i) => (
                <>
                  <a href={r.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--a-accent)' }}>
                    MLS {r.mls}
                  </a>
                  {i < 3 ? <> <StateWord state="accent">top {i + 1}</StateWord></> : null}
                  <span style={{ display: 'block', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{r.address}</span>
                </>
              ),
            },
            { key: 'city', header: 'City', cell: (r) => r.city },
            { key: 'price', header: 'Price', num: true, cell: (r) => fmtUsd(r.price) },
            { key: 'views', header: 'Views', num: true, cell: (r) => fmtInt(r.views) },
            { key: 'unique', header: 'Unique', num: true, cell: (r) => fmtInt(r.uniqueVisitors) },
            { key: 'identified', header: 'Identified', num: true, cell: (r) => fmtInt(r.identified) },
            { key: 'idrate', header: 'ID rate', num: true, cell: (r) => `${(r.identifyRate * 100).toFixed(1)}%` },
            { key: 'hot', header: 'Hot', num: true, cell: (r) => fmtInt(r.hot) },
            { key: 'source', header: 'Top source', cell: (r) => r.topSource },
          ]}
          empty={<>No listing-detail page views captured in the last 30 days yet. Once visitors browse listings with consent granted, the leaderboard fills in.</>}
        />
        <p className="av2-note">
          If a listing is repeatedly getting many views but a low identify rate, the listing detail page is hooking attention without converting. Worth reviewing the photo gallery, description, or video tour for that listing.
        </p>
      </section>
    </>
  )
}

export default async function ListingPerformancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <p className="av2-note">
        Which listings drive the most engagement, and which converted visitors into identified leads. Sourced from <code>visitor_events</code> where event_type = listing_view.
      </p>
      <RangeControl current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />

      <Suspense fallback={<Loading what="listing views" />}>
        <ListingLeaderboard range={range} />
      </Suspense>
    </div>
  )
}
