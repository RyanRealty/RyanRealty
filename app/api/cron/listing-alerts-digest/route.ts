/**
 * Listing-alerts digest cron — daily at 7:05am PT (14:05 UTC).
 *
 * Walks every active subscriber in `public.listing_alerts`, runs the match
 * engine against the live MLS listings table for the last 24h window, and
 * sends a branded digest email via Resend with up to 6 matching homes per
 * subscriber. Tracks delivery in `public.listing_alert_matches` so the same
 * (alert, listing, match_type) tuple is never sent twice.
 *
 * Why this exists: backs the "Custom Tetherow alerts" form (and equivalent
 * cards on every community/subdivision/city LP) with real email delivery.
 * Subscribers picked their criteria once on the LP; we keep them in the loop
 * without spam.
 *
 * Skip rules per subscriber:
 *   - status='paused' AND paused_until > now() → skip
 *   - status='unsubscribed' → skip
 *   - last_sent_at within the last 23h → skip (rate limit)
 *   - matched = 0 → skip the email entirely (no empties)
 *   - RESEND_API_KEY not set in env → mark sent=false, skip (don't surface as error)
 *
 * Auth: Authorization: Bearer $CRON_SECRET (same pattern as every other cron).
 *
 * Spec: marketing_brain_skills/producers/listing-alerts/SKILL.md §4.1 + §4.2
 */
import { randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/resend'
import { findMatches, MAX_MATCHES_PER_DIGEST } from '@/lib/listing-alerts/match-engine'
import { ListingAlertsDigest } from '@/lib/listing-alerts/email-template'
import type {
  DigestCronSummary,
  DigestRunResult,
  ListingAlertRow,
  MatchedListing,
} from '@/lib/listing-alerts/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** How far back to look for new/price-changed listings on each run. */
const LOOKBACK_HOURS = 24

/** Rate limit: don't send the same subscriber two digests within this window. */
const SEND_RATE_LIMIT_HOURS = 23

/** How many listings to render in a single digest email (matches MAX in match-engine). */
const MAX_LISTINGS_PER_EMAIL = 6

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return true // dev / local
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
}

function unsubscribeUrl(token: string): string {
  return `${siteUrl()}/api/listing-alerts/unsubscribe?token=${encodeURIComponent(token)}`
}

