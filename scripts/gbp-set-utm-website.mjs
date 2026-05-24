#!/usr/bin/env node
/**
 * scripts/gbp-set-utm-website.mjs
 *
 * Sets the Google Business Profile "Website" link to include canonical
 * UTM parameters so GBP traffic is distinguishable from regular Google
 * organic in GA4 (per docs/UTM_TRACKING_CONVENTION.md §2).
 *
 * Idempotent: reads current value, skips if UTMs already present.
 * Default URL:
 *   https://ryan-realty.com/?utm_source=google&utm_medium=organic
 *     &utm_campaign=gbp-profile&utm_content=knowledge-panel
 *
 * Auth: uses the OAuth refresh token stored in Supabase
 *   public.google_business_profile_auth (same path as the existing
 *   gbp-apply-phase1.mjs and gbp-audit-pull.mjs scripts).
 *
 * Usage:
 *   node scripts/gbp-set-utm-website.mjs --dry-run     # see what would change
 *   node scripts/gbp-set-utm-website.mjs               # apply
 */

const DRY_RUN = process.argv.includes('--dry-run')

const ACCOUNT_ID = process.env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
const LOCATION_ID = process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT_ID = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET

if (!ACCOUNT_ID || !LOCATION_ID || !SUPABASE_URL || !SUPABASE_KEY || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required env. Need GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID, GOOGLE_BUSINESS_PROFILE_LOCATION_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_OAUTH_CLIENT_ID/SECRET.')
  process.exit(1)
}

// Canonical GBP Website URL — chosen by Matt 2026-05-24.
// utm_source=gbp (not google) for instant distinguishability in reports.
const DESIRED_URL = 'https://ryan-realty.com/?utm_source=gbp&utm_medium=organic&utm_campaign=profile'

async function getAccessToken() {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const { data: rows, error: readErr } = await sb
    .from('google_business_profile_auth')
    .select('access_token, refresh_token, expires_at')
    .eq('id', 'default')
    .limit(1)
  if (readErr) throw new Error(`Supabase read failed: ${readErr.message}`)
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No GBP auth row in Supabase google_business_profile_auth (id=default).')
  const row = rows[0]
  const expiresAt = new Date(row.expires_at).getTime()
  if (Date.now() < expiresAt - 30 * 60 * 1000) return row.access_token

  // Refresh
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const refreshed = await refreshRes.json()
  if (!refreshed.access_token) throw new Error(`Refresh failed: ${JSON.stringify(refreshed)}`)

  // Persist refreshed token
  await sb
    .from('google_business_profile_auth')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || row.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'default')
  return refreshed.access_token
}

const locName = `locations/${LOCATION_ID}`

async function readWebsite(token) {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locName}?readMask=websiteUri,title,name`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) {
    throw new Error(`Read failed (HTTP ${r.status}): ${(await r.text()).slice(0, 300)}`)
  }
  return r.json()
}

async function patchWebsite(token, websiteUri) {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locName}?updateMask=websiteUri`
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ websiteUri }),
  })
  const body = await r.text()
  return { ok: r.ok, status: r.status, body }
}

console.log(`${'='.repeat(64)}`)
console.log(`GBP Website UTM Setter — Location ${LOCATION_ID}`)
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`)
console.log('='.repeat(64))

const token = await getAccessToken()
console.log('✓ GBP access token obtained')

const cur = await readWebsite(token)
console.log(`\nCurrent state:`)
console.log(`  title: ${cur.title}`)
console.log(`  websiteUri: ${cur.websiteUri || '(none)'}`)

console.log(`\nDesired:`)
console.log(`  websiteUri: ${DESIRED_URL}`)

if (cur.websiteUri === DESIRED_URL) {
  console.log('\n✓ ALREADY CORRECT — no action.')
  process.exit(0)
}

if (DRY_RUN) {
  console.log('\n⚡ Would PATCH websiteUri (dry-run; no change).')
  process.exit(0)
}

console.log('\n⚡ Applying PATCH...')
const result = await patchWebsite(token, DESIRED_URL)
console.log(`HTTP ${result.status}: ${result.body.slice(0, 300)}`)

if (result.ok) {
  console.log('\n✓ APPLIED. Verifying...')
  const after = await readWebsite(token)
  console.log(`  websiteUri now: ${after.websiteUri}`)
  if (after.websiteUri === DESIRED_URL) console.log('\n🎯 SUCCESS — GBP Website link now carries canonical UTMs.')
  else console.log('\n⚠️ Patch reported success but value did not persist. Check Business Profile UI.')
} else {
  console.log('\n✗ PATCH FAILED — check error above.')
  process.exit(1)
}
