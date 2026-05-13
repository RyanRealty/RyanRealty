#!/usr/bin/env node
/**
 * Download full-res versions of the 13 approved photos and composite P43
 * as photo banners at every platform aspect ratio.
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

const APPROVED_DIR = 'design_system/ryan-realty/assets/social/approved';
const PHOTO_BANNER_DIR = 'design_system/ryan-realty/assets/social/banner-photo';
fs.mkdirSync(APPROVED_DIR, { recursive: true });
fs.mkdirSync(PHOTO_BANNER_DIR, { recursive: true });

// The 13 approved picks — Unsplash IDs (or wikimedia for the two Bonnie Moreland shots)
const PICKS = [
  { pick: 'P1',  src: 'unsplash',  id: 'GV6Vx7Pr9bU', author: 'Mick Haupt',        desc: 'Three Sisters at sunrise' },
  { pick: 'P2',  src: 'unsplash',  id: '8mW5YlBeoTs', author: 'Mick Haupt',        desc: 'Cascade Lakes Scenic Byway' },
  { pick: 'P3',  src: 'unsplash',  id: '2Z_cvmc8Utk', author: 'Mick Haupt',        desc: 'Cascade Lakes Scenic Byway' },
  { pick: 'P4',  src: 'unsplash',  id: 'RxsNhUzcwcM', author: 'Nick Harsell',      desc: 'Still Vibrato cafe interior' },
  { pick: 'P5',  src: 'unsplash',  id: 'R47CRfi4u4Y', author: 'Nick Harsell',      desc: 'Still Vibrato drip coffee' },
  { pick: 'P9',  src: 'unsplash',  id: 'e8X7oaj6tyM', author: 'Daniel Herron',     desc: 'Smith Rock at sunset' },
  { pick: 'P18', src: 'wikimedia', id: 'Mt._Bachelor_Oregon_early_morning_-_Flickr', wikiTitle: 'File:Mt. Bachelor, Oregon, early morning - Flickr - Bonnie Moreland (free images).jpg', author: 'Bonnie Moreland', desc: 'Mt Bachelor early morning' },
  { pick: 'P19', src: 'wikimedia', id: 'Mt._Bachelor_Oregon_early_morning', wikiTitle: 'File:Mt. Bachelor, Oregon, early morning.jpg', author: 'Bonnie Moreland', desc: 'Mt Bachelor early morning v2' },
  { pick: 'P43', src: 'unsplash',  id: 'N9Sm-RLmqao', author: 'Simon Hermans',     desc: 'Downtown Bend brick storefront with crosswalk', hero: true },
  { pick: 'P44', src: 'unsplash',  id: '7kh9KKPWBaQ', author: 'Derek Sears',       desc: 'Cascade Lakes road to South Sister' },
  { pick: 'P47', src: 'unsplash',  id: 'KqArcGgJuP8', author: 'Caleb Kastein',     desc: 'Trillium Lake at dawn' },
  { pick: 'P48', src: 'unsplash',  id: 'OAXnAFAf3K4', author: 'Naresh Bojja',      desc: 'Sunrise at Sparks Lake' },
  { pick: 'P50', src: 'unsplash',  id: 'TxYutPUNfJ4', author: 'Cameron Stow',      desc: 'Start of winter at Sparks Lake' },
];

// ============ DOWNLOAD FULL RES ============
async function fetchUnsplash(id) {
  // Use the Unsplash API to get the full-res download URL
  const r = await fetch(`https://api.unsplash.com/photos/${id}`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` }
  });
  if (!r.ok) throw new Error(`Unsplash API HTTP ${r.status}`);
  const j = await r.json();
  // Per Unsplash guidelines, ping the download tracking endpoint
  if (j.links?.download_location) {
    await fetch(j.links.download_location, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } });
  }
  return {
    url: j.urls.full,
    width: j.width,
    height: j.height,
    author: j.user.name,
    author_url: j.user.links.html,
    description: j.description || j.alt_description || '',
    license: 'Unsplash License',
    permalink: j.links.html,
    color: j.color,
  };
}

async function fetchWikimedia(title) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=3840&format=json`;
  const r = await fetch(url, { headers: UA });
  const j = await r.json();
  const pages = j.query?.pages || {};
  for (const id of Object.keys(pages)) {
    const p = pages[id];
    const info = p.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata || {};
    return {
      url: info.url,
      width: info.width,
      height: info.height,
      author: (meta.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
      author_url: '',
      description: (meta.ImageDescription?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 300),
      license: meta.LicenseShortName?.value || 'CC',
      permalink: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      color: '',
    };
  }
  throw new Error(`Wikimedia title not found: ${title}`);
}

const approved = [];
for (const p of PICKS) {
  const ext = 'jpg';
  const safeName = `${p.pick.toLowerCase()}-${p.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)}.${ext}`;
  const filePath = path.join(APPROVED_DIR, safeName);

  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 200000) {
    console.log(`⏭  ${p.pick}: full-res already on disk`);
    approved.push({ ...p, file: filePath, sizeBytes: fs.statSync(filePath).size });
    continue;
  }

  console.log(`↓  ${p.pick}: fetching ${p.src} ${p.id}`);
  try {
    const meta = p.src === 'unsplash'
      ? await fetchUnsplash(p.id)
      : await fetchWikimedia(p.wikiTitle);
    const r = await fetch(meta.url, { headers: UA });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(filePath, buf);
    console.log(`   ${p.pick}: saved ${(buf.length / 1024 / 1024).toFixed(1)} MB, ${meta.width}x${meta.height}`);
    approved.push({ ...p, ...meta, file: filePath, sizeBytes: buf.length });
  } catch (e) {
    console.error(`   ${p.pick}: FAILED — ${e.message}`);
  }
}

// Save approved manifest
fs.writeFileSync(
  path.join(APPROVED_DIR, 'manifest.json'),
  JSON.stringify(approved, null, 2)
);
console.log(`\nApproved manifest written: ${path.join(APPROVED_DIR, 'manifest.json')}`);

// ============ COMPOSITE P43 AS PHOTO BANNERS ============
const hero = approved.find(p => p.hero);
if (!hero) {
  console.error('No hero photo found in approved set');
  process.exit(1);
}
console.log(`\n=== Compositing P43 (${hero.desc}) as banner at every aspect ratio ===`);

const BANNER_SPECS = [
  { name: 'banner-2048x1152-youtube',  w: 2048, h: 1152, label: 'YouTube channel art' },
  { name: 'banner-1500x500-x',         w: 1500, h: 500,  label: 'X / Twitter header' },
  { name: 'banner-820x312-facebook',   w: 820,  h: 312,  label: 'Facebook Page cover' },
  { name: 'banner-1024x576-gbp',       w: 1024, h: 576,  label: 'Google Business Profile' },
  { name: 'banner-800x450-pinterest',  w: 800,  h: 450,  label: 'Pinterest cover' },
  { name: 'banner-1128x191-linkedin',  w: 1128, h: 191,  label: 'LinkedIn Company cover (very wide)' },
];

// P43 has its subject (building, sign, person) in the upper portion of the frame.
// Bottom half is mostly asphalt + crosswalk. For wide banners, we must crop top-anchored.
const heroMeta = await sharp(hero.file).metadata();
const heroAspect = heroMeta.width / heroMeta.height;
console.log(`Hero source: ${heroMeta.width}x${heroMeta.height} (aspect ${heroAspect.toFixed(2)})`);

for (const spec of BANNER_SPECS) {
  const out = path.join(PHOTO_BANNER_DIR, `${spec.name}.jpg`);
  const targetAspect = spec.w / spec.h;

  // For wide banners (aspect > source aspect), the cover crop will trim top+bottom.
  // We want to trim from the BOTTOM to keep the building in frame.
  // For taller-than-source banners (rare), trim from the sides — use centre.
  // Strategy: extract the subject region first, then resize.
  let cropBox;
  if (targetAspect > heroAspect) {
    // Banner is wider than source — full width, partial height from top.
    // We want to keep the top ~50% of the source where the building is.
    const cropHeight = Math.round(heroMeta.width / targetAspect);
    const cropTop = 0; // anchor to top
    const cropLeft = 0;
    const cropWidth = heroMeta.width;
    cropBox = { left: cropLeft, top: cropTop, width: cropWidth, height: Math.min(cropHeight, heroMeta.height) };
  } else {
    // Banner is narrower than source — full height, centre horizontally
    const cropWidth = Math.round(heroMeta.height * targetAspect);
    const cropLeft = Math.round((heroMeta.width - cropWidth) / 2);
    cropBox = { left: cropLeft, top: 0, width: cropWidth, height: heroMeta.height };
  }

  await sharp(hero.file)
    .extract(cropBox)
    .resize(spec.w, spec.h, { fit: 'cover' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(out);
  console.log(`✓ ${spec.name}.jpg (${spec.w}x${spec.h})  crop=${cropBox.width}x${cropBox.height}@${cropBox.left},${cropBox.top}`);
}

console.log(`\nPhoto banners in: ${PHOTO_BANNER_DIR}/`);
