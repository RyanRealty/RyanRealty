#!/usr/bin/env node
/**
 * Re-run failures from the first rollout pass:
 *   - X: v1.1 403 → use v2/media/upload + v2/tweets
 *   - LinkedIn: digitalmediaAsset URN rejected → use /rest/images?action=initializeUpload (modern image flow)
 *   - IG carousel: HTTP 500 / "Media not ready" → poll children + carousel container before publish
 *
 * Reads existing publish-status.json, runs only the failed platform per property,
 * merges results back.
 */

import fs from 'node:fs'
import path from 'node:path'

const ENV = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z_0-9]+)=(.*)$/)
  if (m) ENV[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY
const META_PAGE_ACCESS_TOKEN = ENV.META_PAGE_ACCESS_TOKEN
const META_IG_BUSINESS_ACCOUNT_ID = ENV.META_IG_BUSINESS_ACCOUNT_ID
const META_FB_PAGE_ID = ENV.META_FB_PAGE_ID
const META_GRAPH = 'https://graph.facebook.com/v25.0'

const ROOT = '/Users/matthewryan/RyanRealty'
const STATUS_PATH = `${ROOT}/out/proof/2026-05-14/publish-status.json`
const CAPTIONS_DIR = `${ROOT}/out/proof/2026-05-14/captions`

const CAPTION_KEY = { schoolhouse: 'schoolhouse', beaumont: 'beaumont', saghali: 'tillicum', simpson: 'simpson' }

const BANNED_DASHES = /[–—―⸺⸻]/g
function loadCaption(property, platform) {
  const key = CAPTION_KEY[property]
  const fp = path.join(CAPTIONS_DIR, `${key}-${platform}.md`)
  const text = fs.readFileSync(fp, 'utf8').trim()
  if (BANNED_DASHES.test(text)) throw new Error(`DASH VIOLATION in ${fp}`)
  return text
}

const status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'))
const urls = status.assetUrls

// ---------------------------------------------------------------------------
// LinkedIn image — modern /rest/images flow
// ---------------------------------------------------------------------------
async function getLinkedInToken() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/linkedin_auth?id=eq.default&select=access_token`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  })
  return (await r.json())[0].access_token
}

async function postLinkedInImage(imageUrl, caption) {
  const token = await getLinkedInToken()
  const ui = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
  const sub = ui.sub
  if (!sub) throw new Error('LI userinfo missing sub')
  const authorUrn = `urn:li:person:${sub}`

  // Initialize upload
  const init = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202602',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  })
  if (!init.ok) throw new Error(`LI init HTTP ${init.status} ${(await init.text()).slice(0, 200)}`)
  const initJson = await init.json()
  const uploadUrl = initJson.value?.uploadUrl
  const imageUrn = initJson.value?.image
  if (!uploadUrl || !imageUrn) throw new Error('LI init missing uploadUrl/image')

  // Fetch image bytes + PUT
  const imgResp = await fetch(imageUrl)
  if (!imgResp.ok) throw new Error(`Fetch image HTTP ${imgResp.status}`)
  const bytes = Buffer.from(await imgResp.arrayBuffer())
  const upR = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: bytes })
  if (!upR.ok) throw new Error(`LI upload HTTP ${upR.status}`)

  // Create post
  const post = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202602',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: caption,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: imageUrn } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })
  if (!post.ok) {
    const body = await post.text()
    throw new Error(`LI post HTTP ${post.status} ${body.slice(0, 250)}`)
  }
  return post.headers.get('x-restli-id') || (await post.json()).id
}

// ---------------------------------------------------------------------------
// X image — v2/media/upload + v2/tweets
// ---------------------------------------------------------------------------
async function getXToken() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/x_auth?id=eq.default&select=access_token,refresh_token,expires_at`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  })
  const row = (await r.json())[0]
  if (new Date(row.expires_at).getTime() > Date.now() + 60_000) return row.access_token
  const creds = Buffer.from(`${ENV.X_CLIENT_ID}:${ENV.X_CLIENT_SECRET}`).toString('base64')
  const rr = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${creds}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }).toString(),
  })
  if (!rr.ok) throw new Error(`X refresh HTTP ${rr.status}`)
  const tok = await rr.json()
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
  const token = await getXToken()
  const r = await fetch(imageUrl)
  if (!r.ok) throw new Error(`Fetch image for X HTTP ${r.status}`)
  const bytes = Buffer.from(await r.arrayBuffer())

  // v2/media/upload
  const fd = new FormData()
  fd.append('media', new Blob([bytes], { type: 'image/jpeg' }), 'hero.jpg')
  fd.append('media_category', 'tweet_image')
  const up = await fetch('https://api.twitter.com/2/media/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  if (!up.ok) throw new Error(`X v2/media/upload HTTP ${up.status} ${(await up.text()).slice(0, 200)}`)
  const upJson = await up.json()
  const mediaId = upJson.data?.id || upJson.data?.media_key
  if (!mediaId) throw new Error('X v2/media/upload missing id')

  // v2/tweets
  const tweetText = caption.length > 280 ? caption.slice(0, 277) + '...' : caption
  const tw = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: tweetText, media: { media_ids: [mediaId] } }),
  })
  if (!tw.ok) throw new Error(`X v2/tweets HTTP ${tw.status} ${(await tw.text()).slice(0, 200)}`)
  const tj = await tw.json()
  if (!tj.data?.id) throw new Error('X tweet missing id')
  return tj.data.id
}

