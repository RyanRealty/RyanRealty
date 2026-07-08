/**
 * /admin/reports/traffic-sources — comprehensive "how is everyone getting
 * to my site" report.
 *
 * The single most important attribution view: combines GA4 (source/medium +
 * channel groups) with our own visits / visitor_sessions tables (first-touch
 * UTMs + raw referrers + landing pages) so you can see where every visitor
 * came from across three independent data sources side by side.
 *
 * Why three data sources? They each have blind spots:
 *
 *   - **GA4 source/medium** — aggregated, polished, includes Google modeling
 *     for cookieless visitors. But you can't see individual URLs or
 *     referrers, only the bucketed source/medium pair.
 *   - **visitor_sessions** — our own first-touch attribution per session
 *     with full UTM + raw referrer + landing page. Survives ad blockers.
 *     But only fires when the WordPress + Next.js tracking snippet runs.
 *   - **visits** — every page view with its raw referrer. Fires from the
 *     visit-tracker on every authenticated session AND for the legacy
 *     WordPress site via the snippet. Includes a lot more granular data
 *     (every page hit), but no UTM parsing — just raw referrer URLs.
 *
 * The page renders ONE table per source so you can spot gaps:
 *
 *   1. Hero metrics — GA4 sessions, visits, unique cookies, GBP website
 *      clicks (the "source said it sent X clicks" number)
 *   2. GA4 default channel group breakdown (Organic Search, Direct, Paid
 *      Social, Email, Referral, etc.)
 *   3. GA4 source / medium top 20
 *   4. visitor_sessions UTM source / medium / campaign (first-touch, our DB)
 *   5. visits referrer top 30 (RAW referring URLs)
 *   6. Top landing pages (where visitors arrive first)
 *   7. Untagged traffic analysis — sessions with referrers but no UTMs.
 *      These are the channels you should fix by adding canonical UTMs.
 *      See docs/UTM_TRACKING_CONVENTION.md for the convention.
 *   8. GBP attribution callout — separate count of GBP website clicks
 *      from marketing_channel_daily vs how many of those are visible as
 *      google/organic sessions in GA4. Big gap = GBP "Website" link is
 *      not UTM-tagged.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { getGA4Summary, type GA4Summary } from '@/app/actions/ga4-report'
import DashboardSummaryStrip from '@/components/admin/DashboardSummaryStrip'
import { TableWithMobileCards } from '@/components/admin/TableWithMobileCards'
import { DateRangePicker } from '@/app/admin/(protected)/analytics/_components/DateRangePicker'
import { resolveDateRange } from '@/app/admin/(protected)/analytics/_lib/queries'

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

async function TrafficSourcesContent({ range }: { range: { startDate: string; endDate: string } }) {
  const supabase = getServiceSupabase()
  const sinceIso = `${range.startDate}T00:00:00.000Z`
  const untilIso = `${range.endDate}T23:59:59.999Z`
  const sinceDate = range.startDate

  // Parallel fetch: GA4 + visits + visitor_sessions + GBP totals.
  const [ga4Result, visitsRes, sessionsRes, gbpRes] = await Promise.all([
    getGA4Summary(range.startDate, range.endDate),
    supabase
      .from('visits')
      .select('path, referrer')
      .gte('created_at', sinceIso)
      .lte('created_at', untilIso)
      .limit(50000),
    supabase
      .from('visitor_sessions')
      .select('utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page, source_domain')
      .gte('first_seen_at', sinceIso)
      .lte('first_seen_at', untilIso)
      .limit(20000),
    supabase
      .from('marketing_channel_daily')
      .select('metric, value, date')
      .eq('channel', 'gbp')
      .eq('scope', 'account')
      .gte('date', sinceDate)
      .limit(5000),
  ])

  const ga4Ok = ga4Result.ok
  const ga4: GA4Summary | null = ga4Ok ? ga4Result.data : null
  const ga4Error = ga4Ok ? null : ga4Result.error

  const visits = (visitsRes.data ?? []) as VisitRow[]
  const sessions = (sessionsRes.data ?? []) as SessionRow[]
  const gbp = (gbpRes.data ?? []) as GbpDaily[]

  // Hero numbers.
  const ga4Sessions = ga4?.sessions ?? 0
  const ga4Users = ga4?.totalUsers ?? 0
  const visitsCount = visits.length
  const uniqueVisitorsApprox = new Set(visits.map((v) => v.path)).size  // rough
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

  // visits.referrer: raw referrer + classified bucket.
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

  // GBP attribution gap: visits whose referrer matches a google host.
  const googleReferrerVisits = visits.filter((v) => {
    const bucket = classifyReferrer(v.referrer)
    return bucket === 'google'
  }).length

  return (
    <div className="space-y-6">
      {!ga4Ok && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">
            GA4 Data API call failed: <code className="rounded bg-muted px-1">{ga4Error}</code>. The Supabase-side numbers below are still accurate.
          </AlertDescription>
        </Alert>
      )}

      {/* 1. Hero metrics — glanceable KPI band */}
      <DashboardSummaryStrip
        stats={[
          { label: `GA4 sessions (${range.startDate} to ${range.endDate})`, value: formatInt(ga4Sessions), caption: `${formatInt(ga4Users)} unique users` },
          { label: 'Visits captured', value: formatInt(visitsCount), caption: 'visits table (first-party)' },
          { label: 'First-touch sessions', value: formatInt(sessions.length), caption: 'visitor_sessions w/ attribution' },
          { label: 'GBP website clicks', value: formatInt(gbpWebsiteClicks), caption: `${formatInt(gbpCallClicks)} calls · ${formatInt(gbpDirectionsClicks)} directions` },
        ]}
      />

      {/* GBP attribution callout — the one place where you can spot the
          gap between what GBP reports as outbound clicks and what GA4 sees
          as inbound google/organic sessions. */}
      <Card>
        <CardHeader>
          <CardTitle>Google Business Profile attribution gap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">GBP website clicks (source-side)</p>
              <p className="text-2xl font-semibold tabular-nums">{formatInt(gbpWebsiteClicks)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">GA4 google/organic sessions</p>
              <p className="text-2xl font-semibold tabular-nums">{formatInt(ga4GoogleOrganic)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">visits w/ google.* referrer</p>
              <p className="text-2xl font-semibold tabular-nums">{formatInt(googleReferrerVisits)}</p>
            </div>
          </div>
          <Alert>
            <AlertDescription className="text-sm">
              <strong>How to read this:</strong> GBP says it sent <strong>{formatInt(gbpWebsiteClicks)}</strong> clicks to the site (source-side). GA4 google/organic = <strong>{formatInt(ga4GoogleOrganic)}</strong> sessions (regular search + any untagged GBP). The GBP &ldquo;Website&rdquo; link is now UTM-tagged with <code className="rounded bg-muted px-1">?utm_source=gbp&amp;utm_medium=organic&amp;utm_campaign=profile</code> (live 2026-05-24). Look for <strong>gbp / organic / profile</strong> rows in the &ldquo;First-touch UTM attribution&rdquo; table below as GBP visits land. Full convention in <code className="rounded bg-muted px-1">docs/UTM_TRACKING_CONVENTION.md</code> §2.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 2. GA4 source / medium */}
      {ga4 && ga4.socialChannels && (
        <section className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">GA4 source / medium</h2>
            <p className="text-xs text-muted-foreground">
              Aggregated by GA4&apos;s default attribution. Use this view for high-level channel-mix decisions.
            </p>
          </div>
          <TableWithMobileCards
            rows={ga4.topSources}
            cap={10}
            getRowKey={(s) => s.sourceMedium}
            columns={[
              { key: 'source', header: 'Source / Medium', className: 'whitespace-nowrap text-xs', cell: (s) => s.sourceMedium },
              { key: 'sessions', header: 'Sessions', className: 'whitespace-nowrap text-right tabular-nums', cell: (s) => formatInt(s.sessions) },
              { key: 'users', header: 'Users', className: 'whitespace-nowrap text-right tabular-nums', cell: (s) => formatInt(s.users) },
              { key: 'engaged', header: 'Engaged', className: 'whitespace-nowrap text-right tabular-nums', cell: (s) => formatInt(s.engagedSessions) },
              { key: 'rate', header: 'Engagement', className: 'whitespace-nowrap text-right tabular-nums', cell: (s) => `${(s.engagementRate * 100).toFixed(0)}%` },
            ]}
            renderCard={(s) => (
              <Card>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{s.sourceMedium}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatInt(s.sessions)} <span className="text-xs font-normal text-muted-foreground">sess</span></span>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatInt(s.users)} users · {formatInt(s.engagedSessions)} engaged · {(s.engagementRate * 100).toFixed(0)}% rate</p>
                </CardContent>
              </Card>
            )}
            empty={<>No source rows from GA4 for {range.startDate} to {range.endDate}. Confirm the GA4 Data API connection on the analytics overview.</>}
          />
        </section>
      )}

      {/* 3. Visitor_sessions UTM tally */}
      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">First-touch UTM attribution</h2>
          <p className="text-xs text-muted-foreground">
            Where each visitor came from on their FIRST visit (from <code className="rounded bg-muted px-1">visitor_sessions</code>). UTMs override referrer; <code className="rounded bg-muted px-1">(no utm)</code> means the channel didn&apos;t carry tags and was inferred from referrer instead.
          </p>
        </div>
        <TableWithMobileCards
          rows={topUtms}
          cap={10}
          getRowKey={(r) => `${r.source}|${r.medium}|${r.campaign}`}
          columns={[
            { key: 'source', header: 'Source', className: 'whitespace-nowrap text-xs', cell: (r) => r.source },
            { key: 'medium', header: 'Medium', className: 'whitespace-nowrap text-xs', cell: (r) => r.medium },
            { key: 'campaign', header: 'Campaign', className: 'whitespace-nowrap text-xs', cell: (r) => r.campaign },
            { key: 'sessions', header: 'Sessions', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.count) },
          ]}
          renderCard={(r) => (
            <Card>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{r.source} / {r.medium}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatInt(r.count)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{r.campaign}</p>
              </CardContent>
            </Card>
          )}
          empty={<>No first-touch sessions for {range.startDate} to {range.endDate}. The WordPress + Next.js tracking snippet has to fire for these to populate.</>}
        />
      </section>

      {/* 4. Raw referrers from visits table */}
      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Raw referrers</h2>
          <p className="text-xs text-muted-foreground">
            Every distinct referring URL recorded in <code className="rounded bg-muted px-1">visits.referrer</code>, classified into a coarse platform bucket. This is the rawest view — what the browser actually sent in the Referer header.
          </p>
        </div>
        <TableWithMobileCards
          rows={topReferrers}
          cap={10}
          getRowKey={(r) => `${r.bucket}|${r.referrer}`}
          columns={[
            { key: 'platform', header: 'Platform', className: 'whitespace-nowrap', cell: (r) => <Badge variant={r.bucket === '(direct)' || r.bucket === '(internal)' ? 'outline' : 'secondary'} className="text-[10px]">{r.bucket}</Badge> },
            { key: 'referrer', header: 'Referrer', className: 'max-w-md truncate text-xs', cell: (r) => r.referrer },
            { key: 'visits', header: 'Visits', className: 'whitespace-nowrap text-right tabular-nums', cell: (r) => formatInt(r.count) },
            { key: 'share', header: 'Share', className: 'whitespace-nowrap text-right tabular-nums text-muted-foreground', cell: (r) => formatPct(r.count, visitsCount) },
          ]}
          renderCard={(r) => (
            <Card>
              <CardContent className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={r.bucket === '(direct)' || r.bucket === '(internal)' ? 'outline' : 'secondary'} className="text-[10px]">{r.bucket}</Badge>
                  <span className="text-sm font-semibold tabular-nums">{formatInt(r.count)} <span className="text-xs font-normal text-muted-foreground">({formatPct(r.count, visitsCount)})</span></span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{r.referrer}</p>
              </CardContent>
            </Card>
          )}
          empty={<>No visits for {range.startDate} to {range.endDate}.</>}
        />
      </section>

      {/* 5. Top landing pages */}
      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Top landing pages (first hit per session)</h2>
          <p className="text-xs text-muted-foreground">
            Where each session began. High counts on <code className="rounded bg-muted px-1">/lp/&lt;variant&gt;</code> mean paid ads are sending traffic; high counts on <code className="rounded bg-muted px-1">/listings/...</code> mean organic SEO is working.
          </p>
        </div>
        <TableWithMobileCards
          rows={topLandings}
          cap={10}
          getRowKey={([lp]) => lp}
          columns={[
            { key: 'lp', header: 'Landing page', className: 'max-w-md truncate text-xs', cell: ([lp]) => lp },
            { key: 'sessions', header: 'Sessions', className: 'whitespace-nowrap text-right tabular-nums', cell: ([, count]) => formatInt(count) },
          ]}
          renderCard={([lp, count]) => (
            <Card>
              <CardContent className="flex items-center justify-between gap-2">
                <span className="truncate text-xs">{lp}</span>
                <span className="text-sm font-semibold tabular-nums">{formatInt(count)}</span>
              </CardContent>
            </Card>
          )}
          empty={<>No landing-page data yet. Once the tracking snippet records session starts, top pages appear here.</>}
        />
      </section>

      {/* 6. Untagged-channel analysis — actionable list */}
      {untaggedSorted.length > 0 && (
        <section className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Channels you should tag with UTMs ({formatInt(untaggedSessions.length)} untagged sessions)</h2>
            <p className="text-xs text-muted-foreground">
              These platforms sent visitors to the site without a UTM tag, so they collapse into &ldquo;referral&rdquo; in GA4. Adding the canonical UTM string to your links on each platform makes their traffic separable in reports.
            </p>
          </div>
          <TableWithMobileCards
            rows={untaggedSorted}
            cap={12}
            getRowKey={([platform]) => platform}
            columns={[
              { key: 'platform', header: 'Platform', className: 'whitespace-nowrap', cell: ([platform]) => <Badge variant="default" className="text-[10px]">{platform}</Badge> },
              { key: 'count', header: 'Untagged sessions', className: 'whitespace-nowrap text-right tabular-nums', cell: ([, count]) => formatInt(count) },
              { key: 'utm', header: 'Suggested UTM string', className: 'whitespace-nowrap font-mono text-[10px] text-muted-foreground', cell: ([platform]) => <>?utm_source={platform}&amp;utm_medium=referral&amp;utm_campaign=organic</> },
            ]}
            renderCard={([platform, count]) => (
              <Card>
                <CardContent className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="default" className="text-[10px]">{platform}</Badge>
                    <span className="text-sm font-semibold tabular-nums">{formatInt(count)} <span className="text-xs font-normal text-muted-foreground">untagged</span></span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">?utm_source={platform}&amp;utm_medium=referral&amp;utm_campaign=organic</p>
                </CardContent>
              </Card>
            )}
            empty={<>Every referring channel is carrying a UTM tag. Nothing to fix here.</>}
          />
          <p className="text-xs text-muted-foreground">
            See <code className="rounded bg-muted px-1">docs/UTM_TRACKING_CONVENTION.md</code> for the recommended UTM string per channel (GBP, IG bio, email signature, YouTube descriptions, etc.).
          </p>
        </section>
      )}

      <Separator />

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Data sources:</strong> GA4 Data API (sessions, source/medium), Supabase <code className="rounded bg-muted px-1">visits</code> (raw page views + referrer), <code className="rounded bg-muted px-1">visitor_sessions</code> (first-touch UTMs), <code className="rounded bg-muted px-1">marketing_channel_daily</code> filtered to <code className="rounded bg-muted px-1">channel=gbp</code> (GBP outbound click counts).
        </p>
        <p>
          <strong className="text-foreground">Related:</strong>{' '}
          <Link href="/admin/analytics/google-business-profile" className="underline hover:no-underline">GBP performance dashboard</Link>{' · '}
          <Link href="/admin/reports/lead-flow" className="underline hover:no-underline">Lead-flow report</Link>{' · '}
          <Link href="/admin/crm" className="underline hover:no-underline">Contacts</Link>{' · '}
          <Link href="/admin/analytics" className="underline hover:no-underline">Performance hub</Link>
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function TrafficSourcesReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Traffic sources</h1>
        <p className="text-sm text-muted-foreground">
          Where every visitor came from. Joins GA4 with our own <code className="rounded bg-muted px-1">visits</code> + <code className="rounded bg-muted px-1">visitor_sessions</code> tables so you can spot the gaps between what each platform reports as outbound clicks and what GA4 actually attributes. Includes a list of platforms you should tag with canonical UTMs.
        </p>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <TrafficSourcesContent range={range} />
      </Suspense>
    </div>
  )
}
