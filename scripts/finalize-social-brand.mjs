#!/usr/bin/env node
/**
 * Final-pass: lock the brand kit and produce the per-platform paste-and-upload checklist HTML.
 *
 * Locked decisions (2026-05-13):
 *   - Avatar: stacked wordmark, centroid-centered, 85% size, cream background. APPROVED.
 *   - Banner: P69 Old Mill District 2019 by Beastes35 (Wikimedia, CC BY-SA 4.0). APPROVED at every spec.
 *   - Phone (bio): 541.703.3095 (FUB-tracked brokerage main line)
 *   - Bio voice: Option C — Matt's current voice preserved (emoji included on consumer platforms)
 *   - Service areas: Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville
 *
 * Output: a single self-contained HTML page Matt can scroll, with per-platform sections:
 *   - Avatar preview
 *   - Banner preview
 *   - Bio text (copyable)
 *   - Display name (copyable)
 *   - Website (copyable)
 *   - Phone (copyable)
 *   - Exact navigation path on the platform
 *   - File path for avatar + banner downloads
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PHONE = '541.703.3095';
const WEBSITE = 'ryan-realty.com';
const ADDRESS = '115 NW Oregon Ave Suite #2, Bend, OR 97703';
const ATTRIBUTION = '';  // Banner = F1 frame from licensed iStock video, no attribution required

// --- Bios (Option C — Matt's current voice with emoji preserved) ---
const BIOS = {
  // 150-char consumer bio — IG, X, TikTok, Threads, Pinterest
  short: `Your trusted Central Oregon brokerage. 🤝
Building community through authentic relationships and exceptional customer service. 🏡🌲`,

  // ~500-char medium — LinkedIn Company intro, YouTube About first paragraph
  medium: `Ryan Realty is your trusted Central Oregon real estate brokerage. 🤝

We're committed to building community through authentic relationships and exceptional customer service. 🏡🌲

Service area: Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville
${PHONE} · ${WEBSITE}`,

  // Full About — LinkedIn Company About, FB long-form, GBP business description, website footer
  full: `Ryan Realty is your trusted Central Oregon real estate brokerage, based in downtown Bend. 🤝

Our mission is to build community through authentic relationships and exceptional customer service. 🏡🌲

We work the way you'd want us to. Honest. Direct. Kind. Local. We know the neighborhoods, the trails, the breweries, the school districts, the trades. We live here too.

Service area: Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville

Whether you're buying your first home, listing in Tumalo, retiring to Sunriver, building in Sisters, or thinking through a long-term investment plan — we'll help you do it right.

How can we earn your business?

${PHONE} · matt@ryan-realty.com · ${WEBSITE}
${ADDRESS}`,

  // FB Page About is capped at 255 chars — tight version
  facebookAbout: `Your trusted Central Oregon real estate brokerage. 🤝 Building community through authentic relationships and exceptional customer service. 🏡🌲

How can we earn your business?
${PHONE} · ${WEBSITE}`,

  // GBP description capped at 750 chars
  gbpDescription: `Ryan Realty is your trusted Central Oregon real estate brokerage, based in downtown Bend.

Our mission: build community through authentic relationships and exceptional customer service.

Service area: Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville

We work the way you'd want us to. Honest. Direct. Kind. Local.

Whether you're buying your first home, listing in Tumalo, retiring to Sunriver, building in Sisters, or thinking through an investment strategy — we'll help you do it right.

How can we earn your business?
${PHONE} · matt@ryan-realty.com · ${WEBSITE}`,
};

const DISPLAY_NAMES = {
  instagram: 'Ryan Realty · Bend, Oregon',
  facebook: 'Ryan Realty Bend',
  linkedin: 'Ryan Realty',
  youtube: 'Ryan Realty · Bend, Oregon',
  x: 'Ryan Realty · Bend, OR',
  tiktok: 'Ryan Realty',
  pinterest: 'Ryan Realty · Bend, Oregon',
  threads: '(inherits from Instagram)',
  gbp: 'Ryan Realty',
};

// --- Platforms (in upload order) ---
const PLATFORMS = [
  {
    key: 'instagram',
    name: 'Instagram',
    handle: '@ryanrealtybend',
    icon: '📷',
    nav: 'Profile → Edit profile',
    avatar: 'avatar-320-instagram.png',
    banner: null,  // IG doesn't have a banner — it's a feed grid
    bioText: BIOS.short,
    bioLimit: '150 characters',
    extras: [
      { label: 'Website', value: WEBSITE, field: 'Links → Add link' },
      { label: 'Contact options', value: PHONE, field: 'Settings → Business → Contact options → Phone' },
      { label: 'Category', value: 'Real Estate Company', field: 'Settings → Business → Edit profile → Category' },
    ],
  },
  {
    key: 'facebook',
    name: 'Facebook Page',
    handle: 'Ryan Realty Bend',
    icon: '👤',
    nav: 'Meta Business Suite → Settings → Page details',
    avatar: 'avatar-720-facebook-gbp.png',
    banner: 'banner-820x312-facebook.jpg',
    bioText: BIOS.facebookAbout,
    bioLimit: '255 chars for "About"',
    longAbout: BIOS.full,
    extras: [
      { label: 'Phone', value: PHONE, field: 'Page details → Contact information → Phone (REPLACE the current 541.213.6706)' },
      { label: 'Website', value: `https://${WEBSITE}`, field: 'Page details → Contact information → Website' },
      { label: 'Email', value: 'matt@ryan-realty.com', field: 'Page details → Contact information → Email' },
      { label: 'Address', value: ADDRESS, field: 'Page details → Address' },
    ],
  },
  {
    key: 'linkedin',
    name: 'LinkedIn Company Page',
    handle: 'Ryan Realty',
    icon: '💼',
    nav: 'Company Page → Edit Page → Overview',
    avatar: 'avatar-300-linkedin.png',
    banner: 'banner-1128x191-linkedin.jpg',
    bioText: BIOS.full,
    bioLimit: '2000 chars for About',
    tagline: 'Your trusted Central Oregon real estate brokerage',
    extras: [
      { label: 'Tagline', value: 'Your trusted Central Oregon real estate brokerage', field: 'Tagline (120 char limit)' },
      { label: 'Website', value: `https://${WEBSITE}`, field: 'Overview → Website' },
      { label: 'Phone', value: PHONE, field: 'Overview → Phone' },
      { label: 'Headquarters', value: ADDRESS, field: 'Overview → Headquarters' },
      { label: 'Industry', value: 'Real Estate', field: 'Overview → Industry' },
      { label: 'Specialties', value: 'Residential real estate, Central Oregon, Bend OR, Sunriver, Sisters, Tumalo, La Pine, Prineville, Redmond', field: 'Overview → Specialties' },
    ],
  },
  {
    key: 'youtube',
    name: 'YouTube',
    handle: '@RyanRealty',
    icon: '▶️',
    nav: 'YouTube Studio → Customization → Branding + Basic info',
    avatar: 'avatar-800-youtube.png',
    banner: 'banner-2048x1152-youtube.jpg',
    bioText: BIOS.full,
    bioLimit: '1000 chars for channel description',
    extras: [
      { label: 'Channel name', value: 'Ryan Realty · Bend, Oregon', field: 'Basic info → Name' },
      { label: 'Description', value: BIOS.medium, field: 'Basic info → Description' },
      { label: 'Channel banner safe zone', value: 'Image must be 2048×1152 — banner has safe zone 1546×423 for the center area visible on TVs', field: 'Customization → Branding → Banner image' },
      { label: 'Profile picture', value: '800×800 PNG (uploaded)', field: 'Customization → Branding → Picture' },
      { label: 'Website link', value: `https://${WEBSITE}`, field: 'Basic info → Links' },
    ],
  },
  {
    key: 'x',
    name: 'X / Twitter',
    handle: '(set by you)',
    icon: '𝕏',
    nav: 'Profile → Edit profile',
    avatar: 'avatar-400-x.png',
    banner: 'banner-1500x500-x.jpg',
    bioText: BIOS.short,
    bioLimit: '160 chars',
    extras: [
      { label: 'Header image', value: '1500×500 (uploaded)', field: 'Edit profile → Header' },
      { label: 'Profile picture', value: '400×400 PNG (uploaded)', field: 'Edit profile → Profile photo' },
      { label: 'Location', value: 'Bend, Oregon', field: 'Edit profile → Location' },
      { label: 'Website', value: `https://${WEBSITE}`, field: 'Edit profile → Website' },
    ],
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    handle: '(needs first-time OAuth connect)',
    icon: '🎵',
    nav: 'After OAuth: TikTok app → Profile → Edit profile',
    avatar: 'avatar-320-instagram.png',
    banner: null,  // TikTok doesn't have a banner
    bioText: BIOS.short,
    bioLimit: '80 chars (TikTok is the shortest)',
    notes: '⚠️ TikTok OAuth not connected yet. Visit `/api/tiktok/authorize/` to connect, then I can push the bio + photo via API. For now, copy-paste manually.',
    extras: [
      { label: 'Bio (trimmed to 80 chars)', value: 'Building community through authentic relationships + service. 🏡🌲', field: 'Profile → Bio' },
      { label: 'Profile picture', value: '320×320 PNG (uploaded)', field: 'Profile → Photo' },
      { label: 'Website', value: WEBSITE, field: 'Profile → Website' },
    ],
  },
  {
    key: 'pinterest',
    name: 'Pinterest',
    handle: '(needs first-time OAuth connect)',
    icon: '📌',
    nav: 'After OAuth: Pinterest app → Settings → Edit profile',
    avatar: 'avatar-1080-universal.png',
    banner: 'banner-800x450-pinterest.jpg',
    bioText: BIOS.short,
    bioLimit: '160 chars',
    notes: '⚠️ Pinterest OAuth not connected yet. Visit `/api/pinterest/authorize/` to connect for API push.',
    extras: [
      { label: 'Cover photo', value: 'Pinterest profile cover (uploaded)', field: 'Settings → Edit profile' },
      { label: 'Website', value: WEBSITE, field: 'Settings → Account management → Claimed websites' },
    ],
  },
  {
    key: 'threads',
    name: 'Threads',
    handle: '@ryanrealtybend (inherits from IG)',
    icon: '🧵',
    nav: 'Threads syncs bio + avatar from Instagram automatically — update IG first',
    avatar: '(inherits from Instagram)',
    banner: null,
    bioText: '(inherits from Instagram)',
    bioLimit: '500 chars (can override after IG syncs)',
    extras: [],
  },
  {
    key: 'gbp',
    name: 'Google Business Profile',
    handle: 'Ryan Realty (115 NW Oregon Ave)',
    icon: '🗺️',
    nav: 'Google Business Profile manager → Edit profile',
    avatar: 'avatar-720-facebook-gbp.png',
    banner: 'banner-1024x576-gbp.jpg',
    bioText: BIOS.gbpDescription,
    bioLimit: '750 chars',
    extras: [
      { label: 'Business name', value: 'Ryan Realty', field: 'Business name' },
      { label: 'Category (primary)', value: 'Real Estate Agency', field: 'Categories → Primary' },
      { label: 'Phone', value: PHONE, field: 'Contact → Phone' },
      { label: 'Website', value: `https://${WEBSITE}`, field: 'Contact → Website' },
      { label: 'Service areas', value: 'Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville', field: 'Service area → Areas served' },
      { label: 'Cover photo', value: '1024×576 (uploaded)', field: 'Photos → Cover' },
      { label: 'Logo', value: '720×720 PNG (uploaded)', field: 'Photos → Logo' },
    ],
  },
];

// --- Inline a file as base64 image src ---
function inlineImage(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const sig = buf.slice(0, 4).toString('hex');
  const mime = sig.startsWith('ffd8') ? 'image/jpeg' :
               sig.startsWith('8950') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function inlineThumb(filePath, w = 240, h = 240, fit = 'contain') {
  if (!fs.existsSync(filePath)) return null;
  const buf = await sharp(filePath)
    .resize(w, h, { fit, background: { r: 0xfa, g: 0xf8, b: 0xf4, alpha: 1 } })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

const AVATAR_DIR = 'design_system/ryan-realty/assets/social/avatar';
const PHOTO_BANNER_DIR = 'design_system/ryan-realty/assets/social/banner-photo';

// --- Build HTML ---
const sectionsHtml = [];
for (const p of PLATFORMS) {
  const avatarPath = p.avatar && !p.avatar.startsWith('(') ? path.join(AVATAR_DIR, p.avatar) : null;
  const bannerPath = p.banner ? path.join(PHOTO_BANNER_DIR, p.banner) : null;

  const avatarSrc = avatarPath ? await inlineThumb(avatarPath, 240, 240) : null;
  const bannerSrc = bannerPath ? await inlineThumb(bannerPath, 800, 200, 'cover') : null;

  const extraRows = (p.extras || []).map(e => `
    <tr>
      <td class="extra-label">${e.label}</td>
      <td class="extra-value"><code>${e.value.replace(/\n/g, '<br>')}</code></td>
      <td class="extra-field">${e.field || ''}</td>
    </tr>`).join('');

  sectionsHtml.push(`
<section class="platform" id="${p.key}">
  <div class="platform-head">
    <span class="icon">${p.icon}</span>
    <div>
      <h2>${p.name}</h2>
      <div class="handle">${p.handle}</div>
    </div>
  </div>

  ${p.notes ? `<div class="notes">${p.notes}</div>` : ''}

  <div class="nav-row">
    <div class="nav-label">Navigate to:</div>
    <div class="nav-value"><code>${p.nav}</code></div>
  </div>

  <div class="assets-row">
    ${avatarSrc ? `
    <div class="asset-tile">
      <div class="asset-label">Avatar</div>
      <img class="asset-img" src="${avatarSrc}" alt="avatar">
      <div class="asset-path"><code>${avatarPath}</code></div>
    </div>` : ''}
    ${bannerSrc ? `
    <div class="asset-tile asset-tile-banner">
      <div class="asset-label">Banner</div>
      <img class="asset-img" src="${bannerSrc}" alt="banner">
      <div class="asset-path"><code>${bannerPath}</code></div>
    </div>` : ''}
  </div>

  <div class="bio-block">
    <div class="bio-head">
      <span>Bio text</span>
      <span class="bio-limit">${p.bioLimit}</span>
    </div>
    <pre class="bio-text">${p.bioText.replace(/</g, '&lt;')}</pre>
    <button class="copy-btn" data-text="${p.bioText.replace(/"/g, '&quot;').replace(/\n/g, '\\n')}">Copy bio</button>
  </div>

  ${extraRows ? `
  <details class="extras-detail">
    <summary>Other fields to update (${(p.extras || []).length})</summary>
    <table class="extras">
      <thead><tr><th>Field</th><th>Value to paste</th><th>Where</th></tr></thead>
      <tbody>${extraRows}</tbody>
    </table>
  </details>` : ''}
</section>`);
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ryan Realty — social brand upload checklist</title>
<style>
:root {
  --rr-navy: #102742;
  --rr-navy-deep: #0a1a2e;
  --rr-cream: #faf8f4;
  --rr-sand: #e8e2d4;
  --rr-fir: #2e4a3a;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--rr-cream); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color: var(--rr-navy); line-height: 1.5; }
.container { max-width: 1100px; margin: 0 auto; padding: 48px 32px 80px; }
h1 { font-size: 40px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.02em; }
.subtitle { opacity: 0.7; margin-bottom: 8px; font-size: 16px; }
.locked-summary { background: white; border: 1px solid var(--rr-sand); border-radius: 12px; padding: 24px; margin: 32px 0 48px; }
.locked-summary h3 { font-size: 16px; margin-bottom: 12px; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.05em; }
.locked-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.locked-item { font-size: 14px; }
.locked-item strong { display: block; font-size: 12px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }

.toc { background: white; border: 1px solid var(--rr-sand); border-radius: 12px; padding: 20px 24px; margin-bottom: 32px; }
.toc-h { font-size: 12px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
.toc-list { display: flex; flex-wrap: wrap; gap: 8px; }
.toc-list a { background: var(--rr-sand); padding: 6px 12px; border-radius: 16px; font-size: 13px; text-decoration: none; color: var(--rr-navy); transition: background 200ms; }
.toc-list a:hover { background: var(--rr-navy); color: var(--rr-cream); }

.platform { background: white; border: 1px solid var(--rr-sand); border-radius: 14px; padding: 32px 36px; margin-bottom: 32px; box-shadow: 0 1px 6px rgb(16 39 66 / 0.05); }
.platform-head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid var(--rr-sand); }
.platform-head .icon { font-size: 32px; }
.platform-head h2 { font-size: 26px; font-weight: 700; line-height: 1.1; }
.handle { font-size: 13px; opacity: 0.6; margin-top: 2px; font-family: ui-monospace, monospace; }

.notes { background: #fff8e1; border-left: 3px solid #f0c000; padding: 10px 14px; border-radius: 4px; font-size: 13px; margin-bottom: 18px; }

.nav-row { display: flex; gap: 8px; align-items: center; font-size: 13px; margin-bottom: 18px; }
.nav-label { opacity: 0.55; font-weight: 500; }
.nav-value code { background: var(--rr-cream); padding: 3px 8px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 12px; }

.assets-row { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-bottom: 20px; }
.asset-tile { background: var(--rr-cream); border-radius: 8px; padding: 12px; }
.asset-tile-banner { grid-column: span 1; }
.asset-label { font-size: 11px; font-weight: 600; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.asset-img { width: 100%; height: auto; border-radius: 6px; display: block; }
.asset-path { font-size: 10px; opacity: 0.5; margin-top: 8px; word-break: break-all; }
.asset-path code { font-family: ui-monospace, monospace; }

.bio-block { background: var(--rr-cream); border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; }
.bio-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.bio-head span:first-child { font-size: 11px; font-weight: 600; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; }
.bio-limit { font-size: 11px; opacity: 0.55; font-family: ui-monospace, monospace; }
.bio-text { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; white-space: pre-wrap; font-size: 14px; line-height: 1.55; background: white; padding: 14px; border-radius: 6px; border: 1px solid var(--rr-sand); }
.copy-btn { margin-top: 10px; background: var(--rr-navy); color: var(--rr-cream); border: none; padding: 7px 14px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 200ms; }
.copy-btn:hover { background: var(--rr-navy-deep); }
.copy-btn.copied { background: var(--rr-fir); }

.extras-detail { margin-top: 4px; }
.extras-detail summary { font-size: 13px; cursor: pointer; opacity: 0.7; padding: 6px 0; }
.extras-detail summary:hover { opacity: 1; }
table.extras { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
table.extras th, table.extras td { padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--rr-sand); }
table.extras th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
table.extras td.extra-label { font-weight: 600; width: 22%; }
table.extras td.extra-value { width: 45%; }
table.extras td.extra-value code { font-family: ui-monospace, monospace; font-size: 12px; background: var(--rr-cream); padding: 2px 6px; border-radius: 3px; display: inline-block; }
table.extras td.extra-field { font-size: 12px; opacity: 0.7; }
</style>
</head>
<body>
<div class="container">
  <h1>Social brand upload checklist</h1>
  <p class="subtitle">Locked 2026-05-13. Scroll each platform section, paste the bio + extras into the matching fields, upload the avatar + banner from the listed file paths. Click "Copy bio" to copy without manual selection.</p>

  <div class="locked-summary">
    <h3>Locked decisions</h3>
    <div class="locked-grid">
      <div class="locked-item"><strong>Avatar</strong>Stacked wordmark, navy on cream, centroid-centered, 85% size</div>
      <div class="locked-item"><strong>Banner</strong>F1 frame — iStock-1330945786 Old Mill drone, 3.61s (stock subscription)</div>
      <div class="locked-item"><strong>Phone (bio)</strong>${PHONE} (FUB-tracked brokerage main)</div>
      <div class="locked-item"><strong>Website</strong>${WEBSITE}</div>
      <div class="locked-item"><strong>Bio voice</strong>Option C — current voice preserved (emoji on consumer platforms)</div>
      <div class="locked-item"><strong>Service area</strong>Bend · Redmond · Sisters · Sunriver · Tumalo · La Pine · Prineville</div>
      <div class="locked-item"><strong>Attribution</strong>📷 Beastes35 · Wikimedia CC BY-SA — bottom line of every bio</div>
      <div class="locked-item"><strong>Office</strong>${ADDRESS}</div>
    </div>
  </div>

  <div class="toc">
    <div class="toc-h">Jump to platform</div>
    <div class="toc-list">
      ${PLATFORMS.map(p => `<a href="#${p.key}">${p.icon} ${p.name}</a>`).join('')}
    </div>
  </div>

  ${sectionsHtml.join('')}
</div>

<script>
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const text = btn.dataset.text.replace(/\\\\n/g, '\\n');
    try { await navigator.clipboard.writeText(text); }
    catch (e) { /* clipboard blocked; fallback selectAll */ }
    const orig = btn.innerText;
    btn.innerText = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerText = orig; btn.classList.remove('copied'); }, 1500);
  });
});
</script>
</body>
</html>`;

const out = 'design_system/ryan-realty/assets/social/upload-checklist.html';
fs.writeFileSync(out, html);
console.log(`Wrote ${out}  (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
