#!/usr/bin/env node
// Targeted re-fetch for b4_contained (need a real fire crew / hose line photo)
// and b11_skyline (try harder for a Bend / Central Oregon golden-hour shot).

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'public/source_clips/news_wildfire_r327')

const KEY = process.env.UNSPLASH_ACCESS_KEY
if (!KEY) { console.error('Missing UNSPLASH_ACCESS_KEY'); process.exit(1) }

const TARGETS = [
  {
    slug: 'b4_contained',
    queries: [
      'forest fire smoke pine trees',
      'wildfire smoke mountain forest',
      'controlled burn smoke ponderosa',
      'forest smoke morning haze',
    ],
    avoidTerms: ['table', 'helmet', 'museum', 'vintage', 'antique', 'studio'],
    minRatio: 1.2,
  },
  {
    slug: 'b11_skyline',
    queries: [
      'high desert juniper sunset',
      'ponderosa forest sunset oregon',
      'mountain meadow golden hour pacific northwest',
      'cascade mountains alpenglow',
    ],
    avoidTerms: [],
    minRatio: 1.2,
  },
]

async function search(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=15&orientation=portrait`
  const { stdout } = await exec('curl', ['-sS','-m','30',
    '-H',`Authorization: Client-ID ${KEY}`,
    '-H','Accept: application/json',
    url,
  ], { maxBuffer: 8*1024*1024 })
  return JSON.parse(stdout).results || []
}

function score(p, q, target) {
  const tags = [p.alt_description||'', p.description||'', ...(p.tags||[]).map(t=>t.title)].join(' ').toLowerCase()
  let s = 0
  const ratio = (p.height||1)/(p.width||1)
  if (ratio < target.minRatio) return -100
  if (ratio >= 1.4) s += 12
  else if (ratio >= 1.2) s += 8
  for (const tok of q.toLowerCase().split(/\s+/)) if (tok && tags.includes(tok)) s += 2
  for (const bad of target.avoidTerms) if (tags.includes(bad)) s -= 25
  for (const bad of ['portland','salem','medford','crater lake','mount hood','columbia gorge','cannon beach']) {
    if (tags.includes(bad)) s -= 12
  }
  s += Math.min(8, Math.log2((p.likes||0)+1))
  return s
}

for (const target of TARGETS) {
  let chosen = null, chosenQ = null, chosenScore = -100
  for (const q of target.queries) {
    console.log(`[${target.slug}] querying: ${q}`)
    let results = []
    try { results = await search(q) } catch (e) { console.warn(`  err: ${e.message}`); continue }
    const ranked = results.map(p => ({ p, s: score(p, q, target) })).sort((a,b)=>b.s-a.s)
    if (ranked.length === 0) continue
    console.log(`  top: ${ranked[0].s.toFixed(1)} ${(ranked[0].p.alt_description||'').slice(0,70)}`)
    if (ranked[0].s > chosenScore) {
      chosen = ranked[0].p
      chosenScore = ranked[0].s
      chosenQ = q
    }
    // If we got a really strong candidate, take it.
    if (chosenScore >= 18) break
  }
  if (!chosen) { console.error(`  no replacement for ${target.slug}`); continue }
  console.log(`  -> ${chosen.id} score=${chosenScore.toFixed(1)} from "${chosenQ}"`)
  const tracking = chosen.links?.download_location
  if (tracking) {
    try { await exec('curl', ['-sS','-m','15','-H',`Authorization: Client-ID ${KEY}`, tracking]) } catch {}
  }
  const outPath = resolve(OUT, `${target.slug}.jpg`)
  await exec('curl', ['-sS','-m','60','-o', outPath, chosen.urls.full || chosen.urls.regular])
  console.log(`  saved ${outPath}`)
  console.log(`  credit: ${chosen.user?.name} (https://unsplash.com/@${chosen.user?.username})`)
  console.log(`  url: ${chosen.links?.html}\n`)
}
