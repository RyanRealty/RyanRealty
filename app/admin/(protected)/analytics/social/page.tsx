/**
 * /admin/analytics/social - dedicated social-channel visibility.
 *
 * Pulls from two places and stitches them into one focused view:
 *   - GA4 Data API (last 30 days): per-channel sessions, users, engagement,
 *     plus per-source leads (so you see "Facebook brought 12 leads")
 *   - visitor_sessions table (last 7 days + right-now): real-time social
 *     traffic the moment events land
 *
 * Recognises every common social referrer host even when UTMs are missing
 * (Facebook, Instagram, TikTok, YouTube, LinkedIn, X/Twitter, Pinterest,
 * Threads, Reddit). Matches the auto-inference the WP snippet uses, so
 * the two surfaces report consistent numbers.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — classifySocial, every window (7d / today / 5-minute live /
 * 30-minute feed / GA4 range), every aggregation and the GA4 cross-reference are
 * carried over verbatim. The per-platform brand colours are gone: in the admin,
 * colour is a reserved status vocabulary and never decorates a label.
 */
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { DataList, Figures, Loading, Trouble } from '../_components/v2/kit'
import { getGA4SummaryCached as getGA4Summary } from '@/lib/ga4-cache'
import { resolveDateRange } from '../_lib/queries'
import { RangeControl } from '../_components/v2/RangeControl'

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

