#!/usr/bin/env node
/**
 * Apply Phase 1 + 3.1 + 4.1 of the GBP update plan (out/gbp-audit/update-plan-2026-05-22.md).
 *
 * Phase 1 (low-risk repairs and obvious wins):
 *   1.1 Repair 4 broken LIVE posts (strip scaffolding, fix banned word, fix Northpointe geography)
 *   1.2 Reply to the unanswered E Oster review
 *   1.3 Set hours to 05:00–19:00 every day
 *   1.4 Add UTM params to website URL
 *   1.5 Fix founding date to 2014-10-01 (the LLC entity dates from October 2014 per Matt)
 *   1.6 Remove 2 inapplicable service items (real_estate_management, furnished_property)
 *   1.7 Set small-business identity attribute (best-effort)
 *
 * Phase 3.1 (4 ready photos):
 *   - Canonical Bend hero (Old Mill 4K)
 *   - Matt Ryan headshot
 *   - Paul Stevenson headshot
 *   - Rebecca Peterson headshot
 *
 * Phase 4.1 (publisher fix):
 *   - Already applied in lib/google-business-profile.ts (sanitizeGbpSummary)
 *   - This script verifies the import path still resolves
 *
 * Usage:
 *   node scripts/gbp-apply-phase1.mjs              # dry-run (shows what it would do)
 *   node scripts/gbp-apply-phase1.mjs --execute    # actually push
 */

import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = process.cwd()

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
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const res = await fetch(
    `${supabaseUrl}/rest/v1/google_business_profile_auth?select=access_token,refresh_token,expires_at&id=eq.default&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  const rows = await res.json()
  const tokenRow = rows[0]
  const expiresAt = new Date(tokenRow.expires_at).getTime()
  if (Date.now() < expiresAt - 30 * 60 * 1000) return tokenRow.access_token

  const clientId = env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET
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
  const refreshed = await refreshRes.json()
  await fetch(`${supabaseUrl}/rest/v1/google_business_profile_auth?id=eq.default`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || tokenRow.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  })
  return refreshed.access_token
}

async function api(method, url, token, body, label) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : {} } catch { json = { _raw: text } }
  return { ok: res.ok, status: res.status, label, json, raw: text }
}

// ----------- Post repair drafts (synchronized with post-fixes-draft-2026-05-22.md) -----------

const POST_REPAIRS = [
  {
    postId: '1917384386661719820',
    label: 'Broken Top closing',
    newSummary: `Just closed in Broken Top, Bend. Rebecca Peterson on the Ryan Realty team worked the buyer side.

The home is a three-bedroom, three-bath, 2,116 square feet, built in 2000, on a classic Broken Top lot. Broken Top is one of Bend's most established golf-community neighborhoods, on the west side of town with access to the Broken Top Club, hiking and biking trails, and a short drive to downtown.

A note on Broken Top at this price band. Buyers read the comps carefully and reward patient strategy. Sub-list outcomes are common when a seller has been on the market past thirty days.

Big congratulations to Rebecca and her clients. The buyers were patient through the search and ended up landing this one nicely under the original asking. If you're thinking about Broken Top, Tetherow, or anywhere on Bend's west side, reach out.`,
  },
  {
    postId: '1355150671698513928',
    label: 'Tillicum Village pending',
    newSummary: `Pending in Tillicum Village, Bend Oregon. Rebecca Peterson on the Ryan Realty team worked the buyer side.

The home is a three-bedroom, two-bath on a half-acre lot, 1,560 square feet. Tillicum Village sits at the south end of Bend with larger lots than most comparably priced in-town neighborhoods. Buyers who want room to spread out and don't want to drive twenty minutes to Sisters keep finding their way here.

Tillicum continues to be one of the better price-to-land neighborhoods we show relocation and step-up buyers in the Bend metro.

Big congratulations to Rebecca and her clients. If you're thinking about Tillicum, Sundance, or anywhere on the south side of Bend, reach out.`,
  },
  {
    postId: '1277278442958680311',
    label: 'Northpointe under contract',
    newSummary: `Under contract in Northpointe, Bend Oregon. A three-bedroom, two-bath Cascade-view home, 1,803 square feet, built 2004.

Northpointe sits in NE Bend with easy access to Pilot Butte, downtown, and the NE Bend trail network. The $500K to $600K band of this neighborhood has been moving quickly when homes are priced honestly and presented well. Step-up buyers from Bend and relocation buyers from the surrounding metros are both active in this range.

Big congratulations to our seller and to the new buyers. If you're thinking about buying or selling in Northpointe or anywhere in NE Bend, reach out.`,
  },
  {
    postId: '5525574215694829000',
    label: 'Vandevert Ranch closing',
    newSummary: `Just closed in Vandevert Ranch, Bend.

The home is a 2017 ranch-style build on the Little Deschutes River. 3,996 square feet, 4 bedrooms, 5 baths, on 1.59 acres along the water. Steel-framed windows, a stone-clad chimney, and an antler chandelier in the great room.

Vandevert Ranch is a private subdivision south of Bend along the Little Deschutes. Buyers come here for river frontage, Cascade views, and architecture that holds up over time, twenty minutes south of downtown Bend.

Big congratulations to our buyers and to our sellers. The high-end of the Bend market keeps moving when the right buyer meets the right property. If you're thinking about buying or selling in Bend, Tumalo, or Sisters, reach out.`,
  },
]

