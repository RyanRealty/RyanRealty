// @no-parity — internal admin analytics page, superuser-only, no public mockup contract.
/**
 * /admin/analytics/ad-roi — the plain-English answer to "is my ad money
 * turning into real leads, am I wasting it, what's my return?"
 *
 * This page joins three live feeds and says, in plain words, what they add up to:
 *   - Ad spend          → marketing_channel_daily (channel=meta_ads / google_ads, metric=spend)
 *   - Site visitors     → visitor_sessions (utm_source → channel, identified_at, fub_person_id, hot_lead_fired_at)
 *   - Leads             → getLeadIntake (real crm_people inbound leads; the dead FUB channel='fub' plane was decommissioned 2026-06)
 *   - FB lead forms     → processed_meta_leads (campaign_name + fub_person_id)
 *
 * Design intent: honest first. When a data pipe is dry (no spend synced, no
 * visitor matched to a name, no lead-form captured), the page says so in plain
 * language instead of showing a confident-looking but empty table. Every number
 * shows its own math so it traces to source. True return-on-ad-spend (revenue ÷
 * spend) is NOT computable yet because closed-deal commission is not wired to a
 * lead source. The page is explicit about that rather than faking a number.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — the superuser gate (analytics/layout.tsx), all five reads,
 * channelOf / isPaidChannel, every spend, session, ratio and data-health
 * computation, and the ?range/?startDate/?endDate handling are carried over
 * verbatim.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { getLeadIntake } from '@/lib/data/crm/getLeadIntake'
import { SectionHead, StateWord, VerdictLine, type AdminState } from '@/components/admin/v2'
import { DataGrid, GridSkeleton, LaneNote, NumberStrip, Stamp, StatePanel } from '../_components/v2/DataGrid'
import { formatInt, formatUsd } from '../_lib/formatters'
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
function daysSince(dateStr: string): number {
  const then = new Date(`${dateStr}T00:00:00Z`).getTime()
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000))
}
function usdOrDash(n: number | null): string {
  return n == null ? '—' : formatUsd(n)
}

/** Map a raw utm_source to a friendly channel name a human reads at a glance. */
function channelOf(utmSource: string | null): string {
  const s = (utmSource || '').toLowerCase().trim()
  if (!s) return 'Direct / unknown'
  if (/(facebook|fb|instagram|^ig$|meta)/.test(s)) return 'Facebook / Instagram'
  if (/(google|adwords|gads)/.test(s)) return 'Google'
  if (/(bing|microsoft)/.test(s)) return 'Bing'
  if (s === 'direct') return 'Direct / unknown'
  if (s === 'gbp') return 'Google Business Profile'
  if (/(tiktok)/.test(s)) return 'TikTok'
  if (/(youtube|yt)/.test(s)) return 'YouTube'
  if (/(linkedin)/.test(s)) return 'LinkedIn'
  return utmSource as string
}
/** A paid channel is one we can plausibly attribute to ad spend. */
function isPaidChannel(channel: string): boolean {
  return channel === 'Facebook / Instagram' || channel === 'Google' || channel === 'Bing'
}

type SpendRow = { date: string; value: number; scope_id?: string | null; metadata?: Record<string, unknown> | null }
type MetricRow = { date: string; metric: string; value: number }
type DailyValueRow = { date: string; value: number }
type SessionRow = {
  first_seen_at: string
  utm_source: string | null
  utm_campaign: string | null
  identified_at: string | null
  fub_person_id: number | null
  hot_lead_fired_at: string | null
}

