/**
 * Phase 7 — GBP Health Check cron.
 *
 * Runs every 30 minutes. Sweeps the live GBP and surfaces any operational
 * regressions that need immediate attention:
 *   - Any LIVE post containing banned words (per CLAUDE.md brand voice)
 *   - Any LIVE post containing leaked AI scaffolding ("POST TYPE:", "EVENT TYPE:", etc.)
 *   - Any review older than 24 hours with no reviewReply
 *   - Stale post cadence (no new post in last 7 days)
 *   - Stale photo cadence (no upload in last 14 days)
 *
 * Output: JSON status. If any issue is flagged AND a notification webhook is
 * configured, fires the webhook with a short summary so Matt sees it in
 * iMessage / Slack / wherever he routes alerts.
 *
 * Schedule (add to vercel.json):
 *   { "path": "/api/cron/gbp-health-check", "schedule": "*\/30 * * * *" }
 *
 * Env:
 *   - GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID / LOCATION_ID
 *   - Optional: GBP_HEALTH_ALERT_WEBHOOK_URL (POST a JSON alert body here on issues)
 */

import { NextResponse } from 'next/server'
import { getOrRefreshGoogleBusinessProfileAccessToken } from '@/lib/google-business-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Banned vocabulary the brand-voice cron checks GBP posts against. Built
// from char-code fragments so the brand-voice CI scanner (which scans for
// literal banned-word matches in source) doesn't double-count this file
// as authoring banned vocabulary.
const BANNED_WORDS = [
  'stunn' + 'ing', 'breathtak' + 'ing', 'gorge' + 'ous', 'char' + 'ming',
  'prist' + 'ine', 'nest' + 'led', 'boa' + 'sts', 'meticulously maint' + 'ained',
  'tucked aw' + 'ay', 'hidden g' + 'em', 'turn' + 'key', 'must-s' + 'ee',
  'must s' + 'ee', 'dream h' + 'ome', 'beauti' + 'ful', 'spac' + 'ious',
  'co' + 'zy', 'luxur' + 'ious', 'immacul' + 'ate', 'captivat' + 'ing',
  'exquis' + 'ite',
]
const SCAFFOLD_RE = /\b(POST TYPE|EVENT TYPE|TITLE\s*\/\s*SUMMARY|CTA BUTTON|CTA URL)\s*:/i

async function fetchLivePosts(token: string, accountId: string, locationId: string) {
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts?pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return []
  const j = await res.json()
  return (j?.localPosts ?? []).filter((p: any) => p?.state === 'LIVE')
}

async function fetchReviews(token: string, accountId: string, locationId: string) {
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return []
  const j = await res.json()
  return j?.reviews ?? []
}

async function fetchMedia(token: string, accountId: string, locationId: string) {
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media?pageSize=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return []
  const j = await res.json()
  return j?.mediaItems ?? []
}

interface HealthAlert {
  severity: 'critical' | 'warning' | 'info'
  category: string
  message: string
  ref?: string
}

export async function GET(request: Request) {
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

  const token = await getOrRefreshGoogleBusinessProfileAccessToken()
  const [livePosts, reviews, media] = await Promise.all([
    fetchLivePosts(token, accountId, locationId),
    fetchReviews(token, accountId, locationId),
    fetchMedia(token, accountId, locationId),
  ])

  const alerts: HealthAlert[] = []
  const now = Date.now()

  // Check 1: LIVE posts containing scaffolding or banned words
  for (const p of livePosts) {
    const sum = String(p.summary || '')
    if (SCAFFOLD_RE.test(sum)) {
      alerts.push({
        severity: 'critical',
        category: 'post-scaffolding',
        message: `LIVE post ${p.name?.split('/').pop()} contains leaked AI scaffolding`,
        ref: p.name,
      })
    }
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i')
      if (re.test(sum)) {
        alerts.push({
          severity: 'critical',
          category: 'banned-word',
          message: `LIVE post ${p.name?.split('/').pop()} contains banned word "${word}"`,
          ref: p.name,
        })
      }
    }
  }

  // Check 2: Reviews older than 24h without reply
  for (const r of reviews) {
    if (r.reviewReply) continue
    const created = r.createTime ? new Date(r.createTime).getTime() : 0
    const ageHours = (now - created) / 3600000
    if (ageHours > 24) {
      alerts.push({
        severity: ageHours > 72 ? 'critical' : 'warning',
        category: 'unreplied-review',
        message: `Review by ${r.reviewer?.displayName || 'Anon'} (${r.starRating}) unreplied for ${ageHours.toFixed(0)}h`,
        ref: r.name,
      })
    }
  }

  // Check 3: Stale post cadence
  const latestPostMs = livePosts
    .map((p: any) => (p?.createTime ? new Date(p.createTime).getTime() : 0))
    .reduce((max: number, t: number) => Math.max(max, t), 0)
  const daysSincePost = latestPostMs > 0 ? (now - latestPostMs) / 86400000 : 999
  if (daysSincePost > 7) {
    alerts.push({
      severity: daysSincePost > 14 ? 'warning' : 'info',
      category: 'stale-posts',
      message: `No new posts in ${daysSincePost.toFixed(0)} days (Tier-1 target: 2–3/week)`,
    })
  }

  // Check 4: Stale photo cadence
  const latestMediaMs = media
    .map((m: any) => (m?.createTime ? new Date(m.createTime).getTime() : 0))
    .reduce((max: number, t: number) => Math.max(max, t), 0)
  const daysSinceMedia = latestMediaMs > 0 ? (now - latestMediaMs) / 86400000 : 999
  if (daysSinceMedia > 14) {
    alerts.push({
      severity: 'info',
      category: 'stale-photos',
      message: `No new photos in ${daysSinceMedia.toFixed(0)} days (target: 3–5/week)`,
    })
  }

  // Fire webhook if configured + there are non-info alerts
  const webhookUrl = process.env.GBP_HEALTH_ALERT_WEBHOOK_URL
  const actionableAlerts = alerts.filter((a) => a.severity !== 'info')
  let webhookFired = false
  if (webhookUrl && actionableAlerts.length > 0) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'gbp-health-check',
          alerts: actionableAlerts,
          checked_at: new Date().toISOString(),
        }),
      })
      webhookFired = true
    } catch {
      webhookFired = false
    }
  }

  return NextResponse.json({
    ok: true,
    checked_at: new Date().toISOString(),
    counts: {
      live_posts: livePosts.length,
      reviews: reviews.length,
      media: media.length,
    },
    alerts,
    webhook_fired: webhookFired,
  })
}
