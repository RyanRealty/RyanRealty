// @no-parity — internal admin surface, no public mockup contract
// /admin/analytics/google-business-profile — GBP dashboard.
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Presentation only. The superuser gate (analytics/layout.tsx), the service-role
// read of marketing_channel_daily (channel='gbp', scope='account'), the prior-
// period window math, the METRICS list, and the ?range/?startDate/?endDate
// handling are carried over verbatim. DateRangePicker stays as-is — it is shared
// with the rest of the analytics family and owns the query-param contract.
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { DataGrid, GridSkeleton, LaneNote, Stamp } from '../_components/v2/DataGrid'
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
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

const METRICS: Array<{ key: string; label: string; help: string }> = [
  { key: 'business_impressions_desktop_search', label: 'Desktop Search impressions', help: 'Profile appeared in Google Search on desktop' },
  { key: 'business_impressions_mobile_search', label: 'Mobile Search impressions', help: 'Profile appeared in Google Search on mobile' },
  { key: 'business_impressions_desktop_maps', label: 'Desktop Maps impressions', help: 'Profile appeared in Google Maps on desktop' },
  { key: 'business_impressions_mobile_maps', label: 'Mobile Maps impressions', help: 'Profile appeared in Google Maps on mobile' },
  { key: 'website_clicks', label: 'Website clicks', help: 'Clicked website link from GBP' },
  { key: 'call_clicks', label: 'Phone calls', help: 'Tapped call button (mobile)' },
  { key: 'business_direction_requests', label: 'Direction requests', help: 'Asked for driving directions' },
  { key: 'business_bookings', label: 'Bookings', help: 'Via GBP booking widget' },
  { key: 'business_conversations', label: 'GBP chats', help: 'Messages sent via GBP chat' },
]

async function fetchPeriod(sinceDate: string, untilDate?: string) {
  const q = sup().from('marketing_channel_daily').select('metric, value')
    .eq('channel', 'gbp').eq('scope', 'account').gte('date', sinceDate)
  const { data } = await (untilDate ? q.lt('date', untilDate) : q)
  const out: Record<string, number> = {}
  for (const r of ((data ?? []) as Array<{ metric: string; value: number }>)) {
    out[r.metric] = (out[r.metric] ?? 0) + (Number(r.value) || 0)
  }
  return out
}

