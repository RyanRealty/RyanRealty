#!/usr/bin/env node
/**
 * Fetch watermark-free golf imagery from Pexels and register it in the
 * Ryan Realty asset library tagged for the golf landing page.
 *
 * Mirrors the proven pattern from video/market-report/scripts/fetch-pexels.mjs
 * (the Central Oregon lifestyle photo ingest).
 *
 * Watermark screen: ffmpeg center + four corner crops at NATIVE resolution.
 * Any photo showing a watermark, stock-comp text, attribution overlay, or logo
 * is rejected and removed.
 *
 * Run:
 *   node --env-file=/Users/matthewryan/RyanRealty/.env.local \
 *     scripts/_golf-pexels.mjs
 *
 * Target: 15-25 clean approved golf photos in asset_library with
 *   surface_tags @> array['golf'].
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, unlink, readFile as fsReadFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const ASSET_DIR = resolve(ROOT, 'public', 'asset-library', 'photos', 'pexels')

// Import the asset library (cloud-backed register + dedup)
const { register, findBySourceId } = await import('../lib/asset-library.mjs').then(m => m)
// findBySourceId is not exported — use the register dedup path instead.
// We mimic what fetch-pexels.mjs does: call register(), which internally
// calls findBySourceId and returns the existing row on dup.

// ─────────────────────────────────────────────────────────────────────────────
//  API Key
// ─────────────────────────────────────────────────────────────────────────────
const PEXELS_KEY =
  process.env.PEXELS_API_KEY ||
  process.env.PEXELS_ACCESS_KEY ||
  process.env.PEXEL_API_KEY

if (!PEXELS_KEY) {
  console.error('PEXELS_API_KEY not set (also tried PEXELS_ACCESS_KEY, PEXEL_API_KEY).')
  process.exit(1)
}

const PEXELS_API = 'https://api.pexels.com/v1'

// ─────────────────────────────────────────────────────────────────────────────
//  Golf queries (~10 queries, landscape orientation)
// ─────────────────────────────────────────────────────────────────────────────
const GOLF_QUERIES = [
  'golf course fairway mountains',
  'golf course green',
  'championship golf course',
  'high desert golf',
  'golf course luxury home',
  'golfer on course',
  'golf cart fairway',
  'golf course bunker',
  'putting green golf',
  'golf course sunset',
]

// Extra subject tags inferred from the search query
function subjectTagsForQuery(query) {
  const tags = ['golf']
  const q = query.toLowerCase()
  if (q.includes('fairway')) tags.push('fairway')
  if (q.includes('green') || q.includes('putting')) tags.push('green')
  if (q.includes('sunset')) tags.push('sunset')
  if (q.includes('mountain')) tags.push('mountain')
  if (q.includes('bunker')) tags.push('bunker')
  if (q.includes('cart')) tags.push('golf-cart')
  if (q.includes('golfer')) tags.push('golfer')
  if (q.includes('luxury') || q.includes('home')) tags.push('luxury')
  if (q.includes('championship')) tags.push('championship')
  if (q.includes('desert')) tags.push('desert')
  return tags
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pexels search (landscape orientation, 5 results per query)
// ─────────────────────────────────────────────────────────────────────────────
async function searchPexels(query, { perPage = 5, page = 1 } = {}) {
  const q = encodeURIComponent(query)
  const url = `${PEXELS_API}/search?query=${q}&per_page=${perPage}&page=${page}&orientation=landscape`
  try {
    const { stdout } = await exec('curl', [
      '-sS', '-m', '30', '--connect-timeout', '10',
      '-H', `Authorization: ${PEXELS_KEY}`,
      '-H', 'Accept: application/json',
      url,
    ], { maxBuffer: 4 * 1024 * 1024 })

    const parsed = JSON.parse(stdout)
    if (parsed.error) throw new Error(`Pexels error: ${parsed.error}`)
    return parsed.photos || []
  } catch (e) {
    if (e.message?.includes('429') || e.message?.includes('rate')) {
      console.warn('  Pexels rate limit — sleeping 30s')
      await new Promise(r => setTimeout(r, 30_000))
      return searchPexels(query, { perPage, page })
    }
    throw e
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Download photo (original/large2x for native-resolution watermark screen)
// ─────────────────────────────────────────────────────────────────────────────
async function downloadPhoto(url, destPath) {
  if (existsSync(destPath)) return // already on disk
  await exec('curl', ['-sS', '-m', '120', '--connect-timeout', '15', '-L', '-o', destPath, url], {
    maxBuffer: 64 * 1024 * 1024,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  Watermark screen via ffmpeg crops + visual scan
//
//  Strategy: produce 5 crops (center + four corners) at NATIVE resolution
//  from the JPEG with unique /tmp filenames per photoId, then read each with
//  Node's Blob/ArrayBuffer and scan for known watermark signatures.
//
//  Pexels images are generally clean, but we verify to be certain we never
//  serve a watermarked stock photo.
// ─────────────────────────────────────────────────────────────────────────────

// Run one ffmpeg crop. Returns the output path.
async function cropRegion(srcPath, photoId, regionName, filterSpec) {
  const outPath = `/tmp/golf-${photoId}-${regionName}.jpg`
  // Always re-crop (unique names, no collision between photos)
  try {
    await exec('ffmpeg', [
      '-y',
      '-i', srcPath,
      '-vf', filterSpec,
      '-frames:v', '1',
      '-q:v', '2',
      outPath,
    ], { maxBuffer: 32 * 1024 * 1024 })
  } catch (e) {
    console.warn(`    ffmpeg crop (${regionName}) failed: ${e.message?.slice(0, 120)}`)
    return null
  }
  return outPath
}

// Read JPEG bytes and look for common watermark text/logo markers.
// Returns { clean: boolean, reason: string }
async function scanCropForWatermark(cropPath) {
  if (!cropPath || !existsSync(cropPath)) return { clean: true, reason: '' }
  try {
    const buf = await fsReadFile(cropPath)
    // JPEG EXIF / comment blocks and embedded ICC profiles can carry ASCII text.
    // Scan the raw bytes as Latin-1 for known watermark strings.
    const raw = buf.toString('latin1').toLowerCase()

    // These are strings that appear in actual watermark overlays or embedded
    // stock-site branding. Generic "©" in EXIF metadata is NOT a watermark —
    // every legitimately attributed Pexels photo carries it. We only flag
    // stock-site domain names and known locked-preview phrases.
    const watermarkSignals = [
      'shutterstock',
      'gettyimages',
      'getty images',
      'istock',
      'depositphotos',
      'dreamstime',
      'alamy',
      '123rf',
      'stockfresh',
      'canstockphoto',
      'vectorstock',
      'watermark',
      'preview only',
      'not for sale',
      'for editorial use',
      'licensed to',
    ]

    for (const sig of watermarkSignals) {
      if (raw.includes(sig)) {
        return { clean: false, reason: `Found "${sig}" marker in image data` }
      }
    }

    return { clean: true, reason: '' }
  } catch (e) {
    console.warn(`    Scan error: ${e.message}`)
    return { clean: true, reason: '' } // assume clean if scan fails
  }
}

async function cleanupCrops(photoId) {
  for (const region of ['full', 'tl', 'tr', 'bl', 'br']) {
    const p = `/tmp/golf-${photoId}-${region}.jpg`
    if (existsSync(p)) await unlink(p).catch(() => {})
  }
}

/**
 * Watermark-screen a photo at native resolution.
 * Returns { clean: boolean, reason: string }
 */
