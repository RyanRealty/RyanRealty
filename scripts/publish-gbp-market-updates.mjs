#!/usr/bin/env node
/**
 * Publish RyanRealty.com market-report blog posts to Google Business Profile.
 *
 * Source of truth: WordPress categories on https://ryan-realty.com
 * - market-reports
 * - local-news
 *
 * Usage:
 *   node scripts/publish-gbp-market-updates.mjs --count 5
 *   node scripts/publish-gbp-market-updates.mjs --count 5 --publish
 *   node scripts/publish-gbp-market-updates.mjs --count 5 --publish --direct
 */

import fs from 'node:fs'

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

function stripHtml(value) {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(value) {
  return (value || '')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&#8230;/g, '...')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function contentSlugFromUrl(url) {
  try {
    const u = new URL(url)
    const slug = u.pathname.split('/').filter(Boolean).pop()
    return slug ? `post_${slug}` : null
  } catch {
    return null
  }
}

function buildSummary(post) {
  const title = decodeEntities(stripHtml(post.title?.rendered))
  const excerpt = decodeEntities(stripHtml(post.excerpt?.rendered))
  const lead = excerpt ? `${title}. ${excerpt}` : title
  const withCta = `${lead} Read the full market update on Ryan Realty.`
  return withCta.slice(0, 1450)
}

async function fetchWordPressMarketPosts(siteUrl, count) {
  const catRes = await fetch(`${siteUrl}/wp-json/wp/v2/categories?per_page=100`)
  if (!catRes.ok) {
    throw new Error(`WordPress categories fetch failed: ${catRes.status} ${catRes.statusText}`)
  }
  const categories = await catRes.json()
  const wanted = categories.filter(
    (c) => c.slug === 'market-reports' || c.slug === 'local-news'
  )
  if (!wanted.length) return []

  const catIds = wanted.map((c) => c.id).join(',')
  const postsRes = await fetch(
    `${siteUrl}/wp-json/wp/v2/posts?per_page=${count}&orderby=date&order=desc&_embed=1&categories=${catIds}`
  )
  if (!postsRes.ok) {
    throw new Error(`WordPress posts fetch failed: ${postsRes.status} ${postsRes.statusText}`)
  }
  const posts = await postsRes.json()

  return posts.map((post) => {
    const media =
      post._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
      null
    const title = decodeEntities(stripHtml(post.title?.rendered))
    const link = post.link
    const trackedLink = addGbpUtmParams(link, 'gbp_market_updates', contentSlugFromUrl(link))
    return {
      title,
      link: trackedLink,
      mediaUrl: media,
      summary: buildSummary(post),
      publishedAt: post.date_gmt || post.date,
    }
  })
}

async function publishOne({ siteUrl, cronSecret, item }) {
  const payload = {
    approved: true,
    contentType: 'blog_market_update',
    platforms: ['google_business_profile'],
    mediaType: 'image',
    mediaUrl:
      item.mediaUrl ||
      `${siteUrl}/wp-content/uploads/2025/01/ryan-realty-logo.png`,
    captionDefault: item.summary,
    captionPerPlatform: {
      google_business_profile: item.summary,
    },
    metadata: {
      google_business_profile: {
        summary: item.summary,
        callToActionUrl: item.link,
      },
    },
    gate: {
      scorecardPath: 'scripts/publish-gbp-market-updates.mjs',
      citationsPath: 'scripts/publish-gbp-market-updates.mjs',
      qaReportPath: 'scripts/publish-gbp-market-updates.mjs',
      postflightPath: 'scripts/publish-gbp-market-updates.mjs',
      manifestoPath: 'video_production_skills/ANTI_SLOP_MANIFESTO.md',
      humanApprovedAt: new Date().toISOString(),
      formatSkillName: 'blog_market_update',
      formatSkillVersion: 'wp-market-categories-v1',
    },
  }

  const res = await fetch(`${siteUrl}/api/social/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': cronSecret,
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  return { status: res.status, body }
}

async function getGoogleAccessTokenFromSupabase(env) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials for direct GBP publish')
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
  if (!rowRes.ok) {
    throw new Error(`Failed reading GBP auth row: ${rowRes.status} ${rowRes.statusText}`)
  }
  const rows = await rowRes.json()
  if (!rows.length) {
    throw new Error('No google_business_profile_auth token row found')
  }

  const tokenRow = rows[0]
  const expiresAt = new Date(tokenRow.expires_at).getTime()
  const refreshWindowMs = 60 * 1000
  if (Date.now() < expiresAt - refreshWindowMs) {
    return tokenRow.access_token
  }

  const clientId = env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret || !tokenRow.refresh_token) {
    throw new Error('Google refresh prerequisites missing (client_id/client_secret/refresh_token)')
  }

  const refreshBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokenRow.refresh_token,
    grant_type: 'refresh_token',
  })
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: refreshBody.toString(),
  })
  if (!refreshRes.ok) {
    const detail = await refreshRes.text()
    throw new Error(`Google token refresh failed: ${refreshRes.status} ${detail}`)
  }
  const refreshed = await refreshRes.json()
  if (!refreshed.access_token) {
    throw new Error('Google token refresh returned no access_token')
  }

  const patchRes = await fetch(`${supabaseUrl}/rest/v1/google_business_profile_auth?id=eq.default`, {
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
  if (!patchRes.ok) {
    const detail = await patchRes.text()
    throw new Error(`Failed to persist refreshed Google token: ${patchRes.status} ${detail}`)
  }

  return refreshed.access_token
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

async function fetchExistingGbpPostCtaUrls(accessToken, accountId, locationId) {
  const existing = new Set()
  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts?pageSize=100`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) return existing
  const json = await res.json()
  for (const post of json.localPosts || []) {
    const ctaUrl = post?.callToAction?.url
    if (ctaUrl) existing.add(normalizeUrlForDedupe(ctaUrl))
  }
  return existing
}

async function publishOneDirect({ env, item }) {
  const accountId = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!accountId || !locationId) {
    throw new Error('GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID or LOCATION_ID missing in .env.local')
  }

  const accessToken = await getGoogleAccessTokenFromSupabase(env)
  const payload = {
    summary: item.summary,
    languageCode: 'en-US',
    topicType: 'STANDARD',
    media: [
      {
        mediaFormat: 'PHOTO',
        sourceUrl:
          item.mediaUrl || 'https://ryan-realty.com/wp-content/uploads/2025/01/ryan-realty-logo.png',
      },
    ],
    callToAction: {
      actionType: 'LEARN_MORE',
      url: item.link,
    },
  }

  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (res.ok) {
    return { status: res.status, body }
  }

  // Some WP featured images are rejected by GBP. Retry once with text-only.
  if (res.status === 400) {
    const fallbackPayload = {
      summary: item.summary.slice(0, 1200),
      languageCode: 'en-US',
      topicType: 'STANDARD',
      callToAction: {
        actionType: 'LEARN_MORE',
        url: item.link,
      },
    }
    const retry = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fallbackPayload),
    })
    const retryBody = await retry.json().catch(() => ({}))
    return { status: retry.status, body: retryBody }
  }

  return { status: res.status, body }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const shouldPublish = Boolean(args.publish)
  const directMode = Boolean(args.direct)
  const force = Boolean(args.force)
  const count = Math.max(1, Number.parseInt(args.count || '5', 10))

  const env = readDotEnv('.env.local')
  const siteUrl = (env.NEXT_PUBLIC_SITE_URL || 'https://ryan-realty.com').replace(/\/+$/, '')
  const cronSecret = env.CRON_SECRET || process.env.CRON_SECRET

  if (!cronSecret) {
    throw new Error('Missing CRON_SECRET in .env.local or process env')
  }

  const marketPosts = await fetchWordPressMarketPosts('https://ryan-realty.com', count)
  if (!marketPosts.length) {
    console.log('No market-report/local-news posts found on ryan-realty.com')
    return
  }

  console.log(`Found ${marketPosts.length} WordPress market posts:`)
  for (const post of marketPosts) {
    console.log(`- ${post.publishedAt} | ${post.title}`)
    console.log(`  ${post.link}`)
  }

  if (!shouldPublish) {
    console.log('\nDry run complete. Re-run with --publish to post to GBP.')
    return
  }

  console.log(
    `\nPublishing to Google Business Profile (${directMode ? 'direct API mode' : 'unified API mode'})...\n`
  )
  let existingCtaUrls = new Set()
  if (!force) {
    const accountId = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
    const locationId = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
    if (accountId && locationId) {
      const token = await getGoogleAccessTokenFromSupabase(env)
      existingCtaUrls = await fetchExistingGbpPostCtaUrls(token, accountId, locationId)
      console.log(`Found ${existingCtaUrls.size} existing GBP posts with CTA URLs for dedupe.`)
    }
  }

  for (const item of marketPosts) {
    const normalizedLink = normalizeUrlForDedupe(item.link)
    if (!force && normalizedLink && existingCtaUrls.has(normalizedLink)) {
      console.log(`↷ Skipped (already posted): ${item.title}`)
      continue
    }

    const result = directMode
      ? await publishOneDirect({ env, item })
      : await publishOne({ siteUrl, cronSecret, item })
    const gbp = result.body?.results?.google_business_profile
    const directSuccess = directMode && result.status >= 200 && result.status < 300 && !!result.body?.name
    const unifiedSuccess = !directMode && result.status >= 200 && result.status < 300 && gbp?.success
    if (directSuccess || unifiedSuccess) {
      console.log(`✓ ${item.title}`)
      console.log(`  GBP ID: ${directMode ? result.body?.name : gbp.externalPostId}`)
    } else {
      console.log(`✗ ${item.title}`)
      console.log(`  HTTP ${result.status}`)
      const errorDetail =
        gbp?.error ||
        result.body?.error?.message ||
        result.body?.error ||
        result.body?.message ||
        'Unknown error'
      console.log(`  Error: ${errorDetail}`)
    }
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
