#!/usr/bin/env node
/**
 * Find the most-popular "bend oregon" photos across Unsplash + Shutterstock.
 * Rank by likes (Unsplash) / view count / sort=popular (Shutterstock).
 * Build a base64-inlined contact sheet (resized thumbs) for Matt to scroll.
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
const SS_KEY = env.SHUTTERSTOCK_API_KEY;
const SS_SEC = env.SHUTTERSTOCK_API_SECRET;
const UA = { 'User-Agent': 'RyanRealtyBrandAudit/1.0 (matt@ryan-realty.com)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OUT_DIR = 'design_system/ryan-realty/assets/social/popular-candidates';
fs.mkdirSync(OUT_DIR, { recursive: true });

// ========== 1) UNSPLASH — paginate "bend oregon" + sort by likes ==========
console.log('=== Unsplash ===');
const allUnsplash = [];
const seenU = new Set();
for (const q of ['bend oregon', 'central oregon', 'deschutes river', 'mount bachelor', 'three sisters oregon']) {
  for (let page = 1; page <= 4; page++) {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=30&page=${page}&orientation=landscape`;
    try {
      const r = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } });
      if (!r.ok) { console.log(`  ${q} p${page}: HTTP ${r.status}`); break; }
      const j = await r.json();
      const results = j.results || [];
      if (!results.length) break;
      for (const p of results) {
        if (seenU.has(p.id)) continue;
        seenU.add(p.id);
        // Geo-filter: must mention bend / oregon / deschutes / cascade / three sisters / smith rock / tumalo
        const blob = `${p.description||''} ${p.alt_description||''} ${(p.tags||[]).map(t=>t.title).join(' ')} ${p.location?.name||''}`.toLowerCase();
        if (!/\b(bend|oregon|deschutes|cascade|three\s*sisters|smith\s*rock|tumalo|sunriver|sisters|cascade\s*lakes|old\s*mill|pilot\s*butte|mt\s*bachelor|mount\s*bachelor)\b/i.test(blob)) continue;
        allUnsplash.push({
          source: 'unsplash',
          id: p.id,
          title: p.description || p.alt_description || p.id,
          description: p.description || p.alt_description || '',
          author: p.user?.name || '',
          author_url: p.user?.links?.html || '',
          license: 'Unsplash License (free)',
          width: p.width,
          height: p.height,
          likes: p.likes || 0,
          thumb_url: p.urls.small,
          full_url: p.urls.regular,
          download_url: p.urls.full,
          permalink: p.links.html,
          matched: q,
        });
      }
      await sleep(300);
    } catch (e) { console.log(`  err ${q} p${page}: ${e.message}`); break; }
  }
}
allUnsplash.sort((a, b) => b.likes - a.likes);
console.log(`  Unsplash total filtered: ${allUnsplash.length}, top likes: ${allUnsplash.slice(0,5).map(p=>p.likes).join(',')}`);

// ========== 2) SHUTTERSTOCK — OAuth + popular sort ==========
console.log('\n=== Shutterstock ===');
const tokenResp = await fetch('https://api.shutterstock.com/v2/oauth/access_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SS_KEY,
    client_secret: SS_SEC,
    scope: 'user.view licenses.view',
  }),
});
const tokenJ = await tokenResp.json();
const SS_ACCESS = tokenJ.access_token;
console.log(`  token: ${SS_ACCESS ? 'OK' : 'FAILED'}`);

const allSS = [];
for (const q of ['bend oregon', 'central oregon', 'deschutes river', 'mount bachelor oregon', 'old mill bend', 'smith rock oregon', 'three sisters oregon']) {
  const url = `https://api.shutterstock.com/v2/images/search?query=${encodeURIComponent(q)}&per_page=20&orientation=horizontal&sort=popular&min_width=2000`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${SS_ACCESS}` } });
    const j = await r.json();
    const results = j.data || [];
    console.log(`  "${q}" -> ${results.length} of ${j.total_count}`);
    for (const item of results) {
      const blob = (item.description || '').toLowerCase();
      if (!/\b(bend|oregon|deschutes|cascade|three\s*sisters|smith\s*rock|tumalo|sunriver|sisters|cascade\s*lakes|old\s*mill|pilot\s*butte|mt\s*bachelor|mount\s*bachelor)\b/i.test(blob)) continue;
      allSS.push({
        source: 'shutterstock',
        id: item.id,
        title: item.description || '',
        description: item.description || '',
        author: item.contributor?.id || '',
        license: 'Shutterstock — license required per use',
        width: item.image?.width || 0,
        height: item.image?.height || 0,
        thumb_url: (item.assets?.preview?.url) || (item.assets?.preview_1000?.url) || (item.assets?.preview_1500?.url) || '',
        full_url: (item.assets?.preview_1500?.url) || (item.assets?.preview_1000?.url) || '',
        permalink: `https://www.shutterstock.com/image-photo/-${item.id}`,
        matched: q,
      });
    }
    await sleep(400);
  } catch (e) { console.log(`  ss err: ${e.message}`); }
}
console.log(`  Shutterstock total filtered: ${allSS.length}`);

// ========== 3) Combine, dedupe, cap ==========
const seenAll = new Set();
const combined = [];
for (const p of [...allUnsplash, ...allSS]) {
  const k = `${p.source}:${p.id}`;
  if (seenAll.has(k)) continue;
  seenAll.add(k);
  combined.push(p);
}

// Photographer cap: 3 per photographer to ensure variety
const photogCount = new Map();
const filtered = [];
for (const p of combined) {
  const k = `${p.source}:${p.author || 'unknown'}`.toLowerCase();
  const n = photogCount.get(k) || 0;
  if (n >= 3) continue;
  photogCount.set(k, n + 1);
  filtered.push(p);
}

// Final ranking — unsplash by likes desc, shutterstock follows
filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
const top = filtered.slice(0, 60);
top.forEach((p, i) => { p._idx = i + 1; });

console.log(`\n=== Final pool: ${top.length} (Unsplash ${top.filter(p=>p.source==='unsplash').length}, Shutterstock ${top.filter(p=>p.source==='shutterstock').length}) ===`);

// ========== 4) Download thumbs ==========
let dl = 0;
for (const p of top) {
  if (!p.thumb_url) continue;
  const ext = p.thumb_url.match(/\.(jpg|jpeg|png|webp)/i)?.[1]?.toLowerCase() || 'jpg';
  const safe = String(p.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const fn = `${p.source.slice(0,2)}-${String(p._idx).padStart(3,'0')}-${safe}.${ext}`;
  const fp = path.join(OUT_DIR, fn);
  if (!fs.existsSync(fp)) {
    try {
      const r = await fetch(p.thumb_url, { headers: UA });
      if (r.ok) {
        fs.writeFileSync(fp, Buffer.from(await r.arrayBuffer()));
        dl++;
      }
    } catch (e) {}
  }
  p.file = fp;
  await sleep(120);
}
console.log(`Downloaded ${dl} new thumbs`);

// ========== 5) Build inlined contact sheet ==========
let inlined = 0, remote = 0;
const cards = [];
for (const p of top) {
  let src = '';
  if (p.file && fs.existsSync(p.file)) {
    try {
      const resized = await sharp(p.file).resize(480, 320, { fit: 'cover' }).jpeg({ quality: 75, mozjpeg: true }).toBuffer();
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
  const sourcePill = p.source === 'unsplash' ? 'UNSPLASH' : 'SHUTTERSTOCK';
  const sourceColor = p.source === 'unsplash' ? '#2d5a2d' : '#7a4500';
  const popularBadge = p.likes ? `<span style="background:rgba(0,0,0,0.6);color:white;padding:2px 6px;border-radius:8px;font-size:10px;margin-left:4px;">♥ ${p.likes}</span>` : '';
  cards.push(`
<div class="card">
  <a href="${p.permalink}" target="_blank">
    <div class="thumb-wrap">
      <img class="thumb" src="${src}" loading="lazy" alt="">
      <span class="idx-pill">P${p._idx}${popularBadge}</span>
      <span class="src-pill" style="background:${sourceColor}">${sourcePill}</span>
    </div>
    <div class="meta">
      <div class="author">${(p.author||'').slice(0,40)}${p.likes ? ` · ♥${p.likes}` : ''}</div>
      <div class="desc">${(p.description||'').slice(0,110) || '<em style="opacity:0.4">(no description)</em>'}</div>
      <div class="dim">${p.width}×${p.height} · ${(p.license||'').slice(0,40)}</div>
    </div>
  </a>
</div>`);
}

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Most-popular Bend Oregon photos</title>
<style>
:root { --rr-navy:#102742; --rr-cream:#faf8f4; --rr-sand:#e8e2d4; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--rr-cream); font-family: system-ui, sans-serif; color: var(--rr-navy); padding: 32px; }
h1 { font-size: 32px; margin-bottom: 6px; font-weight: 700; }
.subtitle { opacity: 0.7; margin-bottom: 24px; font-size: 14px; max-width: 720px; line-height: 1.5; }
.legend { display: flex; gap: 16px; margin-bottom: 24px; font-size: 12px; opacity: 0.7; }
.legend .item { display: flex; align-items: center; gap: 6px; }
.legend .dot { width: 10px; height: 10px; border-radius: 50%; }
.dot.unsplash { background: #2d5a2d; }
.dot.shutterstock { background: #7a4500; }
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
<h1>${top.length} most-popular Bend Oregon photos</h1>
<div class="subtitle">Ranked by likes (Unsplash) / popularity (Shutterstock). Capped at 3 per photographer for variety. Click any to open the source. Reply with photo numbers you want as hero (e.g. "P3, P12, P41").</div>
<div class="legend">
  <div class="item"><div class="dot unsplash"></div>Unsplash — free license</div>
  <div class="item"><div class="dot shutterstock"></div>Shutterstock — paid license per use</div>
</div>
<div class="grid">${cards.join('')}</div>
</body></html>`;

const outPath = 'design_system/ryan-realty/assets/social/popular-bend-contact-sheet.html';
fs.writeFileSync(outPath, html);
fs.writeFileSync('/tmp/popular-bend-contact-sheet.json', JSON.stringify(top, null, 2));
console.log(`\nInlined ${inlined}, remote ${remote}. File: ${(fs.statSync(outPath).size/1024/1024).toFixed(1)} MB`);
console.log(`Output: ${outPath}`);
