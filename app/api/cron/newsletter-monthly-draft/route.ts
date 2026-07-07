/**
 * Monthly newsletter auto-draft cron (spec §4.1 UC-C1, Matt directive
 * 2026-07-06: "newsletter generated on the 1st").
 *
 * Registered in vercel.json to run DAILY early morning; the handler itself
 * decides whether to act, so the schedule stays timezone-proof and a missed
 * tick self-heals the next morning:
 *
 *   1. Is today the 1st of the month in America/Los_Angeles? (else no-op)
 *   2. Does a newsletter for this month already exist in ANY status? (else
 *      no-op — idempotent across retries and manual generates)
 *   3. produceNewsletterDraft() — every figure pulled live through the DAL
 *      with a §0 citations trace. DRAFT ONLY; nothing sends without Matt's
 *      per-issue approval on the review page.
 *   4. Notify Matt: email to matt@ryan-realty.com with the review link, plus
 *      the broker-alert SMS rail (queueBrokerHealthAlert — operational, routes
 *      to Matt, deduped by cooldown).
 *
 * `?force=1` (still Bearer-authed) skips the day-of-month check for manual
 * runs. Never throws to the caller — every failure is a 200 JSON status so
 * Vercel doesn't retry-storm.
 */
import { NextResponse } from 'next/server'
import { produceNewsletterDraft, monthlyNewsletterSubject } from '@/lib/newsletter/produce-draft'
import { findNewsletterIdBySubject } from '@/lib/data/newsletter/scheduled'
import { queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { sendEmail } from '@/lib/resend'
import { zonedDateKey } from '@/lib/format/date'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MATT_EMAIL = 'matt@ryan-realty.com'
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
  if (!secret) return !isProd
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

/** Day-of-month in America/Los_Angeles — the schedule is UTC, Matt's month is not. */
function dayOfMonthPacific(now = new Date()): number {
  return Number(zonedDateKey(now).slice(8, 10))
}

/** The current Pacific calendar day as a Date (noon-anchored) — drives the issue subject. */
function nowInPacific(now = new Date()): Date {
  return new Date(`${zonedDateKey(now)}T12:00:00`)
}

async function notifyMatt(newsletterId: string, subject: string): Promise<void> {
  const reviewUrl = `${SITE_URL}/admin/newsletters/${newsletterId}`
  // Email is the primary channel. Internal ops mail to Matt, brand-voice clean.
  await sendEmail({
    to: MATT_EMAIL,
    subject: `Newsletter draft ready for review · ${subject}`,
    html: `<p>The monthly newsletter drafted itself from live market data and is waiting for your review.</p>
<p><a href="${reviewUrl}">Open the rendered preview</a> to review, edit, and approve the send.</p>
<p>Nothing goes out until you approve and schedule it.</p>`,
    text: `The monthly newsletter drafted itself from live market data and is waiting for your review.\n\nReview it here: ${reviewUrl}\n\nNothing goes out until you approve and schedule it.`,
  })
  // SMS nudge via the existing broker-alert rail (routes to Matt, cooldown-deduped).
  await queueBrokerHealthAlert({
    key: 'newsletter-monthly-draft',
    body: `Newsletter draft ready: ${subject}. Review: ${reviewUrl}`,
    cooldownMinutes: 60 * 20,
  })
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const force = new URL(request.url).searchParams.get('force') === '1'
    const day = dayOfMonthPacific()
    if (day !== 1 && !force) {
      return NextResponse.json({ ok: true, action: 'skipped', reason: `day ${day} is not the 1st (Pacific)` })
    }

    const subject = monthlyNewsletterSubject(nowInPacific())
    const existingId = await findNewsletterIdBySubject(subject)
    if (existingId) {
      return NextResponse.json({ ok: true, action: 'exists', id: existingId, subject })
    }

    const result = await produceNewsletterDraft('cron:newsletter-monthly-draft')
    if (!result.ok || !result.id) {
      // draft_exists carries the id of the already-created draft — still idempotent.
      if (result.error === 'draft_exists' && result.id) {
        return NextResponse.json({ ok: true, action: 'exists', id: result.id, subject })
      }
      console.error('[cron/newsletter-monthly-draft] produce failed:', result.error)
      return NextResponse.json({ ok: false, action: 'failed', error: result.error ?? 'produce_failed' }, { status: 200 })
    }

    await notifyMatt(result.id, subject)
    return NextResponse.json({ ok: true, action: 'drafted', id: result.id, subject, notified: MATT_EMAIL })
  } catch (err) {
    console.error('[cron/newsletter-monthly-draft]', err)
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'draft_failed' }, { status: 200 })
  }
}
