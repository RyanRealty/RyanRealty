#!/usr/bin/env node
// One-off retry for the b11_skyline photo on the wildfire clip.
// Tries broader queries and any orientation, picks whichever scores best.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'public/source_clips/news_wildfire_r327/b11_skyline.jpg')

const KEY = process.env.UNSPLASH_ACCESS_KEY
if (!KEY) { console.error('Missing UNSPLASH_ACCESS_KEY'); process.exit(1) }

const QUERIES = [
  'bend oregon city',
  'cascade range golden hour',
  'oregon high desert sunset',
  'central oregon mountain dusk',
  'oregon evening landscape',
]

async function search(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=portrait`
  const { stdout } = await exec('curl', ['-sS', '-m', '30',
    '-H', `Authorization: Client-ID ${KEY}`,
    '-H', 'Accept: application/json',
    url,
  ])
  return JSON.parse(stdout).results || []
}

function score(p, q) {
  const tags = [p.alt_description||'', p.description||'', ...(p.tags||[]).map(t=>t.title)].join(' ').toLowerCase()
  let s = 0
  const ratio = (p.height||1)/(p.width||1)
  if (ratio >= 1.2) s += 10
  for (const tok of q.toLowerCase().split(/\s+/)) if (tok && tags.includes(tok)) s += 2
  for (const bad of ['portland','eugene','salem','crater lake','mount hood','columbia gorge','cannon beach']) {
    if (tags.includes(bad)) s -= 12
  }
  s += Math.min(8, Math.log2((p.likes||0)+1))
  return s
}

let chosen = null, chosenQ = null
for (const q of QUERIES) {
  console.log(`querying: ${q}`)
  const results = await search(q)
  const ranked = results.map(p => ({ p, s: score(p, q) })).sort((a,b)=>b.s-a.s)
  if (ranked.length && ranked[0].s > 0) {
    chosen = ranked[0].p; chosenQ = q
    console.log(`  -> ${chosen.id} score=${ranked[0].s.toFixed(1)} ${(chosen.alt_description||'').slice(0,80)}`)
    break
  }
}
if (!chosen) { console.error('no skyline photo found'); process.exit(1) }
const tracking = chosen.links?.download_location
if (tracking) {
  try { await exec('curl', ['-sS','-m','15','-H',`Authorization: Client-ID ${KEY}`, tracking]) } catch {}
}
await exec('curl', ['-sS','-m','60','-o',OUT, chosen.urls.full || chosen.urls.regular])
console.log(`saved ${OUT}`)
console.log(`credit: ${chosen.user?.name} (https://unsplash.com/@${chosen.user?.username})`)
