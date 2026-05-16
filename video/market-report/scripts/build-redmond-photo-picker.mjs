#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..', '..')
const OUT_DIR = resolve(__dirname, '..', 'public', 'redmond')
const OUT_HTML = resolve(OUT_DIR, 'redmond-photo-picker.html')
const OUT_JSON = resolve(OUT_DIR, 'redmond-photo-picker.json')

const { search } = await import('../../../lib/asset-library.mjs')

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function scoreAsset(a) {
  const q = String(a.search_query || '').toLowerCase()
  const tags = (a.subject_tags || []).map((t) => String(t).toLowerCase()).join(' ')
  const text = `${q} ${tags} ${String(a.creator || '').toLowerCase()}`
  let score = 0
  const boosts = [
    'redmond', 'dry canyon', 'downtown', 'main street', 'oregon',
    'cline falls', 'smith rock', 'high desert', 'deschutes',
  ]
  const penalties = [
    'airport', 'islamabad', 'pakistan', 'china', 'beijing', 'qantas',
    'runner', 'running', 'climber', 'climbing', 'athlete',
  ]
  for (const b of boosts) if (text.includes(b)) score += 8
  for (const p of penalties) if (text.includes(p)) score -= 20
  if (a.width && a.height && Number(a.height) >= 1600) score += 3
  if (String(a.approval || '') === 'approved') score += 2
  return score
}

function isRenderableAsset(a) {
  const source = String(a.source || '').toLowerCase()
  const license = String(a.license || '').toLowerCase()
  if (source.includes('shutterstock') || license.includes('shutterstock')) return false
  if (a.license_metadata?.preview_only || a.license_metadata?.preview_watermarked) return false
  if (!a.file_url) return false
  return true
}

function isStrictHyperlocal(a) {
  const q = String(a.search_query || '').toLowerCase()
  const tags = (a.subject_tags || []).map((t) => String(t).toLowerCase()).join(' ')
  const text = `${q} ${tags}`
  const mustContain = [
    'redmond',
    'dry canyon',
    'downtown',
    'main street',
    'cline falls',
    'smith rock',
    'roberts field',
    'deschutes county fairgrounds',
  ]
  return mustContain.some((t) => text.includes(t))
}

async function loadCurrentSet() {
  const creditsPath = resolve(OUT_DIR, 'unsplash_credits.json')
  if (!existsSync(creditsPath)) return []
  const raw = await readFile(creditsPath, 'utf8')
  const json = JSON.parse(raw)
  const photos = Array.isArray(json?.photos) ? json.photos : []
  return photos.map((p, i) => {
    const localImg = resolve(OUT_DIR, `img_${i + 1}.jpg`)
    const localSrc = existsSync(localImg) ? pathToFileURL(localImg).toString() : null
    return {
      id: `CUR-${i + 1}`,
      section: 'current',
      src: localSrc || p.photo_url || '',
      title: p.search_query || 'current-set-photo',
      subtitle: `Current set #${i + 1}`,
      meta: `Photographer: ${p.photographer || 'Unknown'}`,
      source: 'current-redmond-set',
      credit: p.photographer_url || '',
    }
  })
}

async function loadAssetLibrary() {
  const rows = await search({ geo: ['redmond'], type: 'photo', limit: 250, unusedOnly: false })
  const scored = rows
    .filter((a) => isRenderableAsset(a))
    .map((a) => ({ ...a, _score: scoreAsset(a) }))
    .sort((a, b) => b._score - a._score)

  const strict = scored
    .filter((a) => isStrictHyperlocal(a))
    .slice(0, 40)

  const strictIds = new Set(strict.map((a) => a.id))
  const full = scored
    .filter((a) => !strictIds.has(a.id))
    .slice(0, 80)

  const toCard = (a, i, sectionKey, prefix) => ({
    id: `${prefix}-${i + 1}`,
    section: sectionKey,
    src: a.file_url,
    title: a.search_query || 'asset-library-photo',
    subtitle: `Score ${a._score}`,
    meta: `${a.source} · ${a.creator || 'Unknown'} · ${(a.geo_tags || []).join(', ')}`,
    source: a.source,
    credit: a.creator_url || '',
    raw: {
      asset_id: a.id,
      search_query: a.search_query,
      subject_tags: a.subject_tags,
      geo_tags: a.geo_tags,
      approval: a.approval,
    },
  })

  return {
    strict: strict.map((a, i) => toCard(a, i, 'recommended', 'R')),
    full: full.map((a, i) => toCard(a, i, 'asset_library', 'A')),
  }
}

async function loadListingPhotos() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []
  const sb = createClient(url, key)
  const { data: listings, error: e1 } = await sb
    .from('listings')
    .select('ListingKey,StreetNumber,StreetName,City,StandardStatus,ModificationTimestamp')
    .ilike('City', 'Redmond')
    .or('StandardStatus.ilike.%Active%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Closed%')
    .order('ModificationTimestamp', { ascending: false })
    .limit(120)
  if (e1) return []
  const keys = (listings || []).map((r) => r.ListingKey).filter(Boolean)
  if (!keys.length) return []
  const listingMap = new Map((listings || []).map((r) => [r.ListingKey, r]))

  const { data: photos, error: e2 } = await sb
    .from('listing_photos')
    .select('id,listing_key,photo_url,cdn_url,sort_order,is_hero,caption')
    .in('listing_key', keys)
    .order('sort_order', { ascending: true })
    .limit(500)
  if (e2 || !photos?.length) return []

  return photos.slice(0, 80).map((p, i) => {
    const l = listingMap.get(p.listing_key)
    return {
      id: `L-${i + 1}`,
      section: 'listing_photos',
      src: p.cdn_url || p.photo_url || '',
      title: `${l?.StreetNumber || ''} ${l?.StreetName || ''}`.trim() || p.listing_key,
      subtitle: `${l?.City || 'Redmond'} · ${l?.StandardStatus || 'Unknown'}`,
      meta: `sort ${p.sort_order ?? '?'}${p.is_hero ? ' · hero' : ''}`,
      source: 'listing_photos',
      credit: '',
      raw: {
        listing_key: p.listing_key,
        photo_id: p.id,
        caption: p.caption,
      },
    }
  })
}

