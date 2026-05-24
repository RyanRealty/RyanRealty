/**
 * GET /api/admin/gbp/set-website-utm
 *
 * Sets the Google Business Profile "Website" link to include the
 * canonical UTM parameters so GBP-driven traffic is separable from
 * regular Google organic in GA4 (per docs/UTM_TRACKING_CONVENTION.md §2).
 *
 * Idempotent: reads current value, returns `applied=false` if UTMs already
 * present.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (same as other admin
 * write endpoints; gates the cross-account write).
 *
 * Query params:
 *   ?dryRun=true   — preview only, no write
 *
 * Implementation notes:
 *   - GBP auth lives in Supabase table `google_business_profile_auth`
 *     (id='default') as a refresh-token row. Refresh happens here if
 *     expired. See scripts/gbp-apply-phase1.mjs for the canonical pattern.
 *   - The websiteUri PATCH goes to
 *     `mybusinessbusinessinformation.googleapis.com/v1/locations/{id}?updateMask=websiteUri`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Canonical GBP Website URL — chosen by Matt 2026-05-24.
// Using utm_source=gbp (not utm_source=google) so the channel is
// instantly distinguishable from regular Google organic in any report
// without needing to filter by campaign. Tradeoff: GA4's default
// "Organic Search" channel grouping won't auto-pick this up; see
// docs/UTM_TRACKING_CONVENTION.md §2 for the channel-grouping override.
const DESIRED_URL =
  'https://ryan-realty.com/?utm_source=gbp&utm_medium=organic&utm_campaign=profile'

function unauthorized(reason: string) {
  return NextResponse.json({ ok: false, error: reason }, { status: 401 })
}

async function getAccessToken(): Promise<{ token: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: rows, error } = await sb
    .from('google_business_profile_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .limit(1)
  if (error) throw new Error(`Supabase read failed: ${error.message}`)
  if (!rows || rows.length === 0) throw new Error('No GBP auth row at id=default')
  const row = rows[0]
  const expiresAt = new Date(row.expires_at as string).getTime()
  if (Date.now() < expiresAt - 30 * 60 * 1000) return { token: row.access_token as string }

  const clientId = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET!
  const refRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token as string,
      grant_type: 'refresh_token',
    }),
  })
  const refreshed = (await refRes.json()) as { access_token?: string; refresh_token?: string; expires_in?: number }
  if (!refreshed.access_token) throw new Error(`Refresh failed: ${JSON.stringify(refreshed)}`)

  await sb
    .from('google_business_profile_auth')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || row.refresh_token,
      expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')
  return { token: refreshed.access_token }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth: bearer = CRON_SECRET (mirrors the other admin write endpoints in this repo)
  const cronSecret = (process.env.CRON_SECRET || '').trim()
  if (!cronSecret) return NextResponse.json({ ok: false, error: 'CRON_SECRET not configured' }, { status: 500 })
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${cronSecret}`) return unauthorized('missing or invalid bearer')

  const locationId = process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!locationId) return NextResponse.json({ ok: false, error: 'GOOGLE_BUSINESS_PROFILE_LOCATION_ID not set' }, { status: 500 })

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dryRun') === 'true' || url.searchParams.get('dryRun') === '1'

  let token: string
  try {
    token = (await getAccessToken()).token
  } catch (e) {
    return NextResponse.json({ ok: false, error: `auth: ${(e as Error).message}` }, { status: 500 })
  }

  const locName = `locations/${locationId}`
  const readUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locName}?readMask=websiteUri,title,name`
  const readRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (!readRes.ok) {
    const body = await readRes.text()
    return NextResponse.json({ ok: false, error: `read failed HTTP ${readRes.status}: ${body.slice(0, 300)}` }, { status: 500 })
  }
  const cur = (await readRes.json()) as { websiteUri?: string; title?: string }
  const before = cur.websiteUri ?? null

  if (before === DESIRED_URL) {
    return NextResponse.json({ ok: true, applied: false, reason: 'already correct', before, after: before })
  }

  if (dryRun) {
    return NextResponse.json({ ok: true, applied: false, reason: 'dryRun', before, would_set: DESIRED_URL })
  }

  const patchUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locName}?updateMask=websiteUri`
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ websiteUri: DESIRED_URL }),
  })
  const patchBody = await patchRes.text()
  if (!patchRes.ok) {
    return NextResponse.json(
      { ok: false, applied: false, error: `patch failed HTTP ${patchRes.status}: ${patchBody.slice(0, 400)}`, before },
      { status: 500 },
    )
  }

  // Verify
  const verifyRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${token}` } })
  const after = ((await verifyRes.json()) as { websiteUri?: string }).websiteUri ?? null

  return NextResponse.json({
    ok: true,
    applied: after === DESIRED_URL,
    before,
    after,
    patch_response: patchBody.slice(0, 400),
  })
}
