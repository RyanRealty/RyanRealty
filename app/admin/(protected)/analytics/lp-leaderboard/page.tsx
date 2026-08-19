/**
 * /admin/analytics/lp-leaderboard - which landing page converts the best.
 *
 * Per-LP-variant table: visits, form_start count, generate_lead count,
 * conversion rate, identified rate, top traffic source, top city.
 *
 * The number that matters: conversion rate. Tells Matt which LP to send
 * paid spend to and which to fix or kill. Pairs with the funnel-breakdown
 * page which shows WHY the conversion rate is what it is.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — the visitor_sessions read, the 10,000-row page cap, the
 * lpVariantFromPath mapping, every rate computation and the best/worst gap
 * threshold are carried over verbatim.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { SectionHead, StateWord, VerdictLine } from '@/components/admin/v2'
import { DataList, Figures, Loading, Trouble } from '../_components/v2/kit'
import { RangeControl } from '../_components/v2/RangeControl'
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

function formatInt(n: number): string { return new Intl.NumberFormat('en-US').format(n) }
function formatPct(num: number, den: number): string {
  if (den === 0) return '—'
  return `${((num / den) * 100).toFixed(1)}%`
}

// Pull the LP slug out of a URL path like /lp/seller-home-value/, /lp/buyer-listing-alerts, /lp/expired-listing
// Treats /home-valuation as the seller LP also (legacy alias).
function lpVariantFromPath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  let p = pathOrUrl
  try { p = new URL(pathOrUrl).pathname } catch { /* already a path */ }
  p = p.toLowerCase().replace(/\/+$/, '')
  if (p === '/home-valuation') return 'seller-home-value'
  const m = p.match(/^\/lp\/([a-z0-9-]+)/)
  if (m) return m[1]
  return null
}

type LpRow = {
  variant: string
  visits: number
  identified: number
  hot: number
  scoreSum: number
  topSourceCounts: Map<string, number>
  topCityCounts: Map<string, number>
}