// ─── Channel classification ─────────────────────────────────────────────────
// Maps a free-form source string (utm_source value or sessionSourceMedium)
// onto a canonical social channel name. Returns null for non-social sources.
// Mirrors the auto-inference logic in the WordPress snippet so server-side
// dashboards report the same buckets the client tags.
function classifySocial(source: string | null | undefined): string | null {
  if (!source) return null
  const s = source.toLowerCase()
  if (/(^|[/_.\s-])(facebook|fb)([/_.\s-]|$)/.test(s) || s === 'fb' || s === 'facebook') return 'Facebook'
  if (/instagram|insta(\b|gram)/.test(s)) return 'Instagram'
  if (/tiktok/.test(s)) return 'TikTok'
  if (/youtube|^yt$/.test(s)) return 'YouTube'
  if (/linkedin/.test(s)) return 'LinkedIn'
  if (/\b(x|twitter|t\.co)\b/.test(s)) return 'X / Twitter'
  if (/pinterest/.test(s)) return 'Pinterest'
  if (/threads/.test(s)) return 'Threads'
  if (/reddit/.test(s)) return 'Reddit'
  if (/snapchat/.test(s)) return 'Snapchat'
  return null
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPct(n: number, total: number): string {
  if (total === 0) return '—'
  return `${((n / total) * 100).toFixed(1)}%`
}

function formatRelative(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ─── Headline summary ───────────────────────────────────────────────────────
async function HeadlineSummary() {
  const supabase = getServiceSupabase()
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

  // Pull recent sessions; classify in JS. Paged read — PostgREST caps single
  // responses at 1,000 rows, so the old .limit(5000) silently truncated there.
  const { rows: data, error } = await fetchPagedRows(
    (from, to) =>
      supabase
        .from('visitor_sessions')
        .select('session_id, utm_source, last_seen_at, first_seen_at, identified_at, hot_lead_fired_at')
        .gte('first_seen_at', sevenDaysAgo)
        .order('session_id', { ascending: true })
        .range(from, to),
    5000,
  )
  if (error) {
    return <Trouble>Could not load summary: {error?.message}. Retry — until it reads, treat the figures below as unknown, not as zero.</Trouble>
  }

  const social = data.filter((r) => classifySocial((r as { utm_source: string | null }).utm_source) !== null)
  const today      = social.filter((r) => (r as { first_seen_at: string }).first_seen_at >= todayStart)
  const liveNow    = social.filter((r) => (r as { last_seen_at: string }).last_seen_at >= fiveMinAgo)
  const identified = social.filter((r) => (r as { identified_at: string | null }).identified_at !== null)
  const hot        = social.filter((r) => (r as { hot_lead_fired_at: string | null }).hot_lead_fired_at !== null)

  return (
    <>
      <VerdictLine tone={liveNow.length > 0 || hot.length > 0 ? 'attention' : 'ok'}>
        {liveNow.length > 0 ? (
          <>
            <b>{formatInt(liveNow.length)} social visitor{liveNow.length === 1 ? '' : 's'} on the site now.</b>{' '}
            {formatInt(hot.length)} hot lead{hot.length === 1 ? '' : 's'} from social in the last 7 days.
          </>
        ) : hot.length > 0 ? (
          <>
            <b>{formatInt(hot.length)} hot lead{hot.length === 1 ? '' : 's'} from social in the last 7 days.</b> Nobody from social is on the site right now.
          </>
        ) : (
          <>
            <b>Nothing needs you from social.</b> {formatInt(social.length)} session{social.length === 1 ? '' : 's'} in the last 7 days, no hot leads.
          </>
        )}
      </VerdictLine>
      <Figures
        figures={[
          { label: 'Social active now (5m)', value: formatInt(liveNow.length) },
          { label: 'Social today', value: formatInt(today.length) },
          { label: 'Social last 7 days', value: formatInt(social.length), caption: `${formatPct(identified.length, social.length)} identified` },
          { label: 'Social hot leads (7d)', value: formatInt(hot.length), tone: hot.length > 0 ? 'ok' : undefined },
        ]}
      />
    </>
  )
}

// ─── Per-channel breakdown from visitor_sessions ───────────────────────────
async function ChannelBreakdown() {
  const supabase = getServiceSupabase()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { rows: data, error } = await fetchPagedRows(
    (from, to) =>
      supabase
        .from('visitor_sessions')
        .select('session_id, utm_source, utm_medium, utm_campaign, identified_at, hot_lead_fired_at, ip_city, engagement_score')
        .gte('first_seen_at', sevenDaysAgo)
        .order('session_id', { ascending: true })
        .range(from, to),
    5000,
  )
  if (error) {
    return <Trouble>Could not load channel breakdown: {error?.message}. Retry before reading anything into the channel mix.</Trouble>
  }

  type ChannelAgg = { sessions: number; identified: number; hot: number; campaigns: Set<string>; topCity: Map<string, number>; engagedSum: number }
  const byChannel = new Map<string, ChannelAgg>()
  for (const raw of data) {
    const row = raw as { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; identified_at: string | null; hot_lead_fired_at: string | null; ip_city: string | null; engagement_score: number }
    const ch = classifySocial(row.utm_source)
    if (!ch) continue
    const a = byChannel.get(ch) ?? { sessions: 0, identified: 0, hot: 0, campaigns: new Set<string>(), topCity: new Map<string, number>(), engagedSum: 0 }
    a.sessions += 1
    if (row.identified_at) a.identified += 1
    if (row.hot_lead_fired_at) a.hot += 1
    if (row.utm_campaign) a.campaigns.add(row.utm_campaign)
    if (row.ip_city) a.topCity.set(row.ip_city, (a.topCity.get(row.ip_city) ?? 0) + 1)
    a.engagedSum += (row.engagement_score ?? 0)
    byChannel.set(ch, a)
  }

  const rows = Array.from(byChannel.entries())
    .map(([channel, a]) => {
      let topCity = ''
      let topCityCount = 0
      for (const [c, n] of a.topCity) { if (n > topCityCount) { topCity = c; topCityCount = n } }
      return {
        channel,
        sessions: a.sessions,
        identified: a.identified,
        hot: a.hot,
        identifyRate: a.sessions ? a.identified / a.sessions : 0,
        hotRate: a.sessions ? a.hot / a.sessions : 0,
        avgScore: a.sessions ? a.engagedSum / a.sessions : 0,
        campaignCount: a.campaigns.size,
        topCity,
      }
    })
    .sort((x, y) => y.sessions - x.sessions)

  return (
    <section aria-label="Per-channel breakdown">
      <SectionHead>Per-channel breakdown — last 7 days, from visitor_sessions</SectionHead>
      <DataList
        label="Per-channel breakdown"
        rows={rows}
        cap={10}
        rowKey={(r) => r.channel}
        columns={[
          { key: 'channel', header: 'Channel', lead: true, cell: (r) => r.channel },
          { key: 'sessions', header: 'Sessions', num: true, cell: (r) => formatInt(r.sessions) },
          { key: 'identified', header: 'Identified', num: true, cell: (r) => formatInt(r.identified) },
          { key: 'identifyRate', header: 'Identify rate', num: true, cell: (r) => `${(r.identifyRate * 100).toFixed(1)}%` },
          { key: 'hot', header: 'Hot leads', num: true, cell: (r) => formatInt(r.hot) },
          { key: 'avgScore', header: 'Avg score', num: true, cell: (r) => r.avgScore.toFixed(1) },
          { key: 'campaigns', header: 'Campaigns', num: true, cell: (r) => r.campaignCount },
          { key: 'topCity', header: 'Top city', cell: (r) => r.topCity || '—' },
        ]}
        empty={<>No social traffic captured in the last 7 days yet. Once the consent banner is accepted and visitors arrive from FB / IG / TikTok etc, channel rows appear here. The WP snippet auto-tags referrers even when UTMs are missing.</>}
      />
    </section>
  )
}

// ─── Live "right now from social" feed ──────────────────────────────────────
async function LiveSocialFeed() {
  const supabase = getServiceSupabase()
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('visitor_sessions')
    .select('session_id, utm_source, utm_medium, utm_campaign, last_seen_at, engagement_score, intent_tags, ip_city, identified_email, fub_person_id')
    .gte('last_seen_at', thirtyMinAgo)
    .order('last_seen_at', { ascending: false })
    .limit(40)
  type FeedRow = { session_id: string; utm_source: string | null; utm_campaign: string | null; last_seen_at: string; engagement_score: number; intent_tags: string[]; ip_city: string | null; identified_email: string | null; fub_person_id: number | null }
  const rows = (data ?? []).filter((r) => classifySocial((r as { utm_source: string | null }).utm_source) !== null) as FeedRow[]

  const identifiedCell = (r: FeedRow) =>
    r.fub_person_id ? (
      <a href={`https://app.followupboss.com/2/people/view/${r.fub_person_id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--a-accent)' }}>
        {r.identified_email ?? `FUB #${r.fub_person_id}`}
      </a>
    ) : (
      <span style={{ color: 'var(--a-text-2)' }}>anonymous</span>
    )

  return (
    <section aria-label="Right now from social">
      <SectionHead>Right now from social — last 30 min</SectionHead>
      <DataList
        label="Right now from social"
        rows={rows}
        cap={8}
        rowKey={(r) => r.session_id}
        columns={[
          { key: 'channel', header: 'Channel', lead: true, cell: (r) => classifySocial(r.utm_source) || '—' },
          { key: 'campaign', header: 'Campaign', cell: (r) => r.utm_campaign ?? '—' },
          { key: 'city', header: 'City', cell: (r) => r.ip_city ?? '—' },
          { key: 'score', header: 'Score', num: true, cell: (r) => r.engagement_score },
          { key: 'intent', header: 'Intent', cell: (r) => (r.intent_tags ?? []).map((t) => t.replace(/_/g, ' ')).join(', ') || '—' },
          { key: 'identified', header: 'Identified', cell: identifiedCell },
          { key: 'lastSeen', header: 'Last seen', num: true, cell: (r) => formatRelative(r.last_seen_at) },
        ]}
        empty={<>No social visitors in the last 30 minutes.</>}
      />
    </section>
  )
}

// ─── GA4 cross-reference (last 30 days) ─────────────────────────────────────
async function Ga4SocialSources({ startDate, endDate }: { startDate: string; endDate: string }) {
  const res = await getGA4Summary(startDate, endDate)
  if (!res.ok) {
    return <Trouble>GA4 unavailable: {res.error}. The visitor_sessions figures above still stand on their own.</Trouble>
  }
  const d = res.data
  type Row = { source: string; channel: string; sessions: number; users: number; engaged: number; leads: number }
  const social: Row[] = d.topSources
    .map((s) => {
      const ch = classifySocial(s.sourceMedium)
      if (!ch) return null
      const leads = d.leadSources.find((l) => l.sourceMedium === s.sourceMedium)?.leadEvents ?? 0
      return { source: s.sourceMedium, channel: ch, sessions: s.sessions, users: s.users, engaged: s.engagedSessions, leads }
    })
    .filter((x): x is Row => x !== null)
    .sort((a, b) => b.sessions - a.sessions)
  return (
    <section aria-label="GA4 cross-reference">
      <SectionHead>GA4 cross-reference — last 30 days, by source/medium</SectionHead>
      <p className="av2-note">From the GA4 Data API. Use this to validate the visitor_sessions count above and to see leads-per-source.</p>
      <DataList
        label="GA4 cross-reference"
        rows={social}
        cap={10}
        rowKey={(r) => r.source}
        columns={[
          { key: 'channel', header: 'Channel', lead: true, cell: (r) => r.channel },
          { key: 'source', header: 'Source / Medium', mono: true, cell: (r) => r.source },
          { key: 'sessions', header: 'Sessions', num: true, cell: (r) => formatInt(r.sessions) },
          { key: 'users', header: 'Users', num: true, cell: (r) => formatInt(r.users) },
          { key: 'engaged', header: 'Engaged', num: true, cell: (r) => formatInt(r.engaged) },
          { key: 'leads', header: 'Leads', num: true, cell: (r) => formatInt(r.leads) },
          { key: 'conv', header: 'Conv rate', num: true, cell: (r) => r.sessions ? `${((r.leads / r.sessions) * 100).toFixed(1)}%` : '—' },
        ]}
        empty={<>No social sources surfaced by GA4 in this window. Once visitors arrive from a tagged social link, leads-per-source rows appear here.</>}
      />
    </section>
  )
}

export default async function SocialChannelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <p className="av2-note">
        Who is showing up from Facebook, Instagram, TikTok, YouTube, LinkedIn, X, Pinterest, Threads, Reddit, and Snapchat. Real-time from <code>visitor_sessions</code> plus a GA4 cross-reference for the last 30 days.
      </p>
      <RangeControl current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      <p className="av2-note">Date range applies to GA4 data only. The real-time visitor session tables below always show the full available history.</p>

      <Suspense fallback={<Loading what="social sessions" />}>
        <HeadlineSummary />
      </Suspense>

      <Suspense fallback={<Loading what="the live social feed" />}>
        <LiveSocialFeed />
      </Suspense>

      <Suspense fallback={<Loading what="the channel breakdown" />}>
        <ChannelBreakdown />
      </Suspense>

      <Suspense fallback={<Loading what="GA4 social sources" />}>
        <Ga4SocialSources startDate={range.startDate} endDate={range.endDate} />
      </Suspense>
    </div>
  )
}
