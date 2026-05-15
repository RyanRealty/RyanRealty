#!/usr/bin/env node
/**
 * render-ig-post.mjs
 *
 * Static 1080×1350 IG post compositor for the ig-single-post producer.
 * Renders S1 (Just Listed), S2 (Just Sold), S3 (Open House), S6 (Featured)
 * variants from a JSON payload. Uses Playwright Chromium for HTML→PNG.
 *
 * Brand assets:
 *   - Fonts: design_system/ryan-realty/fonts/Amboqia_Boriango.otf, AzoSans-Medium.ttf
 *   - Geist: via CDN (Google Fonts) at render time
 *   - Logos: design_system/ryan-realty/assets/brand/logo-white.png (footer reversed)
 *   - Headshots: design_system/ryan-realty/assets/team/{matt-ryan,paul-stevenson,rebecca-peterson}.png
 *
 * Usage:
 *   node scripts/render-ig-post.mjs <payload.json> <output.png>
 *
 * Payload shape: see PAYLOAD_SCHEMA below.
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function dataUri(absPath) {
  const ext = extname(absPath).toLowerCase().slice(1);
  const mimeByExt = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif',
    otf: 'font/otf', ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2',
  };
  const mime = mimeByExt[ext] || 'application/octet-stream';
  const b64 = readFileSync(absPath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

// PAYLOAD_SCHEMA = {
//   template: 'S1' | 'S2' | 'S3' | 'S6',
//   eyebrow: string,        // 'JUST SOLD · BEND, OREGON'
//   address_line: string,   // '20702 Beaumont Dr'
//   editorial_subhead?: string,  // S6 only
//   primary_value: string,  // '$3,025,000' (S1/S2/S6) or '11:00 AM – 1:00 PM' (S3)
//   secondary_line?: string,  // varies by template
//   tertiary_line?: string,   // varies
//   hero_photo_path: string,
//   broker_slug: 'matt-ryan' | 'paul-stevenson' | 'rebecca-peterson',
//   broker_name: string,    // 'Matt Ryan'
//   broker_role: string,    // 'Principal Broker'
// }

const TEMPLATE_DEFAULTS = {
  S1: { primary_label: 'List Price' },
  S2: { primary_label: 'Sale Price' },
  S3: { primary_label: 'Open House' },
  S6: { primary_label: 'Featured' },
};

const NAVY = '#102742';
const CREAM = '#faf8f4';
const PHONE = '541.213.6706';
const WEB = 'ryan-realty.com';

function buildHtml(payload) {
  const {
    template,
    eyebrow,
    address_line,
    editorial_subhead,
    primary_value,
    secondary_line,
    tertiary_line,
    hero_photo_path,
    broker_slug,
    broker_name,
    broker_role,
  } = payload;

  // Resolve absolute paths so file:// URLs work
  const heroAbs = resolve(REPO_ROOT, hero_photo_path);
  const logoAbs = resolve(REPO_ROOT, 'design_system/ryan-realty/assets/brand/logo-white.png');
  const headshotAbs = resolve(REPO_ROOT, `design_system/ryan-realty/assets/team/${broker_slug}.png`);
  const amboqiaAbs = resolve(REPO_ROOT, 'design_system/ryan-realty/fonts/Amboqia_Boriango.otf');
  const azoAbs = resolve(REPO_ROOT, 'design_system/ryan-realty/fonts/AzoSans-Medium.ttf');

  if (!existsSync(heroAbs)) throw new Error(`hero photo not found: ${heroAbs}`);
  if (!existsSync(logoAbs)) throw new Error(`logo not found: ${logoAbs}`);
  if (!existsSync(headshotAbs)) throw new Error(`broker headshot not found: ${headshotAbs}`);
  if (!existsSync(amboqiaAbs)) throw new Error(`Amboqia not found: ${amboqiaAbs}`);
  if (!existsSync(azoAbs)) throw new Error(`Azo Sans not found: ${azoAbs}`);

  const heroDU = dataUri(heroAbs);
  const logoDU = dataUri(logoAbs);
  const headshotDU = dataUri(headshotAbs);
  const amboqiaDU = dataUri(amboqiaAbs);
  const azoDU = dataUri(azoAbs);

  const editorialHeadline = template === 'S6' && editorial_subhead
    ? `<div class="editorial">${escapeHtml(editorial_subhead)}</div>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face {
  font-family: 'Amboqia Boriango';
  src: url('${amboqiaDU}') format('opentype');
}
@font-face {
  font-family: 'Azo Sans';
  src: url('${azoDU}') format('truetype');
  font-weight: 500;
}
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');

* { margin:0; padding:0; box-sizing:border-box; }

body {
  width: 1080px;
  height: 1350px;
  background: ${CREAM};
  font-family: 'Geist', system-ui, sans-serif;
  position: relative;
  overflow: hidden;
}

/* Eyebrow — Azo Sans Medium UPPERCASE */
.eyebrow {
  position: absolute;
  top: 80px;
  left: 54px;
  font-family: 'Azo Sans', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: ${NAVY};
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

/* Hero photo block: 600px tall, 972px wide, 14px corner radius */
.hero {
  position: absolute;
  top: 130px;
  left: 54px;
  width: 972px;
  height: 600px;
  border-radius: 14px;
  overflow: hidden;
  background: #ddd;
}
.hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.10);
}