function digestSubject(community: string | null, city: string | null, count: number): string {
  const where = community
    ? community.charAt(0).toUpperCase() + community.slice(1).replace(/-/g, ' ')
    : city
      ? city.charAt(0).toUpperCase() + city.slice(1).replace(/-/g, ' ')
      : 'Central Oregon'
  if (count === 1) return `One new ${where} home matches your search`
  return `${count} new ${where} homes match your search`
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date()
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000)
  const rateLimitCutoff = new Date(Date.now() - SEND_RATE_LIMIT_HOURS * 60 * 60 * 1000)

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const subscriberFilter = url.searchParams.get('subscriber_email') ?? undefined

  const supabase = createServiceClient()

  // Pull active subscribers who haven't been sent to recently.
  let query = supabase
    .from('listing_alerts')
    .select(
      'id,email,name,source_lp,community_slug,city_slug,criteria,status,paused_until,unsubscribe_token,last_sent_at,consent_marketing',
    )
    .eq('status', 'active')
    .eq('consent_marketing', true)

  if (subscriberFilter) {
    query = query.eq('email', subscriberFilter.toLowerCase())
  }

  const { data: subscribers, error: subErr } = await query
  if (subErr) {
    console.error('[listing-alerts/digest] subscriber query failed:', subErr)
    return NextResponse.json({ ok: false, error: subErr.message }, { status: 500 })
  }

  const summary: DigestCronSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    durationMs: 0,
    scanned: subscribers?.length ?? 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    details: [],
  }

  const candidates = subscribers ?? []
  for (const row of candidates) {
    const sub = row as unknown as Pick<
      ListingAlertRow,
      | 'id'
      | 'email'
      | 'name'
      | 'source_lp'
      | 'community_slug'
      | 'city_slug'
      | 'criteria'
      | 'status'
      | 'paused_until'
      | 'unsubscribe_token'
      | 'last_sent_at'
      | 'consent_marketing'
    >

    const detail: DigestRunResult = {
      alertId: sub.id,
      email: sub.email,
      matched: 0,
      sent: false,
    }

    // Rate limit gate
    if (sub.last_sent_at && new Date(sub.last_sent_at).getTime() > rateLimitCutoff.getTime()) {
      detail.skipReason = 'rate_limited'
      summary.skipped++
      summary.details.push(detail)
      continue
    }

    // Paused-window gate (status='paused' AND paused_until > now)
    if (sub.paused_until && new Date(sub.paused_until).getTime() > Date.now()) {
      detail.skipReason = 'paused'
      summary.skipped++
      summary.details.push(detail)
      continue
    }

    // Run the match engine
    let matches: MatchedListing[] = []
    try {
      matches = await findMatches(
        { community_slug: sub.community_slug, city_slug: sub.city_slug, criteria: sub.criteria },
        since,
        { cap: MAX_MATCHES_PER_DIGEST },
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      detail.error = msg
      summary.errors++
      summary.details.push(detail)
      console.error(`[listing-alerts/digest] match engine failed for ${sub.email}:`, err)
      continue
    }

    detail.matched = matches.length
    if (matches.length === 0) {
      detail.skipReason = 'no_matches'
      summary.skipped++
      summary.details.push(detail)
      continue
    }

    // Render and send the digest
    const visibleMatches = matches.slice(0, MAX_LISTINGS_PER_EMAIL)
    const overflow = matches.length - visibleMatches.length

    if (dryRun) {
      detail.sent = false
      summary.skipped++
      summary.details.push(detail)
      continue
    }

    const digestId = randomUUID()
    try {
      const result = await sendEmail({
        to: sub.email,
        subject: digestSubject(sub.community_slug, sub.city_slug, matches.length),
        replyTo: 'matt@ryan-realty.com',
        react: ListingAlertsDigest({
          subscriberName: sub.name,
          matches: visibleMatches,
          overflowCount: overflow,
          communitySlug: sub.community_slug,
          citySlug: sub.city_slug,
          unsubscribeUrl: unsubscribeUrl(sub.unsubscribe_token),
        }),
      })

      if (result.error) {
        detail.error = result.error
        summary.errors++
        summary.details.push(detail)
        console.error(`[listing-alerts/digest] resend failed for ${sub.email}:`, result.error)
        continue
      }

      detail.sent = true
      detail.resendId = result.id
      summary.sent++

      // Mark matches as sent + update last_sent_at
      const matchRows = visibleMatches.map((m) => ({
        alert_id: sub.id,
        listing_id: m.listingId,
        match_type: m.matchType,
        digest_id: digestId,
        sent_at: new Date().toISOString(),
      }))
      if (matchRows.length > 0) {
        await supabase
          .from('listing_alert_matches')
          .upsert(matchRows, { onConflict: 'alert_id,listing_id,match_type', ignoreDuplicates: false })
          .catch((err: unknown) => {
            console.warn(`[listing-alerts/digest] match upsert failed for ${sub.email}:`, err)
          })
      }
      await supabase
        .from('listing_alerts')
        .update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', sub.id)
        .catch((err: unknown) => {
          console.warn(`[listing-alerts/digest] last_sent_at update failed for ${sub.email}:`, err)
        })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      detail.error = msg
      summary.errors++
      console.error(`[listing-alerts/digest] send threw for ${sub.email}:`, err)
    }

    summary.details.push(detail)
  }

  const finishedAt = new Date()
  summary.finishedAt = finishedAt.toISOString()
  summary.durationMs = finishedAt.getTime() - startedAt.getTime()

  return NextResponse.json({ ok: true, ...summary })
}
