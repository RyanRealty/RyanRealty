/**
 * /api/cron/ga4-internal-traffic-qa
 *
 * Read-only daily GA4 data-QA for internal / automation leakage (Analytics
 * fix 6). Pulls yesterday in the GA4 property timezone via the Data API
 * (same GOOGLE_GA4_PROPERTY_ID + service-account credentials as
 * app/actions/ga4-report.ts) and flags:
 *   - hostName other than ryan-realty.com
 *   - browserVersion with more than 20 session_starts
 *   - form_start with no generate_lead
 *
 * No database writes. No email, SMS, Slack, or webhook. Output is the JSON
 * body plus one structured console log.
 *
 * Schedule: daily 12:40 UTC (vercel.json). Auth: Authorization: Bearer $CRON_SECRET.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import {
  evaluateInternalTrafficQa,
  fetchInternalTrafficQa,
  yesterdayInPropertyTz,
} from '@/lib/analytics/ga4-internal-traffic-qa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const date = yesterdayInPropertyTz()
  const pulled = await fetchInternalTrafficQa(date)
  if (!pulled.ok) {
    const body = { ok: false, date, error: pulled.error, flags: [] as const }
    console.log(JSON.stringify({ event: 'ga4-internal-traffic-qa', ...body }))
    return NextResponse.json(body)
  }

  const verdict = evaluateInternalTrafficQa({
    date,
    hosts: pulled.hosts,
    browserVersions: pulled.browserVersions,
    formLead: pulled.formLead,
  })
  const body = {
    ...verdict,
    hosts: pulled.hosts,
    browserVersions: pulled.browserVersions,
    formLead: pulled.formLead,
  }
  console.log(JSON.stringify({ event: 'ga4-internal-traffic-qa', ...body }))
  return NextResponse.json(body)
}