function buildHtml(all) {
  const sections = [
    { key: 'recommended', title: 'Recommended Hyperlocal (strict Redmond context)' },
    { key: 'asset_library', title: 'Asset Library (Redmond-tagged, curated)' },
    { key: 'listing_photos', title: 'Supabase Listing Photos (Redmond listings)' },
    { key: 'current', title: 'Current Redmond Set (already in public/redmond)' },
  ]

  const sectionHtml = sections.map((s) => {
    const rows = all.filter((x) => x.section === s.key && x.src)
    const cards = rows.map((r) => `
      <article class="card" data-id="${esc(r.id)}" onclick="toggleCard(this)">
        <div class="id">${esc(r.id)}</div>
        <img loading="lazy" src="${esc(r.src)}" alt="${esc(r.title)}" />
        <div class="body">
          <h3>${esc(r.title)}</h3>
          <p class="sub">${esc(r.subtitle)}</p>
          <p class="meta">${esc(r.meta)}</p>
          ${r.credit ? `<p class="meta"><a href="${esc(r.credit)}" target="_blank" rel="noopener">credit/profile</a></p>` : ''}
        </div>
      </article>
    `).join('\n')
    return `
      <section>
        <h2>${esc(s.title)} <span class="count">(${rows.length})</span></h2>
        <div class="grid">${cards || '<p class="empty">No candidates found in this source.</p>'}</div>
      </section>
    `
  }).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redmond Photo Picker</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #0d1117; color: #e6edf3; }
    .wrap { max-width: 1300px; margin: 0 auto; padding: 16px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .intro { color: #9da7b3; margin-bottom: 18px; line-height: 1.45; }
    .toolbar { position: sticky; top: 0; z-index: 20; background: #111827; border: 1px solid #263141; border-radius: 10px; padding: 10px 12px; display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
    .toolbar button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 8px 12px; font-weight: 600; cursor: pointer; }
    .toolbar .count { font-size: 14px; color: #c8d1dc; }
    section { margin: 26px 0; }
    h2 { font-size: 18px; margin: 0 0 10px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
    .card { border: 2px solid #273244; border-radius: 10px; overflow: hidden; background: #151b23; cursor: pointer; }
    .card img { width: 100%; aspect-ratio: 9 / 16; object-fit: cover; display: block; background: #0b0f14; }
    .card .id { padding: 6px 8px; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: #9fb0c4; background: #1f2937; }
    .card .body { padding: 8px 10px 10px; }
    .card h3 { margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #e6edf3; }
    .card .sub { margin: 0 0 4px; font-size: 12px; color: #b7c2cf; }
    .card .meta { margin: 0; font-size: 11px; color: #8b98a8; line-height: 1.35; }
    .card a { color: #7fb3ff; }
    .card.selected { border-color: #22c55e; box-shadow: 0 0 0 1px #22c55e inset; }
    .empty { color: #94a3b8; font-size: 13px; }
    textarea { position: absolute; left: -9999px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Redmond Hyperlocal Photo Picker</h1>
    <p class="intro">Select the images you want for the Redmond render. This sheet includes candidates from asset library, Supabase listing photos (if available), and the current Redmond set. Click cards to toggle, then copy selected IDs.</p>
    <div class="toolbar">
      <button onclick="copySelected()">Copy selected IDs</button>
      <span id="count" class="count">Selected: 0</span>
      <span class="count">Generated: ${esc(new Date().toISOString())}</span>
    </div>
    ${sectionHtml}
    <textarea id="clipboard"></textarea>
  </div>
  <script>
    const selected = new Set();
    function refreshCount() {
      const el = document.getElementById('count');
      el.textContent = 'Selected: ' + selected.size + (selected.size ? ' (' + [...selected].join(', ') + ')' : '');
    }
    function toggleCard(card) {
      const id = card.dataset.id;
      if (!id) return;
      if (selected.has(id)) { selected.delete(id); card.classList.remove('selected'); }
      else { selected.add(id); card.classList.add('selected'); }
      refreshCount();
    }
    function copySelected() {
      const list = [...selected];
      const text = list.join(', ');
      const ta = document.getElementById('clipboard');
      ta.value = text;
      ta.select();
      document.execCommand('copy');
      alert(list.length ? ('Copied: ' + text) : 'No selections yet');
    }
    window.toggleCard = toggleCard;
    window.copySelected = copySelected;
    refreshCount();
  </script>
</body>
</html>`
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const [assetSets, listingPhotos, current] = await Promise.all([
    loadAssetLibrary(),
    loadListingPhotos(),
    loadCurrentSet(),
  ])
  const all = [...assetSets.strict, ...assetSets.full, ...listingPhotos, ...current]
  const html = buildHtml(all)
  await writeFile(OUT_HTML, html, 'utf8')
  await writeFile(OUT_JSON, JSON.stringify({ generated_at: new Date().toISOString(), counts: {
    recommended: assetSets.strict.length,
    asset_library: assetSets.full.length,
    listing_photos: listingPhotos.length,
    current: current.length,
  }, candidates: all }, null, 2), 'utf8')
  console.log(`Wrote picker: ${OUT_HTML}`)
  console.log(`Wrote data:   ${OUT_JSON}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

