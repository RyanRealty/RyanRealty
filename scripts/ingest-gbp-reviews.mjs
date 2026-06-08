#!/usr/bin/env node
/**
 * ingest-gbp-reviews.mjs — pull Ryan Realty's Google Business Profile reviews
 * into the `reviews` table (source='google') for use as on-site social proof.
 *
 * Uses the same OAuth token as the other GBP crons (google_business_profile_auth,
 * business.manage scope), refreshing it if needed. Reads the Business Profile API
 * v4 reviews endpoint. Idempotent: --apply deletes existing source='google' rows
 * and re-inserts, so re-running refreshes. `is_hidden` lets Matt curate which
 * reviews surface without deleting them.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID, GOOGLE_BUSINESS_PROFILE_LOCATION_ID,
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
 * Usage:
 *   node --env-file=.env.local scripts/ingest-gbp-reviews.mjs            # dry run
 *   node --env-file=.env.local scripts/ingest-gbp-reviews.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ACCOUNT = process.env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
const LOCATION = process.env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET
const APPLY = process.argv.includes('--apply')

if (!SB_URL || !SB_KEY || !ACCOUNT || !LOCATION || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing env', { ACCOUNT: !!ACCOUNT, LOCATION: !!LOCATION, CLIENT_ID: !!CLIENT_ID })
  process.exit(1)
}
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } })
const STAR = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }

async function getToken() {
  const { data, error } = await sb.from('google_business_profile_auth')
    .select('access_token,refresh_token,expires_at').eq('id', 'default').maybeSingle()
  if (error || !data) throw new Error('no GBP token row: ' + (error?.message || 'empty'))
  if (Date.now() < new Date(data.expires_at).getTime() - 5 * 60 * 1000) return data.access_token
  if (!data.refresh_token) throw new Error('token expired and no refresh_token; reconnect GBP at /api/admin/gbp')
  const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: data.refresh_token, grant_type: 'refresh_token' })
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
  const j = await r.json()
  if (!j.access_token) throw new Error('refresh failed: ' + JSON.stringify(j).slice(0, 300))
  await sb.from('google_business_profile_auth').upsert({ id: 'default', access_token: j.access_token, refresh_token: j.refresh_token ?? data.refresh_token, expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'id' })
  console.log('(refreshed access token)')
  return j.access_token
}

const acct = String(ACCOUNT).startsWith('accounts/') ? ACCOUNT : `accounts/${ACCOUNT}`
const loc = String(LOCATION).startsWith('locations/') ? LOCATION : `locations/${LOCATION}`
const token = await getToken()

const all = []
let pageToken = null, avg = null, total = null
do {
  const u = `https://mybusiness.googleapis.com/v4/${acct}/${loc}/reviews?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ''}`
  const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } })
  const j = await r.json()
  if (!r.ok) { console.error('reviews fetch ERROR', r.status, JSON.stringify(j).slice(0, 400)); process.exit(1) }
  for (const rev of (j.reviews || [])) all.push(rev)
  avg = j.averageRating; total = j.totalReviewCount
  pageToken = j.nextPageToken || null
} while (pageToken)

const rows = all.map((rev) => ({
  source: 'google',
  rating: STAR[rev.starRating] ?? null,
  text: rev.comment ?? null,
  reviewer_name: rev.reviewer?.displayName ?? null,
  review_date: rev.createTime ? rev.createTime.slice(0, 10) : null,
  is_hidden: false,
})).filter((r) => r.rating)

console.log(`fetched=${all.length}  totalReviewCount=${total}  averageRating=${avg}  withRating=${rows.length}  withText=${rows.filter(r => r.text).length}`)
for (const row of rows.filter(r => r.text).slice(0, 8)) console.log(`  ${row.rating}★ ${row.reviewer_name} (${row.review_date}): ${(row.text || '').replace(/\s+/g, ' ').slice(0, 100)}`)

if (APPLY) {
  const REPLACE = process.argv.includes('--replace')
  const { count } = await sb.from('reviews').select('id', { count: 'exact', head: true }).eq('source', 'google')
  if ((count ?? 0) > 0 && !REPLACE) {
    console.log(`\n${count} google reviews already present — skipping (pass --replace to refresh).`)
  } else {
    if (REPLACE) await sb.from('reviews').delete().eq('source', 'google')
    const { error } = await sb.from('reviews').insert(rows)
    if (error) { console.error('insert error', error.message); process.exit(1) }
    console.log(`\nINSERTED ${rows.length} google reviews into public.reviews`)
  }
} else {
  console.log('\n(dry run — pass --apply to write)')
}