async function AdRoi({ range }: { range: { startDate: string; endDate: string } }) {
  const supabase = getServiceSupabase()
  const sinceDate = range.startDate
  const sinceTs = `${range.startDate}T00:00:00.000Z`
  const windowLabel = `${range.startDate} to ${range.endDate}`

  const [
    metaAcctRes,
    metaCampRes,
    googleAcctRes,
    sessionsRes,
    leadFormCountRes,
    intake,
  ] = await Promise.all([
    // Meta account-scope metrics (authoritative daily totals, no double-count).
    supabase.from('marketing_channel_daily')
      .select('date, metric, value')
      .eq('channel', 'meta_ads').eq('scope', 'account')
      .in('metric', ['spend', 'impressions', 'clicks', 'conversions'])
      .gte('date', sinceDate),
    // Meta campaign-scope spend (for the per-campaign breakdown only).
    supabase.from('marketing_channel_daily')
      .select('date, scope_id, value, metadata')
      .eq('channel', 'meta_ads').eq('scope', 'campaign').eq('metric', 'spend')
      .gte('date', sinceDate),
    // Google Ads account-scope spend.
    supabase.from('marketing_channel_daily')
      .select('date, value')
      .eq('channel', 'google_ads').eq('scope', 'account').eq('metric', 'spend')
      .gte('date', sinceDate),
    // Site sessions with their source + identity state. Paged read —
    // PostgREST caps single responses at 1,000 rows, so the old .limit(20000)
    // silently truncated there.
    fetchPagedRows<SessionRow>(
      (from, to) =>
        supabase.from('visitor_sessions')
          .select('first_seen_at, utm_source, utm_campaign, identified_at, fub_person_id, hot_lead_fired_at')
          .gte('first_seen_at', sinceTs)
          .lte('first_seen_at', `${range.endDate}T23:59:59.999Z`)
          .order('session_id', { ascending: true })
          .range(from, to),
      20000,
    ),
    // Facebook lead-form submissions captured (count only).
    supabase.from('processed_meta_leads')
      .select('leadgen_id', { count: 'exact', head: true }),
    // Leads = real crm_people inbound via getLeadIntake, NOT the dead
    // marketing_channel_daily channel='fub' metrics (writer removed 2026-06 → always
    // 0, so this page's lead + ROI numbers were permanently broken).
    getLeadIntake({ startIso: sinceTs, endIso: `${range.endDate}T23:59:59.999Z` }),
  ])

  const firstErr = [metaAcctRes, metaCampRes, googleAcctRes]
    .find((r) => r.error) as { error: { message: string } | null } | undefined
  if (firstErr?.error) {
    return (
      <StatePanel tone="error">
        Data read failed: {firstErr.error.message}. Reload once the read recovers, or narrow the date range.
      </StatePanel>
    )
  }

  // ── Spend totals ───────────────────────────────────────────────────────────
  const metaAcct = (metaAcctRes.data ?? []) as MetricRow[]
  let metaSpend = 0, metaImpressions = 0, metaClicks = 0, metaConversions = 0
  let latestSpendDate: string | null = null
  for (const r of metaAcct) {
    const v = Number(r.value) || 0
    if (r.metric === 'spend') {
      metaSpend += v
      if (v > 0 && (!latestSpendDate || r.date > latestSpendDate)) latestSpendDate = r.date
    } else if (r.metric === 'impressions') metaImpressions += v
    else if (r.metric === 'clicks') metaClicks += v
    else if (r.metric === 'conversions') metaConversions += v
  }
  let googleSpend = 0
  for (const r of (googleAcctRes.data ?? []) as DailyValueRow[]) {
    const v = Number(r.value) || 0
    googleSpend += v
    if (v > 0 && (!latestSpendDate || r.date > latestSpendDate)) latestSpendDate = r.date
  }
  const totalSpend = metaSpend + googleSpend

  // Daily spend series (Meta + Google combined) for the small timeline.
  const spendByDate = new Map<string, number>()
  for (const r of metaAcct) {
    if (r.metric !== 'spend') continue
    spendByDate.set(r.date, (spendByDate.get(r.date) ?? 0) + (Number(r.value) || 0))
  }
  for (const r of (googleAcctRes.data ?? []) as DailyValueRow[]) {
    spendByDate.set(r.date, (spendByDate.get(r.date) ?? 0) + (Number(r.value) || 0))
  }
  const spendDays = Array.from(spendByDate.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[0].localeCompare(a[0]))

  // Per-campaign Meta spend.
  const campaignSpend = new Map<string, number>()
  for (const r of (metaCampRes.data ?? []) as SpendRow[]) {
    const name = (r.metadata as { campaign_name?: string } | null)?.campaign_name || r.scope_id || 'unnamed campaign'
    campaignSpend.set(name, (campaignSpend.get(name) ?? 0) + (Number(r.value) || 0))
  }
  const campaigns = Array.from(campaignSpend.entries()).sort((a, b) => b[1] - a[1])

  // ── Leads (FUB account metrics) ──────────────────────────────────────────────
  // Real inbound leads from crm_people (getLeadIntake). There is no separate live
  // "qualified seller" sub-count, so the ROI math uses the one real lead number.
  const newLeads = intake.inboundLeads

  // ── Sessions by channel ──────────────────────────────────────────────────────
  const sessions = sessionsRes.rows
  const sessionsCapped = sessions.length === 20000
  type ChannelAgg = { sessions: number; identified: number; hot: number }
  const byChannel = new Map<string, ChannelAgg>()
  let totalSessions = 0, totalIdentified = 0, totalHot = 0, paidSessions = 0
  let earliestSession: string | null = null, latestSession: string | null = null
  for (const s of sessions) {
    const ch = channelOf(s.utm_source)
    let agg = byChannel.get(ch)
    if (!agg) { agg = { sessions: 0, identified: 0, hot: 0 }; byChannel.set(ch, agg) }
    agg.sessions += 1
    totalSessions += 1
    if (isPaidChannel(ch)) paidSessions += 1
    if (s.identified_at || s.fub_person_id) { agg.identified += 1; totalIdentified += 1 }
    if (s.hot_lead_fired_at) { agg.hot += 1; totalHot += 1 }
    const d = s.first_seen_at.slice(0, 10)
    if (!earliestSession || d < earliestSession) earliestSession = d
    if (!latestSession || d > latestSession) latestSession = d
  }
  const channelRows = Array.from(byChannel.entries()).sort((a, b) => b[1].sessions - a[1].sessions)

  const leadFormCount = leadFormCountRes.count ?? 0

  // ── Derived ratios (each carries its own math so it traces to source) ────────
  const blendedCostPerLead = totalSpend > 0 && newLeads > 0 ? totalSpend / newLeads : null
  const metaCpc = metaClicks > 0 ? metaSpend / metaClicks : null
  const metaCtr = metaImpressions > 0 ? metaClicks / metaImpressions : null

  // ── Data-health flags ────────────────────────────────────────────────────────
  const spendStaleDays = latestSpendDate ? daysSince(latestSpendDate) : null
  const spendHealthy = spendStaleDays != null && spendStaleDays <= 2
  const identityWorking = totalIdentified > 0
  const leadFormWorking = leadFormCount > 0

  const metaRows = metaSpend === 0 ? [] : [
    { label: 'Spend', value: formatUsd(metaSpend), strong: true },
    { label: 'Impressions', value: formatInt(metaImpressions), strong: false },
    { label: 'Clicks', value: formatInt(metaClicks), strong: false },
    { label: 'Cost per click', value: usdOrDash(metaCpc), strong: false },
    { label: 'Click-through rate', value: metaCtr != null ? `${(metaCtr * 100).toFixed(2)}%` : '—', strong: false },
    { label: 'Conversions (reported by Meta)', value: formatInt(metaConversions), strong: false },
  ]

  const healthRows: Array<{ feed: string; status: string; state: AdminState; meaning: string }> = [
    {
      feed: 'Meta ad spend sync',
      status: spendHealthy ? 'flowing' : 'needs a look',
      state: spendHealthy ? 'ok' : 'down',
      meaning: `${latestSpendDate ? `Last spend recorded ${latestSpendDate}.` : 'No spend recorded.'} ${spendHealthy ? 'Syncing daily.' : 'Check the marketing-snapshot-meta-ads cron.'}`,
    },
    {
      feed: 'Facebook lead forms',
      status: leadFormWorking ? 'flowing' : 'no data',
      state: leadFormWorking ? 'ok' : 'waiting',
      meaning: leadFormWorking ? `${formatInt(leadFormCount)} captured.` : 'Zero captured. Expected if you do not run lead-form ads. If you do, the webhook is not delivering.',
    },
    {
      feed: 'Identity matching (name to a number)',
      status: identityWorking ? 'flowing' : 'not live yet',
      state: identityWorking ? 'ok' : 'down',
      meaning: identityWorking
        ? `${formatInt(totalIdentified)} visitors matched to a person.`
        : 'No visitor has been matched to a name yet. The session-to-person stitching is built but not deployed to the site. Once it ships, repeat and identified visitors start showing names here.',
    },
    {
      feed: 'Closed-deal revenue',
      status: 'not wired',
      state: 'waiting',
      meaning: 'Commission from closed deals is not connected to the lead that started it. Until it is, true return on ad spend (revenue ÷ spend) cannot be calculated. Cost per lead is the leading indicator we can show today.',
    },
  ]

  return (
    <>
      {/* ── Plain-English verdict ───────────────────────────────────────────── */}
      <VerdictLine tone={identityWorking ? 'ok' : 'attention'}>
        {identityWorking ? (
          <>
            <b>{formatUsd(totalSpend)} of tracked ad spend</b> against {formatInt(newLeads)} new leads ({windowLabel}).
          </>
        ) : (
          <>
            <b>There is not enough connected data yet to calculate a real return on ad spend.</b> Here is what is
            flowing and what still needs to be turned on, in plain words.
          </>
        )}
      </VerdictLine>

      <section aria-label="The short version">
        <SectionHead>The short version</SectionHead>
        <ul className="av2-quietlist">
          <li className="av2-quiet" style={{ display: 'block' }}>
            {totalSpend > 0
              ? <>You have spent <b style={{ color: 'var(--a-text)', fontVariantNumeric: 'tabular-nums' }}>{formatUsd(totalSpend)}</b> on ads that we can see ({formatUsd(metaSpend)} Meta, {formatUsd(googleSpend)} Google) ({windowLabel}).</>
              : <>No ad spend has synced ({windowLabel}).</>}
            {' '}
            {spendHealthy
              ? <>Spend is syncing daily.</>
              : latestSpendDate
                ? <><span style={{ color: 'var(--a-danger)' }}>Spend last synced {latestSpendDate}, {spendStaleDays} days ago.</span> Either ads are paused or the daily sync needs a look.</>
                : <><span style={{ color: 'var(--a-danger)' }}>No daily spend rows at all.</span> The Meta spend sync may not be running.</>}
          </li>
          <li className="av2-quiet" style={{ display: 'block' }}>
            {totalSessions > 0
              ? <><b style={{ color: 'var(--a-text)', fontVariantNumeric: 'tabular-nums' }}>{formatInt(totalSessions)}</b> people visited the site, <b style={{ color: 'var(--a-text)', fontVariantNumeric: 'tabular-nums' }}>{formatInt(paidSessions)}</b> of them from a paid channel.</>
              : <>No site visitors recorded ({windowLabel}).</>}
            {' '}
            {identityWorking
              ? <><b style={{ color: 'var(--a-text)', fontVariantNumeric: 'tabular-nums' }}>{formatInt(totalIdentified)}</b> of them have been matched to a real person in Follow Up Boss.</>
              : <><span style={{ color: 'var(--a-danger)' }}>None have been matched to a name yet.</span> The matching that ties an ad click to a person in Follow Up Boss is not live on the site yet. Once it ships, the Identified column below starts filling in.</>}
          </li>
          <li className="av2-quiet" style={{ display: 'block' }}>
            {leadFormWorking
              ? <><b style={{ color: 'var(--a-text)', fontVariantNumeric: 'tabular-nums' }}>{formatInt(leadFormCount)}</b> Facebook lead-form submissions captured.</>
              : <><span style={{ color: 'var(--a-danger)' }}>No Facebook lead-form submissions captured.</span> If you run lead-form ads, the webhook that records them is not delivering. If you do not, this is expected.</>}
          </li>
        </ul>
      </section>

      {/* ── Money funnel KPIs ────────────────────────────────────────────────── */}
      <section aria-label="The money funnel">
        <SectionHead>The money funnel ({windowLabel})</SectionHead>
        <NumberStrip
          items={[
            { label: 'Ad spend (tracked)', value: formatUsd(totalSpend), caption: `${formatUsd(metaSpend)} Meta · ${formatUsd(googleSpend)} Google` },
            { label: 'Visitors from paid ads', value: formatInt(paidSessions), caption: `of ${formatInt(totalSessions)} total visitors` },
            { label: 'New leads (all sources)', value: formatInt(newLeads), caption: 'real inbound leads, getLeadIntake' },
            { label: 'Visitors matched to a name', value: formatInt(totalIdentified), caption: 'the "put a name to the number" count' },
            {
              label: 'Blended cost per new lead',
              value: usdOrDash(blendedCostPerLead),
              caption: blendedCostPerLead != null ? `${formatUsd(totalSpend)} spend ÷ ${formatInt(newLeads)} leads. Rough only, see note.` : 'needs both spend and leads',
            },
          ]}
        />
      </section>

      {/* ── By channel: where visitors came from + how many got a name ────────── */}
      <section aria-label="Where your visitors come from">
        <SectionHead>Where your visitors come from</SectionHead>
        <LaneNote>
          Every site session ({windowLabel}), grouped by the channel that sent it. &quot;Matched to a name&quot; is the
          count we tied to a real person in Follow Up Boss. That column is the heart of putting a name to a number.
        </LaneNote>
        {sessionsCapped && (
          <StatePanel tone="error">
            Showing first 20,000 sessions — result capped. Narrow the date range to see complete data.
          </StatePanel>
        )}
        <DataGrid
          label="Visitors by channel"
          rows={channelRows.map(([ch, agg]) => {
            const matchRate = agg.sessions > 0 ? agg.identified / agg.sessions : 0
            let note: string
            if (agg.identified === 0) note = isPaidChannel(ch) ? 'Paid traffic, but none matched to a name yet' : 'No names matched yet'
            else if (matchRate >= 0.2) note = 'Healthy match rate'
            else note = 'Some matched, room to improve'
            return { ch, agg, paid: isPaidChannel(ch), note }
          })}
          cap={10}
          minWidth={820}
          getRowKey={(r) => r.ch}
          columns={[
            {
              key: 'ch',
              header: 'Channel',
              width: '1.3fr',
              cell: (r) => (
                <span style={{ fontWeight: 600 }}>
                  {r.ch}
                  {r.paid ? <span style={{ marginLeft: 8 }}><StateWord state="accent">paid</StateWord></span> : null}
                </span>
              ),
            },
            { key: 'visitors', header: 'Visitors', numeric: true, cell: (r) => formatInt(r.agg.sessions) },
            { key: 'matched', header: 'Matched to a name', numeric: true, cell: (r) => formatInt(r.agg.identified) },
            { key: 'hot', header: 'Hot leads', numeric: true, cell: (r) => formatInt(r.agg.hot) },
            { key: 'note', header: 'What this tells you', width: '1.6fr', cell: (r) => <span style={{ color: 'var(--a-text-2)' }}>{r.note}</span> },
          ]}
          empty={<>No site visitors recorded ({windowLabel}). Once the tracking snippet fires on the site, channels appear here.</>}
        />
        {earliestSession && (
          <Stamp>
            Visitor data on file spans {earliestSession} to {latestSession}.
          </Stamp>
        )}
      </section>

      {/* ── Meta ad performance + campaign spend ─────────────────────────────── */}
      <section aria-label="What the Meta money bought">
        <SectionHead>What the Meta money bought</SectionHead>
        <DataGrid
          label="Meta ad performance"
          rows={metaRows}
          cap={8}
          minWidth={480}
          getRowKey={(r) => r.label}
          columns={[
            { key: 'label', header: 'Metric', width: '1.6fr', cell: (r) => <span style={{ color: 'var(--a-text-2)' }}>{r.label}</span> },
            { key: 'value', header: 'Value', numeric: true, width: '160px', cell: (r) => <span style={{ fontWeight: r.strong ? 600 : 400 }}>{r.value}</span> },
          ]}
          empty={<>No Meta ad spend synced ({windowLabel}).</>}
        />
      </section>

      <section aria-label="Spend by campaign">
        <SectionHead>Spend by campaign</SectionHead>
        <DataGrid
          label="Meta spend by campaign"
          rows={campaigns}
          cap={8}
          minWidth={560}
          getRowKey={([name]) => name}
          columns={[
            { key: 'name', header: 'Campaign', width: '1.6fr', cell: ([name]) => <span style={{ fontWeight: 500 }}>{name}</span> },
            { key: 'spend', header: 'Spend', numeric: true, cell: ([, spend]) => formatUsd(spend) },
            { key: 'share', header: 'Share', numeric: true, cell: ([, spend]) => (metaSpend > 0 ? `${((spend / metaSpend) * 100).toFixed(0)}%` : '—') },
          ]}
          empty={<>No per-campaign spend ({windowLabel}). Campaign rows appear once the Meta spend sync writes campaign-scope data.</>}
        />
      </section>

      {/* ── Daily spend timeline (what we actually have) ─────────────────────── */}
      {spendDays.length > 0 && (
        <section aria-label="Days we recorded spend">
          <SectionHead>Days we recorded spend</SectionHead>
          <LaneNote>
            Each day the spend sync wrote a non-zero number. Gaps mean either no spend that day or the sync did not run.
          </LaneNote>
          <DataGrid
            label="Days with recorded spend"
            rows={spendDays}
            cap={10}
            minWidth={420}
            getRowKey={([date]) => date}
            columns={[
              { key: 'date', header: 'Date', width: '1fr', cell: ([date]) => <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{date}</span> },
              { key: 'spend', header: 'Spend', numeric: true, cell: ([, spend]) => formatUsd(spend) },
            ]}
            empty={<>No days with recorded spend ({windowLabel}).</>}
          />
        </section>
      )}

      {/* ── Data health: which pipes are flowing ─────────────────────────────── */}
      <section aria-label="Data health">
        <SectionHead>Data health: what is connected</SectionHead>
        <LaneNote>
          The numbers above are only as good as these feeds. This is the honest status of each one.
        </LaneNote>
        <DataGrid
          label="Data feed health"
          rows={healthRows}
          cap={8}
          minWidth={780}
          getRowKey={(r) => r.feed}
          columns={[
            { key: 'feed', header: 'Feed', width: '1.2fr', cell: (r) => <span style={{ fontWeight: 600 }}>{r.feed}</span> },
            { key: 'status', header: 'Status', width: '150px', cell: (r) => <StateWord state={r.state}>{r.status}</StateWord> },
            { key: 'meaning', header: 'What it means', width: '2.2fr', cell: (r) => <span style={{ color: 'var(--a-text-2)' }}>{r.meaning}</span> },
          ]}
          empty={<>No data feeds to report on.</>}
        />
      </section>

      {/* ── Honest note on true ROAS + where to dig deeper ───────────────────── */}
      <section aria-label="How to read this page">
        <SectionHead>How to read this page</SectionHead>
        <LaneNote>
          <b style={{ color: 'var(--a-text)' }}>Cost per lead</b> here is blended. It divides all paid spend by all new
          Follow Up Boss leads, including leads that came from word of mouth or organic search, not just ads. So it is a
          rough floor, not a precise per-channel number. A precise &quot;cost per Facebook lead&quot; needs every lead
          tagged with the channel that produced it, which happens automatically once identity matching is live.
        </LaneNote>
        <LaneNote>
          <b style={{ color: 'var(--a-text)' }}>True return on ad spend</b> (dollars earned ÷ dollars spent) is not on
          this page because closed-deal commission is not yet linked back to the lead source. When that link exists, this
          page can show real return per campaign. Until then, watch cost per lead and the match rate by channel.
        </LaneNote>
        <LaneNote>
          For the week-by-week cost-per-lead trend, see{' '}
          <Link href="/admin/analytics/cost-per-lead" style={{ color: 'var(--a-accent)' }}>Cost per lead</Link>.
          For the Meta infrastructure and recent lead forms, see{' '}
          <Link href="/admin/analytics/meta-health" style={{ color: 'var(--a-accent)' }}>Meta health</Link>.
          To see individual people, see{' '}
          <Link href="/admin/visitors/live" style={{ color: 'var(--a-accent)' }}>Live visitors</Link>.
        </LaneNote>
      </section>
    </>
  )
}

export default async function AdRoiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 var(--a-s5)' }}>
        <DateRangePicker current={sp.range ?? '90d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </div>

      <Suspense fallback={<GridSkeleton rows={8} label="Loading marketing ROI" />}>
        <AdRoi range={range} />
      </Suspense>
    </div>
  )
}