// ---------------------------------------------------------------------------
// IG carousel — poll status before publish
// ---------------------------------------------------------------------------
async function metaPost(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Meta ${url.split('/').slice(-2).join('/')} HTTP ${r.status} ${JSON.stringify(j).slice(0, 250)}`)
  return j
}

async function getContainerStatus(containerId) {
  const url = `${META_GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(META_PAGE_ACCESS_TOKEN)}`
  const r = await fetch(url)
  const j = await r.json()
  return j.status_code
}

async function waitForContainer(containerId, maxWaitMs = 60000) {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    const status = await getContainerStatus(containerId)
    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Container ${containerId} status ${status}`)
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`Container ${containerId} timed out`)
}

async function publishIGCarousel(imageUrls, caption) {
  const igUser = META_IG_BUSINESS_ACCOUNT_ID
  // Create children sequentially with short delay
  const childIds = []
  for (const url of imageUrls) {
    const c = await metaPost(`${META_GRAPH}/${igUser}/media`, {
      image_url: url,
      is_carousel_item: true,
      access_token: META_PAGE_ACCESS_TOKEN,
    })
    if (!c.id) throw new Error('IG child missing id')
    childIds.push(c.id)
  }
  // Wait briefly for child containers to settle
  for (const cid of childIds) {
    try { await waitForContainer(cid, 30000) } catch { /* image children rarely need polling but tolerate it */ }
  }

  const carousel = await metaPost(`${META_GRAPH}/${igUser}/media`, {
    media_type: 'CAROUSEL',
    children: childIds,
    caption,
    access_token: META_PAGE_ACCESS_TOKEN,
  })
  if (!carousel.id) throw new Error('IG carousel container missing id')

  // Poll carousel container until FINISHED
  await waitForContainer(carousel.id, 90000)

  const pub = await metaPost(`${META_GRAPH}/${igUser}/media_publish`, {
    creation_id: carousel.id,
    access_token: META_PAGE_ACCESS_TOKEN,
  })
  if (!pub.id) throw new Error('IG carousel publish missing id')
  return pub.id
}

// ---------------------------------------------------------------------------
// Re-run failures
// ---------------------------------------------------------------------------
async function tryOnce(label, fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const id = await fn()
      console.log(`  OK ${label}: ${id}`)
      return { success: true, externalPostId: String(id) }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt === 2) {
        console.log(`  FAIL ${label}: ${msg.slice(0, 250)}`)
        return { success: false, error: msg }
      }
      console.log(`  retry ${label}: ${msg.slice(0, 120)}`)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
}

async function main() {
  for (const property of ['schoolhouse', 'beaumont', 'saghali', 'simpson']) {
    const p = status.properties[property]
    const u = urls[property]
    console.log(`\n=== ${property.toUpperCase()} ===`)

    if (!p.x.success) {
      console.log('Retrying X...')
      p.x = await tryOnce('X', () => postXImage(u.hero, loadCaption(property, 'x')))
      if (p.x.success) {
        status.cost.xTweets++
      }
    } else {
      console.log('  X already OK, skipping')
    }

    if (!p.linkedin.success) {
      console.log('Retrying LinkedIn...')
      p.linkedin = await tryOnce('LinkedIn', () => postLinkedInImage(u.hero, loadCaption(property, 'linkedin')))
    } else {
      console.log('  LinkedIn already OK, skipping')
    }

    if (!p.ig.success) {
      console.log('Retrying IG carousel...')
      const igUrls = u.carousel
      p.ig = await tryOnce('IG carousel', () => publishIGCarousel(igUrls, loadCaption(property, 'ig')))
    } else {
      console.log('  IG already OK, skipping')
    }

    if (p.igReel && !p.igReel.success) {
      console.log('Retrying IG Reel via direct API...')
      p.igReel = await tryOnce('IG Reel', async () => {
        // Direct call
        const c = await metaPost(`${META_GRAPH}/${META_IG_BUSINESS_ACCOUNT_ID}/media`, {
          media_type: 'REELS',
          video_url: u.reel,
          caption: loadCaption(property, 'ig'),
          share_to_feed: true,
          cover_url: u.cover,
          access_token: META_PAGE_ACCESS_TOKEN,
        })
        if (!c.id) throw new Error('IG Reel container missing id')
        await waitForContainer(c.id, 120000)
        const pub = await metaPost(`${META_GRAPH}/${META_IG_BUSINESS_ACCOUNT_ID}/media_publish`, {
          creation_id: c.id,
          access_token: META_PAGE_ACCESS_TOKEN,
        })
        if (!pub.id) throw new Error('IG Reel publish missing id')
        return pub.id
      })
    }
  }

  status.cost.costUsd = status.cost.xTweets * 0.015
  status.fixesAt = new Date().toISOString()
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2))

  console.log('\n=== Updated status ===')
  for (const [prop, results] of Object.entries(status.properties)) {
    console.log(`\n${prop}:`)
    for (const [plat, res] of Object.entries(results)) {
      console.log(`  ${plat}: ${res.success ? `OK ${res.externalPostId}` : `FAIL ${res.error?.slice(0, 100)}`}`)
    }
  }
}

main().catch((e) => {
  console.error('FATAL:', e)
  fs.writeFileSync(STATUS_PATH, JSON.stringify({ ...status, fatal: e.message }, null, 2))
  process.exit(1)
})