/* Address — Amboqia Boriango 56px navy */
.address {
  position: absolute;
  top: 770px;
  left: 54px;
  font-family: 'Amboqia Boriango', Georgia, serif;
  font-size: 56px;
  color: ${NAVY};
  line-height: 1.05;
  max-width: 972px;
}

/* Editorial subhead (S6) — replaces the address visual position */
.editorial {
  position: absolute;
  top: 770px;
  left: 54px;
  right: 54px;
  font-family: 'Amboqia Boriango', Georgia, serif;
  font-size: 48px;
  color: ${NAVY};
  line-height: 1.10;
  max-width: 972px;
}

/* Primary value: $price (Amboqia 72px) OR S3 time (Geist 500 32px) */
.primary {
  position: absolute;
  top: 850px;
  left: 54px;
  font-family: 'Amboqia Boriango', Georgia, serif;
  font-size: 72px;
  color: ${NAVY};
  font-variant-numeric: tabular-nums;
  line-height: 1.0;
}
.primary.s3 {
  font-family: 'Geist', sans-serif;
  font-size: 32px;
  font-weight: 500;
  top: 800px;
}

/* Secondary line: Geist 500 22-28px */
.secondary {
  position: absolute;
  top: 940px;
  left: 54px;
  font-family: 'Geist', sans-serif;
  font-size: 20px;
  font-weight: 500;
  color: ${NAVY};
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
.secondary.s3 {
  top: 870px;
}

/* Tertiary line: small data subline */
.tertiary {
  position: absolute;
  top: 970px;
  left: 54px;
  font-family: 'Geist', sans-serif;
  font-size: 16px;
  font-weight: 400;
  color: ${NAVY};
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}
.tertiary.s3 {
  top: 905px;
}

/* Broker block bottom-left */
.broker {
  position: absolute;
  bottom: 200px;
  left: 54px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.broker .head {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background-color: ${CREAM};
  background-image: url('${headshotDU}');
  background-size: 200% auto;
  background-position: 50% 12%;
  background-repeat: no-repeat;
  flex-shrink: 0;
  border: 2px solid rgba(16,39,66,0.08);
}
.broker .info {
  display: flex;
  flex-direction: column;
}
.broker .name {
  font-family: 'Geist', sans-serif;
  font-size: 18px;
  font-weight: 500;
  color: ${NAVY};
  line-height: 1.2;
}
.broker .role {
  font-family: 'Geist', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: ${NAVY};
  opacity: 0.65;
  letter-spacing: 0.02em;
}

/* Footer band — navy 0.94, 180px tall, y=1170-1350 */
.footer {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 1080px;
  height: 180px;
  background: rgba(16,39,66,0.94);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
}
.footer .logo {
  height: 64px;
}
.footer .contact {
  font-family: 'Geist', sans-serif;
  font-size: 18px;
  font-weight: 400;
  color: ${CREAM};
  text-align: right;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}

</style></head>
<body>
  <div class="eyebrow">${escapeHtml(eyebrow)}</div>

  <div class="hero">
    <img src="${heroDU}" alt="">
  </div>

  ${editorialHeadline || `<div class="address">${escapeHtml(address_line)}</div>`}

  <div class="primary ${template === 'S3' ? 's3' : ''}">${escapeHtml(primary_value)}</div>

  ${secondary_line ? `<div class="secondary ${template === 'S3' ? 's3' : ''}">${escapeHtml(secondary_line)}</div>` : ''}

  ${tertiary_line ? `<div class="tertiary ${template === 'S3' ? 's3' : ''}">${escapeHtml(tertiary_line)}</div>` : ''}

  <div class="broker">
    <div class="head"></div>
    <div class="info">
      <div class="name">${escapeHtml(broker_name)}</div>
      <div class="role">${escapeHtml(broker_role)}</div>
    </div>
  </div>

  <div class="footer">
    <img class="logo" src="${logoDU}" alt="">
    <div class="contact">
      ${PHONE}<br>${WEB}
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function render(payload, outputPath) {
  const html = buildHtml(payload);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    // wait extra for font/image loading
    await page.waitForTimeout(800);
    await page.screenshot({ path: outputPath, fullPage: false, omitBackground: false });
  } finally {
    await browser.close();
  }
}

// CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const payloadPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!payloadPath || !outputPath) {
    console.error('usage: node render-ig-post.mjs <payload.json> <output.png>');
    process.exit(1);
  }
  const payload = JSON.parse(readFileSync(payloadPath, 'utf-8'));
  render(payload, outputPath).then(() => {
    console.log(`Wrote ${outputPath}`);
  }).catch(err => {
    console.error('Render failed:', err.message);
    process.exit(2);
  });
}

export { render, buildHtml };
