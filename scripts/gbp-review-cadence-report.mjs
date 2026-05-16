#!/usr/bin/env node
/**
 * GBP review cadence report:
 * - Pull latest reviews
 * - Count replied vs unreplied
 * - Print direct Google review link for request outreach
 *
 * Usage:
 *   node scripts/gbp-review-cadence-report.mjs
 */

import fs from 'node:fs'

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

async function main() {
  const env = readDotEnv('.env.local')
  const accountId = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!accountId || !locationId) throw new Error('Missing GBP account/location IDs')

  const accessToken = await getGoogleAccessTokenFromSupabase(env)
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  const reviewsUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?pageSize=50&orderBy=updateTime desc`
  const reviewsRes = await fetch(reviewsUrl, { headers })
  if (!reviewsRes.ok) {
    const detail = await reviewsRes.text()
    throw new Error(`Failed reading GBP reviews: ${reviewsRes.status} ${detail}`)
  }
  const reviewsJson = await reviewsRes.json()
  const reviews = reviewsJson.reviews || []
  const replied = reviews.filter((r) => Boolean(r.reviewReply?.comment))
  const unreplied = reviews.filter((r) => !r.reviewReply?.comment)

  const locationsUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?readMask=metadata,title,name&pageSize=100`
  const locationsRes = await fetch(locationsUrl, { headers })
  const locationsJson = locationsRes.ok ? await locationsRes.json().catch(() => ({})) : {}
  const locationName = `locations/${locationId}`
  const infoJson = (locationsJson?.locations || []).find((loc) => loc.name === locationName) || {}

  console.log(
    JSON.stringify(
      {
        location: infoJson?.title || 'Ryan Realty',
        totalReviews: reviewsJson.totalReviewCount ?? reviews.length,
        averageRating: reviewsJson.averageRating ?? null,
        repliedCount: replied.length,
        unrepliedCount: unreplied.length,
        reviewRequestLink: infoJson?.metadata?.newReviewUri || null,
        newestUnreplied: unreplied.slice(0, 10).map((r) => ({
          reviewer: r.reviewer?.displayName,
          star: r.starRating,
          updateTime: r.updateTime,
          comment: r.comment || null,
        })),
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
