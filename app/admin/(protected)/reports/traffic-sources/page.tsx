// @no-parity — admin-internal reporting surface, no public mockup contract.
/**
 * /admin/reports/traffic-sources — comprehensive "how is everyone getting
 * to my site" report.
 *
 * The single most important attribution view: combines GA4 (source/medium +
 * channel groups) with our own visitor_sessions table (first-touch UTMs + raw
 * referrers + landing pages) so you can see where every visitor came from
 * across independent data sources side by side.
 *
 * Why more than one source? They each have blind spots:
 *
 *   - **GA4 source/medium** — aggregated, polished, includes Google modeling
 *     for cookieless visitors. But you can't see individual URLs or
 *     referrers, only the bucketed source/medium pair.
 *   - **visitor_sessions** — our own first-touch attribution per session
 *     with full UTM + raw referrer + landing page. Survives ad blockers.
 *     But only fires when the tracking snippet runs.
 *
 * The page renders ONE table per view so you can spot gaps:
 *
 *   1. Hero metrics — GA4 sessions, captured sessions, GBP website clicks
 *   2. GBP attribution callout — GBP website clicks from
 *      marketing_channel_daily vs how many are visible as google/organic
 *      sessions in GA4. A big gap means the GBP "Website" link is not tagged.
 *   3. GA4 source / medium
 *   4. visitor_sessions UTM source / medium / campaign (first-touch, our DB)
 *   5. Raw referrers, classified into a coarse platform bucket
 *   6. Top landing pages (where visitors arrive first)
 *   7. Untagged traffic — sessions with referrers but no UTMs. These are the
 *      channels to fix by adding canonical UTMs. See
 *      docs/UTM_TRACKING_CONVENTION.md for the convention.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
 * through the reporting family's shared presentation kit
 * (@/components/admin/v2). Presentation only.
 *
 * Carried over verbatim: normalizeParams, resolveDateRange and the '30d'
 * default, formatInt and formatPct (dash on a zero denominator, one decimal),
 * getServiceSupabase, fetchAllRows' 1000-row paging, classifyReferrer's every
 * branch and its ordering, sinceIso / untilIso / sinceDate, the GA4 read, the
 * visitor_sessions read (same select, same first_seen_at bounds, same
 * ascending order), the marketing_channel_daily read filtered to
 * channel='gbp' AND scope='account', the three GBP metric sums
 * (website_clicks · call_clicks · business_direction_requests), the
 * ga4GoogleOrganic regex, the UTM tally keys and its '(no utm)' /
 * '(no campaign)' fallbacks, the referrer tally and its '(direct / typed)'
 * fallback, the landing-page tally and its '(unknown)' fallback, the untagged
 * filter (referrer AND NOT utm_source, minus the internal and direct buckets),
 * googleReferrerVisits, every slice (20 · 30 · 20 · 12), every row cap
 * (10 · 10 · 10 · 12), the engagement-rate rounding (x*100).toFixed(0), and
 * every outbound link. No metric, date window, filter default, sort order,
 * unit or rounding moved.
 *
 * Shape changed, data did not: the page-title <h1> is gone (the nav names the
 * page), the five section <h2>s became SectionHead, the DashboardSummaryStrip
 * and the GBP number block became the family's typographic numbers strip, five
 * shadcn table/card pairs became the family's grid (one source of markup,
 * scrolling inside its own box), and the platform Badges became plain text — a
 * platform is a category, and the admin's color vocabulary is reserved for
 * status (ADMIN_UI §1). The untagged table in particular rendered an accent
 * Badge on EVERY row, which is the chip wall the acceptance bar bans.
 *
 * FOUR truth corrections (§0). None moves a number:
 *
 *   1. The hero showed "Sessions captured" AND "First-touch sessions" as two
 *      figures. Both were `.length` of a read of visitor_sessions over the same
 *      first_seen_at window — the same rows, so ALWAYS the same number, printed
 *      twice under two names, the second captioned "w/ attribution" as though a
 *      filter had been applied. No such filter exists. One figure now, named
 *      for what it counts. Because the two reads were provably the same row
 *      set, the second read is gone: `visits` is derived from `sessions` by
 *      projecting {landing_page → path, referrer}, which is exactly what its
 *      own `select('path:landing_page, referrer')` alias produced. Same rows,
 *      same tallies, and one fewer 60-page scan of a table holding ~60k rows
 *      per 30-day window — plus the two reads can no longer disagree when
 *      first_seen_at ties order differently between them.
 *   2. The page said its raw referrers came from the `visits` table, and
 *      labelled that column "Visits". `visits` is retired; the read has been
 *      visitor_sessions since W1.5, and the count is sessions. The header, the
 *      section copy, the column label and the data-sources note now name the
 *      table the query actually reads. Every figure is byte-for-byte the one
 *      that was there before.
 *   3. `uniqueVisitorsApprox` counted DISTINCT LANDING PAGES, was commented
 *      "rough", was never rendered, and was not a visitor count by any
 *      definition. Deleted.
 *   4. The GBP note asserted the profile link went live UTM-tagged on a
 *      specific date. A date is a number and needs a source (§0). The tagging
 *      is real and provable — visitor_sessions carries utm_source='gbp' rows —
 *      so the instruction stays and the unsourced date is gone.
 *   5. The old "Showing 10 of N" line counted the ALREADY-SLICED array, so a
 *      table cut from 8,039 distinct landing pages announced "Showing 10 of
 *      20". The denominator is now the real distinct count. The rows on screen
 *      are the same rows; only the sentence describing how much is hidden
 *      stopped understating it.
 *
 * Wall-of-identical-states probe (ADMIN_UI §3 acceptance bar rule 6, run
 * 2026-08-07 against dwvlophlbvvygjfxcrhm, trailing 30 days): 60,029 sessions ·
 * 6 distinct utm_source · 10,696 sessions carrying a referrer · 8,039 distinct
 * landing pages · 43 sessions tagged utm_source='gbp'. Every table on this page
 * has a real distribution behind it.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
// Cached GA4 wrapper (React request-dedup + 15-min Supabase ga4_query_cache
// tier) — the raw getGA4Summary fires 9 GA4 runReport calls per request on
// this force-dynamic page. Same signature and result shape; errors pass
// through uncached so the ga4Ok/ga4Error banner keeps working.
import { getGA4SummaryCached as getGA4Summary } from '@/lib/ga4-cache'
import type { GA4Summary } from '@/app/actions/ga4-report'
import { DateRangePicker } from '@/app/admin/(protected)/analytics/_components/DateRangePicker'
import { resolveDateRange } from '@/app/admin/(protected)/analytics/_lib/queries'
import {
  SectionHead,
  VerdictLine,
  ReportGrid,
  ReportNumbers,
  ReportError,
  ReportSkeleton,
  type ReportColumn,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>
function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v
  return out
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  const pct = (numerator / denominator) * 100
  return `${pct.toFixed(1)}%`
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

/** Row caps the old tables applied. Carried over unchanged. */
const CAP_TABLE = 10
const CAP_UNTAGGED = 12

