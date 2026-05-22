#!/usr/bin/env node
/**
 * GBP audit pull — single-shot dump of the entire Ryan Realty Google Business
 * Profile current state. Reads only. No mutation.
 *
 * Output:
 *   out/gbp-audit/ryan-realty-current-state-<DATE>.json   — raw API responses
 *   out/gbp-audit/ryan-realty-current-state-<DATE>.md     — readable audit doc
 *
 * Usage:
 *   node scripts/gbp-audit-pull.mjs                       # default: today's date
 *   node scripts/gbp-audit-pull.mjs --date 2026-05-22
 *   node scripts/gbp-audit-pull.mjs --days 30             # perf window (default 90)
 *
 * Endpoints called (read-only):
 *   - mybusinessbusinessinformation.googleapis.com/v1/locations/{loc}        (details + categories + serviceItems + attributes)
 *   - mybusinessbusinessinformation.googleapis.com/v1/categories             (look up category display names)
 *   - mybusiness.googleapis.com/v4/accounts/{acct}/locations/{loc}/media     (photos + cover + logo)
 *   - mybusiness.googleapis.com/v4/accounts/{acct}/locations/{loc}/reviews   (reviews + response state)
 *   - mybusiness.googleapis.com/v4/accounts/{acct}/locations/{loc}/localPosts(existing Google Posts)
 *   - mybusinessqanda.googleapis.com/v1/locations/{loc}/questions            (Q&A)
 *   - businessprofileperformance.googleapis.com/v1/locations/{loc}:getDailyMetricsTimeSeries
 */

import fs from 'node:fs'
import path from 'node:path'

const DATE_TODAY = new Date().toISOString().slice(0, 10)

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (!t.startsWith('--')) continue
    const key = t.slice(2)
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

