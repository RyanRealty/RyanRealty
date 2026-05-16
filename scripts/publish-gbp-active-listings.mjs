#!/usr/bin/env node
/**
 * Publish active Matt Ryan listings to Google Business Profile.
 *
 * Rules:
 * - Video first (when listing details include a usable video URL)
 * - Photo fallback
 * - CTA always points to production site listing search
 * - Dedupe by CTA URL unless --force
 *
 * Usage:
 *   node scripts/publish-gbp-active-listings.mjs
 *   node scripts/publish-gbp-active-listings.mjs --publish
 *   node scripts/publish-gbp-active-listings.mjs --publish --force
 *   node scripts/publish-gbp-active-listings.mjs --publish --count 2
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

function normalizeUrlForDedupe(value) {
  if (!value) return ''
  try {
    const u = new URL(String(value).trim())
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      const lower = key.toLowerCase()
      if (lower.startsWith('utm_') || lower === 'fbclid' || lower === 'gclid') {
        u.searchParams.delete(key)
      }
    }
    u.pathname = u.pathname.replace(/\/+$/, '') || '/'
    return u.toString()
  } catch {
    return String(value).trim().replace(/\/+$/, '')
  }
}

function addGbpUtmParams(url, campaign, content) {
  try {
    const u = new URL(url)
    u.searchParams.set('utm_source', 'google')
    u.searchParams.set('utm_medium', 'organic')
    u.searchParams.set('utm_campaign', campaign)
    if (content) u.searchParams.set('utm_content', content)
    return u.toString()
  } catch {
    return url
  }
}

function isActiveStatus(value) {
  const s = String(value || '').toLowerCase()
  return s.includes('active') || s.includes('for sale') || s.includes('coming soon')
}

function extractVideoUrl(details) {
  if (!details || typeof details !== 'object') return null
  const videos = Array.isArray(details.Videos) ? details.Videos : []
  for (const v of videos) {
    const raw = v?.Uri || v?.uri || v?.URL || v?.url || v?.ObjectHtml || null
    if (!raw) continue
    const s = String(raw).trim()
    if (!s) continue
    if (s.startsWith('http://') || s.startsWith('https://')) return s
  }
  return null
}

async function extractVirtualTourUrlFromListingPage(listingUrl) {
  try {
    const res = await fetch(listingUrl, { redirect: 'follow' })
    if (!res.ok) return null
    const html = await res.text()
    const match =
      html.match(/data-purpose=\"vtour\"[^>]*href=\"([^\"]+)\"/i) ||
      html.match(/href=\"([^\"]+)\"[^>]*data-purpose=\"vtour\"/i)
    if (!match?.[1]) return null
    return match[1].replace(/&amp;/g, '&').trim()
  } catch {
    return null
  }
}

function buildSummary(listing) {
  const price = Number(listing.ListPrice || 0).toLocaleString('en-US')
  const beds = Number(listing.BedroomsTotal || 0)
  const baths = Number(listing.BathroomsTotal || 0)
  const sqft = Number(listing.TotalLivingAreaSqFt || 0).toLocaleString('en-US')
  const address = [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ').trim()
  const city = [listing.City, listing.State].filter(Boolean).join(', ')
  return `New listing in ${city} ${address}. Price $${price}. ${beds} bedrooms and ${baths} bathrooms with ${sqft} square feet.`
}

function slugSegment(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
}

function buildListingCta(listingBaseUrl, listing) {
  const listNumber = String(listing?.ListNumber || '').trim()
  if (!listNumber) return `${listingBaseUrl}/`
  const city = slugSegment(listing?.City || '')
  const address = slugSegment([listing?.StreetNumber, listing?.StreetName].filter(Boolean).join(' '))
  if (city && address) {
    return `${listingBaseUrl}/listing/odsmls/${listNumber}/${city}/${address}/`
  }
  return `${listingBaseUrl}/listing/odsmls/${listNumber}/`
}

async function resolveCanonicalUrl(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return url
    const html = await res.text()
    const m = html.match(/<link rel="canonical" href="([^"]+)"/i)
    return m?.[1] || url
  } catch {
    return url
  }
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

async function fetchExistingGbpPostCtaUrls(accessToken, accountId, locationId) {
  const existing = new Set()
  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts?pageSize=100`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) return existing
  const json = await res.json()
  for (const post of json.localPosts || []) {
    const ctaUrl = post?.callToAction?.url
    if (ctaUrl) existing.add(normalizeUrlForDedupe(ctaUrl))
  }
  return existing
}

async function fetchActiveMattListings(env, count) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase credentials')
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const officeName = env.GBP_BROKER_OFFICE_NAME || 'Ryan Realty LLC'
  const { data: lightRows, error: lightError } = await supabase
    .from('listings')
    .select('ListingKey,ListNumber,StandardStatus,ListAgentName,ListOfficeName,ModificationTimestamp')
    .eq('ListOfficeName', officeName)
    .limit(120)
  if (lightError) throw new Error(lightError.message)
  if (!lightRows?.length) throw new Error(`No listings returned for office ${officeName}`)

  const activeListNumbers = lightRows
    .filter((r) => isActiveStatus(r.StandardStatus))
    .filter((r) => String(r.ListAgentName || '').toLowerCase().includes('matt'))
    .map((r) => r.ListNumber)
    .filter(Boolean)
    .slice(0, count)

  if (!activeListNumbers.length) return []

  const { data: fullRows, error: fullError } = await supabase
    .from('listings')
    .select(
      'ListingKey,ListNumber,ListPrice,StreetNumber,StreetName,City,State,StandardStatus,ListAgentName,ListOfficeName,BedroomsTotal,BathroomsTotal,TotalLivingAreaSqFt,PhotoURL,details'
    )
    .in('ListNumber', activeListNumbers)

  if (fullError) throw new Error(`Failed full listing fetch: ${fullError.message}`)
  return fullRows ?? []
}

async function publishListingPost({ accessToken, accountId, locationId, listing, listingBaseUrl }) {
  const canonicalCta = await resolveCanonicalUrl(buildListingCta(listingBaseUrl, listing))
  const cta = addGbpUtmParams(
    canonicalCta,
    'gbp_listing_posts',
    listing?.ListNumber ? `listing_${listing.ListNumber}` : null
  )
  const summary = `${buildSummary(listing)} Message us for a private tour today.`
  const directVideoUrl = extractVideoUrl(listing.details)
  const virtualTourVideoUrl = directVideoUrl
    ? null
    : await extractVirtualTourUrlFromListingPage(canonicalCta)
  const videoUrl = directVideoUrl || virtualTourVideoUrl
  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`

  const basePayload = {
    summary,
    languageCode: 'en-US',
    topicType: 'STANDARD',
    callToAction: {
      actionType: 'LEARN_MORE',
      url: cta,
    },
  }

  const attempts = []
  if (videoUrl) attempts.push({ mediaMode: 'video', media: [{ mediaFormat: 'VIDEO', sourceUrl: videoUrl }] })
  if (listing.PhotoURL) attempts.push({ mediaMode: 'photo', media: [{ mediaFormat: 'PHOTO', sourceUrl: listing.PhotoURL }] })
  attempts.push({ mediaMode: 'text', media: undefined })

  let res = null
  let body = {}
  let mediaMode = 'text'

  for (const attempt of attempts) {
    mediaMode = attempt.mediaMode
    const payload = attempt.media ? { ...basePayload, media: attempt.media } : basePayload
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    body = await res.json().catch(() => ({}))
    if (res.ok) break
  }

  return {
    status: res.status,
    success: res.ok,
    postName: body?.name || null,
    cta,
    mediaMode,
    error: res.ok ? null : body?.error?.message || JSON.stringify(body),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const shouldPublish = Boolean(args.publish)
  const force = Boolean(args.force)
  const count = Math.max(1, Number.parseInt(args.count || '2', 10))
  const env = readDotEnv('.env.local')

  const accountId = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!accountId || !locationId) throw new Error('Missing GBP account/location IDs')

  const listingBaseUrl = (env.GBP_LISTING_BASE_URL || 'https://ryan-realty.com').replace(/\/+$/, '')
  const listings = await fetchActiveMattListings(env, count)
  if (!listings.length) {
    console.log('No active Matt Ryan listings found.')
    return
  }

  console.log(`Found ${listings.length} active Matt Ryan listing(s):`)
  for (const l of listings) {
    console.log(`- ${l.ListNumber} | ${[l.StreetNumber, l.StreetName].filter(Boolean).join(' ')} | ${l.City} | $${Number(l.ListPrice || 0).toLocaleString('en-US')} | ${l.StandardStatus}`)
  }

  if (!shouldPublish) {
    console.log('\nDry run complete. Re-run with --publish to post to GBP.')
    return
  }

  const accessToken = await getGoogleAccessTokenFromSupabase(env)
  const existing = force ? new Set() : await fetchExistingGbpPostCtaUrls(accessToken, accountId, locationId)
  console.log(`\nFound ${existing.size} existing GBP CTA URL(s) for dedupe.`)

  for (const listing of listings) {
    const canonicalCta = await resolveCanonicalUrl(buildListingCta(listingBaseUrl, listing))
    const cta = addGbpUtmParams(
      canonicalCta,
      'gbp_listing_posts',
      listing?.ListNumber ? `listing_${listing.ListNumber}` : null
    )
    const normalized = normalizeUrlForDedupe(cta)
    if (!force && existing.has(normalized)) {
      console.log(`↷ Skipped (already posted): ${listing.ListNumber}`)
      continue
    }

    const result = await publishListingPost({
      accessToken,
      accountId,
      locationId,
      listing,
      listingBaseUrl,
    })

    if (result.success) {
      console.log(`✓ ${listing.ListNumber} (${result.mediaMode})`)
      console.log(`  GBP ID: ${result.postName}`)
      console.log(`  CTA: ${result.cta}`)
    } else {
      console.log(`✗ ${listing.ListNumber}`)
      console.log(`  HTTP ${result.status}`)
      console.log(`  Error: ${result.error}`)
    }
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