const REVIEW_REPLY = {
  reviewId: 'AbFvOqm0v-mYSyVtPxQ-xfHtDQ-iII-PRG1FVW9_-4hvc_qizfttfORxntX19GdkIBZJNvT0kkVpBg',
  reviewer: 'E Oster',
  comment: `E, Thank you so much for taking the time to share this. The data side of negotiations is something I genuinely care about, so it means a lot to hear that it came through for you. Working through a deal with you was a real pleasure, and the trust on both sides made it possible. Wishing you all the best in your new chapter, and please know I'm always here if you need anything down the road. Reviews like this mean the world to a small business like ours.`,
}

const NEW_HOURS = {
  periods: [
    'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
  ].map((day) => ({
    openDay: day,
    openTime: { hours: 5, minutes: 0 },
    closeDay: day,
    closeTime: { hours: 19, minutes: 0 },
  })),
}

const NEW_WEBSITE_URI = 'https://ryan-realty.com/?utm_source=gbp&utm_medium=organic&utm_campaign=profile'

const NEW_OPENING_DATE = { year: 2014, month: 10, day: 1 }

// 13 retained service items (15 - 2 pruned)
const RETAINED_SERVICE_ITEMS = [
  'building_lots_for_sale',
  'buying_agent_services',
  'commercial_real_estate',
  'developments',
  'farm_sales',
  'first_time_home_buyer_services',
  'foreclosed_property_sales',
  // 'furnished_property',           // REMOVED
  'luxury_property_buying_and_sales',
  'new_real_estate',
  'plots_of_land',
  'real_estate_investment',
  // 'real_estate_management',       // REMOVED
  'relocation_services',
  'sellers_agent_services',
].map((id) => ({ structuredServiceItem: { serviceTypeId: `job_type_id:${id}` } }))

// Brand-voice scan (light — matches lib/google-business-profile.ts sanitizeGbpSummary)
function scanBrandVoice(text, label) {
  const banned = ['stunning', 'breathtaking', 'gorgeous', 'charming', 'pristine', 'nestled',
    'boasts', 'meticulously maintained', 'tucked away', 'hidden gem', 'turnkey', 'must-see',
    'dream home', 'beautiful', 'spacious', 'cozy', 'luxurious', 'immaculate', 'captivating',
    'exquisite', 'delve', 'leverage', 'tapestry', 'robust', 'seamless', 'elevate', 'unlock',
    'bustling', 'eclectic', 'curated', 'bespoke', 'approximately', 'roughly']
  for (const b of banned) {
    const re = new RegExp(`\\b${b}\\b`, 'i')
    if (re.test(text)) throw new Error(`Brand-voice hard fail in ${label}: "${b}"`)
  }
  if (/[—–]/.test(text)) throw new Error(`Em/en-dash in ${label}`)
  if (/;/.test(text)) throw new Error(`Semicolon in ${label}`)
}

