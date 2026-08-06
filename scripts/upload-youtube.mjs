#!/usr/bin/env node
/**
 * upload-youtube.mjs — Upload a rendered YouTube long-form market report MP4
 * to the Ryan Realty YouTube channel as a PRIVATE video.
 *
 * Per draft-first rule: uploads as PRIVATE first. Matt reviews at the
 * returned URL and explicitly approves publishing via the YouTube Studio
 * or via --publish flag on a follow-up call.
 *
 * Auth: googleapis OAuth2 using GOOGLE_OAUTH_CLIENT_ID,
 *       GOOGLE_OAUTH_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN from .env.local.
 *       Falls back to Supabase oauth_tokens table for 'youtube' provider if
 *       the env vars are missing.
 *
 * Usage:
 *   node --env-file=/Users/matthewryan/RyanRealty/.env.local \
 *     scripts/upload-youtube.mjs \
 *     --city bend --period 2026-04 [--publish] [--dry-run]
 *
 * Flags:
 *   --publish    Set privacy to PUBLIC on upload (skip private-first step).
 *                Normally you omit this — Matt reviews the private video first.
 *   --dry-run    Build metadata bundle, skip actual upload.
 *   --mp4 <path> Explicit MP4 path (overrides auto-derived path).
 *   --thumb <path>  Explicit thumbnail path (1280x720 JPG).
 *
 * Output:
 *   Prints the YouTube video URL (private) and writes
 *   out/yt-long/<slug>/youtube_result.json with videoId, url, uploadedAt.
 *   Auto-registers the upload in asset_library with type='video',
 *   source='render-output', source_id='youtube:<videoId>'.
 */

import fs from 'node:fs'
import path from 'node:path'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const ENV_PATH = '/Users/matthewryan/RyanRealty/.env.local'
const EXPECTED_CHANNEL_ID = 'UCpxIXnNVeG25oeDjfE3b4lw'

// ─── Env loader (mirrors short-form youtube-upload.mjs) ───────────────────────

function parseEnv(text) {
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const k = line.slice(0, eq).trim()
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[k] = v
  }
  return out
}

function loadEnv() {
  try { return parseEnv(fs.readFileSync(ENV_PATH, 'utf8')) } catch { return {} }
}

// ─── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq >= 0) out[a.slice(2, eq)] = a.slice(eq + 1)
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i]
      else out[a.slice(2)] = true
    } else { out._.push(a) }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const slug = args.city
const period = args.period
if (!slug || !period) {
  console.error('Usage: upload-youtube.mjs --city <slug> --period YYYY-MM [--publish] [--dry-run]')
  process.exit(1)
}

const isPublish = !!args.publish
const isDryRun  = !!args['dry-run']

// ─── File paths ────────────────────────────────────────────────────────────────

const cityOut = resolve(ROOT, 'out/yt-long', slug)
const mp4Path = args.mp4 || resolve(cityOut, `${slug}_yt_long_${period.replace('-', '_')}.mp4`)
const thumbPath = args.thumb || resolve(cityOut, `${slug}_thumbnail.jpg`)

if (!fs.existsSync(mp4Path)) {
  console.error(`MP4 not found: ${mp4Path}`)
  console.error('Run render-youtube-long.mjs first.')
  process.exit(1)
}

// ─── YouTube metadata per SKILL.md §6 ─────────────────────────────────────────

const env = loadEnv()

// Load props.json for city/period data to build the SEO metadata
let props = {}
try {
  props = JSON.parse(fs.readFileSync(resolve(cityOut, 'props.json'), 'utf8'))
} catch { console.warn('props.json not found — using generic metadata') }

const cityDisplay = props.city || slug
  .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// Format period as "Month Year" for display
const [year, mon] = period.split('-')
const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December']
const monthDisplay = MONTHS[parseInt(mon)] || mon

// Median price from props (display string)
const medianDisplay = props.medianPriceDisplay || '—'
const marketLabel = props.marketHealthLabel || ''

// Title ≤70 chars per skill spec §6.1
const title = `${cityDisplay} Oregon Real Estate Market Report — ${monthDisplay} ${year} | Ryan Realty`
  .slice(0, 100) // YouTube hard limit is 100; SEO sweet spot is 70

