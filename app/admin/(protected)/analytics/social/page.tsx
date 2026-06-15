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
 */
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'
import { getGA4SummaryCached as getGA4Summary } from '@/lib/ga4-cache'
import { resolveDateRange } from '../_lib/queries'
import { DateRangePicker } from '../_components/DateRangePicker'

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

const CHANNEL_COLOR: Record<string, string> = {
  Facebook:    'bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/30',
  Instagram:   'bg-[#E4405F]/10 text-[#E4405F] border-[#E4405F]/30',
  TikTok:      'bg-[#000]/10 text-[#000] border-[#000]/30',
  YouTube:     'bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/30',
  LinkedIn:    'bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/30',
  'X / Twitter': 'bg-[#000]/10 text-[#000] border-[#000]/30',
  Pinterest:   'bg-[#E60023]/10 text-[#E60023] border-[#E60023]/30',
  Threads:     'bg-[#000]/10 text-[#000] border-[#000]/30',
  Reddit:      'bg-[#FF4500]/10 text-[#FF4500] border-[#FF4500]/30',
  Snapchat:    'bg-[#FFFC00]/30 text-[#000] border-[#FFFC00]/60',
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

// ─── Headline summary cards ─────────────────────────────────────────────────
async function HeadlineSummary() {
  const supabase = getServiceSupabase()
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

  // Pull recent sessions; classify in JS.
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, utm_source, last_seen_at, first_seen_at, identified_at, hot_lead_fired_at')
    .gte('first_seen_at', sevenDaysAgo)
    .limit(5000)
  if (error || !data) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Could not load summary: {error?.message}</CardContent></Card>
  }

  const social = data.filter((r) => classifySocial((r as { utm_source: string | null }).utm_source) !== null)
  const today      = social.filter((r) => (r as { first_seen_at: string }).first_seen_at >= todayStart)
  const liveNow    = social.filter((r) => (r as { last_seen_at: string }).last_seen_at >= fiveMinAgo)
  const identified = social.filter((r) => (r as { identified_at: string | null }).identified_at !== null)
  const hot        = social.filter((r) => (r as { hot_lead_fired_at: string | null }).hot_lead_fired_at !== null)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Social active now (5m)</p><p className="mt-1 text-2xl font-semibold tabular-nums">{liveNow.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Social today</p><p className="mt-1 text-2xl font-semibold tabular-nums">{today.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Social last 7 days</p><p className="mt-1 text-2xl font-semibold tabular-nums">{social.length}</p><p className="text-xs text-muted-foreground tabular-nums">{formatPct(identified.length, social.length)} identified</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Social hot leads (7d)</p><p className="mt-1 text-2xl font-semibold tabular-nums">{hot.length}</p></CardContent></Card>
    </div>
  )
}

// ─── Per-channel breakdown from visitor_sessions ───────────────────────────
async function ChannelBreakdown() {
  const supabase = getServiceSupabase()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('session_id, utm_source, utm_medium, utm_campaign, identified_at, hot_lead_fired_at, ip_city, engagement_score')
    .gte('first_seen_at', sevenDaysAgo)
    .limit(5000)
  if (error || !data) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Could not load channel breakdown: {error?.message}</CardContent></Card>
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
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">Per-channel breakdown (last 7 days, from visitor_sessions)</h2>
      <TableWithMobileCards
        rows={rows}
        cap={10}
        getRowKey={(r) => r.channel}
        columns={[
          { key: 'channel', header: 'Channel', cell: (r) => <Badge variant="outline" className={CHANNEL_COLOR[r.channel] ?? ''}>{r.channel}</Badge> },
          { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => <span className="font-semibold">{formatInt(r.sessions)}</span> },
          { key: 'identified', header: 'Identified', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.identified) },
          { key: 'identifyRate', header: 'Identify rate', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => `${(r.identifyRate * 100).toFixed(1)}%` },
          { key: 'hot', header: 'Hot leads', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.hot) },
          { key: 'avgScore', header: 'Avg score', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => r.avgScore.toFixed(1) },
          { key: 'campaigns', header: 'Campaigns', className: 'text-right tabular-nums whitespace-nowrap text-muted-foreground', cell: (r) => r.campaignCount },
          { key: 'topCity', header: 'Top city', className: 'whitespace-nowrap', cell: (r) => <span className="text-xs text-muted-foreground">{r.topCity || '—'}</span> },
        ]}
        renderCard={(r) => (
          <Card>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className={CHANNEL_COLOR[r.channel] ?? ''}>{r.channel}</Badge>
                <span className="text-lg font-semibold tabular-nums">{formatInt(r.sessions)} <span className="text-xs font-normal text-muted-foreground">sessions</span></span>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatInt(r.identified)} identified ({(r.identifyRate * 100).toFixed(1)}%) · {formatInt(r.hot)} hot · avg score {r.avgScore.toFixed(1)} · {r.topCity || '—'}
              </p>
            </CardContent>
          </Card>
        )}
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
      <a href={`https://app.followupboss.com/2/people/view/${r.fub_person_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
        {r.identified_email ?? `FUB #${r.fub_person_id}`}
      </a>
    ) : (
      <span className="text-muted-foreground">anonymous</span>
    )

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">Right now from social (last 30 min)</h2>
      <TableWithMobileCards
        rows={rows}
        cap={8}
        getRowKey={(r) => r.session_id}
        columns={[
          { key: 'channel', header: 'Channel', className: 'whitespace-nowrap', cell: (r) => <Badge variant="outline" className={CHANNEL_COLOR[classifySocial(r.utm_source) || '—'] ?? ''}>{classifySocial(r.utm_source) || '—'}</Badge> },
          { key: 'campaign', header: 'Campaign', className: 'text-xs whitespace-nowrap', cell: (r) => r.utm_campaign ?? '—' },
          { key: 'city', header: 'City', className: 'text-xs whitespace-nowrap', cell: (r) => r.ip_city ?? '—' },
          { key: 'score', header: 'Score', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => r.engagement_score },
          { key: 'intent', header: 'Intent', className: 'whitespace-nowrap', cell: (r) => <div className="flex flex-wrap gap-1">{(r.intent_tags ?? []).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t.replace(/_/g, ' ')}</Badge>)}</div> },
          { key: 'identified', header: 'Identified', className: 'text-xs whitespace-nowrap', cell: identifiedCell },
          { key: 'lastSeen', header: 'Last seen', className: 'text-xs whitespace-nowrap', cell: (r) => formatRelative(r.last_seen_at) },
        ]}
        renderCard={(r) => {
          const ch = classifySocial(r.utm_source) || '—'
          return (
            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={CHANNEL_COLOR[ch] ?? ''}>{ch}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">score {r.engagement_score} · {formatRelative(r.last_seen_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(r.utm_campaign ?? '—')} · {(r.ip_city ?? '—')} · {identifiedCell(r)}
                </p>
              </CardContent>
            </Card>
          )
        }}
        empty={<>No social visitors in the last 30 minutes.</>}
      />
    </section>
  )
}