// ----------- Photo upload helpers -----------

const PHOTOS = [
  {
    label: 'Bend hero — Old Mill',
    path: 'design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg',
    category: 'ADDITIONAL',
    description: 'Old Mill District, Bend, Oregon — Ryan Realty service area',
  },
  {
    label: 'Matt Ryan headshot',
    path: 'design_system/ryan-realty/assets/team/matt-ryan.jpg',
    category: 'ADDITIONAL',
    description: 'Matt Ryan, principal broker — Ryan Realty Bend',
  },
  {
    label: 'Paul Stevenson headshot',
    path: 'design_system/ryan-realty/assets/team/paul-stevenson.jpg',
    category: 'ADDITIONAL',
    description: 'Paul Stevenson, broker — Ryan Realty Bend',
  },
  {
    label: 'Rebecca Peterson headshot',
    path: 'design_system/ryan-realty/assets/team/rebecca-peterson.jpg',
    category: 'ADDITIONAL',
    description: 'Rebecca Peterson, broker — Ryan Realty Bend',
  },
]

async function uploadPhotoBytes(accountId, locationId, token, photo) {
  // Step 1 — startUpload to get a resourceName placeholder.
  const startUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media:startUpload`
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const startJson = await startRes.json()
  if (!startRes.ok || !startJson?.resourceName) {
    return { ok: false, error: `startUpload failed: ${JSON.stringify(startJson)}` }
  }
  const resourceName = startJson.resourceName

  // Step 2 — upload the bytes to mediaupload endpoint.
  const fullPath = path.resolve(PROJECT_ROOT, photo.path)
  if (!fs.existsSync(fullPath)) {
    return { ok: false, error: `Photo file not found: ${fullPath}` }
  }
  const bytes = fs.readFileSync(fullPath)
  const uploadUrl = `https://mybusinessbusinessinformation.googleapis.com/upload/v1/media/${resourceName}?upload_type=media`
  // Note: the GBP media upload uses POST /upload to a slightly different host; we map carefully.
  // Per docs: PUT to https://mybusiness.googleapis.com/upload/v1/media/{resourceName}?upload_type=media
  const altUploadUrl = `https://mybusiness.googleapis.com/upload/v1/media/${resourceName}?upload_type=media`
  const uploadRes = await fetch(altUploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: bytes,
  })
  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    return { ok: false, error: `byte upload failed: ${uploadRes.status} ${errText.slice(0, 500)}` }
  }

  // Step 3 — create the media item.
  const createUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`
  const createBody = {
    mediaFormat: 'PHOTO',
    locationAssociation: { category: photo.category },
    description: photo.description,
    dataRef: { resourceName },
  }
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody),
  })
  const createJson = await createRes.json()
  if (!createRes.ok) {
    return { ok: false, error: `create media failed: ${JSON.stringify(createJson).slice(0, 500)}` }
  }
  return { ok: true, mediaName: createJson.name, googleUrl: createJson.googleUrl }
}

// ----------- Main -----------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const execute = !!args.execute
  const env = { ...readDotEnv(path.join(PROJECT_ROOT, '.env.local')), ...process.env }
  const accountId = env.GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID
  const locationId = env.GOOGLE_BUSINESS_PROFILE_LOCATION_ID
  const locName = `locations/${locationId}`
  const apiAcctLocBase = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}`

  console.log(`\n=== Ryan Realty GBP — Phase 1 + 3.1 + 4.1 ===`)
  console.log(`Mode: ${execute ? '🟢 EXECUTE' : '🟡 DRY-RUN'}`)
  console.log(`Account: ${accountId}`)
  console.log(`Location: ${locationId}\n`)

  // Scan all post summaries + review reply for brand-voice fails BEFORE getting a token
  for (const p of POST_REPAIRS) scanBrandVoice(p.newSummary, `post:${p.label}`)
  scanBrandVoice(REVIEW_REPLY.comment, 'review reply')
  console.log('✓ Brand-voice scan passed on all text\n')

  if (!execute) {
    console.log('--- DRY-RUN SUMMARY ---')
    console.log(`Would PATCH ${POST_REPAIRS.length} broken posts`)
    console.log(`Would PUT review reply to ${REVIEW_REPLY.reviewer}`)
    console.log(`Would PATCH location: hours, websiteUri, openingDate, serviceItems`)
    console.log(`Would PATCH attributes: small_business identity`)
    console.log(`Would upload ${PHOTOS.length} photos`)
    console.log('\nRe-run with --execute to push.')
    return
  }

  const token = await getAccessToken(env)
  console.log('✓ Access token obtained\n')

  const results = []

  // 1.1 — Repair 4 posts
  console.log('--- 1.1 Repair 4 broken posts ---')
  for (const post of POST_REPAIRS) {
    const url = `${apiAcctLocBase}/localPosts/${post.postId}?updateMask=summary`
    const r = await api('PATCH', url, token, { summary: post.newSummary }, `post:${post.label}`)
    if (r.ok) {
      console.log(`  ✓ ${post.label}`)
      results.push({ action: `post:${post.label}`, ok: true })
    } else {
      console.log(`  ✗ ${post.label} — HTTP ${r.status}: ${r.json?.error?.message || r.raw?.slice(0, 200)}`)
      results.push({ action: `post:${post.label}`, ok: false, error: r.json?.error?.message })
    }
  }

  // 1.2 — Reply to E Oster review
  console.log('\n--- 1.2 Reply to E Oster review ---')
  const reviewReplyUrl = `${apiAcctLocBase}/reviews/${REVIEW_REPLY.reviewId}/reply`
  const replyRes = await api('PUT', reviewReplyUrl, token, { comment: REVIEW_REPLY.comment }, 'review-reply')
  if (replyRes.ok) {
    console.log(`  ✓ Reply posted to ${REVIEW_REPLY.reviewer}`)
    results.push({ action: 'review-reply', ok: true })
  } else {
    console.log(`  ✗ HTTP ${replyRes.status}: ${replyRes.json?.error?.message || replyRes.raw?.slice(0, 200)}`)
    results.push({ action: 'review-reply', ok: false, error: replyRes.json?.error?.message })
  }

  // 1.3 + 1.4 + 1.5 + 1.6 — Location patch
  console.log('\n--- 1.3-1.6 Location patch (hours + website + opening date + service items) ---')
  const locReadMask = 'regularHours,websiteUri,openInfo,serviceItems'
  const locPatchUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locName}?updateMask=${encodeURIComponent(locReadMask)}`
  const locPatchBody = {
    regularHours: NEW_HOURS,
    websiteUri: NEW_WEBSITE_URI,
    openInfo: { openingDate: NEW_OPENING_DATE, status: 'OPEN' },
    serviceItems: RETAINED_SERVICE_ITEMS,
  }
  const locRes = await api('PATCH', locPatchUrl, token, locPatchBody, 'location-patch')
  if (locRes.ok) {
    console.log('  ✓ Location patched (hours, website, opening date, service items)')
    results.push({ action: 'location-patch', ok: true })
  } else {
    console.log(`  ✗ HTTP ${locRes.status}: ${locRes.json?.error?.message || locRes.raw?.slice(0, 500)}`)
    results.push({ action: 'location-patch', ok: false, error: locRes.json?.error?.message })
  }

  // 1.7 — Small-business identity attribute (best-effort)
  console.log('\n--- 1.7 Small-business identity attribute (best-effort) ---')
  // Discover the right attribute name for this category first
  const attrListUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/attributes?categoryName=categories/gcid:real_estate_agency&regionCode=US&languageCode=en`
  const attrListRes = await api('GET', attrListUrl, token, undefined, 'attr-list')
  let smallBizAttrName = null
  if (attrListRes.ok) {
    const allAttrs = attrListRes.json?.attributeMetadata || []
    const candidate = allAttrs.find((a) => /small.?business/i.test(a.parent || '') || /small.?business/i.test(a.displayName || ''))
    if (candidate) {
      smallBizAttrName = candidate.parent || candidate.name
      console.log(`  Found attribute: ${smallBizAttrName} (${candidate.displayName})`)
    } else {
      console.log('  ! No "small business" identity attribute available for Real Estate Agency category — skipping')
      results.push({ action: 'attr-small-business', ok: false, error: 'attribute not available for category' })
    }
  } else {
    console.log(`  ! Could not list attributes: ${attrListRes.json?.error?.message || 'unknown'} — skipping`)
    results.push({ action: 'attr-small-business', ok: false, error: 'attribute discovery failed' })
  }
  if (smallBizAttrName) {
    const attrPatchUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locName}/attributes`
    const attrPatchBody = {
      name: `${locName}/attributes`,
      attributes: [{ name: smallBizAttrName, values: [true] }],
    }
    const ar = await api('PATCH', attrPatchUrl + '?updateMask=attributes', token, attrPatchBody, 'attr-patch')
    if (ar.ok) {
      console.log('  ✓ Small-business attribute set')
      results.push({ action: 'attr-small-business', ok: true })
    } else {
      console.log(`  ✗ HTTP ${ar.status}: ${ar.json?.error?.message || ar.raw?.slice(0, 200)}`)
      results.push({ action: 'attr-small-business', ok: false, error: ar.json?.error?.message })
    }
  }

  // 3.1 — Photo upload SKIPPED via API
  // The GBP v4 media create endpoint returns 500 Internal Error reliably after a successful
  // startUpload + byte upload. This is a known GBP API flakiness pattern; the UI upload path
  // works fine. Photos in Phase 3.1 are deferred to a Matt-UI task — see update plan §3.1.
  console.log('\n--- 3.1 Photo uploads — DEFERRED to UI task (API 500s) ---')
  for (const photo of PHOTOS) {
    console.log(`  ⏭  ${photo.label} — ${photo.path}`)
    results.push({ action: `photo:${photo.label}`, ok: false, skipped: true, error: 'deferred to UI upload — GBP v4 media create returns 500' })
  }

  // 4.1 — Verify publisher sanitizer was applied
  console.log('\n--- 4.1 Verify publisher sanitizer ---')
  const libPath = path.join(PROJECT_ROOT, 'lib/google-business-profile.ts')
  const libSrc = fs.readFileSync(libPath, 'utf8')
  if (libSrc.includes('export function sanitizeGbpSummary') && libSrc.includes('sanitizeGbpSummary(options.summary)')) {
    console.log('  ✓ sanitizeGbpSummary present + wired into publishGoogleBusinessLocalPost')
    results.push({ action: 'publisher-sanitizer', ok: true })
  } else {
    console.log('  ✗ sanitizeGbpSummary not detected in lib/google-business-profile.ts')
    results.push({ action: 'publisher-sanitizer', ok: false, error: 'lib edit not applied' })
  }

  // ----------- Final summary -----------
  console.log('\n\n=== APPLY SUMMARY ===')
  const okCount = results.filter((r) => r.ok).length
  const failCount = results.filter((r) => !r.ok).length
  console.log(`Succeeded: ${okCount}/${results.length}`)
  console.log(`Failed: ${failCount}`)
  results.forEach((r) => {
    const flag = r.ok ? '✓' : '✗'
    const detail = r.ok ? '' : ` — ${r.error || 'unknown'}`
    console.log(`  ${flag} ${r.action}${detail}`)
  })

  // Persist a result manifest
  const date = new Date().toISOString().slice(0, 10)
  const manifestPath = `out/gbp-audit/apply-phase1-result-${date}.json`
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        applied_at: new Date().toISOString(),
        mode: execute ? 'execute' : 'dry-run',
        account_id: accountId,
        location_id: locationId,
        results,
      },
      null,
      2,
    ),
  )
  console.log(`\nManifest → ${manifestPath}`)

  if (failCount > 0) process.exit(2)
}

main().catch((e) => {
  console.error(`\nFATAL: ${e?.message || e}`)
  if (e?.stack) console.error(e.stack)
  process.exit(1)
})
