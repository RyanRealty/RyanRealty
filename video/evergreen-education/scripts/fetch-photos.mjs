#!/usr/bin/env node
/**
 * fetch-photos.mjs
 *
 * Sources real estate / lifestyle photos from Unsplash for the evergreen
 * 4-pillars video beats that benefit from photography over abstract vector art.
 *
 * Per Matt feedback 2026-05-04: mix real photos with the existing Grok
 * illustrations rather than using illustrations alone.
 *
 * Each query downloads 3 candidates per slot; first one is auto-promoted to
 * public/4-pillars/photos/<slot>.jpg. Re-run with --force to re-pull.
 *
 * Output:
 *   out/4-pillars/photos/candidates/<slot>-<n>.jpg  (3 per slot for review)
 *   out/4-pillars/photos/credits.json               (Unsplash attribution rows)
 *   public/4-pillars/photos/<slot>.jpg              (auto-promoted top hit)
 *
 * Required env: UNSPLASH_ACCESS_KEY
 *
 * Run: node video/evergreen-education/scripts/fetch-photos.mjs
 *      node video/evergreen-education/scripts/fetch-photos.mjs --force
 */

import { mkdir, writeFile, copyFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'out', '4-pillars', 'photos')
const CAND_DIR = resolve(OUT_DIR, 'candidates')
const PUB_DIR = resolve(ROOT, 'public', '4-pillars', 'photos')

/**
 * Per-slot search queries. Each slot defines:
 *   slug  — output filename (slot.jpg)
 *   beat  — which video beat it shows up in (intro / cash-flow / loan-paydown / outro)
 *   query — Unsplash search string (tight, real-estate / craftsman feel)
 *   orientation — portrait | landscape | squarish (we want squarish to fill 580x580 panel)
 *   notes — what we're looking for visually
 */
// Multiple query candidates per slot — try each, keep all results, score visually.
// The agent re-runs unsplashSearch per query and saves all hits; then the agent
// (or Matt) picks the best from the candidate pool.
// v3 photo spec — per Matt 2026-05-04: people doing the thing, not abstract objects.
// Each chapter that gets a photo backdrop has its own slot.
const SLOTS = [
  {
    slug: 'intro-hero',
    beat: 'intro',
    queries: ['couple outside home holding hands', 'family home front yard', 'homebuyers in front of house'],
    orientation: 'landscape',
    notes: 'People in front of / interacting with a home. Aspirational.',
  },
  {
    slug: 'cash-flow',
    beat: 'cash-flow',
    queries: ['landlord receiving rent payment', 'tenant paying rent envelope', 'real estate keys handover handshake'],
    orientation: 'squarish',
    notes: 'A transaction moment — keys + envelope or handshake. Hands, NOT staged faces.',
  },
  {
    slug: 'appreciation',
    beat: 'appreciation',
    queries: ['hand on doorframe house keys', 'homeowner standing in driveway', 'family in backyard golden hour'],
    orientation: 'landscape',
    notes: 'Time-passing feel. Patient. A moment of ownership / connection to the home.',
  },
  {
    slug: 'loan-paydown',
    beat: 'loan-paydown',
    queries: ['signing contract pen close up', 'mortgage document signature hand', 'loan paperwork close-up'],
    orientation: 'squarish',
    notes: 'Pen on document, hand visible. v2 photo (Ahmad Saidu) was good — re-pull only if forced.',
  },
  {
    slug: 'tax-benefits',
    beat: 'tax-benefits',
    queries: ['1040 tax form calculator pen', 'schedule e tax form', 'tax preparation desk paperwork'],
    orientation: 'squarish',
    notes: 'Tax document close-up. Concrete, not abstract.',
  },
  {
    slug: 'outro-hero',
    beat: 'outro',
    queries: ['suburban neighborhood aerial trees', 'family home golden hour exterior', 'single family home dusk'],
    orientation: 'landscape',
    notes: 'A neighborhood OR a single home at golden hour. v2 outro-hero (Zac Gudakov) worked — keep unless forced.',
  },
]

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

async function unsplashSearch(query, orientation) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY
  if (!apiKey) throw new Error('UNSPLASH_ACCESS_KEY missing')
  const params = new URLSearchParams({
    query,
    orientation,
    per_page: '6',
    content_filter: 'high',
  })
  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${apiKey}`, 'Accept-Version': 'v1' },
  })
  if (!res.ok) throw new Error(`unsplash ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return data.results || []
}

async function downloadJpg(url, outPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()))
}

async function main() {
  const force = process.argv.includes('--force')
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(CAND_DIR, { recursive: true })
  await mkdir(PUB_DIR, { recursive: true })

  const credits = []

  for (const slot of SLOTS) {
    const promoted = resolve(PUB_DIR, `${slot.slug}.jpg`)
    if (!force && (await exists(promoted))) {
      console.log(`✓ ${slot.slug} already promoted — skip (use --force to re-pull)`)
      continue
    }

    console.log(`\n=== ${slot.slug} ===`)
    let allHits = []
    for (const q of slot.queries) {
      try {
        const hits = await unsplashSearch(q, slot.orientation)
        console.log(`  query "${q}" → ${hits.length} hits`)
        allHits.push(...hits.map((h) => ({ ...h, _query: q })))
      } catch (err) {
        console.log(`  query "${q}" failed: ${err.message}`)
      }
    }
    if (!allHits.length) {
      console.log(`  ✗ no results across all queries`)
      continue
    }

    // Deduplicate by photoId
    const seen = new Set()
    allHits = allHits.filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)))
    // Take top 6 candidates
    const top = allHits.slice(0, 6)
    for (let i = 0; i < top.length; i++) {
      const photo = top[i]
      const url = photo.urls.regular
      const candPath = resolve(CAND_DIR, `${slot.slug}-${i}.jpg`)
      try {
        await downloadJpg(url, candPath)
        console.log(`  ${i}: ${photo.id} (${photo._query}) by ${photo.user.name}`)
      } catch (err) {
        console.log(`  ${i}: download fail: ${err.message}`)
      }
      credits.push({
        slot: slot.slug,
        candidate: i,
        photoId: photo.id,
        query: photo._query,
        photographer: photo.user.name,
        photographerUsername: photo.user.username,
        photographerUrl: photo.user.links.html,
        photoUrl: photo.links.html,
        license: 'Unsplash License — free for commercial use, no attribution required (attribution still recommended)',
        unsplashAttribution: `Photo by ${photo.user.name} on Unsplash`,
      })
    }

    // Auto-promote candidate 0 (top hit) — agent visually reviews after
    const top0 = resolve(CAND_DIR, `${slot.slug}-0.jpg`)
    if (await exists(top0)) {
      await copyFile(top0, promoted)
      console.log(`  ✓ promoted candidate 0 → ${promoted}`)
    }
  }

  await writeFile(resolve(OUT_DIR, 'credits.json'), JSON.stringify(credits, null, 2))
  console.log(`\n✓ wrote ${OUT_DIR}/credits.json (${credits.length} entries)`)
  console.log('\nTo swap a different candidate: cp out/4-pillars/photos/candidates/<slot>-<n>.jpg public/4-pillars/photos/<slot>.jpg')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