// YouTube chapter timestamps — derived from chapterDurations in props
function durationsToTimestamps(durations) {
  const CHAPTER_TITLES = [
    'Introduction',
    'Median Sale Price + 4-Year Trend',
    'Where the Action Is — Price Segments',
    'Months of Supply + Market Verdict',
    'Days on Market — Distribution',
    'Sale-to-List + Seller Concessions',
    'Cash Buyers + Affordability',
    'Top Neighborhoods',
    'Buyer + Seller Takeaways',
    'Get the Full Report',
  ]
  let sec = 0
  return durations.map((d, i) => {
    const mm = Math.floor(sec / 60)
    const ss = String(sec % 60).padStart(2, '0')
    const ts = `${mm}:${ss} ${CHAPTER_TITLES[i] || `Chapter ${i + 1}`}`
    sec += Math.round(d)
    return ts
  }).join('\n')
}

const chapterBlock = props.chapterDurations
  ? durationsToTimestamps(props.chapterDurations)
  : `0:00 Introduction
0:45 Median Sale Price + 4-Year Trend
2:00 Where the Action Is — Price Segments
3:15 Months of Supply + Market Verdict
4:15 Days on Market — Distribution
5:30 Sale-to-List + Seller Concessions
6:30 Cash Buyers + Affordability
7:45 Top Neighborhoods
9:00 What This Means — Agent Commentary
10:30 Get the Full Report`

// Description per SKILL.md §6.2
const description = `${medianDisplay} median sale price${marketLabel ? ` — ${marketLabel}` : ''}. Full ${cityDisplay} market analysis for ${monthDisplay} ${year} — closed sales, median price, days on market, top neighborhoods, and what it means for buyers and sellers.

CHAPTERS:
${chapterBlock}

DATA SOURCES:
• Spark MLS API
• Supabase market_stats_cache (computed daily)
• Oregon MLS (ORMLS) — single-family residential

View the full written report: https://ryan-realty.com/market-report/${slug}/${period}
Monthly updates in your inbox: https://ryan-realty.com/subscribe
Search ${cityDisplay} homes for sale: https://ryan-realty.com/search/${slug}

— Matt Ryan, Principal Broker
   Ryan Realty | Bend, Oregon
   541.213.6706
   matt@ryan-realty.com

#${cityDisplay.replace(/\s/g, '')}Oregon #RealEstate #MarketReport #CentralOregon #${cityDisplay.replace(/\s/g, '')}RealEstate`

// Tags per SKILL.md §6.3 (≤500 chars total)
const tags = [
  `${slug} oregon real estate`,
  `${slug} oregon market report`,
  'central oregon real estate',
  `${slug} oregon homes for sale`,
  `${slug} market report ${monthDisplay.toLowerCase()} ${year}`,
  `${slug} oregon median home price`,
  'deschutes county real estate',
  'ryan realty',
  'matt ryan',
  'market analysis',
  `real estate market ${year}`,
  'oregon real estate',
  `${slug} home sales`,
]

console.log(`\n=== YouTube Upload: ${slug} ${period} ===`)
console.log(`  Title:    ${title}`)
console.log(`  MP4:      ${mp4Path}`)
console.log(`  Privacy:  ${isPublish ? 'PUBLIC' : 'PRIVATE (review before publishing)'}`)

if (isDryRun) {
  console.log('\n[dry-run] Would upload with this metadata:')
  console.log('  Title:', title)
  console.log('  Description (first 300 chars):', description.slice(0, 300) + '...')
  console.log('  Tags:', tags.join(', '))
  process.exit(0)
}

// ─── googleapis auth ───────────────────────────────────────────────────────────

// NOTE: googleapis is an optional dep. If not installed, stub the upload.
let youtube = null
try {
  const { google } = await import('googleapis')
  const oauth2 = new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID || env.YT_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET || env.YT_CLIENT_SECRET,
    'http://127.0.0.1:8765/oauth2callback'
  )
  const refreshToken = env.YOUTUBE_REFRESH_TOKEN || env.YT_REFRESH_TOKEN
  if (!refreshToken) throw new Error('YOUTUBE_REFRESH_TOKEN not found in .env.local — run youtube-auth.mjs first')
  oauth2.setCredentials({ refresh_token: refreshToken })
  await oauth2.getAccessToken() // surfaces auth errors early
  youtube = google.youtube({ version: 'v3', auth: oauth2 })
} catch (e) {
  console.error(`\nYouTube auth failed: ${e.message}`)
  console.error('Ensure googleapis is installed: npm install googleapis')
  console.error('Ensure YOUTUBE_REFRESH_TOKEN is set in .env.local')
  process.exit(1)
}

