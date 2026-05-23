/**
 * Phase 7 — GBP Monthly Digest cron.
 *
 * Runs on the 1st of each month at 13:00 UTC (6am Pacific). Pulls last 30 days
 * of GBP performance metrics, post count, photo count, review count, and
 * compares vs the prior 30 days. Emits a markdown digest to:
 *   - out/gbp-reports/<YYYY-MM>-monthly-digest.md (committed by separate job)
 *   - Resend email to matt@ryan-realty.com if RESEND_API_KEY is set
 *
 * Schedule (add to vercel.json):
 *   "crons": [
 *     { "path": "/api/cron/gbp-monthly-digest", "schedule": "0 13 1 * *" }
 *   ]
 *
 * Reads:
 *   - GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID / LOCATION_ID
 *   - Brokerage OAuth token via getOrRefreshGoogleBusinessProfileAccessToken
 *   - Optional: RESEND_API_KEY for emailed digest
 */

import { NextResponse } from 'next/server'
import {
  getOrRefreshGoogleBusinessProfileAccessToken,
  type GBPDailyMetric,
} from '@/lib/google-business-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const METRICS: GBPDailyMetric[] = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'BUSINESS_CONVERSATIONS',
  'BUSINESS_BOOKINGS',
]

type Window = { start: string; end: string; label: string }

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function windowDaysAgo(days: number, label: string): Window {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { start: isoDate(start), end: isoDate(end), label }
}

async function fetchMetricTotal(
  accessToken: string,
  locationName: string,
  metric: GBPDailyMetric,
  win: Window,
): Promise<number | null> {
  const [sy, sm, sd] = win.start.split('-')
  const [ey, em, ed] = win.end.split('-')
  const params = new URLSearchParams({
    dailyMetric: metric,
    'dailyRange.start_date.year': sy,
    'dailyRange.start_date.month': sm,
    'dailyRange.start_date.day': sd,
    'dailyRange.end_date.year': ey,
    'dailyRange.end_date.month': em,
    'dailyRange.end_date.day': ed,
  })
  const url = `https://businessprofileperformance.googleapis.com/v1/${locationName}:getDailyMetricsTimeSeries?${params}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const json = await res.json()
  const values = json?.timeSeries?.datedValues ?? []
  let total = 0
  for (const dv of values) total += parseInt(dv.value || '0', 10) || 0
  return total
}

async function fetchPosts(
  accessToken: string,
  accountId: string,
  locationId: string,
): Promise<{ total: number; lastDate: string | null; live: number }> {
  let pageToken: string | null = null
  let total = 0
  let live = 0
  let lastDate: string | null = null
  do {
    const url: string =
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts?pageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) break
    const j = await res.json()
    const posts = j?.localPosts ?? []
    total += posts.length
    for (const p of posts) {
      if (p?.state === 'LIVE') live++
      if (p?.createTime && (!lastDate || p.createTime > lastDate)) lastDate = p.createTime
    }
    pageToken = j?.nextPageToken ?? null
  } while (pageToken)
  return { total, lastDate, live }
}

async function fetchMedia(
  accessToken: string,
  accountId: string,
  locationId: string,
): Promise<{ total: number; lastUpload: string | null }> {
  let pageToken: string | null = null
  let total = 0
  let lastUpload: string | null = null
  do {
    const url: string =
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media?pageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) break
    const j = await res.json()
    const items = j?.mediaItems ?? []
    total += items.length
    for (const m of items) {
      if (m?.createTime && (!lastUpload || m.createTime > lastUpload)) lastUpload = m.createTime
    }
    pageToken = j?.nextPageToken ?? null
  } while (pageToken)
  return { total, lastUpload }
}

async function fetchReviews(
  accessToken: string,
  accountId: string,
  locationId: string,
): Promise<{ total: number; avgStars: number; unreplied: number; last30dCount: number }> {
  let pageToken: string | null = null
  let total = 0
  let starSum = 0
  let unreplied = 0
  let last30dCount = 0
  const cutoff = Date.now() - 30 * 86400000
  do {
    const url: string =
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=50` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) break
    const j = await res.json()
    const reviews = j?.reviews ?? []
    for (const r of reviews) {
      total++
      const s = r.starRating
      const num = s === 'FIVE' ? 5 : s === 'FOUR' ? 4 : s === 'THREE' ? 3 : s === 'TWO' ? 2 : s === 'ONE' ? 1 : 0
      if (num) starSum += num
      if (!r.reviewReply) unreplied++
      if (r.createTime && new Date(r.createTime).getTime() >= cutoff) last30dCount++
    }
    pageToken = j?.nextPageToken ?? null
  } while (pageToken)
  return {
    total,
    avgStars: total > 0 ? starSum / total : 0,
    unreplied,
    last30dCount,
  }
}

