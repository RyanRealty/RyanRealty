// @no-parity — internal admin analytics page, superuser-only, no public mockup contract.
/**
 * /admin/analytics/ad-roi — the plain-English answer to "is my ad money
 * turning into real leads, am I wasting it, what's my return?"
 *
 * This page joins three live feeds and says, in plain words, what they add up to:
 *   - Ad spend          → marketing_channel_daily (channel=meta_ads / google_ads, metric=spend)
 *   - Site visitors     → visitor_sessions (utm_source → channel, identified_at, fub_person_id, hot_lead_fired_at)
 *   - Leads             → marketing_channel_daily (channel=fub, metric=new_leads / qualified_seller_leads)
 *   - FB lead forms     → processed_meta_leads (campaign_name + fub_person_id)
 *
 * Design intent: honest first. When a data pipe is dry (no spend synced, no
 * visitor matched to a name, no lead-form captured), the page says so in plain
 * language instead of showing a confident-looking but empty table. Every number
 * shows its own math so it traces to source. True return-on-ad-spend (revenue ÷
 * spend) is NOT computable yet because closed-deal commission is not wired to a
 * lead source. The page is explicit about that rather than faking a number.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'
import { KpiCard } from '../_components/KpiCard'
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
    fubNewRes,
    fubQualRes,
    sessionsRes,
    leadFormCountRes,
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
    // FUB new leads (all sources, account daily metric).
    supabase.from('marketing_channel_daily')
      .select('date, value')
      .eq('channel', 'fub').eq('scope', 'account').eq('metric', 'new_leads')
      .gte('date', sinceDate),
    // FUB qualified seller leads.
    supabase.from('marketing_channel_daily')
      .select('date, value')
      .eq('channel', 'fub').eq('scope', 'account').eq('metric', 'qualified_seller_leads')
      .gte('date', sinceDate),
    // Site sessions with their source + identity state.
    supabase.from('visitor_sessions')
      .select('first_seen_at, utm_source, utm_campaign, identified_at, fub_person_id, hot_lead_fired_at')
      .gte('first_seen_at', sinceTs)
      .lte('first_seen_at', `${range.endDate}T23:59:59.999Z`)
      .limit(20000),
    // Facebook lead-form submissions captured (count only).
    supabase.from('processed_meta_leads')
      .select('leadgen_id', { count: 'exact', head: true }),
  ])

  const firstErr = [metaAcctRes, metaCampRes, googleAcctRes, fubNewRes, fubQualRes, sessionsRes]
    .find((r) => r.error)
  if (firstErr?.error) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Data read failed: {firstErr.error.message}</CardContent></Card>
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
  const newLeads = ((fubNewRes.data ?? []) as DailyValueRow[]).reduce((s, r) => s + (Number(r.value) || 0), 0)
  const qualifiedLeads = ((fubQualRes.data ?? []) as DailyValueRow[]).reduce((s, r) => s + (Number(r.value) || 0), 0)

  // ── Sessions by channel ──────────────────────────────────────────────────────
  const sessions = (sessionsRes.data ?? []) as SessionRow[]
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

  return (
    <div className="space-y-6">
      {/* ── Plain-English verdict banner ─────────────────────────────────────── */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="text-base">The short version</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground">
          {!identityWorking && (
            <p>
              <strong>There is not enough connected data yet to calculate a real return on ad spend.</strong>{' '}
              Here is what is flowing and what still needs to be turned on, in plain words.
            </p>
          )}
          <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
            <li>
              {totalSpend > 0
                ? <>You have spent <strong className="text-foreground tabular-nums">{formatUsd(totalSpend)}</strong> on ads that we can see ({formatUsd(metaSpend)} Meta, {formatUsd(googleSpend)} Google) ({windowLabel}).</>
                : <>No ad spend has synced ({windowLabel}).</>}
              {' '}
              {spendHealthy
                ? <>Spend is syncing daily.</>
                : latestSpendDate
                  ? <><span className="text-destructive">Spend last synced {latestSpendDate}, {spendStaleDays} days ago.</span> Either ads are paused or the daily sync needs a look.</>
                  : <><span className="text-destructive">No daily spend rows at all.</span> The Meta spend sync may not be running.</>}
            </li>
            <li>
              {totalSessions > 0
                ? <><strong className="text-foreground tabular-nums">{formatInt(totalSessions)}</strong> people visited the site, <strong className="text-foreground tabular-nums">{formatInt(paidSessions)}</strong> of them from a paid channel.</>
                : <>No site visitors recorded ({windowLabel}).</>}
              {' '}
              {identityWorking
                ? <><strong className="text-foreground tabular-nums">{formatInt(totalIdentified)}</strong> of them have been matched to a real person in Follow Up Boss.</>
                : <><span className="text-destructive">None have been matched to a name yet.</span> The matching that ties an ad click to a person in Follow Up Boss is not live on the site yet. Once it ships, the Identified column below starts filling in.</>}
            </li>
            <li>
              {leadFormWorking
                ? <><strong className="text-foreground tabular-nums">{formatInt(leadFormCount)}</strong> Facebook lead-form submissions captured.</>
                : <><span className="text-destructive">No Facebook lead-form submissions captured.</span> If you run lead-form ads, the webhook that records them is not delivering. If you do not, this is expected.</>}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* ── Money funnel KPIs ────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">The money funnel ({windowLabel})</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Ad spend (tracked)" value={formatUsd(totalSpend)} hint={`${formatUsd(metaSpend)} Meta · ${formatUsd(googleSpend)} Google`} />
          <KpiCard label="Visitors from paid ads" value={formatInt(paidSessions)} hint={`of ${formatInt(totalSessions)} total visitors`} />
          <KpiCard label="New leads (Follow Up Boss)" value={formatInt(newLeads)} hint="all sources, not just ads" />
          <KpiCard label="Qualified seller leads" value={formatInt(qualifiedLeads)} hint="marked qualified in FUB" />
          <KpiCard
            label="Visitors matched to a name"
            value={formatInt(totalIdentified)}
            hint={'the "put a name to the number" count'}
          />
          <KpiCard
            label="Blended cost per new lead"
            value={usdOrDash(blendedCostPerLead)}
            hint={blendedCostPerLead != null ? `${formatUsd(totalSpend)} spend ÷ ${formatInt(newLeads)} leads. Rough only, see note.` : 'needs both spend and leads'}
          />
        </div>
      </div>

      {/* ── By channel: where visitors came from + how many got a name ────────── */}
      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Where your visitors come from</h2>
          <p className="text-xs text-muted-foreground">
            Every site session ({windowLabel}), grouped by the channel that sent it. &quot;Matched to a name&quot; is the count we tied to a real person in Follow Up Boss. That column is the heart of putting a name to a number.
          </p>
          {sessionsCapped && (
            <p className="text-xs text-warning">
              Showing first 20,000 sessions — result capped. Narrow the date range to see complete data.
            </p>
          )}
        </div>
        <TableWithMobileCards
          rows={channelRows.map(([ch, agg]) => {
            const matchRate = agg.sessions > 0 ? agg.identified / agg.sessions : 0
            let note: string
            if (agg.identified === 0) note = isPaidChannel(ch) ? 'Paid traffic, but none matched to a name yet' : 'No names matched yet'
            else if (matchRate >= 0.2) note = 'Healthy match rate'
            else note = 'Some matched, room to improve'
            return { ch, agg, paid: isPaidChannel(ch), note }
          })}
          cap={10}
          getRowKey={(r) => r.ch}
          columns={[
            { key: 'ch', header: 'Channel', className: 'whitespace-nowrap', cell: (r) => <span className="font-medium">{r.ch}{r.paid && <Badge variant="secondary" className="ml-2">paid</Badge>}</span> },
            { key: 'visitors', header: 'Visitors', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.agg.sessions) },
            { key: 'matched', header: 'Matched to a name', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.agg.identified) },
            { key: 'hot', header: 'Hot leads', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.agg.hot) },
            { key: 'note', header: 'What this tells you', className: 'text-xs text-muted-foreground', cell: (r) => r.note },
          ]}
          renderCard={(r) => (
            <Card>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.ch}{r.paid && <Badge variant="secondary" className="ml-2 text-xs">paid</Badge>}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatInt(r.agg.sessions)} <span className="text-xs font-normal text-muted-foreground">visitors</span></span>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">{formatInt(r.agg.identified)} matched · {formatInt(r.agg.hot)} hot · {r.note}</p>
              </CardContent>
            </Card>
          )}
          empty={<>No site visitors recorded ({windowLabel}). Once the tracking snippet fires on the site, channels appear here.</>}
        />
        {earliestSession && (
          <p className="text-xs text-muted-foreground">
            Visitor data on file spans {earliestSession} to {latestSession}.
          </p>
        )}
      </section>

      {/* ── Meta ad performance + campaign spend ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">What the Meta money bought</h2>
          <TableWithMobileCards
            rows={metaSpend === 0 ? [] : [
              { label: 'Spend', value: formatUsd(metaSpend), strong: true },
              { label: 'Impressions', value: formatInt(metaImpressions), strong: false },
              { label: 'Clicks', value: formatInt(metaClicks), strong: false },
              { label: 'Cost per click', value: usdOrDash(metaCpc), strong: false },
              { label: 'Click-through rate', value: metaCtr != null ? `${(metaCtr * 100).toFixed(2)}%` : '—', strong: false },
              { label: 'Conversions (reported by Meta)', value: formatInt(metaConversions), strong: false },
            ]}
            cap={8}
            getRowKey={(r) => r.label}
            columns={[
              { key: 'label', header: 'Metric', className: 'text-muted-foreground', cell: (r) => r.label },
              { key: 'value', header: 'Value', className: 'text-right tabular-nums', cell: (r) => <span className={r.strong ? 'font-medium' : undefined}>{r.value}</span> },
            ]}
            renderCard={(r) => (
              <Card>
                <CardContent className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className={`text-sm tabular-nums ${r.strong ? 'font-semibold' : 'font-medium'}`}>{r.value}</span>
                </CardContent>
              </Card>
            )}
            empty={<>No Meta ad spend synced ({windowLabel}).</>}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Spend by campaign</h2>
          <TableWithMobileCards
            rows={campaigns}
            cap={8}
            getRowKey={([name]) => name}
            columns={[
              { key: 'name', header: 'Campaign', className: 'font-medium', cell: ([name]) => name },
              { key: 'spend', header: 'Spend', className: 'text-right tabular-nums whitespace-nowrap', cell: ([, spend]) => formatUsd(spend) },
              { key: 'share', header: 'Share', className: 'text-right tabular-nums whitespace-nowrap', cell: ([, spend]) => metaSpend > 0 ? `${((spend / metaSpend) * 100).toFixed(0)}%` : '—' },
            ]}
            renderCard={([name, spend]) => (
              <Card>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{name}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatUsd(spend)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">{metaSpend > 0 ? `${((spend / metaSpend) * 100).toFixed(0)}% of Meta spend` : '—'}</p>
                </CardContent>
              </Card>
            )}
            empty={<>No per-campaign spend ({windowLabel}). Campaign rows appear once the Meta spend sync writes campaign-scope data.</>}
          />
        </section>
      </div>

      {/* ── Daily spend timeline (what we actually have) ─────────────────────── */}
      {spendDays.length > 0 && (
        <section className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Days we recorded spend</h2>
            <p className="text-xs text-muted-foreground">Each day the spend sync wrote a non-zero number. Gaps mean either no spend that day or the sync did not run.</p>
          </div>
          <TableWithMobileCards
            rows={spendDays}
            cap={10}
            getRowKey={([date]) => date}
            columns={[
              { key: 'date', header: 'Date', className: 'font-medium tabular-nums whitespace-nowrap', cell: ([date]) => date },
              { key: 'spend', header: 'Spend', className: 'text-right tabular-nums whitespace-nowrap', cell: ([, spend]) => formatUsd(spend) },
            ]}
            renderCard={([date, spend]) => (
              <Card>
                <CardContent className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium tabular-nums">{date}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatUsd(spend)}</span>
                </CardContent>
              </Card>
            )}
            empty={<>No days with recorded spend ({windowLabel}).</>}
          />
        </section>
      )}

      {/* ── Data health: which pipes are flowing ─────────────────────────────── */}
      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Data health: what is connected</h2>
          <p className="text-xs text-muted-foreground">The numbers above are only as good as these feeds. This is the honest status of each one.</p>
        </div>
        <TableWithMobileCards
          rows={[
            {
              feed: 'Meta ad spend sync',
              status: spendHealthy ? 'flowing' : 'needs a look',
              variant: (spendHealthy ? 'default' : 'destructive') as 'default' | 'destructive' | 'secondary',
              meaning: `${latestSpendDate ? `Last spend recorded ${latestSpendDate}.` : 'No spend recorded.'} ${spendHealthy ? 'Syncing daily.' : 'Check the marketing-snapshot-meta-ads cron.'}`,
            },
            {
              feed: 'Facebook lead forms',
              status: leadFormWorking ? 'flowing' : 'no data',
              variant: (leadFormWorking ? 'default' : 'secondary') as 'default' | 'destructive' | 'secondary',
              meaning: leadFormWorking ? `${formatInt(leadFormCount)} captured.` : 'Zero captured. Expected if you do not run lead-form ads. If you do, the webhook is not delivering.',
            },
            {
              feed: 'Identity matching (name to a number)',
              status: identityWorking ? 'flowing' : 'not live yet',
              variant: (identityWorking ? 'default' : 'destructive') as 'default' | 'destructive' | 'secondary',
              meaning: identityWorking
                ? `${formatInt(totalIdentified)} visitors matched to a person.`
                : 'No visitor has been matched to a name yet. The session-to-person stitching is built but not deployed to the site. Once it ships, repeat and identified visitors start showing names here.',
            },
            {
              feed: 'Closed-deal revenue',
              status: 'not wired',
              variant: 'secondary' as 'default' | 'destructive' | 'secondary',
              meaning: 'Commission from closed deals is not connected to the lead that started it. Until it is, true return on ad spend (revenue ÷ spend) cannot be calculated. Cost per lead is the leading indicator we can show today.',
            },
          ]}
          cap={8}
          getRowKey={(r) => r.feed}
          columns={[
            { key: 'feed', header: 'Feed', className: 'font-medium whitespace-nowrap', cell: (r) => r.feed },
            { key: 'status', header: 'Status', className: 'whitespace-nowrap', cell: (r) => <Badge variant={r.variant}>{r.status}</Badge> },
            { key: 'meaning', header: 'What it means', className: 'text-xs text-muted-foreground', cell: (r) => r.meaning },
          ]}
          renderCard={(r) => (
            <Card>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.feed}</span>
                  <Badge variant={r.variant}>{r.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.meaning}</p>
              </CardContent>
            </Card>
          )}
          empty={<>No data feeds to report on.</>}
        />
      </section>

      {/* ── Honest note on true ROAS + where to dig deeper ───────────────────── */}
      <Card className="bg-muted/40">
        <CardHeader><CardTitle className="text-base">How to read this page</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Cost per lead</strong> here is blended. It divides all paid spend by all new Follow Up Boss leads, including leads that came from word of mouth or organic search, not just ads. So it is a rough floor, not a precise per-channel number. A precise &quot;cost per Facebook lead&quot; needs every lead tagged with the channel that produced it, which happens automatically once identity matching is live.
          </p>
          <p>
            <strong className="text-foreground">True return on ad spend</strong> (dollars earned ÷ dollars spent) is not on this page because closed-deal commission is not yet linked back to the lead source. When that link exists, this page can show real return per campaign. Until then, watch cost per lead and the match rate by channel.
          </p>
          <p>
            For the week-by-week cost-per-lead trend, see{' '}
            <Link className="text-primary hover:underline" href="/admin/analytics/cost-per-lead">Cost per lead</Link>.
            For the Meta infrastructure and recent lead forms, see{' '}
            <Link className="text-primary hover:underline" href="/admin/analytics/meta-health">Meta health</Link>.
            To see individual people, see{' '}
            <Link className="text-primary hover:underline" href="/admin/visitors/live">Live visitors</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AdRoiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Marketing ROI</h1>
        <p className="text-sm text-muted-foreground">
          Is your ad money turning into real leads, are you wasting it, and what is your return? This page joins what you spend with who actually comes in, and tells you in plain words. It is honest about what the data can and cannot prove yet.
        </p>
        <DateRangePicker current={sp.range ?? '90d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>

      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
        <AdRoi range={range} />
      </Suspense>
    </div>
  )
}
