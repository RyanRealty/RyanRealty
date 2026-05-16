#!/usr/bin/env node
/**
 * Monthly GBP media refresh:
 * - Pull active Matt Ryan listings from Supabase
 * - Upload listing hero photos to GBP media library (ADDITIONAL category)
 *
 * Usage:
 *   node scripts/gbp-monthly-media-refresh.mjs
 *   node scripts/gbp-monthly-media-refresh.mjs --count 6
 */

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    } else {
      out[key] = true
    }
  }
  return out
}

function readDotEnv(filePath) {
  const env = {}
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return env
}

function isActiveStatus(value) {
  const s = String(value || '').toLowerCase()
  return s.includes('active') || s.includes('for sale') || s.includes('coming soon')
}

async function getGoogleAccessTokenFromSupabase(env) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials')
  }

  const rowRes = await fetch(
    `${supabaseUrl}/rest/v1/google_business_profile_auth?select=access_token,refresh_token,expires_at&id=eq.default&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  )
  if (!rowRes.ok) throw new Error(`Failed reading GBP auth row: ${rowRes.status}`)
  const rows = await rowRes.json()
  if (!rows.length) throw new Error('No google_business_profile_auth row found')
  const tokenRow = rows[0]

  const expiresAt = new Date(tokenRow.expires_at).getTime()
  if (Date.now() < expiresAt - 60_000) return tokenRow.access_token

  const clientId = env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret || !tokenRow.refresh_token) {
    throw new Error('Google refresh prerequisites missing')
  }

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!refreshRes.ok) {
    const detail = await refreshRes.text()
    throw new Error(`Google token refresh failed: ${refreshRes.status} ${detail}`)
  }
  const refreshed = await refreshRes.json()
  if (!refreshed.access_token) throw new Error('Token refresh returned no access_token')

  await fetch(`${supabaseUrl}/rest/v1/google_business_profile_auth?id=eq.default`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || tokenRow.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      token_type: refreshed.token_type || null,
      scope: refreshed.scope || null,
      updated_at: new Date().toISOString(),
    }),
  })

  return refreshed.access_token
}

async function fetchActiveMattListings(env, count) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase credentials')
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const officeName = env.GBP_BROKER_OFFICE_NAME || 'Ryan Realty LLC'
  const { data: rows, error } = await supabase
    .from('listings')
    .select(
      'ListNumber,StreetNumber,StreetName,City,State,ListPrice,StandardStatus,ListAgentName,ListOfficeName,PhotoURL,ModificationTimestamp'
    )
    .eq('ListOfficeName', officeName)
    .limit(200)
  if (error) throw new Error(error.message)

  return (rows ?? [])
    .filter((r) => isActiveStatus(r.StandardStatus))
    .filter((r) => String(r.ListAgentName || '').toLowerCase().includes('matt'))
    .filter((r) => Boolean(r.PhotoURL))
    .sort((a, b) => String(b.ModificationTimestamp || '').localeCompare(String(a.ModificationTimestamp || '')))
    .slice(0, count)
}

async function uploadPhoto({ accessToken, accountId, locationId, sourceUrl }) {
  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`
  const payload = {
    mediaFormat: 'PHOTO',
    sourceUrl,
    locationAssociation: { category: 'ADDITIONAL' },
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const count = Math.max(1, Number.parseInt(args.count || '6', 10))
  const env = readDotEnv('.env.local')

  const accountId = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!accountId || !locationId) throw new Error('Missing GBP account/location IDs')

  const listings = await fetchActiveMattListings(env, count)
  if (!listings.length) {
    console.log('No active Matt listings with photos found.')
    return
  }

  console.log(`Found ${listings.length} active listings with photos:`)
  for (const listing of listings) {
    const address = [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ')
    console.log(`- ${listing.ListNumber} | ${address} | ${listing.City}`)
  }

  const accessToken = await getGoogleAccessTokenFromSupabase(env)
  const results = []
  for (const listing of listings) {
    const result = await uploadPhoto({
      accessToken,
      accountId,
      locationId,
      sourceUrl: listing.PhotoURL,
    })
    results.push({
      listNumber: listing.ListNumber,
      status: result.status,
      ok: result.ok,
      mediaName: result.body?.name || null,
      googleUrl: result.body?.googleUrl || null,
      error: result.ok ? null : (result.body?.error?.message || JSON.stringify(result.body)),
    })
  }

  console.log('\nUpload results:')
  for (const row of results) {
    if (row.ok) {
      console.log(`✓ ${row.listNumber} -> ${row.mediaName}`)
    } else {
      console.log(`✗ ${row.listNumber} | HTTP ${row.status} | ${row.error}`)
    }
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
