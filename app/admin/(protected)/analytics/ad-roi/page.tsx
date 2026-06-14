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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard } from '../_components/KpiCard'
import { formatInt, formatUsd } from '../_lib/formatters'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const WINDOW_DAYS = 90

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function tsDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
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

async function AdRoi() {
  const supabase = getServiceSupabase()
  const sinceDate = isoDaysAgo(WINDOW_DAYS)
  const sinceTs = tsDaysAgo(WINDOW_DAYS)

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
                ? <>You have spent <strong className="text-foreground tabular-nums">{formatUsd(totalSpend)}</strong> on ads that we can see ({formatUsd(metaSpend)} Meta, {formatUsd(googleSpend)} Google) in the last {WINDOW_DAYS} days.</>
                : <>No ad spend has synced in the last {WINDOW_DAYS} days.</>}
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
                : <>No site visitors recorded in the last {WINDOW_DAYS} days.</>}
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
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">The money funnel (last {WINDOW_DAYS} days)</h2>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where your visitors come from</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every site session in the last {WINDOW_DAYS} days, grouped by the channel that sent it. &quot;Matched to a name&quot; is the count we tied to a real person in Follow Up Boss. That column is the heart of putting a name to a number.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {channelRows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No site visitors recorded in the last {WINDOW_DAYS} days.</p>
          ) : (
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Channel</TableHead>
                    <TableHead className="text-right tabular-nums whitespace-nowrap">Visitors</TableHead>
                    <TableHead className="text-right tabular-nums whitespace-nowrap">Matched to a name</TableHead>
                    <TableHead className="text-right tabular-nums whitespace-nowrap">Hot leads</TableHead>
                    <TableHead className="whitespace-nowrap">What this tells you</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelRows.map(([ch, agg]) => {
                    const matchRate = agg.sessions > 0 ? agg.identified / agg.sessions : 0
                    let note: string
                    if (agg.identified === 0) note = isPaidChannel(ch) ? 'Paid traffic, but none matched to a name yet' : 'No names matched yet'
                    else if (matchRate >= 0.2) note = 'Healthy match rate'
                    else note = 'Some matched, room to improve'
                    return (
                      <TableRow key={ch}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {ch}
                          {isPaidChannel(ch) && <Badge variant="secondary" className="ml-2">paid</Badge>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatInt(agg.sessions)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatInt(agg.identified)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatInt(agg.hot)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{note}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {earliestSession && (
            <p className="px-4 pb-4 pt-2 text-xs text-muted-foreground">
              Visitor data on file spans {earliestSession} to {latestSession}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Meta ad performance + campaign spend ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What the Meta money bought</CardTitle>
          </CardHeader>
          <CardContent>
            {metaSpend === 0 ? (
              <p className="text-sm text-muted-foreground">No Meta ad spend synced in the last {WINDOW_DAYS} days.</p>
            ) : (
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                <Table>
                  <TableBody>
                    <TableRow><TableCell className="text-muted-foreground whitespace-nowrap">Spend</TableCell><TableCell className="text-right tabular-nums font-medium whitespace-nowrap">{formatUsd(metaSpend)}</TableCell></TableRow>
                    <TableRow><TableCell className="text-muted-foreground whitespace-nowrap">Impressions</TableCell><TableCell className="text-right tabular-nums whitespace-nowrap">{formatInt(metaImpressions)}</TableCell></TableRow>
                    <TableRow><TableCell className="text-muted-foreground whitespace-nowrap">Clicks</TableCell><TableCell className="text-right tabular-nums whitespace-nowrap">{formatInt(metaClicks)}</TableCell></TableRow>
                    <TableRow><TableCell className="text-muted-foreground whitespace-nowrap">Cost per click</TableCell><TableCell className="text-right tabular-nums whitespace-nowrap">{usdOrDash(metaCpc)}</TableCell></TableRow>
                    <TableRow><TableCell className="text-muted-foreground whitespace-nowrap">Click-through rate</TableCell><TableCell className="text-right tabular-nums whitespace-nowrap">{metaCtr != null ? `${(metaCtr * 100).toFixed(2)}%` : '—'}</TableCell></TableRow>
                    <TableRow><TableCell className="text-muted-foreground whitespace-nowrap">Conversions (reported by Meta)</TableCell><TableCell className="text-right tabular-nums whitespace-nowrap">{formatInt(metaConversions)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spend by campaign</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {campaigns.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No per-campaign spend in the last {WINDOW_DAYS} days.</p>
            ) : (
              <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Campaign</TableHead>
                      <TableHead className="text-right tabular-nums whitespace-nowrap">Spend</TableHead>
                      <TableHead className="text-right tabular-nums whitespace-nowrap">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map(([name, spend]) => (
                      <TableRow key={name}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{formatUsd(spend)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">{metaSpend > 0 ? `${((spend / metaSpend) * 100).toFixed(0)}%` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Daily spend timeline (what we actually have) ─────────────────────── */}
      {spendDays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Days we recorded spend</CardTitle>
            <p className="text-xs text-muted-foreground">Each day the spend sync wrote a non-zero number. Gaps mean either no spend that day or the sync did not run.</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-right tabular-nums whitespace-nowrap">Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spendDays.slice(0, 14).map(([date, spend]) => (
                    <TableRow key={date}>
                      <TableCell className="font-medium tabular-nums whitespace-nowrap">{date}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">{formatUsd(spend)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Data health: which pipes are flowing ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data health: what is connected</CardTitle>
          <p className="text-xs text-muted-foreground">The numbers above are only as good as these feeds. This is the honest status of each one.</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Feed</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">What it means</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium whitespace-nowrap">Meta ad spend sync</TableCell>
                  <TableCell><Badge variant={spendHealthy ? 'default' : 'destructive'}>{spendHealthy ? 'flowing' : 'needs a look'}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {latestSpendDate ? `Last spend recorded ${latestSpendDate}.` : 'No spend recorded.'} {spendHealthy ? 'Syncing daily.' : 'Check the marketing-snapshot-meta-ads cron.'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium whitespace-nowrap">Facebook lead forms</TableCell>
                  <TableCell><Badge variant={leadFormWorking ? 'default' : 'secondary'}>{leadFormWorking ? 'flowing' : 'no data'}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {leadFormWorking ? `${formatInt(leadFormCount)} captured.` : 'Zero captured. Expected if you do not run lead-form ads. If you do, the webhook is not delivering.'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium whitespace-nowrap">Identity matching (name to a number)</TableCell>
                  <TableCell><Badge variant={identityWorking ? 'default' : 'destructive'}>{identityWorking ? 'flowing' : 'not live yet'}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {identityWorking
                      ? `${formatInt(totalIdentified)} visitors matched to a person.`
                      : 'No visitor has been matched to a name yet. The session-to-person stitching is built but not deployed to the site. Once it ships, repeat and identified visitors start showing names here.'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium whitespace-nowrap">Closed-deal revenue</TableCell>
                  <TableCell><Badge variant="secondary">not wired</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Commission from closed deals is not connected to the lead that started it. Until it is, true return on ad spend (revenue ÷ spend) cannot be calculated. Cost per lead is the leading indicator we can show today.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

export default function AdRoiPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Marketing ROI</h1>
        <p className="text-sm text-muted-foreground">
          Is your ad money turning into real leads, are you wasting it, and what is your return? This page joins what you spend with who actually comes in, and tells you in plain words. It is honest about what the data can and cannot prove yet.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
        <AdRoi />
      </Suspense>
    </div>
  )
}
