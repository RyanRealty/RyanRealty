#!/usr/bin/env node
/**
 * Build a single HTML preview page that shows every produced brand asset
 * (avatar variants, heritage banner variants, bio drafts) in one scrollable view.
 * Outputs to design_system/ryan-realty/assets/social/brand-preview.html so the
 * Claude Preview MCP serves it from the same dev server as the contact sheet.
 */
import fs from 'node:fs';
import path from 'node:path';

const AVATAR_DIR        = 'design_system/ryan-realty/assets/social/avatar';
const HERITAGE_BANNER_DIR = 'design_system/ryan-realty/assets/social/banner-illustration';
const PHOTO_BANNER_DIR    = 'design_system/ryan-realty/assets/social/banner-photo';
const BIOS_PATH         = 'design_system/ryan-realty/assets/social/bio-drafts.md';
const OUT               = 'design_system/ryan-realty/assets/social/brand-preview.html';

function inlineImage(filePath) {
  const buf = fs.readFileSync(filePath);
  const sig = buf.slice(0, 4).toString('hex');
  const mime = sig.startsWith('ffd8') ? 'image/jpeg' : sig.startsWith('8950') ? 'image/png' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const AVATAR_SPECS = [
  { file: 'avatar-1080-universal.png',    label: 'Universal upload',          desc: 'Works on every platform — they downsize as needed' },
  { file: 'avatar-720-facebook-gbp.png',  label: 'Facebook Page · GBP',       desc: 'Native upload size for FB and Google Business Profile' },
  { file: 'avatar-800-youtube.png',       label: 'YouTube',                   desc: 'Channel avatar — circular crop in feed' },
  { file: 'avatar-400-x.png',             label: 'X / Twitter',               desc: 'Profile photo — circular crop' },
  { file: 'avatar-320-instagram.png',     label: 'Instagram · Threads',       desc: 'Profile picture — circular crop in feed' },
  { file: 'avatar-300-linkedin.png',      label: 'LinkedIn Company',          desc: 'Square crop on company page' },
];

// Per Matt's hybrid split:
//   Heritage illustration → Google Business Profile, LinkedIn Company, Facebook Page
//   Photo (P43 — Forest US storefront)   → YouTube, X / Twitter, Pinterest, TikTok
const PLATFORM_BANNERS = [
  { platform: 'YouTube channel art',       size: '2048×1152', register: 'photo',     file: 'banner-2048x1152-youtube' },
  { platform: 'X / Twitter header',        size: '1500×500',  register: 'photo',     file: 'banner-1500x500-x' },
  { platform: 'Pinterest cover',           size: '800×450',   register: 'photo',     file: 'banner-800x450-pinterest' },
  { platform: 'Facebook Page cover',       size: '820×312',   register: 'heritage',  file: 'banner-820x312-facebook' },
  { platform: 'Google Business Profile',   size: '1024×576',  register: 'heritage',  file: 'banner-1024x576-gbp' },
  { platform: 'LinkedIn Company cover',    size: '1128×191',  register: 'heritage',  file: 'banner-1128x191-linkedin', note: 'very wide 5.9:1' },
];

const bios = fs.readFileSync(BIOS_PATH, 'utf8');

// Avatar thumbnail demo sizes (how big the avatar actually appears on each platform feed)
const THUMB_SIZES = [
  { px: 48,  label: 'IG feed comment' },
  { px: 64,  label: 'Story circle' },
  { px: 96,  label: 'FB feed' },
  { px: 144, label: 'Profile header' },
];

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ryan Realty — social brand preview</title>
<style>
:root { --rr-navy: #102742; --rr-cream: #faf8f4; --rr-sand: #e8e2d4; --rr-fir: #2e4a3a; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--rr-cream); font-family: system-ui, sans-serif; color: var(--rr-navy); padding: 32px 32px 80px; }
h1 { font-size: 40px; margin-bottom: 6px; }
h2 { font-size: 26px; margin: 40px 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--rr-navy); }
h3 { font-size: 18px; margin: 28px 0 12px; opacity: 0.85; }
.intro { opacity: 0.7; max-width: 760px; margin-bottom: 16px; line-height: 1.5; font-size: 14px; }
.subnav { display: flex; gap: 16px; margin-bottom: 32px; }
.subnav a { padding: 8px 16px; background: white; border: 1px solid var(--rr-sand); border-radius: 8px; text-decoration: none; color: var(--rr-navy); font-weight: 600; font-size: 14px; transition: background 200ms; }
.subnav a:hover { background: var(--rr-sand); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
.tile { background: white; border: 1px solid var(--rr-sand); border-radius: 10px; padding: 20px; }
.tile-label { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
.tile-desc  { font-size: 12px; opacity: 0.6; margin-bottom: 14px; line-height: 1.4; }
.avatar-img { display: block; width: 200px; height: 200px; margin: 0 auto; border-radius: 50%; background: var(--rr-cream); border: 1px solid var(--rr-sand); }
.avatar-img.square { border-radius: 8px; }
.banner-tile { background: white; border: 1px solid var(--rr-sand); border-radius: 10px; padding: 16px; margin-bottom: 24px; }
.banner-tile img { display: block; max-width: 100%; height: auto; border-radius: 4px; border: 1px solid var(--rr-sand); }
.banner-label { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
.banner-desc  { font-size: 12px; opacity: 0.6; margin-bottom: 12px; font-family: ui-monospace, monospace; }
.thumb-demo { display: flex; gap: 16px; align-items: end; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--rr-sand); }
.thumb-demo-item { text-align: center; }
.thumb-demo-item img { display: block; border-radius: 50%; border: 1px solid var(--rr-sand); }
.thumb-demo-item .lbl { font-size: 10px; opacity: 0.6; margin-top: 6px; font-family: ui-monospace, monospace; }
pre.bios { background: white; border: 1px solid var(--rr-sand); border-radius: 10px; padding: 24px; font-size: 13px; line-height: 1.6; overflow-x: auto; font-family: ui-monospace, monospace; white-space: pre-wrap; }
.cta { background: var(--rr-navy); color: var(--rr-cream); padding: 16px 20px; border-radius: 10px; font-size: 14px; line-height: 1.5; }
.cta a { color: var(--rr-cream); text-decoration: underline; }
</style></head><body>

<h1>Ryan Realty — social brand preview</h1>
<p class="intro">Every brand asset I've composited so far against the v2 design system. Avatar uses the stacked navy wordmark on cream. Heritage illustration banners ready for the institutional platforms (FB, LinkedIn, GBP). Photo banner variants for YouTube / X / Pinterest / TikTok will be cut once you pick from the contact sheet.</p>

<div class="subnav">
  <a href="#avatar">Avatar</a>
  <a href="#thumb-demo">Thumbnail check</a>
  <a href="#banners">Heritage banners</a>
  <a href="#bios">Bio drafts</a>
  <a href="bend-contact-sheet.html">→ Photo contact sheet</a>
</div>

<section id="avatar">
<h2>Avatar — stacked wordmark on cream</h2>
<p class="intro">Same composition at every platform's recommended upload size. All show with circular crop to match how each platform displays.</p>
<div class="grid">
${AVATAR_SPECS.map(s => {
  const fp = path.join(AVATAR_DIR, s.file);
  if (!fs.existsSync(fp)) return '';
  const data = inlineImage(fp);
  const m = s.file.match(/avatar-(\d+)/);
  const px = m ? m[1] : '';
  return `<div class="tile">
    <div class="tile-label">${s.label}</div>
    <div class="tile-desc">${px}×${px} · ${s.desc}</div>
    <img class="avatar-img" src="${data}" alt="${s.label}">
  </div>`;
}).join('')}
</div>
</section>

<section id="thumb-demo">
<h2>Avatar at actual feed sizes</h2>
<p class="intro">How the avatar actually appears at the sizes you'll see it on real feeds. Circular crop where platforms enforce it.</p>
<div class="thumb-demo" style="justify-content: center; padding: 32px;">
${THUMB_SIZES.map(t => {
  const data = inlineImage(path.join(AVATAR_DIR, 'avatar-1080-universal.png'));
  return `<div class="thumb-demo-item">
    <img src="${data}" style="width:${t.px}px;height:${t.px}px">
    <div class="lbl">${t.px}px<br>${t.label}</div>
  </div>`;
}).join('')}
</div>
</section>

<section id="banners">
<h2>Banners — hybrid split per platform</h2>
<p class="intro">Heritage illustration on the institutional platforms (Facebook, LinkedIn, Google Business Profile). Photo banner using <strong>P43 (Forest US brick storefront — Simon Hermans)</strong> on the consumer / content-discovery platforms (YouTube, X, Pinterest, TikTok).</p>
${PLATFORM_BANNERS.map(s => {
  const photoPath = path.join(PHOTO_BANNER_DIR, s.file + '.jpg');
  const heritagePath = path.join(HERITAGE_BANNER_DIR, s.file + '.png');
  const showPhoto = fs.existsSync(photoPath);
  const showHeritage = fs.existsSync(heritagePath);
  const photoData = showPhoto ? inlineImage(photoPath) : '';
  const heritageData = showHeritage ? inlineImage(heritagePath) : '';
  const inUseTag = s.register === 'photo'
    ? '<span style="background:#2d5a2d;color:white;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-left:8px">PHOTO (P43)</span>'
    : '<span style="background:#5a2d5a;color:white;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-left:8px">HERITAGE</span>';
  const noteTag = s.note ? ` <span style="font-size:11px;opacity:0.5">(${s.note})</span>` : '';

  return `<div class="banner-tile">
    <div class="banner-label">${s.platform} ${inUseTag}${noteTag}</div>
    <div class="banner-desc">${s.size}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
      <div>
        <div style="font-size:11px;font-weight:600;opacity:0.7;margin-bottom:6px">${s.register === 'photo' ? '★ shipping' : 'alt option'}: photo (P43)</div>
        ${showPhoto ? `<img src="${photoData}" alt="">` : '<div style="height:80px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px">no photo banner</div>'}
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;opacity:0.7;margin-bottom:6px">${s.register === 'heritage' ? '★ shipping' : 'alt option'}: heritage illustration</div>
        ${showHeritage ? `<img src="${heritageData}" alt="">` : '<div style="height:80px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px">no heritage banner</div>'}
      </div>
    </div>
  </div>`;
}).join('')}
</section>

<section id="bios">
<h2>Bio drafts (three lengths)</h2>
<p class="intro">All three tiers against your v2 voice rules. Sign off, edit in place at <code>design_system/ryan-realty/assets/social/bio-drafts.md</code>, or tell me what to change.</p>
<pre class="bios">${bios.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>
</section>

<section style="margin-top: 48px;">
<div class="cta">
<strong>What I'm waiting on from you:</strong><br>
1. Photo numbers from the <a href="bend-contact-sheet.html">contact sheet</a> (e.g. "P3, P12, P47")<br>
2. Sign-off (or edits) on the bio drafts above<br>
3. Confirm the banner split: heritage illustration on GBP/LinkedIn/FB, photo variant on YouTube/X/Pinterest/TikTok
</div>
</section>

</body></html>`;

fs.writeFileSync(OUT, html);
console.log(`Wrote: ${OUT}  (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB)`);
