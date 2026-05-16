#!/usr/bin/env node
/**
 * Matt-approved rollout for 4 properties × 7 platforms (2026-05-14).
 *
 * Step 1: Upload every asset (carousels, single images, broker cards, reels)
 *         to Supabase Storage bucket "asset-library" under
 *         social-drops/2026-05-14/<property>/<file>. Public URLs returned.
 * Step 2: For each property, post in order GBP -> X -> LI -> FB -> IG ->
 *         IG Reel -> FB Reel using the right transport per platform.
 * Step 3: Capture externalPostId + URL on success, error on failure.
 *         Write everything to out/proof/2026-05-14/publish-status.json.
 *
 * The publish route (/api/social/publish) does NOT support IG/FB carousels
 * or LinkedIn image posts. For those we call lib/meta-graph.ts and a custom
 * LinkedIn image flow directly. Reels go via /api/social/publish.
 *
 * Order across properties (most newsworthy first):
 *   schoolhouse -> beaumont -> saghali -> simpson
 *
 * Run: node scripts/publish-2026-05-14-rollout.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync, spawnSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// Env loader
// ---------------------------------------------------------------------------
const ENV = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z_0-9]+)=(.*)$/)
  if (m) ENV[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
for (const [k, v] of Object.entries(ENV)) {
  if (process.env[k] === undefined) process.env[k] = v
}

const SITE = ENV.NEXT_PUBLIC_SITE_URL || 'https://ryanrealty.vercel.app'
const CRON_SECRET = ENV.CRON_SECRET
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY
const META_PAGE_ACCESS_TOKEN = ENV.META_PAGE_ACCESS_TOKEN
const META_IG_BUSINESS_ACCOUNT_ID = ENV.META_IG_BUSINESS_ACCOUNT_ID
const META_FB_PAGE_ID = ENV.META_FB_PAGE_ID

if (!CRON_SECRET) throw new Error('CRON_SECRET not set')
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase env not set')
if (!META_PAGE_ACCESS_TOKEN) throw new Error('META_PAGE_ACCESS_TOKEN not set')
if (!META_IG_BUSINESS_ACCOUNT_ID) throw new Error('META_IG_BUSINESS_ACCOUNT_ID not set')
if (!META_FB_PAGE_ID) throw new Error('META_FB_PAGE_ID not set')

// ---------------------------------------------------------------------------
// Em-dash guard (mirrors lib/punctuation-guard.ts)
// ---------------------------------------------------------------------------
const BANNED_DASHES = /[–—―⸺⸻]/g
function assertNoDashes(text, src) {
  if (!text) return
  if (BANNED_DASHES.test(text)) {
    const idx = text.search(BANNED_DASHES)
    const ctx = text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 30))
    throw new Error(`DASH VIOLATION in ${src}: "${ctx}"`)
  }
}

// ---------------------------------------------------------------------------
// Supabase storage upload helpers
// ---------------------------------------------------------------------------
const STORAGE_API = `${SUPABASE_URL}/storage/v1`
const PUBLIC_API = `${SUPABASE_URL}/storage/v1/object/public`
const BUCKET = 'asset-library'
const DROP_PREFIX = 'social-drops/2026-05-14'

async function uploadToSupabase(localPath, storagePath, contentType) {
  const bytes = fs.readFileSync(localPath)
  const url = `${STORAGE_API}/object/${BUCKET}/${storagePath}`
  // Use upsert mode in case of re-run
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: bytes,
  })
  if (!r.ok) {
    const body = await r.text()
    throw new Error(`Upload ${storagePath} failed: HTTP ${r.status} ${body.slice(0, 200)}`)
  }
  return `${PUBLIC_API}/${BUCKET}/${storagePath}`
}

function contentTypeFor(p) {
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.mp4')) return 'video/mp4'
  if (p.endsWith('.webp')) return 'image/webp'
  throw new Error(`Unknown content type for ${p}`)
}

// ---------------------------------------------------------------------------
// Asset manifest — local paths for every file we need to publish
// ---------------------------------------------------------------------------
const ROOT = '/Users/matthewryan/RyanRealty'
const RENDERED = `${ROOT}/out/proof/2026-05-14/rendered`
const CAPTIONS_DIR = `${ROOT}/out/proof/2026-05-14/captions`

const ASSETS = {
  schoolhouse: {
    carousel: [
      `${RENDERED}/schoolhouse-v3/pattern-a/01-front-exterior.jpg`,
      `${RENDERED}/schoolhouse-v3/pattern-a/02-back-exterior.jpg`,
      `${RENDERED}/schoolhouse-v3/pattern-a/03-hallway-to-great-room.jpg`,
      `${RENDERED}/schoolhouse-v3/pattern-a/04-bedroom-view.jpg`,
      `${RENDERED}/schoolhouse-v3/pattern-a/05-kitchen-direct.jpg`,
      `${RENDERED}/schoolhouse-v3/pattern-a/06-primary-suite.jpg`,
    ],
    hero: `${RENDERED}/schoolhouse-v3/single-image/S2-just-sold.jpg`,
    reel: `${RENDERED}/reels/schoolhouse.mp4`,
  },
  beaumont: {
    carousel: [
      `${RENDERED}/beaumont-v3/pattern-d/panorama-1.jpg`,
      `${RENDERED}/beaumont-v3/pattern-d/panorama-2.jpg`,
      `${RENDERED}/beaumont-v3/pattern-d/panorama-3.jpg`,
    ],
    hero: `${RENDERED}/beaumont-v3/single-image/under-contract.jpg`,
    reel: `${RENDERED}/reels/beaumont.mp4`,
  },
  saghali: {
    carousel: [
      `${RENDERED}/saghali-v3/pattern-b/hero-overlay.jpg`,
      `${RENDERED}/saghali-v3/pattern-a/03-living-great-room.jpg`,
      `${RENDERED}/broker-cards/rebecca-buyer.jpg`,
    ],
    // Use slide 1 (hero-overlay) as the single-image hero for X/LI/GBP
    hero: `${RENDERED}/saghali-v3/pattern-b/hero-overlay.jpg`,
    reel: `${RENDERED}/reels/saghali.mp4`,
  },
  simpson: {
    carousel: [
      `${RENDERED}/simpson-v3/single-image/S2-just-sold.jpg`,
      `${RENDERED}/simpson-v3/pattern-a/02-great-room.jpg`,
      `${RENDERED}/broker-cards/rebecca-buyer-sold.jpg`,
    ],
    hero: `${RENDERED}/simpson-v3/single-image/S2-just-sold.jpg`,
    reel: `${RENDERED}/reels/simpson.mp4`,
  },
}

// Saghali captions live as "tillicum-*"
const CAPTION_KEY = {
  schoolhouse: 'schoolhouse',
  beaumont: 'beaumont',
  saghali: 'tillicum',
  simpson: 'simpson',
}

function loadCaption(property, platform) {
  const key = CAPTION_KEY[property]
  const fp = path.join(CAPTIONS_DIR, `${key}-${platform}.md`)
  const text = fs.readFileSync(fp, 'utf8').trim()
  assertNoDashes(text, `${key}-${platform}.md`)
  return text
}

// ---------------------------------------------------------------------------
// Upload everything, build a URL map per property
// ---------------------------------------------------------------------------
async function uploadProperty(property, asset) {
  const result = { carousel: [], hero: '', reel: '' }
  console.log(`\n--- Uploading ${property} ---`)
  for (let i = 0; i < asset.carousel.length; i++) {
    const local = asset.carousel[i]
    const ext = path.extname(local)
    const name = `carousel-${i + 1}${ext}`
    const url = await uploadToSupabase(local, `${DROP_PREFIX}/${property}/${name}`, contentTypeFor(local))
    result.carousel.push(url)
    console.log(`  ${name} -> ${url}`)
  }
  result.hero = await uploadToSupabase(
    asset.hero,
    `${DROP_PREFIX}/${property}/hero${path.extname(asset.hero)}`,
    contentTypeFor(asset.hero)
  )
  console.log(`  hero -> ${result.hero}`)
  result.reel = await uploadToSupabase(
    asset.reel,
    `${DROP_PREFIX}/${property}/reel.mp4`,
    'video/mp4'
  )
  console.log(`  reel -> ${result.reel}`)
  // Extract a cover frame at 3.0s from the reel for IG Reel cover_url
  const coverLocal = `/tmp/reel-cover-${property}.jpg`
  const ffmpegBin = (() => {
    try { return execSync('which ffmpeg', { encoding: 'utf8' }).trim() } catch { return null }
  })()
  if (ffmpegBin) {
    const ff = spawnSync(ffmpegBin, ['-y', '-ss', '3.0', '-i', asset.reel, '-frames:v', '1', '-q:v', '2', coverLocal], { stdio: ['ignore', 'pipe', 'pipe'] })
    if (ff.status === 0 && fs.existsSync(coverLocal)) {
      result.cover = await uploadToSupabase(coverLocal, `${DROP_PREFIX}/${property}/reel-cover.jpg`, 'image/jpeg')
      console.log(`  reel-cover -> ${result.cover}`)
    } else {
      console.log(`  reel-cover skipped (ffmpeg ${ff.status}): ${ff.stderr?.toString().slice(0, 120)}`)
    }
  } else {
    console.log('  reel-cover skipped (ffmpeg not found)')
  }
  return result
}

// ---------------------------------------------------------------------------
// LinkedIn image upload helper (the existing lib only supports video)
// ---------------------------------------------------------------------------
const LINKEDIN_REST_VERSION = '202602'

async function getLinkedInSub(token) {
  const r = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`LinkedIn userinfo HTTP ${r.status}`)
  const j = await r.json()
  return j.sub
}

async function getLinkedInToken() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/linkedin_auth?id=eq.default&select=access_token,refresh_token,expires_at`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  })
  const arr = await r.json()
  if (!Array.isArray(arr) || !arr[0]) throw new Error('No LinkedIn token row')
  return arr[0].access_token
}

async function postLinkedInImage(imageUrl, caption) {
  const accessToken = await getLinkedInToken()
  const sub = await getLinkedInSub(accessToken)
  const authorUrn = `urn:li:person:${sub}`

  // Step 1 — register the upload using the legacy /v2/assets endpoint with the image recipe
  const reg = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        owner: authorUrn,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  })
  if (!reg.ok) throw new Error(`LI register HTTP ${reg.status} ${(await reg.text()).slice(0, 200)}`)
  const regJson = await reg.json()
  const assetUrn = regJson.value?.asset
  const uploadUrl = regJson.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl
  if (!assetUrn || !uploadUrl) throw new Error('LI register missing fields')

  // Step 2 — fetch the image bytes and PUT to upload URL
  const imgResp = await fetch(imageUrl)
  if (!imgResp.ok) throw new Error(`Fetch image HTTP ${imgResp.status}`)
  const bytes = Buffer.from(await imgResp.arrayBuffer())
  const upResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: bytes,
  })
  if (!upResp.ok) throw new Error(`LI upload HTTP ${upResp.status}`)

  // Step 3 — create the post via /rest/posts
  const postResp = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_REST_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: caption,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: assetUrn } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })
  if (!postResp.ok) {
    const body = await postResp.text()
    throw new Error(`LI post HTTP ${postResp.status} ${body.slice(0, 200)}`)
  }
  const postUrn = postResp.headers.get('x-restli-id') || (await postResp.json()).id
  return postUrn
}

// ---------------------------------------------------------------------------
// X image upload (POST /1.1/media/upload.json simple INIT path)
// ---------------------------------------------------------------------------
async function getXTokenAndRefresh() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/x_auth?id=eq.default&select=access_token,refresh_token,expires_at`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  })
  const arr = await r.json()
  if (!Array.isArray(arr) || !arr[0]) throw new Error('No X token row')
  const row = arr[0]
  const expired = new Date(row.expires_at).getTime() <= Date.now() + 60_000
  if (!expired) return row.access_token
  // Refresh
  const creds = Buffer.from(`${ENV.X_CLIENT_ID}:${ENV.X_CLIENT_SECRET}`).toString('base64')
  const p = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token })
  const rr = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${creds}` },
    body: p.toString(),
  })
  if (!rr.ok) throw new Error(`X refresh HTTP ${rr.status} ${(await rr.text()).slice(0, 200)}`)
  const tok = await rr.json()
  // Update row
  await fetch(`${SUPABASE_URL}/rest/v1/x_auth?id=eq.default`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? row.refresh_token,
      expires_at: new Date(Date.now() + (tok.expires_in ?? 7200) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  })
  return tok.access_token
}

async function postXImage(imageUrl, caption) {
  const accessToken = await getXTokenAndRefresh()
  // Fetch image bytes
  const r = await fetch(imageUrl)
  if (!r.ok) throw new Error(`Fetch image for X HTTP ${r.status}`)
  const bytes = Buffer.from(await r.arrayBuffer())

  // Use multipart upload on v1.1/media/upload.json — simple form, no INIT/APPEND for images
  const fd = new FormData()
  fd.append('media', new Blob([bytes], { type: 'image/jpeg' }))
  const up = await fetch('https://upload.twitter.com/1.1/media/upload.json?media_category=tweet_image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: fd,
  })
  if (!up.ok) {
    const body = await up.text()
    throw new Error(`X media upload HTTP ${up.status} ${body.slice(0, 200)}`)
  }
  const j = await up.json()
  const mediaId = j.media_id_string
  if (!mediaId) throw new Error('X media upload missing media_id_string')

  // Post tweet
  const tweetText = caption.length > 280 ? caption.slice(0, 277) + '...' : caption
  const tw = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: tweetText, media: { media_ids: [mediaId] } }),
  })
  if (!tw.ok) {
    const body = await tw.text()
    throw new Error(`X tweet HTTP ${tw.status} ${body.slice(0, 200)}`)
  }
  const tj = await tw.json()
  if (!tj.data?.id) throw new Error('X tweet missing id')
  return tj.data.id
}

// ---------------------------------------------------------------------------
// Meta direct calls (carousels + image posts)
// ---------------------------------------------------------------------------
const META_GRAPH = 'https://graph.facebook.com/v25.0'

async function metaPost(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Meta ${url.split('/').slice(-2).join('/')} HTTP ${r.status} ${JSON.stringify(j).slice(0, 250)}`)
  return j
}

async function publishIGImage(imageUrl, caption) {
  const igUser = META_IG_BUSINESS_ACCOUNT_ID
  const c = await metaPost(`${META_GRAPH}/${igUser}/media`, {
    image_url: imageUrl,
    caption,
    access_token: META_PAGE_ACCESS_TOKEN,
  })
  if (!c.id) throw new Error('IG image container missing id')
  const p = await metaPost(`${META_GRAPH}/${igUser}/media_publish`, { creation_id: c.id, access_token: META_PAGE_ACCESS_TOKEN })
  return p.id
}

async function publishIGCarousel(imageUrls, caption) {
  const igUser = META_IG_BUSINESS_ACCOUNT_ID
  const children = []
  for (const url of imageUrls) {
    const c = await metaPost(`${META_GRAPH}/${igUser}/media`, {
      image_url: url,
      is_carousel_item: true,
      access_token: META_PAGE_ACCESS_TOKEN,
    })
    if (!c.id) throw new Error('IG carousel child missing id')
    children.push(c.id)
  }
  const carousel = await metaPost(`${META_GRAPH}/${igUser}/media`, {
    media_type: 'CAROUSEL',
    children,
    caption,
    access_token: META_PAGE_ACCESS_TOKEN,
  })
  if (!carousel.id) throw new Error('IG carousel container missing id')
  const pub = await metaPost(`${META_GRAPH}/${igUser}/media_publish`, { creation_id: carousel.id, access_token: META_PAGE_ACCESS_TOKEN })
  return pub.id
}

async function publishFBPhoto(imageUrl, caption) {
  const pageId = META_FB_PAGE_ID
  const r = await metaPost(`${META_GRAPH}/${pageId}/photos`, {
    url: imageUrl,
    caption,
    access_token: META_PAGE_ACCESS_TOKEN,
  })
  return r.post_id || r.id
}

// FB album = multiple photo posts grouped via published=false then album publish
async function publishFBCarousel(imageUrls, caption) {
  const pageId = META_FB_PAGE_ID
  // 1) Upload each photo unpublished, capture media_fbid
  const attached = []
  for (const url of imageUrls) {
    const r = await metaPost(`${META_GRAPH}/${pageId}/photos`, {
      url,
      published: false,
      access_token: META_PAGE_ACCESS_TOKEN,
    })
    if (!r.id) throw new Error('FB unpublished photo missing id')
    attached.push({ media_fbid: r.id })
  }
  // 2) Create a feed post that references all attached_media
  const post = await metaPost(`${META_GRAPH}/${pageId}/feed`, {
    message: caption,
    attached_media: JSON.stringify(attached),
    access_token: META_PAGE_ACCESS_TOKEN,
  })
  return post.id
}

// ---------------------------------------------------------------------------
// Publish-route caller (for reels and GBP/IG-Reel/FB-Reel combos)
// ---------------------------------------------------------------------------
async function callPublishRoute(payload) {
  const r = await fetch(`${SITE}/api/social/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
    body: JSON.stringify(payload),
  })
  const j = await r.json().catch(() => ({}))
  return { httpStatus: r.status, ...j }
}

// ---------------------------------------------------------------------------
// Main rollout
// ---------------------------------------------------------------------------
const STATUS_PATH = `${ROOT}/out/proof/2026-05-14/publish-status.json`
const status = {
  startedAt: new Date().toISOString(),
  properties: {},
  cost: { xTweets: 0, costUsd: 0 },
  skipped: ['threads', 'pinterest', 'nextdoor', 'tiktok', 'youtube_shorts'],
}

function writeStatus() {
  status.finishedAt = new Date().toISOString()
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2))
}

async function tryPlatform(label, fn) {
  // One retry with 1s, 4s backoff
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const id = await fn()
      console.log(`    OK ${label}: ${id}`)
      return { success: true, externalPostId: String(id) }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt === 2) {
        console.log(`    FAIL ${label}: ${msg}`)
        return { success: false, error: msg }
      }
      console.log(`    retry ${label} (attempt 2/2): ${msg.slice(0, 120)}`)
      await new Promise((r) => setTimeout(r, attempt === 1 ? 1000 : 4000))
    }
  }
}

async function publishOne(property, urls) {
  console.log(`\n========== ${property.toUpperCase()} ==========`)
  const captions = {
    gbp: loadCaption(property, 'gbp'),
    x: loadCaption(property, 'x'),
    linkedin: loadCaption(property, 'linkedin'),
    fb: loadCaption(property, 'fb'),
    ig: loadCaption(property, 'ig'),
  }

  const platformResults = {}

  // 1) GBP — STANDARD post, hero image
  platformResults.gbp = await tryPlatform('GBP', async () => {
    const r = await callPublishRoute({
      approved: true,
      contentType: 'listing_post',
      platforms: ['google_business_profile'],
      mediaType: 'image',
      mediaUrl: urls.hero,
      captionDefault: captions.gbp,
      gate: {
        scorecardPath: `out/proof/2026-05-14/rendered/${property}-v3/scorecard.json`,
        citationsPath: `out/proof/2026-05-14/rendered/${property}-v3/citations.json`,
        qaReportPath: `out/proof/2026-05-14/rendered/${property}-v3/qa_report.md`,
        postflightPath: `out/proof/2026-05-14/rendered/${property}-v3/postflight.json`,
        manifestoPath: 'video_production_skills/ANTI_SLOP_MANIFESTO.md',
        humanApprovedAt: new Date().toISOString(),
        formatSkillName: 'listing_post',
        formatSkillVersion: '2026-05-14',
      },
      metadata: { google_business_profile: { summary: captions.gbp, callToActionUrl: 'https://ryan-realty.com' } },
    })
    const res = r?.results?.google_business_profile
    if (!res?.success) throw new Error(res?.error || `route HTTP ${r.httpStatus}`)
    return res.externalPostId
  })

  // 2) X — image + caption
  platformResults.x = await tryPlatform('X', async () => {
    const id = await postXImage(urls.hero, captions.x)
    status.cost.xTweets++
    return id
  })

  // 3) LinkedIn — image + caption (personal profile)
  platformResults.linkedin = await tryPlatform('LinkedIn', async () => postLinkedInImage(urls.hero, captions.linkedin))

  // 4) FB feed — carousel or single photo
  platformResults.fb = await tryPlatform('FB', async () => {
    if (urls.carousel.length >= 2) return publishFBCarousel(urls.carousel, captions.fb)
    return publishFBPhoto(urls.hero, captions.fb)
  })

  // 5) IG feed — carousel or single image
  platformResults.ig = await tryPlatform('IG', async () => {
    if (urls.carousel.length >= 2) return publishIGCarousel(urls.carousel, captions.ig)
    return publishIGImage(urls.hero, captions.ig)
  })

  // 6) IG Reel + 7) FB Reel — via publish route (parallel)
  platformResults.igReel = await tryPlatform('IG Reel', async () => {
    const r = await callPublishRoute({
      approved: true,
      contentType: 'listing_reel',
      platforms: ['instagram'],
      mediaType: 'reel',
      mediaUrl: urls.reel,
      coverUrl: urls.cover,
      captionDefault: captions.ig,
      gate: {
        scorecardPath: `out/proof/2026-05-14/rendered/reels/scorecard.json`,
        citationsPath: `out/proof/2026-05-14/rendered/reels/citations.json`,
        qaReportPath: `out/proof/2026-05-14/rendered/reels/qa_report.md`,
        postflightPath: `out/proof/2026-05-14/rendered/reels/postflight.json`,
        manifestoPath: 'video_production_skills/ANTI_SLOP_MANIFESTO.md',
        humanApprovedAt: new Date().toISOString(),
        formatSkillName: 'listing_reel',
        formatSkillVersion: '2026-05-14',
      },
    })
    const res = r?.results?.instagram
    if (!res?.success) throw new Error(res?.error || `route HTTP ${r.httpStatus}`)
    return res.externalPostId
  })
  platformResults.fbReel = await tryPlatform('FB Reel', async () => {
    const r = await callPublishRoute({
      approved: true,
      contentType: 'listing_reel',
      platforms: ['facebook'],
      mediaType: 'reel',
      mediaUrl: urls.reel,
      captionDefault: captions.fb,
      gate: {
        scorecardPath: `out/proof/2026-05-14/rendered/reels/scorecard.json`,
        citationsPath: `out/proof/2026-05-14/rendered/reels/citations.json`,
        qaReportPath: `out/proof/2026-05-14/rendered/reels/qa_report.md`,
        postflightPath: `out/proof/2026-05-14/rendered/reels/postflight.json`,
        manifestoPath: 'video_production_skills/ANTI_SLOP_MANIFESTO.md',
        humanApprovedAt: new Date().toISOString(),
        formatSkillName: 'listing_reel',
        formatSkillVersion: '2026-05-14',
      },
    })
    const res = r?.results?.facebook
    if (!res?.success) throw new Error(res?.error || `route HTTP ${r.httpStatus}`)
    return res.externalPostId
  })

  status.properties[property] = platformResults
  writeStatus()
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Pre-flight: audit all captions for dash violations ===')
  const platforms = ['gbp', 'x', 'linkedin', 'fb', 'ig']
  for (const p of ['schoolhouse', 'beaumont', 'saghali', 'simpson']) {
    for (const plat of platforms) {
      loadCaption(p, plat)
    }
  }
  console.log('captions audit: PASS (no dashes)')

  console.log('\n=== Phase 1: Upload all assets to Supabase storage ===')
  const allUrls = {}
  for (const property of ['schoolhouse', 'beaumont', 'saghali', 'simpson']) {
    allUrls[property] = await uploadProperty(property, ASSETS[property])
  }
  status.assetUrls = allUrls
  writeStatus()
  console.log('\nAll assets uploaded.')

  console.log('\n=== Phase 2: Publish in order (Schoolhouse -> Beaumont -> Saghali -> Simpson) ===')
  for (const property of ['schoolhouse', 'beaumont', 'saghali', 'simpson']) {
    await publishOne(property, allUrls[property])
  }

  status.cost.costUsd = status.cost.xTweets * 0.015
  writeStatus()

  console.log('\n=== Final status (saved to publish-status.json) ===')
  for (const [property, results] of Object.entries(status.properties)) {
    console.log(`\n${property}:`)
    for (const [plat, res] of Object.entries(results)) {
      console.log(`  ${plat}: ${res.success ? `OK ${res.externalPostId}` : `FAIL ${res.error?.slice(0, 100)}`}`)
    }
  }
  console.log(`\nX tweets posted: ${status.cost.xTweets} ($${status.cost.costUsd.toFixed(3)})`)
  console.log(`Status JSON: ${STATUS_PATH}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  status.fatal = e.message || String(e)
  writeStatus()
  process.exit(1)
})