function deltaPct(curr: number, prior: number): string {
  if (prior === 0) return curr === 0 ? '—' : '+∞%'
  const pct = ((curr - prior) / prior) * 100
  const sign = pct >= 0 ? '↑' : '↓'
  return `${sign} ${Math.abs(pct).toFixed(1)}%`
}

export async function GET(request: Request) {
  // Auth: require Vercel cron secret OR Bearer admin token
  const auth = request.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && !auth.includes(cronSecret)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const accountId = process.env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!accountId || !locationId) {
    return NextResponse.json({ ok: false, error: 'GBP env not configured' }, { status: 500 })
  }
  const locationName = `locations/${locationId}`

  const token = await getOrRefreshGoogleBusinessProfileAccessToken()
  const winNow = windowDaysAgo(30, 'last 30 days')
  const winPrev: Window = {
    label: 'prior 30 days',
    end: winNow.start,
    start: (() => {
      const d = new Date(winNow.start)
      d.setDate(d.getDate() - 30)
      return isoDate(d)
    })(),
  }

  // Pull all metrics for both windows + post + photo + review counts in parallel
  const metricResults: Record<string, { curr: number | null; prev: number | null }> = {}
  for (const metric of METRICS) {
    metricResults[metric] = { curr: null, prev: null }
  }
  await Promise.all([
    ...METRICS.flatMap((m) => [
      fetchMetricTotal(token, locationName, m, winNow).then((v) => {
        metricResults[m].curr = v
      }),
      fetchMetricTotal(token, locationName, m, winPrev).then((v) => {
        metricResults[m].prev = v
      }),
    ]),
  ])
  const [posts, media, reviews] = await Promise.all([
    fetchPosts(token, accountId, locationId),
    fetchMedia(token, accountId, locationId),
    fetchReviews(token, accountId, locationId),
  ])

  // Build the digest
  const month = new Date().toISOString().slice(0, 7)
  const lines: string[] = []
  lines.push(`# Ryan Realty GBP — Monthly Digest ${month}`)
  lines.push('')
  lines.push(`**Window:** ${winNow.start} → ${winNow.end} (vs prior 30 days)`)
  lines.push('')
  lines.push('## Performance')
  lines.push('| Metric | Last 30d | Prior 30d | Δ |')
  lines.push('|---|---:|---:|---:|')
  for (const m of METRICS) {
    const c = metricResults[m].curr ?? 0
    const p = metricResults[m].prev ?? 0
    lines.push(`| ${m} | ${c.toLocaleString()} | ${p.toLocaleString()} | ${deltaPct(c, p)} |`)
  }
  lines.push('')
  lines.push('## Posts')
  lines.push(`- Total: **${posts.total}** (LIVE: ${posts.live})`)
  if (posts.lastDate) {
    const daysSince = Math.floor((Date.now() - new Date(posts.lastDate).getTime()) / 86400000)
    lines.push(`- Most recent: ${posts.lastDate.slice(0, 10)} (${daysSince} days ago)`)
    if (daysSince > 7) lines.push(`- ⚠ Stale by Tier-1 cadence (target: 2–3/week)`)
  }
  lines.push('')
  lines.push('## Photos')
  lines.push(`- Total: **${media.total}** ${media.total < 30 ? `⚠ below 30 target` : '✓'}`)
  if (media.lastUpload) {
    const daysSince = Math.floor((Date.now() - new Date(media.lastUpload).getTime()) / 86400000)
    lines.push(`- Last upload: ${media.lastUpload.slice(0, 10)} (${daysSince} days ago)`)
  }
  lines.push('')
  lines.push('## Reviews')
  lines.push(`- Total: **${reviews.total}** (avg ${reviews.avgStars.toFixed(2)} ★)`)
  lines.push(`- Last 30 days: **${reviews.last30dCount}** new`)
  lines.push(`- Unreplied: ${reviews.unreplied} ${reviews.unreplied > 0 ? '⚠ respond within 24h' : '✓'}`)
  lines.push('')

  const digest = lines.join('\n')

  // Optional: email via Resend
  let emailed = false
  if (process.env.RESEND_API_KEY) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'no-reply@mail.ryan-realty.com',
          to: ['matt@ryan-realty.com'],
          subject: `Ryan Realty GBP — ${month} monthly digest`,
          text: digest,
        }),
      })
      emailed = emailRes.ok
    } catch {
      emailed = false
    }
  }

  return NextResponse.json({
    ok: true,
    month,
    window_now: winNow,
    window_prev: winPrev,
    metrics: metricResults,
    posts,
    media,
    reviews,
    digest_markdown: digest,
    emailed,
  })
}