async function Headlines({ startDate, endDate }: { startDate: string; endDate: string }) {
  // Compute prior period of same length for comparison
  const startMs = new Date(`${startDate}T00:00:00Z`).getTime()
  const endMs = new Date(`${endDate}T00:00:00Z`).getTime()
  const windowMs = endMs - startMs
  const priorEndDate = startDate
  const priorStartDate = new Date(startMs - windowMs).toISOString().slice(0, 10)
  const [cur, prior] = await Promise.all([fetchPeriod(startDate, endDate), fetchPeriod(priorStartDate, priorEndDate)])
  const totalImpressions = (cur.business_impressions_desktop_search || 0) + (cur.business_impressions_mobile_search || 0)
    + (cur.business_impressions_desktop_maps || 0) + (cur.business_impressions_mobile_maps || 0)
  const priorImpressions = (prior.business_impressions_desktop_search || 0) + (prior.business_impressions_mobile_search || 0)
    + (prior.business_impressions_desktop_maps || 0) + (prior.business_impressions_mobile_maps || 0)
  const actions = (cur.website_clicks || 0) + (cur.call_clicks || 0) + (cur.business_direction_requests || 0)
  const priorActions = (prior.website_clicks || 0) + (prior.call_clicks || 0) + (prior.business_direction_requests || 0)
  const actionRate = totalImpressions > 0 ? actions / totalImpressions : 0
  const priorActionRate = priorImpressions > 0 ? priorActions / priorImpressions : 0

  function delta(cur: number, prior: number) {
    if (prior === 0) return null
    const d = ((cur - prior) / prior) * 100
    return { arrow: d > 0 ? '↑' : d < 0 ? '↓' : '→', pct: `${Math.abs(d).toFixed(0)}%`, up: d > 0 }
  }
  function T(cur: number, prior: number, betterUp = true) {
    const t = delta(cur, prior); if (!t) return null
    const good = betterUp ? t.up : !t.up
    return (
      <p
        style={{
          fontSize: 'var(--a-text-xs)',
          fontVariantNumeric: 'tabular-nums',
          color: good ? 'var(--a-ok)' : 'var(--a-danger)',
          margin: 0,
        }}
      >
        {t.arrow} {t.pct} vs prior period
      </p>
    )
  }

  const headline: Array<{ label: string; value: string; trend: React.ReactNode }> = [
    { label: 'Total impressions', value: fmt(totalImpressions), trend: T(totalImpressions, priorImpressions) },
    { label: 'Actions taken', value: fmt(actions), trend: T(actions, priorActions) },
    { label: 'Action rate', value: `${(actionRate * 100).toFixed(2)}%`, trend: T(actionRate, priorActionRate) },
    { label: 'Phone calls', value: fmt(cur.call_clicks || 0), trend: T(cur.call_clicks || 0, prior.call_clicks || 0) },
  ]

  return (
    <>
      <VerdictLine tone={actions > 0 ? 'ok' : 'attention'}>
        <b>
          {fmt(totalImpressions)} impressions, {fmt(actions)} actions
        </b>{' '}
        from Google Maps and local Search, {startDate} to {endDate}.
      </VerdictLine>
      <LaneNote>Every trend below compares against the prior period of equal length.</LaneNote>
      <div className="av2-week" style={{ margin: 'var(--a-s4) 0 var(--a-s5)' }}>
        {headline.map((h) => (
          <span key={h.label} className="av2-wk" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            <span className="av2-wk__n">{h.value}</span>
            <span className="av2-wk__l">{h.label}</span>
            {h.trend}
          </span>
        ))}
      </div>
    </>
  )
}

async function MetricBreakdown({ startDate, endDate }: { startDate: string; endDate: string }) {
  const cur = await fetchPeriod(startDate, endDate)
  const rows = METRICS.map((m) => ({ ...m, value: cur[m.key] || 0 }))
  return (
    <section aria-label="Full metric breakdown">
      <SectionHead>Full metric breakdown</SectionHead>
      <LaneNote>
        Every GBP signal we collect. Mobile Search impressions usually dominates for local real estate (most &ldquo;realtor
        near me&rdquo; searches happen on phone).
      </LaneNote>
      <DataGrid
        label="GBP metric breakdown"
        rows={rows}
        cap={METRICS.length}
        minWidth={560}
        getRowKey={(r) => r.key}
        columns={[
          { key: 'label', header: 'Signal', width: '1.1fr', cell: (r) => r.label },
          { key: 'help', header: 'What it means', width: '1.4fr', cell: (r) => <span style={{ color: 'var(--a-text-2)' }}>{r.help}</span> },
          { key: 'value', header: 'Count', width: '110px', numeric: true, cell: (r) => fmt(r.value) },
        ]}
        empty={
          <>
            No GBP signals recorded {startDate} to {endDate}. The GBP snapshot cron writes into
            marketing_channel_daily — widen the date range or check that the cron ran.
          </>
        }
      />
      <Stamp>
        Window {startDate} to {endDate} · source marketing_channel_daily, channel=gbp, scope=account.
      </Stamp>
    </section>
  )
}

export default async function GbpPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <Suspense fallback={<GridSkeleton rows={3} label="Loading GBP headlines" />}>
        <Headlines startDate={range.startDate} endDate={range.endDate} />
      </Suspense>

      <div style={{ margin: '0 0 var(--a-s5)' }}>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </div>

      <Suspense fallback={<GridSkeleton rows={6} label="Loading GBP metrics" />}>
        <MetricBreakdown startDate={range.startDate} endDate={range.endDate} />
      </Suspense>

    </div>
  )
}