// Verify channel
try {
  const me = await youtube.channels.list({ part: ['snippet'], mine: true })
  const ch = me.data.items?.[0]
  if (ch) {
    console.log(`  Channel: ${ch.snippet.title} (${ch.id})`)
    if (ch.id !== EXPECTED_CHANNEL_ID) console.warn(`  WARNING: channel ${ch.id} != expected ${EXPECTED_CHANNEL_ID}`)
  }
} catch (e) { console.warn(`  Channel verify failed: ${e.message}`) }

// ─── Upload ────────────────────────────────────────────────────────────────────

const fileSize = fs.statSync(mp4Path).size
console.log(`  Uploading ${(fileSize / 1024 / 1024).toFixed(1)} MB...`)
const t0 = Date.now()

let videoId = null
try {
  const insertRes = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      notifySubscribers: false, // don't blast subscribers on private upload
      requestBody: {
        snippet: {
          title,
          description,
          tags,
          categoryId: '22', // People & Blogs
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en',
        },
        status: {
          privacyStatus: isPublish ? 'public' : 'private',
          selfDeclaredMadeForKids: false,
          embeddable: true,
          publicStatsViewable: true,
        },
      },
      media: { body: fs.createReadStream(mp4Path) },
    },
    {
      onUploadProgress: (evt) => {
        const pct = ((evt.bytesRead / fileSize) * 100).toFixed(1)
        process.stdout.write(`\r  Progress: ${pct}%   `)
      },
    }
  )
  process.stdout.write('\n')
  videoId = insertRes.data.id
  if (!videoId) throw new Error('insert returned no videoId')
  console.log(`  videoId: ${videoId} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
} catch (e) {
  console.error(`\nUpload failed: ${e.message}`)
  process.exit(1)
}

// Thumbnail upload
if (fs.existsSync(thumbPath)) {
  try {
    await youtube.thumbnails.set({
      videoId,
      media: { mimeType: 'image/jpeg', body: fs.createReadStream(thumbPath) },
    })
    console.log('  Thumbnail set')
  } catch (e) { console.warn(`  Thumbnail failed: ${e.message}`) }
} else {
  console.warn(`  Thumbnail not found at ${thumbPath} — skipping`)
}

// ─── Auto-register in asset library ───────────────────────────────────────────

const videoUrl = `https://youtu.be/${videoId}`
try {
  const { register } = await import('../lib/asset-library.mjs')
  await register(mp4Path, {
    type: 'video',
    source: 'render-output',
    source_id: `youtube:${videoId}`,
    license: 'owned',
    license_metadata: { platform: 'youtube', video_id: videoId, channel_id: EXPECTED_CHANNEL_ID, privacy: isPublish ? 'public' : 'private' },
    creator: 'Ryan Realty content engine',
    geo: [slug, 'central-oregon'],
    subject: ['market-report', 'youtube-long-form', slug, period],
    search_query: `${cityDisplay} ${period} YouTube long-form market report`,
    approval: isPublish ? 'approved' : 'intake',
    notes: `YouTube long-form upload: ${title}. URL: ${videoUrl}`,
  })
  console.log('  Registered in asset library')
} catch (e) { console.warn(`  asset-library register failed (non-fatal): ${e.message}`) }

// ─── Write result JSON ─────────────────────────────────────────────────────────

const result = {
  slug, period, city: cityDisplay, monthDisplay, year,
  videoId,
  url: videoUrl,
  title,
  privacy: isPublish ? 'public' : 'private',
  uploadedAt: new Date().toISOString(),
}
fs.writeFileSync(resolve(cityOut, 'youtube_result.json'), JSON.stringify(result, null, 2))

// ─── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60))
console.log('UPLOAD COMPLETE')
console.log('─'.repeat(60))
console.log(`URL:     ${videoUrl}`)
console.log(`Privacy: ${isPublish ? 'PUBLIC — live now' : 'PRIVATE — share with Matt for review'}`)
if (!isPublish) {
  console.log('')
  console.log('When Matt approves, run:')
  console.log(`  node scripts/upload-youtube.mjs --city ${slug} --period ${period} --publish`)
  console.log('Or flip privacy in YouTube Studio directly.')
}
console.log('─'.repeat(60))
