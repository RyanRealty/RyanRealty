#!/usr/bin/env node
/**
 * render-ig-carousel-slide.mjs
 *
 * Pattern A — composite a photo + persistent navy footer band onto a single
 * 1080×1350 carousel slide. The photo is the slide; the footer is the only chrome.
 *
 * Usage:
 *   node scripts/render-ig-carousel-slide.mjs <input-photo.jpg> <slide-index> <total-slides> <output.png>
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function dataUri(absPath) {
  const ext = absPath.split('.').pop().toLowerCase();
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', otf: 'font/otf', ttf: 'font/ttf' }[ext] || 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(absPath).toString('base64')}`;
}

async function render({ photoPath, slideIndex, totalSlides, outputPath }) {
  const photoAbs = resolve(REPO_ROOT, photoPath);
  const logoAbs = resolve(REPO_ROOT, 'design_system/ryan-realty/assets/brand/logo-white.png');
  if (!existsSync(photoAbs)) throw new Error(`photo not found: ${photoAbs}`);

  const photoDU = dataUri(photoAbs);
  const logoDU = dataUri(logoAbs);

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1080px; height: 1350px; position: relative; overflow: hidden; background: #000; }
.photo {
  position: absolute; inset: 0;
  background-image: url('${photoDU}');
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
}
.footer {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 120px;
  background: rgba(16,39,66,0.94);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 40px;
}
.footer img { height: 44px; }
.slide-num {
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 18px;
  font-weight: 500;
  color: #faf8f4;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
</style></head>
<body>
  <div class="photo"></div>
  <div class="footer">
    <img src="${logoDU}" alt="">
    <span class="slide-num">${slideIndex} / ${totalSlides}</span>
  </div>
</body></html>`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: outputPath, fullPage: false });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [photoPath, slideIndex, totalSlides, outputPath] = process.argv.slice(2);
  if (!photoPath || !slideIndex || !totalSlides || !outputPath) {
    console.error('usage: node render-ig-carousel-slide.mjs <photo> <slide-index> <total-slides> <output>');
    process.exit(1);
  }
  render({
    photoPath,
    slideIndex: parseInt(slideIndex, 10),
    totalSlides: parseInt(totalSlides, 10),
    outputPath,
  }).then(() => console.log(`Wrote ${outputPath}`)).catch(err => {
    console.error('Failed:', err.message);
    process.exit(2);
  });
}

export { render };
