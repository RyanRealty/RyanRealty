// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/analytics/cost-per-lead - the number that decides paid-spend strategy.
 *
 * Joins paid spend (marketing_channel_daily, channel=meta_ads/google_ads,
 * metric=spend) with REAL inbound leads (getLeadIntake, from crm_people). The old
 * CRM channel='fub' qualified_seller_leads plane was decommissioned at the 2026-06
 * cutover (writer removed) — do not restore it. The denominator is ALL inbound
 * leads, so cost-per-lead here is BLENDED, not paid-only (see the page caveat).
 * Drill-down: by campaign and by week so the trend is visible.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — the superuser gate (analytics/layout.tsx), both spend reads,
 * the paged visitor_sessions read, getLeadIntake, isoWeekStart, every weekly
 * bucket, the closedDataAvailable flag, the CPL thresholds (green < $75, amber
 * $75-$150, red >= $150) and the ?range/?startDate/?endDate handling are carried
 * over verbatim.
 */
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { getLeadIntake } from '@/lib/data/crm/getLeadIntake'
import { SectionHead, StateWord, VerdictLine, type AdminState } from '@/components/admin/v2'
import { DataGrid, GridSkeleton, LaneNote, NumberStrip, Stamp, StatePanel } from '../_components/v2/DataGrid'
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

