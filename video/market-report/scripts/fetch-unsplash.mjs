#!/usr/bin/env node
// Fetch Unsplash images for all 6 cities.
// Downloads 7 images per city: intro aerial, 5 stat backdrops, outro cityscape.
// Follows Unsplash API terms: hit download endpoint for each used image.
// Writes: public/<city>/img_1.jpg ... img_7.jpg
//         public/<city>/unsplash_credits.json
//
// Run: node --env-file=/Users/matthewryan/RyanRealty/.env.local scripts/fetch-unsplash.mjs

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWriteStream } from 'node:fs'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUB = resolve(ROOT, 'public')

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
if (!ACCESS_KEY) { console.error('Missing UNSPLASH_ACCESS_KEY'); process.exit(1) }

const UNSPLASH_API = 'https://api.unsplash.com'

// Helper: curl with rate-limit header inspection
async function unsplashGet(path, retries = 3) {
  const url = `${UNSPLASH_API}${path}`
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { stdout } = await exec('curl', [
        '-sS', '-m', '30', '--connect-timeout', '10',
        '-H', `Authorization: Client-ID ${ACCESS_KEY}`,
        '-H', 'Accept: application/json',
        '-D', '-', // dump headers into stdout
        url,
      ], { maxBuffer: 8 * 1024 * 1024 })

      // Split headers from body (first blank line separates them)
      const splitIdx = stdout.indexOf('\r\n\r\n')
      const headers = stdout.slice(0, splitIdx)
      const body = stdout.slice(splitIdx + 4)

      const remainingMatch = headers.match(/x-ratelimit-remaining:\s*(\d+)/i)
      const remaining = remainingMatch ? parseInt(remainingMatch[1], 10) : null
      if (remaining !== null) {
        process.stdout.write(` [remaining: ${remaining}]`)
      }

      // Rate limit exhausted
      if (remaining === 0 && attempt === retries) {
        throw new Error('Unsplash rate limit exhausted — retry next hour')
      }
      if (remaining === 0) {
        const waitMs = 3600 * 1000 + 30000 // wait 1 hour + 30s buffer
        console.log(`\nRate limit at 0. Waiting ${(waitMs/1000/60).toFixed(1)}m until reset...`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }

      const parsed = JSON.parse(body)
      if (parsed.errors) throw new Error(`Unsplash error: ${JSON.stringify(parsed.errors)}`)
      return { data: parsed, remaining }
    } catch (e) {
      if (attempt === retries) throw e
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
}

// Check rate limit before any downloads
async function checkRateLimit() {
  const { remaining } = await unsplashGet('/photos/random?count=1')
  console.log(`\nUnsplash rate limit: ${remaining}/50 remaining`)
  if (remaining < 40) {
    const waitMs = 3600 * 1000 + 60000
    console.log(`Rate limit too low (${remaining} < 40). Waiting ${(waitMs/1000/60).toFixed(1)}m...`)
    await new Promise(r => setTimeout(r, waitMs))
    const { remaining: r2 } = await unsplashGet('/photos/random?count=1')
    console.log(`After wait: ${r2}/50 remaining`)
    if (r2 < 5) {
      console.error('Rate limit still too low after wait. Exiting.')
      process.exit(1)
    }
  }
  return remaining
}

// Download a URL to a local file path
async function downloadFile(url, destPath) {
  await exec('curl', ['-sS', '-m', '60', '--connect-timeout', '15', '-L', '-o', destPath, url], { maxBuffer: 32 * 1024 * 1024 })
}

// Trigger Unsplash download endpoint (required by API terms)
async function triggerDownload(downloadLocation) {
  try {
    await unsplashGet(`/photos/${downloadLocation.split('/photos/')[1]}`.replace(/\?.*/, '') + '/download')
  } catch (_) {
    // Best effort — don't fail the whole run
  }
}

// Search Unsplash and return best photos for each slot
async function searchPhotos(query, count = 30) {
  const q = encodeURIComponent(query)
  const { data } = await unsplashGet(`/search/photos?query=${q}&per_page=${count}&orientation=portrait&content_filter=high`)
  return data.results || []
}

// Score a photo for our use case: prefer outdoor scenes, no people-as-subject
function scorePhoto(photo) {
  let score = 0
  // Prefer landscape/nature/architecture tags
  const tags = (photo.tags || []).map(t => (t.title || t.slug || '').toLowerCase())
  const goodTags = ['oregon', 'landscape', 'mountain', 'house', 'home', 'architecture', 'nature', 'forest', 'river', 'sunset', 'sky', 'outdoor', 'rural', 'town']
  const badTags = ['person', 'people', 'portrait', 'face', 'man', 'woman', 'child', 'crowd']
  for (const t of tags) {
    if (goodTags.some(g => t.includes(g))) score += 2
    if (badTags.some(b => t.includes(b))) score -= 3
  }
  // Prefer larger images
  if (photo.width >= 1080 && photo.height >= 1920) score += 2
  if (photo.width >= 1920) score += 1
  return score
}

const CITY_CONFIGS = [
  {
    slug: 'bend',
    queries: [
      'bend oregon aerial landscape',
      'cascade mountains home exterior',
      'central oregon house',
      'bend oregon street',
      'oregon mountain sunset',
    ],
  },
  {
    slug: 'redmond',
    queries: [
      'high desert oregon home',
      'central oregon house exterior',
      'oregon ranch home',
      'redmond oregon landscape',
      'desert landscape oregon',
    ],
  },
  {
    slug: 'sisters',
    queries: [
      'sisters oregon mountains',
      'western town oregon main street',
      'cascade range home',
      'oregon small town',
      'mountains house exterior',
    ],
  },
  {
    slug: 'la-pine',
    queries: [
      'ponderosa pine forest oregon',
      'oregon forest cabin',
      'rural oregon house',
      'pine forest house',
      'oregon woodland home',
    ],
  },
  {
    slug: 'prineville',
    queries: [
      'ochoco mountains oregon',
      'oregon high desert home',
      'ranch home exterior',
      'oregon rural landscape',
      'high desert house',
    ],
  },
  {
    slug: 'sunriver',
    queries: [
      'oregon mountain resort home',
      'deschutes river oregon',
      'central oregon resort',
      'mountain home exterior',
      'oregon forest river',
    ],
  },
]

// Collect up to N unique photos across multiple search queries
async function collectPhotos(queries, need = 7) {
  const seen = new Set()
  const all = []
  for (const q of queries) {
    if (all.length >= need * 3) break
    console.log(`\n  Searching: "${q}"...`)
    try {
      const results = await searchPhotos(q, 15)
      for (const p of results) {
        if (!seen.has(p.id) && p.width >= 800) {
          seen.add(p.id)
          all.push({ ...p, _query: q, _score: scorePhoto(p) })
        }
      }
      console.log(` ${results.length} results, ${all.length} unique total`)
    } catch (e) {
      console.warn(`  Search failed for "${q}": ${e.message}`)
    }
  }
  // Sort by score descending, take top N
  all.sort((a, b) => b._score - a._score)
  return all.slice(0, need)
}

async function processCity(cfg) {
  const cityDir = resolve(PUB, cfg.slug)
  await mkdir(cityDir, { recursive: true })
  console.log(`\n=== ${cfg.slug} ===`)

  const photos = await collectPhotos(cfg.queries, 7)
  if (photos.length < 7) {
    console.warn(`  Only found ${photos.length} photos (need 7). Will reuse last photo for missing slots.`)
    while (photos.length < 7) photos.push(photos[photos.length - 1])
  }

  const credits = []
  for (let i = 0; i < 7; i++) {
    const p = photos[i]
    const imgPath = resolve(cityDir, `img_${i + 1}.jpg`)
    const imgUrl = p.urls.regular // 1080px width, good for portrait
    console.log(`  img_${i+1}: ${p.user.name} — ${p.description || p.alt_description || 'untitled'} (${p.width}×${p.height})`)
    await downloadFile(imgUrl, imgPath)
    // Trigger download per Unsplash API terms
    if (p.links?.download_location) {
      try {
        await triggerDownload(p.links.download_location)
      } catch (_) {}
    }
    credits.push({
      slot: `img_${i + 1}`,
      photo_id: p.id,
      photographer: p.user.name,
      photographer_url: `https://unsplash.com/@${p.user.username}`,
      photo_url: p.links.html,
      download_location: p.links.download_location,
      search_query: p._query,
      width: p.width,
      height: p.height,
    })
  }

  await writeFile(resolve(cityDir, 'unsplash_credits.json'), JSON.stringify({ city: cfg.slug, photos: credits }, null, 2))
  console.log(`  Wrote unsplash_credits.json (${credits.length} entries)`)
}

// Filter by optional --cities=slug1,slug2 arg or positional city slugs
const cityArgIdx = process.argv.findIndex(a => a.startsWith('--cities='))
const cityFilter = cityArgIdx >= 0
  ? process.argv[cityArgIdx].replace('--cities=', '').split(',').map(s => s.trim()).filter(Boolean)
  : process.argv.slice(2).filter(a => !a.startsWith('--') && CITY_CONFIGS.some(c => c.slug === a))

const targets = cityFilter.length
  ? CITY_CONFIGS.filter(c => cityFilter.includes(c.slug))
  : CITY_CONFIGS

// Check rate limit then process target cities
await checkRateLimit()
for (const cfg of targets) {
  await processCity(cfg)
}
console.log('\nAll city images downloaded.')