async function LpLeaderboard({ range }: { range: { startDate: string; endDate: string } }) {
  const supabase = getServiceSupabase()
  const cutoff = `${range.startDate}T00:00:00.000Z`
  const until = `${range.endDate}T23:59:59.999Z`

  // Pull sessions whose first-touch landing page is an LP (or hits one of
  // our LP slugs). We classify the variant from `landing_page` then aggregate
  // in JS. Paged read up to 10,000 sessions — PostgREST caps single responses
  // at 1,000 rows, so the old .limit(10000) silently truncated there.
  const { rows: data, error } = await fetchPagedRows(
    (from, to) =>
      supabase
        .from('visitor_sessions')
        .select('session_id, landing_page, utm_source, utm_medium, utm_campaign, identified_at, hot_lead_fired_at, engagement_score, ip_city')
        .gte('first_seen_at', cutoff)
        .lte('first_seen_at', until)
        .order('session_id', { ascending: true })
        .range(from, to),
    10000,
  )
  if (error) {
    return (
      <Trouble>
        Could not load sessions: {error.message}. Nothing on this page is trustworthy until that read succeeds — retry,
        then check the service-role key.
      </Trouble>
    )
  }

  const byVariant = new Map<string, LpRow>()
  for (const raw of data) {
    const row = raw as { landing_page: string | null; utm_source: string | null; identified_at: string | null; hot_lead_fired_at: string | null; engagement_score: number; ip_city: string | null }
    const variant = lpVariantFromPath(row.landing_page)
    if (!variant) continue
    const r = byVariant.get(variant) ?? {
      variant,
      visits: 0,
      identified: 0,
      hot: 0,
      scoreSum: 0,
      topSourceCounts: new Map<string, number>(),
      topCityCounts: new Map<string, number>(),
    }
    r.visits += 1
    if (row.identified_at) r.identified += 1
    if (row.hot_lead_fired_at) r.hot += 1
    r.scoreSum += row.engagement_score || 0
    if (row.utm_source) r.topSourceCounts.set(row.utm_source, (r.topSourceCounts.get(row.utm_source) ?? 0) + 1)
    if (row.ip_city) r.topCityCounts.set(row.ip_city, (r.topCityCounts.get(row.ip_city) ?? 0) + 1)
    byVariant.set(variant, r)
  }

  function topOf(m: Map<string, number>): string {
    let best = '—'
    let bestN = 0
    for (const [k, n] of m) { if (n > bestN) { best = k; bestN = n } }
    return best
  }

  const rows = Array.from(byVariant.values())
    .map((r) => ({
      variant: r.variant,
      visits: r.visits,
      identified: r.identified,
      hot: r.hot,
      identifyRate: r.visits ? r.identified / r.visits : 0,
      hotRate: r.visits ? r.hot / r.visits : 0,
      avgScore: r.visits ? r.scoreSum / r.visits : 0,
      topSource: topOf(r.topSourceCounts),
      topCity: topOf(r.topCityCounts),
    }))
    .sort((a, b) => b.identifyRate - a.identifyRate)

  if (rows.length === 0) {
    return (
      <div className="av2-empty">
        No LP sessions captured in the last 30 days yet. Once visitors arrive at any /lp/[variant] page and consent to tracking, the leaderboard fills in.
      </div>
    )
  }

  // Best vs worst gap for the insights callout
  const best = rows[0]
  const worst = rows[rows.length - 1]
  const gap = best.identifyRate - worst.identifyRate
  // Same evidence bar as the callout below — one definition, one place.
  const hasWinner = rows.length >= 2 && best.visits >= 10 && worst.visits >= 10 && gap >= 0.05

  // Summary band totals
  const totalVisits = rows.reduce((s, r) => s + r.visits, 0)
  const totalIdentified = rows.reduce((s, r) => s + r.identified, 0)
  const totalHot = rows.reduce((s, r) => s + r.hot, 0)

  return (
    <>
      {/* A "converts best" claim is only true when there is evidence for it.
          Gate it on the SAME threshold the "What this tells you" callout below
          uses (>=2 variants, >=10 visits each end, >=5pt gap) — otherwise the
          page would name an arbitrary winner at 0.0% and paint it green, which
          is the number a broker moves ad spend on (§0: narrative reconciles to
          data). With no winner to name, state what happened instead. */}
      <VerdictLine tone={hasWinner ? 'ok' : 'attention'}>
        {hasWinner ? (
          <>
            <b>
              {best.variant} converts best at {(best.identifyRate * 100).toFixed(1)}%.
            </b>{' '}
          </>
        ) : null}
        {formatInt(rows.length)} LP variant{rows.length === 1 ? '' : 's'} took traffic in this window
        {hasWinner ? '.' : totalIdentified === 0 ? '; none identified a visitor yet.' : '; no variant leads by enough to call yet.'}
      </VerdictLine>
      <Figures
        figures={[
          { label: 'LP variants', value: formatInt(rows.length) },
          { label: 'Visits (30d)', value: formatInt(totalVisits) },
          { label: 'Identified', value: formatInt(totalIdentified), caption: formatPct(totalIdentified, totalVisits) + ' identify rate' },
          { label: 'Hot leads', value: formatInt(totalHot), tone: totalHot > 0 ? 'ok' : undefined },
          { label: 'Best LP', value: `${(best.identifyRate * 100).toFixed(1)}%`, caption: best.variant, tone: 'ok' },
        ]}
      />

      <section aria-label="Landing-page conversion leaderboard">
        <SectionHead>Landing-page conversion leaderboard ({range.startDate} to {range.endDate})</SectionHead>
        <p className="av2-note">
          Ranked by identify rate (visitors who signed in or submitted a form). Identify rate is what tells you whether the LP works. Hot rate is the broker-action signal — sessions that crossed score 100 and fired a hot-lead task.
        </p>
        <DataList
          label="Landing-page conversion leaderboard"
          rows={rows}
          cap={10}
          rowKey={(r) => r.variant}
          columns={[
            {
              key: 'variant',
              header: 'LP variant',
              lead: true,
              cell: (r, i) => (
                <>
                  <Link href={`/lp/${r.variant}`} style={{ color: 'var(--a-accent)' }}>
                    {r.variant}
                  </Link>{' '}
                  <StateWord state={i === 0 ? 'ok' : i === rows.length - 1 && rows.length > 2 ? 'down' : 'waiting'}>
                    {i === 0 ? 'best' : i === rows.length - 1 && rows.length > 2 ? 'worst' : `#${i + 1}`}
                  </StateWord>
                </>
              ),
            },
            { key: 'visits', header: 'Visits', num: true, cell: (r) => formatInt(r.visits) },
            { key: 'identified', header: 'Identified', num: true, cell: (r) => formatInt(r.identified) },
            { key: 'idrate', header: 'Identify rate', num: true, cell: (r) => `${(r.identifyRate * 100).toFixed(1)}%` },
            { key: 'hot', header: 'Hot leads', num: true, cell: (r) => formatInt(r.hot) },
            { key: 'hotrate', header: 'Hot rate', num: true, cell: (r) => `${(r.hotRate * 100).toFixed(1)}%` },
            { key: 'score', header: 'Avg score', num: true, cell: (r) => r.avgScore.toFixed(1) },
            { key: 'source', header: 'Top source', cell: (r) => r.topSource },
            { key: 'city', header: 'Top city', cell: (r) => r.topCity },
          ]}
          empty={<>No LP sessions captured in the last 30 days yet. Once visitors arrive at any /lp/[variant] page and consent to tracking, the leaderboard fills in.</>}
        />
      </section>

      {rows.length >= 2 && best.visits >= 10 && worst.visits >= 10 && gap >= 0.05 && (
        <section aria-label="What this tells you">
          <SectionHead>What this tells you</SectionHead>
          <p className="av2-note">
            <b>{best.variant}</b> converts at {(best.identifyRate * 100).toFixed(1)}% vs <b>{worst.variant}</b> at {(worst.identifyRate * 100).toFixed(1)}%. That is a {(gap * 100).toFixed(1)}-point gap.
          </p>
          <p className="av2-note">
            Shift paid spend from {worst.variant} toward {best.variant} until the gap closes. If {worst.variant} still hits zero or near-zero after a budget shift, pause that LP entirely and rebuild the hero, form, or audience targeting.
          </p>
          {best.topSource && best.topSource !== '—' && (
            <p className="av2-note">
              {best.variant}&apos;s best source is <b>{best.topSource}</b>. Double down on that channel for this LP specifically.
            </p>
          )}
        </section>
      )}
    </>
  )
}

export default async function LpLeaderboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)
  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <p className="av2-note">
        Which landing page actually converts. Pulled directly from <code>visitor_sessions</code> with the landing page mapped back to its LP variant slug. Ranked by identify rate.
      </p>
      <RangeControl current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />

      <Suspense fallback={<Loading what="LP sessions" />}>
        <LpLeaderboard range={range} />
      </Suspense>
    </div>
  )
}