/** The locked CPL bands, unchanged: green < $75 · amber $75-$150 · red >= $150. */
function cplState(cpl: number | null): AdminState {
  if (cpl == null) return 'waiting'
  return cpl < 75 ? 'ok' : cpl < 150 ? 'slow' : 'down'
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
  // Leads come from getLeadIntake (real crm_people inbound leads, per-day), NOT the
  // dead marketing_channel_daily channel='fub' metrics whose writer was removed at
  // the 2026-06 CRM cutover — those returned 0 forever, so every CPL read "—" and
  // the page (named for the owner's core question) was permanently broken.
  // deals_closed_won / closed_deal_volume_usd have no live source at all (they need
  // the transaction ledger, rebuild spec 05/06) — shown as "—", never a fake 0.
  const [spendRes, gadsSpendRes, identifiedRes, intake] = await Promise.all([
    supabase.from('marketing_channel_daily')
      .select('date, scope_id, value, metadata')
      .eq('channel', 'meta_ads').eq('scope', 'campaign').eq('metric', 'spend')
      .gte('date', cutoff),
    supabase.from('marketing_channel_daily')
      .select('date, scope_id, value, metadata')
      .eq('channel', 'google_ads').eq('scope', 'campaign').eq('metric', 'spend')
      .gte('date', cutoff),
    // From visitor_sessions: identified-from-FB count per day. Paged read —
    // PostgREST caps single responses at 1,000 rows, so the old .limit(20000)
    // silently truncated there and undercounted sessions.
    fetchPagedRows<{ first_seen_at: string; utm_source: string | null; identified_at: string | null; hot_lead_fired_at: string | null }>(
      (from, to) =>
        supabase.from('visitor_sessions')
          .select('first_seen_at, utm_source, identified_at, hot_lead_fired_at')
          .gte('first_seen_at', sinceTs)
          .lte('first_seen_at', endTs)
          .order('session_id', { ascending: true })
          .range(from, to),
      20000,
    ),
    getLeadIntake({ startIso: sinceTs, endIso: endTs }),
  ])
  // Closed-deal figures have no live source yet — flagged so the tiles render "—".
  const closedDataAvailable = false

  if (spendRes.error) {
    return (
      <StatePanel tone="error">
        spend read failed: {spendRes.error.message}. Reload once the read recovers; the marketing_channel_daily spend
        rows are written by the Meta/Google snapshot crons.
      </StatePanel>
    )
  }

  const sessionsCapped = identifiedRes.rows.length === 20000

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
  // Real inbound leads per day from getLeadIntake, bucketed into weeks. There is no
  // separate "qualified seller" sub-count (that was the dead CRM metric), so both
  // fields hold the one real lead number. closedWon/closedVolume have no source and
  // stay 0 → rendered as "—" via closedDataAvailable.
  for (const day of intake.byDay) {
    const b = bucket(isoWeekStart(day.date))
    b.qualifiedLeads += day.inbound
    b.newLeads += day.inbound
  }
  for (const row of identifiedRes.rows) {
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

  const weekRows = weeks.map(([wk, b]) => ({ wk, b }))

  return (
    <>
      <VerdictLine tone={last7Cpl == null ? 'attention' : cplState(last7Cpl) === 'down' ? 'attention' : 'ok'}>
        {last7Cpl == null ? (
          <>
            <b>No cost per lead this week.</b> Either no paid spend synced or no inbound leads landed.
          </>
        ) : (
          <>
            <b>{formatUsd(last7Cpl)} per lead this week</b>
            {last4Cpl != null ? <> against a 4-week average of {formatUsd(last4Cpl)}.</> : <>.</>}
          </>
        )}
      </VerdictLine>

      {sessionsCapped && (
        <StatePanel tone="error">
          Showing first 20,000 visitor sessions — result capped. Narrow the date range to see complete data.
        </StatePanel>
      )}

      <NumberStrip
        items={[
          { label: 'Cost / lead (wk)', value: last7Cpl == null ? null : formatUsd(last7Cpl), caption: last4Cpl != null ? `4-wk avg ${formatUsd(last4Cpl)}` : undefined },
          { label: 'Paid spend this week', value: formatUsd(last7Spend), caption: `Meta ${formatUsd(weeks[0]?.[1].metaSpend ?? 0)} · Google ${formatUsd(weeks[0]?.[1].googleSpend ?? 0)}` },
          { label: 'New leads (wk)', value: formatInt(last7Qualified), href: '/admin/reports/leads' },
          { label: 'FB identified (wk)', value: formatInt(last7FbIdentified), caption: last7CplIdentified != null ? `${formatUsd(last7CplIdentified)} / id` : undefined },
          { label: 'Closed deals (90d)', value: closedDataAvailable ? formatInt(totals90.closedWon) : null, caption: closedDataAvailable ? `${formatUsd(totals90.closedVolume)} volume` : 'ledger reconnecting', href: '/admin/closings' },
          { label: 'Spend / closing (90d)', value: closedDataAvailable && costPerClosed90 != null ? formatUsd(costPerClosed90) : null, caption: closedDataAvailable ? 'blended, all sources' : 'ledger reconnecting' },
        ]}
      />

      <section aria-label="Weekly trend">
        <SectionHead>Weekly trend</SectionHead>
        <LaneNote>
          Combined paid spend (Meta + Google Ads, broken out per column) joined with real inbound leads (getLeadIntake,
          from crm_people). Cost-per-lead is the headline column. If you spent $400 last week and got 4 leads, you paid
          $100 per. Compare week-over-week and against the 4-week average above.
        </LaneNote>
        <DataGrid
          label="Weekly cost per lead"
          rows={weekRows}
          cap={12}
          minWidth={900}
          getRowKey={(r) => r.wk}
          columns={[
            { key: 'week', header: 'Week of', width: '120px', cell: (r) => <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.wk}</span> },
            { key: 'spend', header: 'Spend', numeric: true, cell: (r) => formatUsd(r.b.spend) },
            { key: 'qual', header: 'New leads', numeric: true, cell: (r) => formatInt(r.b.qualifiedLeads) },
            {
              key: 'cpl',
              header: 'Cost / lead',
              width: '130px',
              cell: (r) => {
                const cpl = r.b.qualifiedLeads > 0 ? r.b.spend / r.b.qualifiedLeads : null
                return <StateWord state={cplState(cpl)}>{cpl == null ? '—' : formatUsd(cpl)}</StateWord>
              },
            },
            { key: 'closed', header: 'Closed deals', numeric: true, cell: () => (closedDataAvailable ? formatInt(0) : '—') },
            { key: 'fbSessions', header: 'FB sessions', numeric: true, cell: (r) => formatInt(r.b.fbSessions) },
            { key: 'fbId', header: 'FB identified', numeric: true, cell: (r) => formatInt(r.b.fbIdentified) },
            { key: 'fbHot', header: 'FB hot', numeric: true, cell: (r) => formatInt(r.b.fbHot) },
          ]}
          empty={
            <>
              No paid-ad spend or lead data in the last 90 days. Once the Meta/Google spend cron populates, weekly
              cost-per-lead appears here.
            </>
          }
        />
        <Stamp>
          Cost-per-lead band: green &lt; $75, amber $75-$150, red &gt;= $150. Industry HNW seller benchmarks land in the
          $80-$120 range; consistent reds mean creative + audience need a rebuild, not more spend.
        </Stamp>
      </section>

      {weeks[0] && weeks[0][1].campaigns.size > 0 && (() => {
        const weekSpend = weeks[0][1].spend
        const campaignRows = Array.from(weeks[0][1].campaigns.entries()).sort((a, b) => b[1] - a[1]).map(([name, spend]) => ({ name, spend }))
        return (
          <section aria-label="This week by campaign">
            <SectionHead>This week by campaign</SectionHead>
            <DataGrid
              label="This week by campaign"
              rows={campaignRows}
              cap={10}
              minWidth={620}
              getRowKey={(r) => r.name}
              columns={[
                { key: 'name', header: 'Campaign', width: '1.6fr', cell: (r) => <span style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-xs)' }}>{r.name}</span> },
                { key: 'spend', header: 'Spend this week', numeric: true, cell: (r) => formatUsd(r.spend) },
                { key: 'share', header: 'Share of week', numeric: true, cell: (r) => (weekSpend > 0 ? `${((r.spend / weekSpend) * 100).toFixed(1)}%` : '—') },
              ]}
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
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 var(--a-s5)' }}>
        <DateRangePicker current={sp.range ?? '90d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </div>

      <Suspense fallback={<GridSkeleton rows={6} label="Loading cost per lead" />}>
        <CostPerLead range={range} />
      </Suspense>

      <Stamp>
        Blended: paid spend (Meta + Google) divided by ALL inbound leads that week. The denominator includes leads from
        every source (Zillow, organic, phone, referral), not only paid ads, so true cost-per-paid-lead is higher than
        shown. Read it as a directional trend, not a precise paid-ad CPL.
      </Stamp>
    </div>
  )
}
