#!/usr/bin/env node
// Fetch portrait Unsplash photos for the Bend Wildfire R-327 news clip.
//
// 8 searches → 8 downloaded JPGs in
//   listing_video_v4/public/source_clips/news_wildfire_r327/
// Plus a credits.json with photographer attribution per Unsplash terms.
//
// Run:
//   node --env-file=/Users/matthewryan/RyanRealty/.env.local \
//     listing_video_v4/scripts/fetch_wildfire_photos.mjs

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'public/source_clips/news_wildfire_r327')

const KEY = process.env.UNSPLASH_ACCESS_KEY
if (!KEY) { console.error('Missing UNSPLASH_ACCESS_KEY'); process.exit(1) }

// Per-beat search queries. We pick the top portrait/landscape candidate per query.
// Fallback queries listed for retry if the first set returns thin results.
const BEATS = [
  { slug: 'b1_hook',      queries: ['wildfire smoke aerial', 'forest fire smoke plume'],            tag: 'smoke aerial' },
  { slug: 'b2_acres',     queries: ['oregon high desert ponderosa', 'central oregon fire'],          tag: 'high desert pine' },
  { slug: 'b3_started',   queries: ['ponderosa pine forest oregon', 'controlled burn forest'],       tag: 'forest floor' },
  { slug: 'b4_contained', queries: ['wildfire firefighter hose line', 'fire crew oregon'],           tag: 'fire crew' },
  { slug: 'b7_siding',    queries: ['fiber cement siding home', 'modern home siding closeup'],       tag: 'hardened siding' },
  { slug: 'b8_cascade',   queries: ['cascade mountains oregon sunset', 'three sisters oregon'],      tag: 'cascade landscape' },
  { slug: 'b10_smoke',    queries: ['mountain smoke haze sunrise', 'smoky cascade range'],           tag: 'smoke haze cascades' },
  { slug: 'b11_skyline',  queries: ['bend oregon downtown sunset', 'central oregon golden hour'],    tag: 'bend skyline' },
]

async function unsplashSearch(query, page = 1) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&page=${page}&orientation=portrait`
  const { stdout } = await exec('curl', [
    '-sS', '-m', '30', '--connect-timeout', '10',
    '-H', `Authorization: Client-ID ${KEY}`,
    '-H', 'Accept: application/json',
    url,
  ], { maxBuffer: 8 * 1024 * 1024 })
  const parsed = JSON.parse(stdout)
  if (parsed.errors) throw new Error(`Unsplash: ${JSON.stringify(parsed.errors)}`)
  return parsed.results || []
}

async function downloadPhoto(photo, outPath) {
  // Per Unsplash terms: hit the download tracking endpoint first.
  const tracking = photo.links?.download_location
  if (tracking) {
    try {
      await exec('curl', ['-sS', '-m', '15',
        '-H', `Authorization: Client-ID ${KEY}`,
        tracking,
      ])
    } catch (_) { /* non-fatal */ }
  }
  // Then download the actual image (large, full 2048-w).
  const url = photo.urls?.full || photo.urls?.regular
  await exec('curl', ['-sS', '-m', '60', '--connect-timeout', '10',
    '-o', outPath,
    url,
  ])
}

function scorePhoto(photo, query) {
  const tags = [
    photo.alt_description || '',
    photo.description || '',
    ...(photo.tags || []).map(t => t.title),
  ].join(' ').toLowerCase()
  const q = query.toLowerCase()
  let s = 0
  // Reward portrait-ish aspect ratios for vertical video.
  const ratio = (photo.height || 1) / (photo.width || 1)
  if (ratio >= 1.2) s += 10
  else if (ratio >= 1.0) s += 4
  else s -= 6
  // Reward query token matches.
  for (const tok of q.split(/\s+/)) {
    if (tok && tags.includes(tok)) s += 2
  }
  // Penalize obvious wrong-region matches.
  for (const bad of ['portland', 'eugene', 'salem', 'medford', 'crater lake', 'mount hood', 'columbia gorge', 'cannon beach', 'astoria']) {
    if (tags.includes(bad)) s -= 12
  }
  // Reward likes for general quality.
  s += Math.min(8, Math.log2((photo.likes || 0) + 1))
  return s
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const credits = []
  const seen = new Set()

  for (const beat of BEATS) {
    let chosen = null
    for (const q of beat.queries) {
      console.log(`[${beat.slug}] querying: ${q}`)
      let results = []
      try { results = await unsplashSearch(q, 1) }
      catch (e) { console.warn(`  search err: ${e.message}`); continue }
      const candidates = results
        .filter(r => !seen.has(r.id))
        .map(r => ({ photo: r, score: scorePhoto(r, q), q }))
        .sort((a, b) => b.score - a.score)
      if (candidates.length === 0) continue
      chosen = candidates[0]
      console.log(`  -> picked ${chosen.photo.id} score=${chosen.score.toFixed(1)} ` +
                  `${(chosen.photo.alt_description || '').slice(0,60)}`)
      seen.add(chosen.photo.id)
      break
    }
    if (!chosen) {
      console.error(`!! no usable photo for ${beat.slug} — left blank`)
      continue
    }
    const outPath = resolve(OUT, `${beat.slug}.jpg`)
    await downloadPhoto(chosen.photo, outPath)
    credits.push({
      beat_slug: beat.slug,
      query: chosen.q,
      tag: beat.tag,
      file: `source_clips/news_wildfire_r327/${beat.slug}.jpg`,
      unsplash_id: chosen.photo.id,
      photographer: chosen.photo.user?.name,
      photographer_url: chosen.photo.user?.links?.html,
      unsplash_url: chosen.photo.links?.html,
      width: chosen.photo.width,
      height: chosen.photo.height,
      alt: chosen.photo.alt_description,
      score: chosen.score,
      fetched_at: new Date().toISOString(),
    })
    console.log(`  saved ${outPath}`)
  }

  await writeFile(
    resolve(OUT, 'credits.json'),
    JSON.stringify({ credits, fetched_at: new Date().toISOString() }, null, 2),
  )
  console.log(`\nDone. ${credits.length}/${BEATS.length} photos saved.`)
}

main().catch(e => { console.error(e); process.exit(1) })