async function getAccessToken(env) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = env
  const supabaseUrl = SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase URL / service-role key missing in .env.local')
  }
  const res = await fetch(
    `${supabaseUrl}/rest/v1/google_business_profile_auth?select=access_token,refresh_token,expires_at&id=eq.default&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  )
  if (!res.ok) throw new Error(`Supabase token fetch failed: ${res.status}`)
  const rows = await res.json()
  if (!rows.length) throw new Error('No google_business_profile_auth row found — OAuth never connected')
  const tokenRow = rows[0]
  const expiresAt = new Date(tokenRow.expires_at).getTime()
  // 30-min refresh window (matches lib/google-business-profile.ts).
  if (Date.now() < expiresAt - 30 * 60 * 1000) return tokenRow.access_token

  const clientId = env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret || !tokenRow.refresh_token) {
    throw new Error('Google refresh prerequisites missing — reconnect OAuth')
  }
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!refreshRes.ok) {
    throw new Error(`Token refresh failed: ${refreshRes.status} ${await refreshRes.text()}`)
  }
  const refreshed = await refreshRes.json()
  // Persist the refreshed token so subsequent runs reuse it.
  await fetch(`${supabaseUrl}/rest/v1/google_business_profile_auth?id=eq.default`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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

async function apiGet(url, token, label) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { _raw: text }
  }
  if (!res.ok) {
    return { ok: false, status: res.status, label, error: json?.error?.message || text || res.statusText, json }
  }
  return { ok: true, status: res.status, label, json }
}

async function paginate(baseUrl, token, label, pageSize = 100, pageTokenParam = 'pageToken') {
  // Generic paginator for endpoints that return { *List: [...], nextPageToken }
  const all = []
  let pageToken = null
  let pageCount = 0
  const errors = []
  do {
    pageCount++
    const sep = baseUrl.includes('?') ? '&' : '?'
    const sized = `${baseUrl}${sep}pageSize=${pageSize}${pageToken ? `&${pageTokenParam}=${encodeURIComponent(pageToken)}` : ''}`
    const r = await apiGet(sized, token, `${label} page ${pageCount}`)
    if (!r.ok) {
      errors.push(r)
      break
    }
    all.push(r.json)
    pageToken = r.json?.nextPageToken || null
    if (pageCount > 20) break // safety
  } while (pageToken)
  return { pages: all, errors }
}

function mdHeader(text, level = 2) {
  return `${'#'.repeat(level)} ${text}\n\n`
}

function fmtAddress(addr) {
  if (!addr) return '_unset_'
  const lines = addr.addressLines?.join(', ') ?? ''
  return [lines, addr.locality, addr.administrativeArea, addr.postalCode, addr.regionCode]
    .filter(Boolean)
    .join(', ')
}

function fmtHours(hours) {
  if (!hours?.periods?.length) return '_unset_'
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
  return days
    .map((day) => {
      const periods = hours.periods.filter((p) => p.openDay === day)
      if (!periods.length) return `- **${day.slice(0, 3)}:** closed`
      return periods
        .map((p) => {
          const open = `${String(p.openTime?.hours ?? 0).padStart(2, '0')}:${String(p.openTime?.minutes ?? 0).padStart(2, '0')}`
          const close = `${String(p.closeTime?.hours ?? 0).padStart(2, '0')}:${String(p.closeTime?.minutes ?? 0).padStart(2, '0')}`
          return `- **${day.slice(0, 3)}:** ${open} – ${close}`
        })
        .join('\n')
    })
    .join('\n')
}

function fmtCategory(cat) {
  if (!cat) return '_unset_'
  // categories.name = "categories/gcid:real_estate_agency", displayName = "Real estate agency"
  return cat.displayName ? `${cat.displayName} (\`${cat.name}\`)` : cat.name
}

function reviewSummary(reviews) {
  if (!reviews.length) return { count: 0, avg: null, byStar: {}, unresponded: 0, responseRate: null }
  const byStar = {}
  let total = 0
  let unresponded = 0
  for (const r of reviews) {
    const stars = (r.starRating || 'STAR_RATING_UNSPECIFIED').toString()
    byStar[stars] = (byStar[stars] || 0) + 1
    const numeric =
      stars === 'FIVE' ? 5 : stars === 'FOUR' ? 4 : stars === 'THREE' ? 3 : stars === 'TWO' ? 2 : stars === 'ONE' ? 1 : 0
    if (numeric) total += numeric
    if (!r.reviewReply) unresponded++
  }
  const avg = total / reviews.length
  const responseRate = ((reviews.length - unresponded) / reviews.length) * 100
  return { count: reviews.length, avg, byStar, unresponded, responseRate }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const date = args.date || DATE_TODAY
  const perfDays = parseInt(args.days || '90', 10)

  // Load env
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('FATAL: .env.local not found')
    process.exit(1)
  }
  const env = { ...readDotEnv(envPath), ...process.env }

  const accountId = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  if (!accountId || !locationId) {
    console.error('FATAL: GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID / LOCATION_ID not set')
    process.exit(1)
  }

  console.log(`Account: accounts/${accountId}`)
  console.log(`Location: locations/${locationId}`)
  console.log(`Pulling current state for ${date} (perf window ${perfDays}d)...`)

  const token = await getAccessToken(env)
  console.log('✓ Access token obtained')

  // 1. Location details (the big one) — request a comprehensive read mask.
  const readMask = [
    'name',
    'title',
    'storeCode',
    'languageCode',
    'phoneNumbers',
    'storefrontAddress',
    'websiteUri',
    'regularHours',
    'specialHours',
    'serviceArea',
    'labels',
    'adWordsLocationExtensions',
    'latlng',
    'openInfo',
    'metadata',
    'profile',
    'relationshipData',
    'moreHours',
    'serviceItems',
    'categories',
  ].join(',')

  const locUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}?readMask=${encodeURIComponent(
    readMask,
  )}`
  const locResult = await apiGet(locUrl, token, 'location-details')
  console.log(locResult.ok ? '✓ Location details' : `✗ Location details: ${locResult.error}`)

  // 2. Attributes
  const attrUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${locationId}/attributes`
  const attrResult = await apiGet(attrUrl, token, 'attributes')
  console.log(attrResult.ok ? '✓ Attributes' : `✗ Attributes: ${attrResult.error}`)

  // 3. Media (photos / cover / logo)
  const mediaBase = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`
  const mediaPaged = await paginate(mediaBase, token, 'media')
  const allMedia = mediaPaged.pages.flatMap((p) => p.mediaItems || [])
  console.log(`✓ Media: ${allMedia.length} items${mediaPaged.errors.length ? ` (${mediaPaged.errors.length} errors)` : ''}`)

  // 4. Reviews
  const reviewsBase = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`
  const reviewsPaged = await paginate(reviewsBase, token, 'reviews')
  const allReviews = reviewsPaged.pages.flatMap((p) => p.reviews || [])
  console.log(`✓ Reviews: ${allReviews.length}${reviewsPaged.errors.length ? ` (${reviewsPaged.errors.length} errors)` : ''}`)

  // 5. Local Posts (Google Posts history)
  const postsBase = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`
  const postsPaged = await paginate(postsBase, token, 'localPosts')
  const allPosts = postsPaged.pages.flatMap((p) => p.localPosts || [])
  console.log(`✓ Local Posts: ${allPosts.length}${postsPaged.errors.length ? ` (${postsPaged.errors.length} errors)` : ''}`)

  // 6. Q&A
  const qaBase = `https://mybusinessqanda.googleapis.com/v1/locations/${locationId}/questions`
  const qaPaged = await paginate(qaBase, token, 'qa', 100, 'pageToken')
  const allQa = qaPaged.pages.flatMap((p) => p.questions || [])
  console.log(`✓ Q&A: ${allQa.length}${qaPaged.errors.length ? ` (${qaPaged.errors.length} errors)` : ''}`)

  // 7. Performance metrics (last `perfDays` days)
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - perfDays)
  const fmt = (d) => d.toISOString().slice(0, 10)
  const startDate = fmt(start)
  const endDate = fmt(end)
  const metrics = [
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'CALL_CLICKS',
    'WEBSITE_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS',
    'BUSINESS_CONVERSATIONS',
    'BUSINESS_BOOKINGS',
  ]
  const perfResults = {}
  for (const metric of metrics) {
    const [sy, sm, sd] = startDate.split('-')
    const [ey, em, ed] = endDate.split('-')
    const params = new URLSearchParams({
      dailyMetric: metric,
      'dailyRange.start_date.year': sy,
      'dailyRange.start_date.month': sm,
      'dailyRange.start_date.day': sd,
      'dailyRange.end_date.year': ey,
      'dailyRange.end_date.month': em,
      'dailyRange.end_date.day': ed,
    })
    const url = `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:getDailyMetricsTimeSeries?${params}`
    const r = await apiGet(url, token, `metric:${metric}`)
    if (r.ok) {
      const values = r.json?.timeSeries?.datedValues || []
      const total = values.reduce((sum, dv) => sum + (parseInt(dv.value || '0', 10) || 0), 0)
      perfResults[metric] = { total, days: values.length }
    } else {
      perfResults[metric] = { error: r.error }
    }
  }
  console.log(`✓ Performance: ${Object.keys(perfResults).length} metrics over ${perfDays}d`)

  // ---------------- write outputs ----------------
  const outDir = 'out/gbp-audit'
  fs.mkdirSync(outDir, { recursive: true })

  const raw = {
    pulled_at: new Date().toISOString(),
    date,
    account_id: accountId,
    location_id: locationId,
    perf_window_days: perfDays,
    perf_start: startDate,
    perf_end: endDate,
    location: locResult.ok ? locResult.json : { _error: locResult.error },
    attributes: attrResult.ok ? attrResult.json : { _error: attrResult.error },
    media: { items: allMedia, errors: mediaPaged.errors },
    reviews: { items: allReviews, errors: reviewsPaged.errors },
    posts: { items: allPosts, errors: postsPaged.errors },
    qa: { items: allQa, errors: qaPaged.errors },
    performance: perfResults,
  }

  const jsonPath = `${outDir}/ryan-realty-current-state-${date}.json`
  fs.writeFileSync(jsonPath, JSON.stringify(raw, null, 2))
  console.log(`✓ Raw JSON → ${jsonPath}`)

  // Build readable markdown
  const loc = raw.location
  const lines = []
  lines.push(`# Ryan Realty — GBP Current State (${date})\n`)
  lines.push(`Pulled: ${raw.pulled_at}  `)
  lines.push(`Account: \`accounts/${accountId}\`  `)
  lines.push(`Location: \`locations/${locationId}\`\n`)

  // Basic info
  lines.push(mdHeader('1. Basic info'))
  lines.push(`- **Business name:** ${loc?.title || '_unset_'}`)
  lines.push(`- **Primary category:** ${fmtCategory(loc?.categories?.primaryCategory)}`)
  const addl = loc?.categories?.additionalCategories || []
  lines.push(`- **Additional categories (${addl.length}):**`)
  if (addl.length) addl.forEach((c) => lines.push(`  - ${fmtCategory(c)}`))
  else lines.push(`  - _none_`)
  lines.push(`- **Phone:** ${loc?.phoneNumbers?.primaryPhone || '_unset_'}`)
  if (loc?.phoneNumbers?.additionalPhones?.length) {
    lines.push(`- **Additional phones:** ${loc.phoneNumbers.additionalPhones.join(', ')}`)
  }
  lines.push(`- **Website:** ${loc?.websiteUri || '_unset_'}`)
  lines.push(`- **Address:** ${fmtAddress(loc?.storefrontAddress)}`)
  lines.push(`- **Lat/lng:** ${loc?.latlng?.latitude ?? '_unset_'}, ${loc?.latlng?.longitude ?? '_unset_'}`)
  lines.push(`- **Status:** ${loc?.openInfo?.status || '_unset_'} (canReopen=${loc?.openInfo?.canReopen ?? '_unset_'})`)
  lines.push(`- **Opened:** ${loc?.openInfo?.openingDate ? `${loc.openInfo.openingDate.year}-${loc.openInfo.openingDate.month}-${loc.openInfo.openingDate.day}` : '_unset_'}`)
  lines.push(`- **Store code:** ${loc?.storeCode || '_unset_'}`)
  lines.push(`- **Language:** ${loc?.languageCode || '_unset_'}`)
  lines.push(``)

  // Description
  lines.push(mdHeader('2. Description'))
  const desc = loc?.profile?.description
  if (desc) {
    lines.push(`> ${desc.replace(/\n/g, '\n> ')}`)
    lines.push(``)
    lines.push(`Length: **${desc.length} chars** (GBP limit: 750)`)
  } else {
    lines.push(`_No description set._`)
  }
  lines.push(``)

  // Hours
  lines.push(mdHeader('3. Hours'))
  lines.push(fmtHours(loc?.regularHours))
  if (loc?.specialHours?.specialHourPeriods?.length) {
    lines.push(`\n**Special hours:** ${loc.specialHours.specialHourPeriods.length} entries`)
  }
  if (loc?.moreHours?.length) {
    lines.push(`\n**More hours sets:** ${loc.moreHours.length}`)
  }
  lines.push(``)

  // Service area
  lines.push(mdHeader('4. Service area'))
  const sa = loc?.serviceArea
  if (sa) {
    lines.push(`- **Type:** ${sa.businessType || '_unset_'}`)
    if (sa.places?.placeInfos?.length) {
      lines.push(`- **Places (${sa.places.placeInfos.length}):**`)
      sa.places.placeInfos.forEach((p) => lines.push(`  - ${p.placeName} (\`${p.placeId}\`)`))
    } else {
      lines.push(`- **Places:** _none_`)
    }
  } else {
    lines.push(`_No service area set (storefront-only profile)._`)
  }
  lines.push(``)

  // Service items
  lines.push(mdHeader('5. Service items'))
  const items = loc?.serviceItems || []
  if (items.length) {
    items.forEach((it, i) => {
      const label = it.freeFormServiceItem?.label?.displayName || it.structuredServiceItem?.serviceTypeId || `Item ${i + 1}`
      lines.push(`- **${label}**`)
      if (it.price) lines.push(`  - Price: ${it.price.currencyCode} ${it.price.units || 0}`)
      const blurb = it.freeFormServiceItem?.label?.description || it.structuredServiceItem?.description
      if (blurb) lines.push(`  - ${blurb}`)
    })
  } else {
    lines.push(`_No service items set._`)
  }
  lines.push(``)

  // Attributes
  lines.push(mdHeader('6. Attributes'))
  const attrs = raw.attributes?.attributes || []
  if (attrs.length) {
    attrs.forEach((a) => {
      let val = '_set_'
      if (a.values?.length) val = a.values.join(', ')
      else if (a.repeatedEnumValue) val = `set=${(a.repeatedEnumValue.setValues || []).join(',')} unset=${(a.repeatedEnumValue.unsetValues || []).join(',')}`
      else if (a.uriValues?.length) val = a.uriValues.map((v) => v.uri).join(', ')
      lines.push(`- \`${a.name}\` → ${val}`)
    })
  } else {
    lines.push(`_No attributes set._`)
  }
  lines.push(``)

  // Media
  lines.push(mdHeader('7. Photos & media'))
  const byCat = {}
  for (const m of allMedia) {
    const cat = m.locationAssociation?.category || 'UNCATEGORIZED'
    byCat[cat] = (byCat[cat] || 0) + 1
  }
  lines.push(`- **Total media items:** ${allMedia.length}`)
  Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, n]) => lines.push(`  - ${cat}: ${n}`))
  if (allMedia.length) {
    const firstUpload = allMedia.reduce((min, m) => (m.createTime && m.createTime < min ? m.createTime : min), allMedia[0].createTime || '9999')
    const lastUpload = allMedia.reduce((max, m) => (m.createTime && m.createTime > max ? m.createTime : max), allMedia[0].createTime || '0000')
    lines.push(`- **First upload:** ${firstUpload}`)
    lines.push(`- **Last upload:** ${lastUpload}`)
  }
  lines.push(``)

  // Reviews
  lines.push(mdHeader('8. Reviews'))
  const rs = reviewSummary(allReviews)
  lines.push(`- **Total reviews:** ${rs.count}`)
  if (rs.count > 0) {
    lines.push(`- **Average rating:** ${rs.avg.toFixed(2)} ★`)
    lines.push(`- **By stars:**`)
    Object.entries(rs.byStar)
      .sort()
      .forEach(([s, n]) => lines.push(`  - ${s}: ${n}`))
    lines.push(`- **Unresponded:** ${rs.unresponded} (response rate: ${rs.responseRate.toFixed(1)}%)`)
    const recent = [...allReviews]
      .sort((a, b) => (b.createTime || '').localeCompare(a.createTime || ''))
      .slice(0, 5)
    lines.push(`\n**5 most recent:**`)
    recent.forEach((r) => {
      const replied = r.reviewReply ? '✓ replied' : '✗ NO REPLY'
      const stars = (r.starRating || '?').toString()
      const author = r.reviewer?.displayName || 'Anonymous'
      const dt = r.createTime?.slice(0, 10) || '?'
      lines.push(`- **${dt}** [${stars}] ${author} — ${replied}`)
      if (r.comment) lines.push(`  > ${r.comment.replace(/\n/g, ' ').slice(0, 200)}${r.comment.length > 200 ? '…' : ''}`)
    })
  }
  lines.push(``)

  // Posts
  lines.push(mdHeader('9. Google Posts'))
  lines.push(`- **Total posts:** ${allPosts.length}`)
  if (allPosts.length) {
    const recent = [...allPosts]
      .sort((a, b) => (b.createTime || '').localeCompare(a.createTime || ''))
    const lastPost = recent[0]
    const lastDate = lastPost?.createTime?.slice(0, 10) || '?'
    const daysSince = lastPost?.createTime
      ? Math.floor((Date.now() - new Date(lastPost.createTime).getTime()) / 86400000)
      : null
    lines.push(`- **Most recent post:** ${lastDate} (${daysSince !== null ? `${daysSince} days ago` : 'unknown'})`)
    const byType = {}
    for (const p of allPosts) {
      const t = p.topicType || 'UNKNOWN'
      byType[t] = (byType[t] || 0) + 1
    }
    lines.push(`- **By topic type:**`)
    Object.entries(byType).forEach(([t, n]) => lines.push(`  - ${t}: ${n}`))
    const live = allPosts.filter((p) => p.state === 'LIVE')
    lines.push(`- **Currently LIVE:** ${live.length}`)
    lines.push(`\n**5 most recent:**`)
    recent.slice(0, 5).forEach((p) => {
      const dt = p.createTime?.slice(0, 10) || '?'
      lines.push(`- **${dt}** [${p.topicType || '?'}] state=${p.state || '?'}`)
      if (p.summary) lines.push(`  > ${p.summary.replace(/\n/g, ' ').slice(0, 200)}${p.summary.length > 200 ? '…' : ''}`)
    })
  } else {
    lines.push(`_No Google Posts found._`)
  }
  lines.push(``)

  // Q&A
  lines.push(mdHeader('10. Q&A'))
  lines.push(`- **Total questions:** ${allQa.length}`)
  if (allQa.length) {
    const unanswered = allQa.filter((q) => !q.answers || q.answers.length === 0)
    const ownerAnswered = allQa.filter((q) => q.answers?.some((a) => a.author?.type === 'MERCHANT'))
    lines.push(`- **Unanswered:** ${unanswered.length}`)
    lines.push(`- **Owner-answered:** ${ownerAnswered.length}`)
    lines.push(`\n**All questions:**`)
    allQa.slice(0, 20).forEach((q) => {
      lines.push(`- ${q.text || '(no text)'} — ${q.totalAnswerCount || 0} answers`)
    })
  } else {
    lines.push(`_No Q&A entries found._`)
  }
  lines.push(``)

  // Performance
  lines.push(mdHeader(`11. Performance (${perfDays}d: ${startDate} → ${endDate})`))
  Object.entries(perfResults).forEach(([metric, data]) => {
    if (data.error) {
      lines.push(`- **${metric}:** _error: ${data.error}_`)
    } else {
      lines.push(`- **${metric}:** ${data.total.toLocaleString()} (${data.days} day-rows)`)
    }
  })
  lines.push(``)

  // Summary scorecard
  lines.push(mdHeader('12. Audit checkpoints'))
  const desc_chars = loc?.profile?.description?.length || 0
  const checks = [
    ['Business name set', !!loc?.title],
    ['Primary category set', !!loc?.categories?.primaryCategory],
    [`Additional categories ≥ 3 (have: ${addl.length})`, addl.length >= 3],
    [`Description ≥ 600 chars (have: ${desc_chars})`, desc_chars >= 600],
    ['Phone set', !!loc?.phoneNumbers?.primaryPhone],
    ['Website set', !!loc?.websiteUri],
    ['Regular hours set', !!loc?.regularHours?.periods?.length],
    [`Photos ≥ 25 (have: ${allMedia.length})`, allMedia.length >= 25],
    [`Total reviews ≥ 25 (have: ${rs.count})`, rs.count >= 25],
    [`Review response rate = 100% (have: ${rs.responseRate?.toFixed(1) ?? 'n/a'}%)`, rs.responseRate === 100],
    [`Posted in last 7 days`, allPosts.length > 0 && (Date.now() - new Date(allPosts[0].createTime).getTime()) / 86400000 <= 7],
    [`Q&A seeded ≥ 5 (have: ${allQa.length})`, allQa.length >= 5],
    [`Service area set OR storefront`, !!(loc?.serviceArea || loc?.storefrontAddress)],
    [`Service items set ≥ 5 (have: ${items.length})`, items.length >= 5],
    [`Attributes set ≥ 5 (have: ${attrs.length})`, attrs.length >= 5],
  ]
  for (const [name, pass] of checks) {
    lines.push(`- [${pass ? 'x' : ' '}] ${name}`)
  }

  const mdPath = `${outDir}/ryan-realty-current-state-${date}.md`
  fs.writeFileSync(mdPath, lines.join('\n'))
  console.log(`✓ Markdown → ${mdPath}`)

  console.log('\nDone.')
}

main().catch((e) => {
  console.error(`FATAL: ${e?.message || e}`)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