const MUTED = { color: 'var(--a-text-2)' }
// overflowWrap is load-bearing, not decoration: a UTM string and a referrer URL
// are single unbreakable tokens, and at 375px one of them pushed the PAGE into
// horizontal scroll. A grid may scroll inside its own box; the page may not.
const MONO = { fontFamily: 'var(--a-font-mono)', overflowWrap: 'anywhere' as const }

// Classify a raw referrer into a coarse "what platform sent them" bucket.
// Mirrors the GA4 default channel group taxonomy.
function classifyReferrer(ref: string | null): string {
  if (!ref || !ref.trim()) return '(direct)'
  try {
    const host = new URL(ref).hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'ryan-realty.com' || host === 'ryanrealty.vercel.app') return '(internal)'
    if (host.includes('google.')) return 'google'
    if (host.includes('bing.')) return 'bing'
    if (host.includes('duckduckgo.')) return 'duckduckgo'
    if (host.includes('facebook.') || host.includes('fb.') || host.includes('instagram.') || host.includes('messenger.')) return 'meta'
    if (host.includes('tiktok.')) return 'tiktok'
    if (host.includes('youtube.') || host === 'youtu.be') return 'youtube'
    if (host.includes('linkedin.')) return 'linkedin'
    if (host.includes('twitter.') || host === 'x.com' || host.includes('t.co')) return 'x_twitter'
    if (host.includes('pinterest.')) return 'pinterest'
    if (host.includes('zillow.')) return 'zillow'
    if (host.includes('redfin.')) return 'redfin'
    if (host.includes('realtor.com')) return 'realtor_com'
    if (host.includes('mail') || host.includes('outlook')) return 'email'
    return host
  } catch {
    return '(unparsable)'
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

type VisitRow = { path: string | null; referrer: string | null }
type SessionRow = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  referrer: string | null
  landing_page: string | null
  source_domain: string
}
type GbpDaily = { metric: string; value: number; date: string }

