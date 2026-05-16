#!/usr/bin/env node
/**
 * Search Unsplash + Shutterstock in parallel for "50s-60s couple, warm/editorial
 * lifestyle" photo candidates for the seller LP social-proof section.
 *
 * Output:
 *   - Downloads thumbnails to scratch/couple-stock-candidates/{provider}_{id}.jpg
 *   - Writes an HTML contact sheet at scratch/couple-stock-candidates/index.html
 *
 * Usage: node scripts/search-couple-stock.mjs
 *
 * No license is acquired here — Shutterstock previews are watermarked/comp-only,
 * Unsplash thumbnails are licensed for free use. Picking a candidate is the
 * trigger for the licensing step.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

// ── load .env.local manually (no dotenv dep needed) ──
const envText = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
    }),
)

const UNSPLASH_ACCESS_KEY = env.UNSPLASH_ACCESS_KEY
const SHUTTERSTOCK_API_KEY = env.SHUTTERSTOCK_API_KEY
const SHUTTERSTOCK_API_SECRET = env.SHUTTERSTOCK_API_SECRET

const OUT_DIR = resolve('scratch/couple-stock-candidates')
mkdirSync(OUT_DIR, { recursive: true })

// Search terms tuned for AFFLUENT + ACTIVE + EDITORIAL — not generic senior stock.
// Targeting Bend's million-dollar-equity boomer seller demographic.
const UNSPLASH_QUERIES = [
  'mature couple luxury modern home',
  'wealthy older couple architectural home',
  'active retirees mountain hiking',
  'stylish couple 60s modern kitchen',
  'affluent older couple home patio',
  'fit older couple outdoor mountain west',
]
const SHUTTERSTOCK_QUERIES = [
  'affluent mature couple luxury modern home',
  'wealthy older couple architect home patio',
  'active retired couple mountain outdoor',
  'stylish older couple modern kitchen island',
  'fit boomers casual elegant home',
]

async function searchUnsplash() {
  const results = []
  for (const q of UNSPLASH_QUERIES) {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&content_filter=high`
    const r = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    })
    if (!r.ok) {
      console.error(`Unsplash "${q}": ${r.status}`)
      continue
    }
    const j = await r.json()
    for (const p of j.results.slice(0, 5)) {
      results.push({
        provider: 'unsplash',
        id: p.id,
        thumb: p.urls.regular || p.urls.small,
        full: p.urls.regular,
        download: p.urls.full,
        author: p.user?.name ?? 'unknown',
        author_url: p.user?.links?.html,
        description: p.alt_description || p.description || '',
        license: 'Unsplash free with attribution',
        provider_url: p.links?.html,
        query: q,
      })
    }
  }
  return results
}

async function searchShutterstock() {
  const auth = Buffer.from(`${SHUTTERSTOCK_API_KEY}:${SHUTTERSTOCK_API_SECRET}`).toString('base64')
  const results = []
  for (const q of SHUTTERSTOCK_QUERIES) {
    // Shutterstock people_age is single-value per request. We query each
    // bucket (60s, older) and merge — covers the affluent-boomer brief.
    const merged = []
    for (const age of ['60s', 'older']) {
      const params = new URLSearchParams({
        query: q,
        per_page: '6',
        orientation: 'horizontal',
        image_type: 'photo',
        people_age: age,
        sort: 'popular',
      })
      const url = `https://api.shutterstock.com/v2/images/search?${params.toString()}`
      const rr = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
      if (!rr.ok) {
        console.error(`Shutterstock "${q}" age=${age}: ${rr.status}`)
        continue
      }
      const jj = await rr.json()
      merged.push(...(jj.data ?? []))
    }
    for (const p of merged.slice(0, 8)) {
      results.push({
        provider: 'shutterstock',
        id: String(p.id),
        thumb: p.assets?.preview?.url || p.assets?.small_thumb?.url,
        full: p.assets?.huge_thumb?.url || p.assets?.preview_1500?.url || p.assets?.preview?.url,
        download: null, // licensing required
        author: p.contributor?.id ?? 'shutterstock',
        author_url: null,
        description: p.description || '',
        license: 'Shutterstock — license required before production use',
        provider_url: `https://www.shutterstock.com/image-photo/${p.id}`,
        query: q,
      })
    }
  }
  return results
}

async function downloadThumb(item, idx) {
  if (!item.thumb) return null
  try {
    const r = await fetch(item.thumb)
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    const filename = `${String(idx + 1).padStart(2, '0')}_${item.provider}_${item.id}.jpg`
    const fp = join(OUT_DIR, filename)
    writeFileSync(fp, buf)
    return filename
  } catch (e) {
    console.error(`download fail ${item.provider}/${item.id}:`, e.message)
    return null
  }
}

;(async () => {
  console.log('searching Unsplash + Shutterstock…')
  const [u, s] = await Promise.all([searchUnsplash(), searchShutterstock()])
  console.log(`Unsplash: ${u.length} hits, Shutterstock: ${s.length} hits`)

  const all = [...u, ...s]

  // Dedupe by id
  const seen = new Set()
  const unique = all.filter((p) => {
    const k = `${p.provider}:${p.id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  // Download all thumbs
  for (let i = 0; i < unique.length; i++) {
    unique[i].localFile = await downloadThumb(unique[i], i)
  }

  // Build contact sheet HTML
  const items = unique
    .filter((p) => p.localFile)
    .map(
      (p, i) => `
    <figure class="card" data-id="${i + 1}">
      <div class="pin">${i + 1}</div>
      <img src="${p.localFile}" alt="" loading="lazy">
      <figcaption>
        <div class="meta">
          <strong>#${i + 1}</strong> · ${p.provider} · ${p.id}
        </div>
        <div class="q">"${(p.description || p.query).replace(/"/g, '&quot;')}"</div>
        <div class="license">${p.license}</div>
        <div class="links">
          <a href="${p.provider_url}" target="_blank">view on ${p.provider}</a>
        </div>
      </figcaption>
    </figure>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Couple-photo candidates — Ryan Realty seller LP</title>
  <style>
    body { font: 14px/1.4 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 0; padding: 24px; background: #faf8f4; color: #102742; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    p.sub { color: #102742aa; margin: 0 0 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
    .card { margin: 0; background: #fff; border: 1px solid #102742; border-color: rgba(16,39,66,.12); border-radius: 14px; overflow: hidden; position: relative; }
    .card img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: #eee; }
    .pin { position: absolute; top: 10px; left: 10px; background: #102742; color: #faf8f4; font-weight: 700; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
    figcaption { padding: 12px 14px; }
    .meta { font-size: 12px; color: #102742cc; }
    .q { margin: 6px 0; font-style: italic; }
    .license { font-size: 11px; color: #102742aa; }
    .links { margin-top: 6px; }
    .links a { color: #102742; }
  </style>
</head>
<body>
  <h1>50s–60s couple photo candidates — Ryan Realty seller LP</h1>
  <p class="sub">${unique.filter((p) => p.localFile).length} candidates. Reply with the pin number(s) you'd consider. Shutterstock picks need licensing before production.</p>
  <div class="grid">${items}</div>
</body>
</html>`

  writeFileSync(join(OUT_DIR, 'index.html'), html)

  // Write a JSON manifest for the next step (licensing)
  writeFileSync(
    join(OUT_DIR, 'manifest.json'),
    JSON.stringify(
      { generated_at: new Date().toISOString(), candidates: unique },
      null,
      2,
    ),
  )

  console.log(`wrote contact sheet → ${join(OUT_DIR, 'index.html')}`)
  console.log(`wrote manifest      → ${join(OUT_DIR, 'manifest.json')}`)
})()
