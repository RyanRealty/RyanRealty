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
 * Data access moved into lib/data/analytics/getSocialChannels.ts (G1 DAL
 * boundary) — classifySocial, every window (7d / today / 5-minute live /
 * 30-minute feed), and every aggregation are carried over verbatim, just
 * relocated. The GA4 range stays on lib/ga4-cache.ts (already a shared cached
 * module, not a raw client in the page). The per-platform brand colours are
 * gone: in the admin, colour is a reserved status vocabulary and never
 * decorates a label.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { DataList, Figures, Loading, Trouble } from '../_components/v2/kit'
import { getGA4SummaryCached as getGA4Summary } from '@/lib/ga4-cache'
import {
  classifySocial,
  getSocialChannelBreakdown,
  getSocialHeadlineSummary,
  getSocialLiveFeed,
} from '@/lib/data/analytics/getSocialChannels'
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
  const s = await getSocialHeadlineSummary()
  if (s.unreadable) {
    return (
      <Trouble>
        Could not load summary{s.errorMessage ? `: ${s.errorMessage}` : ''}. Retry — until it reads, treat the
        figures below as unknown, not as zero.
      </Trouble>
    )
  }

  return (
    <>
      <VerdictLine tone={s.liveNow > 0 || s.hot7d > 0 ? 'attention' : 'ok'}>
        {s.liveNow > 0 ? (
          <>
            <b>{formatInt(s.liveNow)} social visitor{s.liveNow === 1 ? '' : 's'} on the site now.</b>{' '}
            {formatInt(s.hot7d)} hot lead{s.hot7d === 1 ? '' : 's'} from social in the last 7 days.
          </>
        ) : s.hot7d > 0 ? (
          <>
            <b>{formatInt(s.hot7d)} hot lead{s.hot7d === 1 ? '' : 's'} from social in the last 7 days.</b> Nobody from social is on the site right now.
          </>
        ) : (
          <>
            <b>Nothing needs you from social.</b> {formatInt(s.last7d)} session{s.last7d === 1 ? '' : 's'} in the last 7 days, no hot leads.
          </>
        )}
      </VerdictLine>
      <Figures
        figures={[
          { label: 'Social active now (5m)', value: formatInt(s.liveNow) },
          { label: 'Social today', value: formatInt(s.today) },
          { label: 'Social last 7 days', value: formatInt(s.last7d), caption: `${formatPct(s.identified7d, s.last7d)} identified` },
          { label: 'Social hot leads (7d)', value: formatInt(s.hot7d), tone: s.hot7d > 0 ? 'ok' : undefined },
        ]}
      />
    </>
  )
}

// ─── Per-channel breakdown from visitor_sessions ───────────────────────────
async function ChannelBreakdown() {
  const { rows, unreadable, errorMessage } = await getSocialChannelBreakdown()
  if (unreadable) {
    return (
      <Trouble>
        Could not load channel breakdown{errorMessage ? `: ${errorMessage}` : ''}. Retry before reading anything into
        the channel mix.
      </Trouble>
    )
  }

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
  const { rows, unreadable, errorMessage } = await getSocialLiveFeed()
  if (unreadable) {
    return (
      <Trouble>
        Could not load the live social feed{errorMessage ? `: ${errorMessage}` : ''}. Retry before trusting this
        section.
      </Trouble>
    )
  }

  const identifiedCell = (r: (typeof rows)[number]) =>
    r.fubPersonId ? (
      <Link href={`/admin/people/${r.fubPersonId}`} style={{ color: 'var(--a-accent)' }}>
        {r.identifiedEmail ?? `Legacy #${r.fubPersonId}`}
      </Link>
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
        rowKey={(r) => r.sessionId}
        columns={[
          { key: 'channel', header: 'Channel', lead: true, cell: (r) => classifySocial(r.utmSource) || '—' },
          { key: 'campaign', header: 'Campaign', cell: (r) => r.utmCampaign ?? '—' },
          { key: 'city', header: 'City', cell: (r) => r.ipCity ?? '—' },
          { key: 'score', header: 'Score', num: true, cell: (r) => r.engagementScore },
          { key: 'intent', header: 'Intent', cell: (r) => r.intentTags.map((t) => t.replace(/_/g, ' ')).join(', ') || '—' },
          { key: 'identified', header: 'Identified', cell: identifiedCell },
          { key: 'lastSeen', header: 'Last seen', num: true, cell: (r) => formatRelative(r.lastSeenAt) },
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