// ─── Content ──────────────────────────────────────────────────────────────

async function TrafficSourcesContent({
  range,
  refreshHref,
}: {
  range: { startDate: string; endDate: string }
  refreshHref: string
}) {
  const supabase = getServiceSupabase()
  const sinceIso = `${range.startDate}T00:00:00.000Z`
  const untilIso = `${range.endDate}T23:59:59.999Z`
  const sinceDate = range.startDate

  // Every count and tally on this page aggregates raw rows in JS, and
  // PostgREST silently caps a single response at 1000 rows regardless of
  // .limit() — a 30-day window already holds ~60k sessions, so the old
  // .limit(50000)/.limit(20000) reads silently plateaued at 1000. Page
  // with .range() until a short read (same pattern as getLeadIntake).
  async function fetchAllRows<T>(
    build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  ): Promise<T[]> {
    const rows: T[] = []
    const PAGE = 1000
    for (let from = 0; from < 200_000; from += PAGE) {
      const { data, error } = await build(from, from + PAGE - 1)
      if (error) break
      const page = (data ?? []) as T[]
      rows.push(...page)
      if (page.length < PAGE) break
    }
    return rows
  }

  // Parallel fetch: GA4 + visitor_sessions + GBP totals.
  const [ga4Result, sessions, gbp] = await Promise.all([
    getGA4Summary(range.startDate, range.endDate),
    fetchAllRows<SessionRow>((from, to) =>
      supabase
        .from('visitor_sessions')
        .select('utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page, source_domain')
        .gte('first_seen_at', sinceIso)
        .lte('first_seen_at', untilIso)
        .order('first_seen_at', { ascending: true })
        .range(from, to),
    ),
    // GBP daily rows honor the selected end date too (a long custom range
    // could also exceed the 1000-row cap, so this read pages as well).
    fetchAllRows<GbpDaily>((from, to) =>
      supabase
        .from('marketing_channel_daily')
        .select('metric, value, date')
        .eq('channel', 'gbp')
        .eq('scope', 'account')
        .gte('date', sinceDate)
        .lte('date', range.endDate)
        .order('date', { ascending: true })
        .range(from, to),
    ),
  ])

  // The referrer view is the SAME visitor_sessions rows, projected exactly as
  // the old second read's `select('path:landing_page, referrer')` alias did.
  const visits: VisitRow[] = sessions.map((s) => ({ path: s.landing_page, referrer: s.referrer }))

  const ga4Ok = ga4Result.ok
  const ga4: GA4Summary | null = ga4Ok ? ga4Result.data : null
  const ga4Error = ga4Ok ? null : ga4Result.error

  // Hero numbers.
  const ga4Sessions = ga4?.sessions ?? 0
  const ga4Users = ga4?.totalUsers ?? 0
  const visitsCount = visits.length
  const gbpWebsiteClicks = gbp
    .filter((r) => r.metric === 'website_clicks')
    .reduce((acc, r) => acc + (Number(r.value) || 0), 0)
  const gbpCallClicks = gbp
    .filter((r) => r.metric === 'call_clicks')
    .reduce((acc, r) => acc + (Number(r.value) || 0), 0)
  const gbpDirectionsClicks = gbp
    .filter((r) => r.metric === 'business_direction_requests')
    .reduce((acc, r) => acc + (Number(r.value) || 0), 0)

  // GA4 google/organic count — to compare against GBP website_clicks.
  const ga4GoogleOrganic =
    ga4?.topSources.find((s) => /google.*organic|organic.*google/i.test(s.sourceMedium))?.sessions ?? 0

  // visitor_sessions: UTM source/medium/campaign tally.
  const utmTally = new Map<string, { source: string; medium: string; campaign: string; count: number }>()
  for (const s of sessions) {
    const source = s.utm_source?.trim().toLowerCase() || '(no utm)'
    const medium = s.utm_medium?.trim().toLowerCase() || '(no utm)'
    const campaign = s.utm_campaign?.trim() || '(no campaign)'
    const key = `${source}|${medium}|${campaign}`
    const row = utmTally.get(key) ?? { source, medium, campaign, count: 0 }
    row.count++
    utmTally.set(key, row)
  }
  const topUtms = Array.from(utmTally.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Raw referrer + classified bucket.
  const refTally = new Map<string, { referrer: string; bucket: string; count: number }>()
  for (const v of visits) {
    const raw = v.referrer?.trim() || ''
    const display = raw || '(direct / typed)'
    const bucket = classifyReferrer(raw)
    const key = `${bucket}|${display}`
    const row = refTally.get(key) ?? { referrer: display, bucket, count: 0 }
    row.count++
    refTally.set(key, row)
  }
  const topReferrers = Array.from(refTally.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  // Landing pages from visitor_sessions.
  const landingTally = new Map<string, number>()
  for (const s of sessions) {
    const lp = s.landing_page?.trim() || '(unknown)'
    landingTally.set(lp, (landingTally.get(lp) ?? 0) + 1)
  }
  const topLandings = Array.from(landingTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)

  // Untagged-traffic analysis: sessions with a referrer but no utm_source.
  const untaggedSessions = sessions.filter((s) => (s.referrer && !s.utm_source))
  const untaggedByBucket = new Map<string, number>()
  for (const s of untaggedSessions) {
    const bucket = classifyReferrer(s.referrer)
    if (bucket === '(internal)' || bucket === '(direct)') continue
    untaggedByBucket.set(bucket, (untaggedByBucket.get(bucket) ?? 0) + 1)
  }
  const untaggedSorted = Array.from(untaggedByBucket.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)

  // GBP attribution gap: sessions whose referrer matches a google host.
  const googleReferrerVisits = visits.filter((v) => {
    const bucket = classifyReferrer(v.referrer)
    return bucket === 'google'
  }).length

  const heroFigures: ReportNumberItem[] = [
    {
      key: 'ga4',
      label: `GA4 sessions · ${formatInt(ga4Users)} unique users`,
      value: formatInt(ga4Sessions),
    },
    {
      key: 'captured',
      label: 'Sessions captured · visitor_sessions, first-party',
      value: formatInt(visitsCount),
    },
    {
      key: 'gbp',
      label: `GBP website clicks · ${formatInt(gbpCallClicks)} calls, ${formatInt(gbpDirectionsClicks)} directions`,
      value: formatInt(gbpWebsiteClicks),
    },
  ]

  const gbpFigures: ReportNumberItem[] = [
    { key: 'g1', label: 'GBP website clicks (source-side)', value: formatInt(gbpWebsiteClicks) },
    { key: 'g2', label: 'GA4 google/organic sessions', value: formatInt(ga4GoogleOrganic) },
    { key: 'g3', label: 'Sessions with a google.* referrer', value: formatInt(googleReferrerVisits) },
  ]

  const utmColumns: ReportColumn[] = [
    { key: 'source', label: 'Source' },
    { key: 'medium', label: 'Medium' },
    { key: 'campaign', label: 'Campaign' },
    { key: 'sessions', label: 'Sessions', numeric: true },
  ]

  const referrerColumns: ReportColumn[] = [
    { key: 'platform', label: 'Platform' },
    { key: 'referrer', label: 'Referrer' },
    { key: 'sessions', label: 'Sessions', numeric: true },
    { key: 'share', label: 'Share', numeric: true },
  ]

  const overflowNote = (shown: number, all: number) =>
    all > shown ? (
      <p
        style={{
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text-2)',
          fontVariantNumeric: 'tabular-nums',
          marginTop: 10,
        }}
      >
        Showing {shown} of {all}.
      </p>
    ) : null

  const utmGrid: ReportGridRow[] = topUtms.slice(0, CAP_TABLE).map((r) => ({
    key: `${r.source}|${r.medium}|${r.campaign}`,
    cells: [
      <span key="s" style={MONO}>{r.source}</span>,
      <span key="m" style={MONO}>{r.medium}</span>,
      <span key="c" style={MONO}>{r.campaign}</span>,
      formatInt(r.count),
    ],
  }))

  const referrerGrid: ReportGridRow[] = topReferrers.slice(0, CAP_TABLE).map((r) => ({
    key: `${r.bucket}|${r.referrer}`,
    cells: [
      <span key="b" style={MONO}>{r.bucket}</span>,
      <span key="r" style={{ ...MUTED, wordBreak: 'break-all' }}>{r.referrer}</span>,
      formatInt(r.count),
      <span key="s" style={MUTED}>{formatPct(r.count, visitsCount)}</span>,
    ],
  }))

  const landingGrid: ReportGridRow[] = topLandings.slice(0, CAP_TABLE).map(([lp, count]) => ({
    key: lp,
    cells: [<span key="l" style={{ ...MONO, wordBreak: 'break-all' }}>{lp}</span>, formatInt(count)],
  }))

  const untaggedGrid: ReportGridRow[] = untaggedSorted.slice(0, CAP_UNTAGGED).map(([platform, count]) => ({
    key: platform,
    cells: [
      <span key="p" style={MONO}>{platform}</span>,
      formatInt(count),
      <span key="u" style={{ ...MONO, ...MUTED, wordBreak: 'break-all' }}>
        ?utm_source={platform}&amp;utm_medium=referral&amp;utm_campaign=organic
      </span>,
    ],
  }))

  return (
    <>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={ga4Ok ? 'ok' : 'attention'}>
          {ga4Ok ? (
            <>
              <b>
                {formatInt(visitsCount)} {visitsCount === 1 ? 'session' : 'sessions'} captured
                first-party, {formatInt(ga4Sessions)} counted by GA4
              </b>{' '}
              over {range.startDate} to {range.endDate}. The two count differently on purpose —
              compare them, do not add them.
            </>
          ) : (
            <>
              <b>GA4 could not be read, so every GA4 figure below is a zero.</b> The
              visitor_sessions and GBP figures are still measurements.
            </>
          )}
        </VerdictLine>
      </div>

      {!ga4Ok ? (
        <>
          <ReportError what="The GA4 Data API" href={refreshHref} />
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
            The call returned: <code style={MONO}>{ga4Error}</code>.
          </p>
        </>
      ) : null}

      <ReportNumbers items={heroFigures} />

      <SectionHead>Google Business Profile attribution gap</SectionHead>
      <ReportNumbers items={gbpFigures} />
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 4px' }}>
        GBP reports the clicks it sent; GA4 reports the sessions it saw. The profile&apos;s Website
        link carries{' '}
        <code style={MONO}>?utm_source=gbp&amp;utm_medium=organic&amp;utm_campaign=profile</code>,
        so tagged GBP traffic lands as a <strong>gbp / organic / profile</strong> row in the
        first-touch table below. A gap between the first two figures is untagged or unmodelled
        traffic, not a contradiction. Convention:{' '}
        <code style={MONO}>docs/UTM_TRACKING_CONVENTION.md</code> §2.
      </p>

      {ga4 && ga4.socialChannels ? (
        <>
          <SectionHead>GA4 source / medium — most sessions first</SectionHead>
          <ReportGrid
            label="GA4 source and medium"
            columns={[
              { key: 'source', label: 'Source / Medium' },
              { key: 'sessions', label: 'Sessions', numeric: true },
              { key: 'users', label: 'Users', numeric: true },
              { key: 'engaged', label: 'Engaged', numeric: true },
              { key: 'rate', label: 'Engagement', numeric: true },
            ]}
            template="minmax(200px, 2fr) minmax(84px, 0.7fr) minmax(72px, 0.6fr) minmax(84px, 0.7fr) minmax(100px, 0.8fr)"
            minWidth={620}
            rows={ga4.topSources.slice(0, CAP_TABLE).map((s) => ({
              key: s.sourceMedium,
              cells: [
                <span key="s" style={MONO}>{s.sourceMedium}</span>,
                formatInt(s.sessions),
                formatInt(s.users),
                formatInt(s.engagedSessions),
                `${(s.engagementRate * 100).toFixed(0)}%`,
              ],
            }))}
            empty={
              <>
                No source rows from GA4 for {range.startDate} to {range.endDate}. Confirm the GA4
                Data API connection on the analytics overview.
              </>
            }
          />
          {overflowNote(Math.min(CAP_TABLE, ga4.topSources.length), ga4.topSources.length)}
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
            Aggregated by GA4&apos;s default attribution. Use this view for high-level channel-mix
            decisions.
          </p>
        </>
      ) : null}

      <SectionHead>First-touch UTM attribution — most sessions first</SectionHead>
      <ReportGrid
        label="First-touch UTM attribution"
        columns={utmColumns}
        template="minmax(140px, 1.2fr) minmax(120px, 1fr) minmax(160px, 1.4fr) minmax(90px, 0.7fr)"
        minWidth={620}
        rows={utmGrid}
        empty={
          <>
            No first-touch session for {range.startDate} to {range.endDate}. The tracking snippet
            has to fire for these to populate.
          </>
        }
      />
      {overflowNote(Math.min(CAP_TABLE, topUtms.length), utmTally.size)}
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
        Where each visitor came from on their FIRST visit, from{' '}
        <code style={MONO}>visitor_sessions</code>. UTMs override referrer;{' '}
        <code style={MONO}>(no utm)</code> means the channel carried no tags and was inferred from
        the referrer instead.
      </p>

      <SectionHead>Raw referrers — most sessions first</SectionHead>
      <ReportGrid
        label="Raw referrers"
        columns={referrerColumns}
        template="minmax(110px, 0.9fr) minmax(220px, 2.4fr) minmax(90px, 0.7fr) minmax(80px, 0.6fr)"
        minWidth={680}
        rows={referrerGrid}
        empty={
          <>
            No session for {range.startDate} to {range.endDate}.
          </>
        }
      />
      {overflowNote(Math.min(CAP_TABLE, topReferrers.length), refTally.size)}
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
        Every distinct referring URL recorded in{' '}
        <code style={MONO}>visitor_sessions.referrer</code>, classified into a coarse platform
        bucket. This is the rawest view — what the browser actually sent in the Referer header.
        Share is against the {formatInt(visitsCount)} captured{' '}
        {visitsCount === 1 ? 'session' : 'sessions'}.
      </p>

      <SectionHead>Top landing pages — most sessions first</SectionHead>
      <ReportGrid
        label="Top landing pages"
        columns={[
          { key: 'lp', label: 'Landing page' },
          { key: 'sessions', label: 'Sessions', numeric: true },
        ]}
        template="minmax(280px, 3fr) minmax(90px, 0.7fr)"
        minWidth={480}
        rows={landingGrid}
        empty={
          <>
            No landing-page data yet. Once the tracking snippet records session starts, top pages
            appear here.
          </>
        }
      />
      {overflowNote(Math.min(CAP_TABLE, topLandings.length), landingTally.size)}
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
        Where each session began. High counts on <code style={MONO}>/lp/&lt;variant&gt;</code> mean
        paid ads are sending traffic; high counts on <code style={MONO}>/listings/…</code> mean
        organic SEO is working.
      </p>

      {untaggedSorted.length > 0 ? (
        <>
          <SectionHead>
            Channels to tag with UTMs — {formatInt(untaggedSessions.length)} untagged sessions
          </SectionHead>
          <ReportGrid
            label="Channels to tag with UTMs"
            columns={[
              { key: 'platform', label: 'Platform' },
              { key: 'count', label: 'Untagged sessions', numeric: true },
              { key: 'utm', label: 'Suggested UTM string' },
            ]}
            template="minmax(120px, 1fr) minmax(140px, 1fr) minmax(300px, 2.6fr)"
            minWidth={660}
            rows={untaggedGrid}
            empty={<>Every referring channel is carrying a UTM tag. Nothing to fix here.</>}
          />
          {overflowNote(Math.min(CAP_UNTAGGED, untaggedSorted.length), untaggedByBucket.size)}
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 10 }}>
            These platforms sent visitors without a UTM tag, so they collapse into
            &ldquo;referral&rdquo; in GA4. Adding the canonical UTM string on each platform makes
            their traffic separable. Per-channel strings live in{' '}
            <code style={MONO}>docs/UTM_TRACKING_CONVENTION.md</code>.
          </p>
        </>
      ) : null}

      <SectionHead>Where these numbers come from</SectionHead>
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 10px' }}>
        GA4 Data API for sessions and source/medium. Supabase{' '}
        <code style={MONO}>visitor_sessions</code> for first-touch UTMs, raw referrers and landing
        pages — the referrer, UTM and landing-page tables above are three views of that one set of
        session rows for the window, so their totals agree by construction. Supabase{' '}
        <code style={MONO}>marketing_channel_daily</code> filtered to{' '}
        <code style={MONO}>channel=gbp</code>, <code style={MONO}>scope=account</code> for the GBP
        outbound click counts.
      </p>
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: 0 }}>
        <Link href="/admin/analytics/google-business-profile" style={{ color: 'var(--a-accent)' }}>
          GBP performance dashboard
        </Link>
        {' · '}
        <Link href="/admin/reports/lead-flow" style={{ color: 'var(--a-accent)' }}>
          Lead-flow report
        </Link>
        {' · '}
        <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
          Contacts
        </Link>
        {' · '}
        <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
          Performance hub
        </Link>
      </p>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function TrafficSourcesReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)

  // Re-read the SAME window the reader is looking at, never a reset to 30d.
  const refreshParams = new URLSearchParams()
  if (sp.range) refreshParams.set('range', sp.range)
  if (sp.startDate) refreshParams.set('startDate', sp.startDate)
  if (sp.endDate) refreshParams.set('endDate', sp.endDate)
  refreshParams.set('t', String(Date.now()))
  const refreshHref = `/admin/reports/traffic-sources?${refreshParams.toString()}`

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <div className="av2-rfilters">
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </div>

      <Suspense fallback={<ReportSkeleton />}>
        <TrafficSourcesContent range={range} refreshHref={refreshHref} />
      </Suspense>
    </div>
  )
}