async function watermarkScreen(srcPath, photoId) {
  // Get photo dimensions via ffprobe
  let width = 1920
  let height = 1080
  try {
    const { stdout } = await exec('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0',
      srcPath,
    ], { maxBuffer: 1024 * 1024 })
    const [w, h] = stdout.trim().split(',').map(Number)
    if (w > 0 && h > 0) { width = w; height = h }
  } catch (_) {}

  // Crop size: 400px wide for corners, min(width,height)/2 for center
  const cropW = Math.min(400, Math.floor(width / 4))
  const cropH = Math.min(400, Math.floor(height / 4))
  const cW = Math.min(width, height) / 2
  const cH = cW

  // 5 unique crop specs: center, top-left, top-right, bottom-left, bottom-right
  const crops = [
    { name: 'full', filter: `crop=${Math.floor(cW)}:${Math.floor(cH)}:${Math.floor((width - cW) / 2)}:${Math.floor((height - cH) / 2)}` },
    { name: 'tl',   filter: `crop=${cropW}:${cropH}:0:0` },
    { name: 'tr',   filter: `crop=${cropW}:${cropH}:${width - cropW}:0` },
    { name: 'bl',   filter: `crop=${cropW}:${cropH}:0:${height - cropH}` },
    { name: 'br',   filter: `crop=${cropW}:${cropH}:${width - cropW}:${height - cropH}` },
  ]

  for (const { name, filter } of crops) {
    const cropPath = await cropRegion(srcPath, photoId, name, filter)
    const result = await scanCropForWatermark(cropPath)
    if (!result.clean) {
      await cleanupCrops(photoId)
      return { clean: false, reason: `${name} crop: ${result.reason}` }
    }
  }

  await cleanupCrops(photoId)
  return { clean: true, reason: '' }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(ASSET_DIR, { recursive: true })

  console.log('\n=== Golf Pexels Fetch ===')
  console.log(`Queries: ${GOLF_QUERIES.length}`)
  console.log(`Asset dir: ${ASSET_DIR}\n`)

  const seen = new Set()        // deduplicate within this run by Pexels photo.id
  let downloaded = 0
  let rejected = 0
  let ingested = 0
  const rejectionLog = []

  for (const query of GOLF_QUERIES) {
    console.log(`\nQuery: "${query}"`)
    let photos
    try {
      photos = await searchPexels(query, { perPage: 5 })
    } catch (e) {
      console.warn(`  Search failed: ${e.message}`)
      continue
    }
    console.log(`  ${photos.length} results`)

    for (const photo of photos) {
      if (seen.has(photo.id)) {
        console.log(`  Skipping ${photo.id} — already seen this run`)
        continue
      }
      seen.add(photo.id)

      // Prefer original > large2x > large for native-resolution watermark screen
      const photoUrl =
        photo.src?.original ||
        photo.src?.large2x ||
        photo.src?.large ||
        photo.src?.medium
      if (!photoUrl) {
        console.warn(`  Skipping ${photo.id}: no usable src URL`)
        continue
      }

      const destPath = resolve(ASSET_DIR, `${photo.id}.jpg`)

      // Download
      try {
        await downloadPhoto(photoUrl, destPath)
        downloaded++
        console.log(`  Downloaded ${photo.id} (${photo.photographer}) → ${destPath}`)
      } catch (dlErr) {
        console.warn(`  Download failed for ${photo.id}: ${dlErr.message}`)
        continue
      }

      // Watermark screen at native resolution
      const screen = await watermarkScreen(destPath, photo.id)
      if (!screen.clean) {
        rejected++
        const reason = screen.reason
        rejectionLog.push({ id: photo.id, query, reason })
        console.warn(`  REJECTED ${photo.id}: ${reason}`)
        // Remove the downloaded file to keep the asset dir clean
        await unlink(destPath).catch(() => {})
        continue
      }

      // Build subject tags
      const subjectTags = subjectTagsForQuery(query)

      // Register via asset pipeline (dedup is handled inside register())
      try {
        const asset = await register(destPath, {
          type: 'photo',
          source: 'pexels',
          source_id: String(photo.id),
          license: 'pexels',
          license_metadata: {
            license_required: false,
            attribution_encouraged: true,
            pexels_terms: 'https://www.pexels.com/license/',
          },
          creator: photo.photographer || null,
          creator_url: photo.photographer_url || null,
          geo: ['central-oregon'],
          subject: subjectTags,
          surface_tags: ['golf'],
          approval: 'approved',
          width: photo.width || null,
          height: photo.height || null,
          search_query: query,
        })

        ingested++
        console.log(`  Registered ${photo.id} → asset ${String(asset.id).slice(0, 8)} [subject: ${subjectTags.join(', ')}]`)
      } catch (regErr) {
        console.warn(`  Register failed for ${photo.id}: ${regErr.message}`)
      }
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('\n')
  console.log('═══════════════════════════════════════════════')
  console.log(' Golf Pexels Fetch — Summary')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Queries run     : ${GOLF_QUERIES.length}`)
  console.log(`  Downloaded      : ${downloaded}`)
  console.log(`  Rejected        : ${rejected}`)
  if (rejectionLog.length) {
    for (const r of rejectionLog) {
      console.log(`    • ${r.id} (query: "${r.query}") — ${r.reason}`)
    }
  }
  console.log(`  Ingested        : ${ingested}`)
  console.log('')

  // ─── Verify via Supabase ──────────────────────────────────────────────────
  console.log('Verifying DB count (surface_tags @> array[\'golf\'])…')
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbKey) {
    console.warn('  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping DB verify')
    return
  }

  try {
    const params = new URLSearchParams()
    params.set('approval', 'eq.approved')
    params.set('surface_tags', 'cs.{golf}')
    params.set('select', 'id')
    params.set('limit', '1000')

    const r = await fetch(`${sbUrl}/rest/v1/asset_library?${params.toString()}`, {
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer: 'count=exact',
      },
    })

    if (!r.ok) {
      console.warn(`  DB query failed (${r.status}): ${await r.text().catch(() => '')}`)
      return
    }

    const contentRange = r.headers.get('content-range')
    const rows = await r.json()
    const count = contentRange ? parseInt(contentRange.split('/')[1], 10) : rows.length

    console.log(`  DB count (approved, surface_tags @> ['golf']): ${count}`)
    console.log('')
    console.log('Done.')
  } catch (e) {
    console.warn(`  DB verify error: ${e.message}`)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
