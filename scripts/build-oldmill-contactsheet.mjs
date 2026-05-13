#!/usr/bin/env node
/**
 * Build a 50+ photo contact sheet for Old Mill / Deschutes River / float / mountains hero candidates.
 * Sources:
 *  - 363 Bluff Drive Plaza Condominiums listing photos (138 from 3 listings, via Spark CDN)
 *  - Unsplash targeted queries (Old Mill, Deschutes River, paddleboard, kayak, smokestacks)
 *  - Wikimedia Commons (Old Mill District Bend, Deschutes River Bend)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);
const UNSPLASH_KEY = env.UNSPLASH_ACCESS_KEY;
const UA = { 'User-Agent': 'RyanRealtyBrandAudit/1.0 (matt@ryan-realty.com)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OUT_DIR = 'design_system/ryan-realty/assets/social/oldmill-candidates';
fs.mkdirSync(OUT_DIR, { recursive: true });

// =========== 1) 363 Bluff listing photos ===========
const BLUFF_LISTING_PHOTOS = JSON.parse(fs.readFileSync('/tmp/bluff-listing-urls.json', 'utf8'));
console.log(`Spark URLs to fetch: ${BLUFF_LISTING_PHOTOS.length}`);

const sparkResults = [];
let sparkIdx = 0;
for (const u of BLUFF_LISTING_PHOTOS) {
  sparkIdx++;
  const filename = `bluff-${String(sparkIdx).padStart(3,'0')}.jpg`;
  const filePath = path.join(OUT_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      const r = await fetch(u.url, { headers: UA });
      if (!r.ok) { console.log(`  skip bluff ${sparkIdx}: HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(filePath, buf);
    }
    const m = await sharp(filePath).metadata();
    sparkResults.push({
      source: 'spark-listing',
      id: `bluff-${sparkIdx}`,
      title: `363 Bluff Dr — Plaza Condos listing photo ${sparkIdx}`,
      author: u.listingAgent || 'MLS listing agent',
      license: 'MLS / Spark — listing agent owns; usage subject to verification',
      width: m.width,
      height: m.height,
      file: filePath,
      filename,
      sourceUrl: u.url,
      listingKey: u.listingKey,
    });
  } catch (e) {
    console.log(`  err bluff ${sparkIdx}: ${e.message}`);
  }
}
console.log(`Spark photos fetched: ${sparkResults.length}`);

// =========== 2) Unsplash targeted queries ===========
const UNSPLASH_QUERIES = [
  'old mill district bend',
  'deschutes river bend',
  'deschutes river float',
  'deschutes river kayak',
  'paddleboard bend',
  'bend oregon smokestack',
  'bend oregon mountain river',
];

const seen = new Set();
const unsplashResults = [];

for (const q of UNSPLASH_QUERIES) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=20&orientation=landscape`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } });
    if (!r.ok) { console.log(`unsplash err ${q}: HTTP ${r.status}`); continue; }
    const j = await r.json();
    for (const p of (j.results || [])) {
      if (seen.has(p.id)) continue;
      const blob = `${p.description||''} ${p.alt_description||''} ${(p.tags||[]).map(t=>t.title).join(' ')} ${p.location?.name||''}`.toLowerCase();
      // require something Bend/Oregon-adjacent
      if (!/\b(bend|oregon|deschutes|cascade|three\s*sisters|tumalo|sunriver|sisters|smith\s*rock|old\s*mill|pilot\s*butte)\b/i.test(blob)) continue;
      seen.add(p.id);
      unsplashResults.push({
        source: 'unsplash',
        id: p.id,
        title: p.description || p.alt_description || p.id,
        author: p.user.name,
        license: 'Unsplash License (free, no attribution required)',
        width: p.width,
        height: p.height,
        thumb_url: p.urls.small,
        full_url: p.urls.regular,
        permalink: p.links.html,
        matched_query: q,
        description: p.description || p.alt_description || '',
      });
    }
    await sleep(400);
  } catch (e) { console.log(`unsplash err ${q}: ${e.message}`); }
}
console.log(`Unsplash filtered: ${unsplashResults.length}`);

// =========== 3) Wikimedia Commons targeted queries ===========
const WM_QUERIES = ['Old Mill District Bend', 'Deschutes River Bend Oregon', 'Bend Oregon river', 'Old Mill Bend'];
const wmSeen = new Set();
const wmTitles = [];
for (const term of WM_QUERIES) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=25&srnamespace=6&format=json`;
  const r = await fetch(url, { headers: UA });
  const j = await r.json();
  for (const result of (j.query?.search || [])) {
    if (wmSeen.has(result.title)) continue;
    wmSeen.add(result.title);
    wmTitles.push(result.title);
  }
  await sleep(800);
}
console.log(`Wikimedia titles: ${wmTitles.length}`);

// Batch fetch image info
const wmResults = [];
for (let i = 0; i < wmTitles.length; i += 10) {
  const batch = wmTitles.slice(i, i + 10);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(batch.join('|'))}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&format=json`;
  const r = await fetch(url, { headers: UA });
  const j = await r.json();
  const pages = j.query?.pages || {};
  for (const id of Object.keys(pages)) {
    const p = pages[id];
    const info = p.imageinfo?.[0];
    if (!info) continue;
    if (!/image\/(jpeg|jpg|png|webp)/i.test(info.mime || '')) continue;
    if (info.width && info.height && info.width < info.height * 1.1) continue; // need landscape-ish
    if (info.width && info.width < 1200) continue;
    const meta = info.extmetadata || {};
    const desc = (meta.ImageDescription?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 200);
    wmResults.push({
      source: 'wikimedia',
      id: p.title.replace(/^File:/, ''),
      title: p.title.replace(/^File:/, ''),
      author: (meta.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 80),
      license: meta.LicenseShortName?.value || 'CC',
      width: info.width,
      height: info.height,
      thumb_url: info.thumburl,
      full_url: info.url,
      permalink: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      description: desc,
    });
  }
  await sleep(1200);
}
console.log(`Wikimedia filtered: ${wmResults.length}`);

// =========== 4) Download remote thumbnails for inlining ===========
async function ensureLocalThumb(item, prefix) {
  if (item.file) return item.file;
  if (!item.thumb_url) return null;
  const ext = '.jpg';
  const safe = item.id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const filename = `${prefix}-${safe}${ext}`;
  const filePath = path.join(OUT_DIR, filename);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 5000) {
    item.file = filePath;
    return filePath;
  }
  try {
    const r = await fetch(item.thumb_url, { headers: UA });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(filePath, buf);
    item.file = filePath;
    return filePath;
  } catch (e) { return null; }
}

for (const r of unsplashResults) { await ensureLocalThumb(r, 'us'); await sleep(150); }
for (const r of wmResults) { await ensureLocalThumb(r, 'wm'); await sleep(200); }

// =========== 5) Combine + rank + cap ===========
// Strategy:
//  - All Bluff Plaza listing photos (interior + exterior + views) — keep all
//  - Unsplash: prefer landscape, prefer those mentioning old mill / river / float / mountain
//  - Wikimedia: prefer river / old mill / boardwalk / smokestack mentions
// Cap total at ~60 (room above Matt's 50 ask)

function scoreUnsplash(p) {
  let s = 1;
  const d = (p.description || '').toLowerCase();
  if (/old mill|deschutes/i.test(d)) s += 3;
  if (/river|float|kayak|paddleboard/i.test(d)) s += 2;
  if (/smokestack|mountain|cascade|three sisters|bachelor/i.test(d)) s += 2;
  if (/bend.*oregon|oregon.*bend/i.test(d)) s += 2;
  return s;
}
function scoreWiki(p) {
  let s = 1;
  const d = ((p.description || '') + ' ' + p.id).toLowerCase();
  if (/old mill|deschutes/i.test(d)) s += 3;
  if (/river|float|kayak|paddleboard|raft/i.test(d)) s += 2;
  if (/smokestack|mountain|cascade|three sisters|bachelor|pilot butte/i.test(d)) s += 2;
  if (/bend.*oregon|oregon.*bend/i.test(d)) s += 2;
  return s;
}

unsplashResults.forEach(p => { p._score = scoreUnsplash(p); });
wmResults.forEach(p => { p._score = scoreWiki(p); });

const unsplashRanked = unsplashResults.sort((a,b) => b._score - a._score);
const wmRanked = wmResults.sort((a,b) => b._score - a._score);

// Pool: bluff listing photos (priority), then top unsplash, then top wikimedia
const pool = [
  ...sparkResults.map(p => ({ ...p, _bucket: 'Spark — 363 Bluff Plaza Condos' })),
  ...unsplashRanked.slice(0, 25).map(p => ({ ...p, _bucket: 'Unsplash — Old Mill / River' })),
  ...wmRanked.slice(0, 25).map(p => ({ ...p, _bucket: 'Wikimedia — Old Mill / River' })),
];

pool.forEach((p, i) => { p._idx = i + 1; });
console.log(`\nFinal pool size: ${pool.length}`);
console.log(`  Spark:     ${pool.filter(p => p.source === 'spark-listing').length}`);
console.log(`  Unsplash:  ${pool.filter(p => p.source === 'unsplash').length}`);
console.log(`  Wikimedia: ${pool.filter(p => p.source === 'wikimedia').length}`);

// =========== 6) Build HTML contact sheet (base64-inlined, RESIZED thumbs) ===========
// Pre-resize each image to 480x320 thumb so the HTML stays under ~10 MB
let inlined = 0, remote = 0;
const cards = [];
for (const p of pool) {
  let src = '';
  if (p.file && fs.existsSync(p.file)) {
    try {
      const resized = await sharp(p.file)
        .resize(480, 320, { fit: 'cover' })
        .jpeg({ quality: 75, mozjpeg: true })
        .toBuffer();
      src = `data:image/jpeg;base64,${resized.toString('base64')}`;
      inlined++;
    } catch (e) {
      src = p.thumb_url || '';
      remote++;
    }
  } else if (p.thumb_url) {
    src = p.thumb_url;
    remote++;
  }

  const link = p.permalink || p.sourceUrl || '';
  const dims = (p.width && p.height) ? `${p.width}×${p.height}` : '';
  const sourcePill = p.source === 'spark-listing' ? 'BLUFF MLS' : p.source.toUpperCase();
  const sourceColor = p.source === 'spark-listing' ? '#5a2d2d' : p.source === 'unsplash' ? '#2d5a2d' : '#2d2d5a';

  cards.push(`
<div class="card">
  ${link ? `<a href="${link}" target="_blank">` : '<div>'}
    <div class="thumb-wrap">
      <img class="thumb" src="${src}" loading="lazy" alt="">
      <span class="idx-pill">P${p._idx}</span>
      <span class="src-pill" style="background:${sourceColor}">${sourcePill}</span>
    </div>
    <div class="meta">
      <div class="author">${(p.author || '').slice(0, 50)}</div>
      <div class="desc">${(p.description || p.title || '').slice(0, 100) || '<em style="opacity:0.4">(no description)</em>'}</div>
      <div class="dim">${dims} · ${(p.license || '').slice(0, 50)}</div>
    </div>
  ${link ? '</a>' : '</div>'}
</div>`);
}
const cardsHtml = cards.join('');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Old Mill / Deschutes River / Mountains — hero candidates</title>
<style>
:root { --rr-navy: #102742; --rr-cream: #faf8f4; --rr-sand: #e8e2d4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--rr-cream); font-family: system-ui, sans-serif; color: var(--rr-navy); padding: 32px; }
h1 { font-size: 32px; margin-bottom: 6px; font-weight: 700; }
.subtitle { opacity: 0.7; margin-bottom: 24px; font-size: 14px; max-width: 720px; line-height: 1.5; }
.bucket-h { font-size: 18px; font-weight: 600; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--rr-sand); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
.card { background: white; border: 1px solid var(--rr-sand); border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgb(16 39 66 / 0.06); transition: transform 200ms; }
.card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgb(16 39 66 / 0.12); }
.thumb-wrap { position: relative; aspect-ratio: 3/2; background: var(--rr-sand); overflow: hidden; }
.thumb { display: block; width: 100%; height: 100%; object-fit: cover; }
.idx-pill { position: absolute; top: 8px; left: 8px; background: var(--rr-navy); color: var(--rr-cream); padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 700; font-family: ui-monospace, monospace; box-shadow: 0 2px 6px rgb(0 0 0 / 0.3); }
.src-pill { position: absolute; top: 8px; right: 8px; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; color: white; letter-spacing: 0.04em; }
.meta { padding: 10px 12px 12px; font-size: 12px; line-height: 1.4; }
.author { font-weight: 600; opacity: 0.85; margin-bottom: 4px; font-size: 11px; }
.desc { opacity: 0.7; margin-bottom: 4px; }
.dim { font-size: 10px; opacity: 0.5; font-family: ui-monospace, monospace; }
a { color: inherit; text-decoration: none; display: block; }
</style></head><body>
<h1>Old Mill / River / Mountains — ${pool.length} hero candidates</h1>
<div class="subtitle">Sources: 363 Bluff Drive Plaza Condominiums listing photos (MLS — license verification needed for non-self-listing use), Unsplash (free), Wikimedia (CC-licensed). Click any to open the source. Reply with photo numbers you want as hero (e.g. "P3, P22, P41").</div>
<div class="grid">${cardsHtml}</div>
</body></html>`;

const htmlPath = 'design_system/ryan-realty/assets/social/oldmill-contact-sheet.html';
fs.writeFileSync(htmlPath, html);
fs.writeFileSync('/tmp/oldmill-contact-sheet.json', JSON.stringify(pool, null, 2));

const sizeMb = (fs.statSync(htmlPath).size/1024/1024).toFixed(1);
console.log(`\nWrote ${htmlPath} (${sizeMb} MB)`);
console.log(`  Inlined: ${inlined}, remote: ${remote}`);
