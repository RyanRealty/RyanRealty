/**
 * Weekly West Side cohort digest.
 *
 * Every Monday, pulls the parcel-linked cohort's last-7-days activity
 * (site visits via visitor_sessions.crm_person_id, email opens/clicks via
 * email_events, inbound messages via crm_timeline) through
 * getWestsideCohortActivity and emails the ranked list + rollups to the broker.
 *
 * INTERNAL ops email only (analytics-daily-digest pattern): the recipient is
 * MATT_ALERT_EMAIL (the broker's own inbox), never a lead, so no suppression
 * gate applies. Nothing here can ever send to a cohort member.
 *
 * Dry run: append ?dry=1 to get the computed subject + rollup as JSON without
 * sending anything.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 * Cadence: 0 15 * * 1 (Mondays 15:00 UTC, 7–8am Pacific) — registered in
 * vercel.json "crons".
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { getWestsideCohortActivity } from '@/lib/data/crm/getWestsideCohortActivity'
import { buildWestsideDigestSubject, renderWestsideDigestHtml } from '@/lib/westside-digest-email'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const RESEND_API_URL = 'https://api.resend.com/emails'
const WINDOW_DAYS = 7

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const dryRun = request.nextUrl.searchParams.get('dry') === '1'

  let data
  try {
    data = await getWestsideCohortActivity({ sinceDays: WINDOW_DAYS })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  const subject = buildWestsideDigestSubject(data)
  const html = renderWestsideDigestHtml(data)

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      subject,
      rollup: data.rollup,
      topPeople: data.people.slice(0, 5).map((p) => ({ personId: p.personId, score: p.score })),
      windowStartIso: data.windowStartIso,
    })
  }

  let sent = false
  let errorMsg: string | null = null
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    // Broker-internal recipients only — mirrors analytics-daily-digest. These
    // env vars point at the broker's own alert inbox, never at a lead.
    const from = (process.env.MATT_ALERT_FROM_EMAIL || 'alerts@mail.ryan-realty.com').trim()
    const to = (process.env.MATT_ALERT_EMAIL || 'matt@ryan-realty.com').trim()
    if (!apiKey) errorMsg = 'RESEND_API_KEY not configured'
    else {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to, subject, html }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        errorMsg = `Resend ${res.status}: ${body.slice(0, 200)}`
      } else sent = true
    }
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    ok: sent,
    sent,
    error: errorMsg,
    subject,
    rollup: data.rollup,
    activeListed: data.people.length,
    windowStartIso: data.windowStartIso,
    fetchedAt: data.fetchedAtIso,
  })
}