// ─── GA4 cross-reference (last 30 days) ─────────────────────────────────────
async function Ga4SocialSources({ startDate, endDate }: { startDate: string; endDate: string }) {
  const res = await getGA4Summary(startDate, endDate)
  if (!res.ok) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">GA4 unavailable: {res.error}</CardContent></Card>
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
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">GA4 cross-reference (last 30 days, by source/medium)</h2>
        <p className="text-xs text-muted-foreground">From the GA4 Data API. Use this to validate the visitor_sessions count above and to see leads-per-source.</p>
      </div>
      <TableWithMobileCards
        rows={social}
        cap={10}
        getRowKey={(r) => r.source}
        columns={[
          { key: 'channel', header: 'Channel', cell: (r) => <Badge variant="outline" className={CHANNEL_COLOR[r.channel] ?? ''}>{r.channel}</Badge> },
          { key: 'source', header: 'Source / Medium', className: 'font-mono text-xs whitespace-nowrap', cell: (r) => r.source },
          { key: 'sessions', header: 'Sessions', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.sessions) },
          { key: 'users', header: 'Users', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.users) },
          { key: 'engaged', header: 'Engaged', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => formatInt(r.engaged) },
          { key: 'leads', header: 'Leads', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => <span className="font-semibold">{formatInt(r.leads)}</span> },
          { key: 'conv', header: 'Conv rate', className: 'text-right tabular-nums whitespace-nowrap', cell: (r) => r.sessions ? `${((r.leads / r.sessions) * 100).toFixed(1)}%` : '—' },
        ]}
        renderCard={(r) => (
          <Card>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className={CHANNEL_COLOR[r.channel] ?? ''}>{r.channel}</Badge>
                <span className="text-sm font-semibold tabular-nums">{formatInt(r.leads)} <span className="text-xs font-normal text-muted-foreground">leads</span></span>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">{r.source}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatInt(r.sessions)} sessions · {formatInt(r.users)} users · {r.sessions ? `${((r.leads / r.sessions) * 100).toFixed(1)}% conv` : '—'}</p>
            </CardContent>
          </Card>
        )}
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
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Social channels</h1>
        <p className="text-sm text-muted-foreground">
          Who is showing up from Facebook, Instagram, TikTok, YouTube, LinkedIn, X, Pinterest, Threads, Reddit, and Snapchat. Real-time from <code>visitor_sessions</code> plus a GA4 cross-reference for the last 30 days.
        </p>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>

      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <HeadlineSummary />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LiveSocialFeed />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ChannelBreakdown />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Ga4SocialSources startDate={range.startDate} endDate={range.endDate} />
      </Suspense>
    </div>
  )
}
