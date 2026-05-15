#!/usr/bin/env node
/**
 * render-sold-intro-card.mjs
 *
 * 1080×1920 vertical "JUST SOLD" intro card that gets prepended to a
 * listing video for sold-content reels. Renders a 1-frame PNG; ffmpeg
 * then loops it into a 5-second MP4.
 *
 * Usage:
 *   node scripts/render-sold-intro-card.mjs <payload.json> <output.png>
 *
 * Payload:
 *   {
 *     "eyebrow_top": "JUST SOLD",
 *     "headline": "$3,025,000",
 *     "sub_a": "OFF-MARKET · BOTH SIDES REPRESENTED",
 *     "address": "56111 School House Road",
 *     "subdivision": "Vandevert Ranch"
 *   }
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function dataUri(absPath) {
  const ext = absPath.split('.').pop().toLowerCase();
  const mime = { jpg: 'image/jpeg', png: 'image/png', otf: 'font/otf', ttf: 'font/ttf' }[ext] || 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(absPath).toString('base64')}`;
}

const NAVY = '#102742';
const CREAM = '#faf8f4';

async function render(payload, outputPath) {
  const { eyebrow_top, headline, sub_a, address, subdivision } = payload;
  const logoAbs = resolve(REPO_ROOT, 'design_system/ryan-realty/assets/brand/logo-blue.png');
  const amboqiaAbs = resolve(REPO_ROOT, 'design_system/ryan-realty/fonts/Amboqia_Boriango.otf');
  const azoAbs = resolve(REPO_ROOT, 'design_system/ryan-realty/fonts/AzoSans-Medium.ttf');

  const logoDU = dataUri(logoAbs);
  const amboqiaDU = dataUri(amboqiaAbs);
  const azoDU = dataUri(azoAbs);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Amboqia Boriango'; src: url('${amboqiaDU}') format('opentype'); }
@font-face { font-family: 'Azo Sans'; src: url('${azoDU}') format('truetype'); font-weight: 500; }
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { width: 1080px; height: 1920px; background: ${CREAM}; position: relative; }

.eyebrow-top {
  position: absolute;
  top: 720px;
  left: 0; right: 0;
  text-align: center;
  font-family: 'Azo Sans', system-ui, sans-serif;
  font-size: 32px;
  font-weight: 500;
  color: ${NAVY};
  text-transform: uppercase;
  letter-spacing: 0.40em;
  padding-left: 0.40em;
}

.headline {
  position: absolute;
  top: 800px;
  left: 0; right: 0;
  text-align: center;
  font-family: 'Amboqia Boriango', Georgia, serif;
  font-size: 180px;
  color: ${NAVY};
  font-variant-numeric: tabular-nums;
  line-height: 1.0;
}

.sub-a {
  position: absolute;
  top: 1080px;
  left: 0; right: 0;
  text-align: center;
  font-family: 'Azo Sans', system-ui, sans-serif;
  font-size: 22px;
  font-weight: 500;
  color: ${NAVY};
  text-transform: uppercase;
  letter-spacing: 0.32em;
  padding-left: 0.32em;
}

.divider {
  position: absolute;
  top: 1170px;
  left: 50%; transform: translateX(-50%);
  width: 80px;
  height: 1px;
  background: ${NAVY};
  opacity: 0.30;
}

.address {
  position: absolute;
  top: 1210px;
  left: 0; right: 0;
  text-align: center;
  font-family: 'Amboqia Boriango', Georgia, serif;
  font-size: 56px;
  color: ${NAVY};
  line-height: 1.10;
}

.subdivision {
  position: absolute;
  top: 1285px;
  left: 0; right: 0;
  text-align: center;
  font-family: 'Geist', sans-serif;
  font-size: 22px;
  font-weight: 400;
  color: ${NAVY};
  opacity: 0.65;
  letter-spacing: 0.04em;
}

.logo-bottom {
  position: absolute;
  bottom: 200px;
  left: 50%; transform: translateX(-50%);
}
.logo-bottom img {
  width: 360px;
  height: auto;
}
</style></head>
<body>
  <div class="eyebrow-top">${eyebrow_top}</div>
  <div class="headline">${headline}</div>
  <div class="sub-a">${sub_a}</div>
  <div class="divider"></div>
  <div class="address">${address}</div>
  <div class="subdivision">${subdivision}</div>
  <div class="logo-bottom"><img src="${logoDU}" alt=""></div>
</body></html>`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: outputPath, fullPage: false });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const payloadPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!payloadPath || !outputPath) {
    console.error('usage: node render-sold-intro-card.mjs <payload.json> <output.png>');
    process.exit(1);
  }
  const payload = JSON.parse(readFileSync(payloadPath, 'utf-8'));
  render(payload, outputPath).then(() => console.log(`Wrote ${outputPath}`)).catch(err => {
    console.error('Failed:', err.message);
    process.exit(2);
  });
}

export { render };
