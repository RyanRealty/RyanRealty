#!/usr/bin/env node
/**
 * Patch 2 — F6 and F7 fixes only
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/flyers';
const MIRROR_DIR = '/Users/matthewryan/RyanRealty/public/template-picker/list-kits/19496-tumalo-reservoir/flyers';

function b64(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', otf: 'font/otf', ttf: 'font/ttf' }[ext];
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

const A = {
  amboqia: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/fonts/Amboqia_Boriango.otf'),
  azosans: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/fonts/AzoSans-Medium.ttf'),
  logoBlue: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/logo-blue.png'),
  logoWhite: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/logo-white.png'),
  illus05: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/illustration-05.png'),
};

const P = {
  HERO: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175825195222000000-o.jpg',
  DUSK_2: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035353837808000000-o.jpg',
};

function base(a) {
  return `
    @font-face { font-family: 'Amboqia'; src: url('${a.amboqia}') format('opentype'); }
    @font-face { font-family: 'AzoSans'; src: url('${a.azosans}') format('truetype'); font-weight: 500; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1350px; overflow: hidden; background: #faf8f4; -webkit-font-smoothing: antialiased; }
  `;
}

// F6: Heritage Postcard — photo 420px, cream panel gets 720px, navy footer 130px
// Key fix: reduce photo height, give illustration more room
function F6(a, p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${base(a)}
    .frame {
      position: relative; width: 1080px; height: 1350px;
      background: #faf8f4; display: flex; flex-direction: column; overflow: hidden;
    }
    /* Tight nav */
    .nav {
      height: 72px; background: #102742; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between; padding: 0 52px;
    }
    .nav img { height: 34px; }
    .nav-tag { font-family: 'AzoSans', sans-serif; font-size: 11px; letter-spacing: 0.18em; color: rgba(250,248,244,0.48); text-transform: uppercase; }
    /* Photo — 390px only */
    .photo-band {
      height: 390px; flex-shrink: 0; position: relative;
      background: url('${p.DUSK_2}') center 45% / cover no-repeat;
    }
    .photo-band::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 120px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    /* Heritage cream — gets the bulk of the space */
    .heritage {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      text-align: center; padding: 24px 72px 0;
    }
    .lockup { width: 460px; margin-bottom: 28px; }
    .rule { width: 56px; height: 1px; background: rgba(16,39,66,0.16); margin: 0 auto 22px; }
    .location {
      font-family: 'AzoSans', sans-serif; font-size: 11px; letter-spacing: 0.22em;
      color: rgba(16,39,66,0.38); text-transform: uppercase; margin-bottom: 12px;
    }
    .address {
      font-family: 'Amboqia', serif; font-size: 68px; line-height: 0.94; letter-spacing: -0.01em;
      color: #102742; margin-bottom: 20px;
    }
    .specs {
      font-family: 'AzoSans', sans-serif; font-size: 13px; letter-spacing: 0.14em;
      color: rgba(16,39,66,0.50); text-transform: uppercase;
    }
    /* Navy footer */
    .footer {
      height: 130px; background: #102742; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between; padding: 0 52px;
    }
    .price { font-family: 'Amboqia', serif; font-size: 50px; color: #faf8f4; letter-spacing: -0.01em; }
    .contact { font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(250,248,244,0.52); text-align: right; }
  </style></head><body>
  <div class="frame">
    <div class="nav">
      <img src="${a.logoWhite}" alt="Ryan Realty">
      <div class="nav-tag">Tumalo, Oregon &nbsp;·&nbsp; Active</div>
    </div>
    <div class="photo-band"></div>
    <div class="heritage">
      <img class="lockup" src="${a.illus05}" alt="Ryan Realty Heritage Lockup">
      <div class="rule"></div>
      <div class="location">Tumalo &nbsp;·&nbsp; Central Oregon</div>
      <div class="address">19496 Tumalo<br>Reservoir Rd</div>
      <div class="specs">3 Bedrooms &nbsp;·&nbsp; 3 Baths &nbsp;·&nbsp; 2,325 SQFT &nbsp;·&nbsp; 2.28 Acres</div>
    </div>
    <div class="footer">
      <div class="price">$1,225,000</div>
      <div class="contact">Matt Ryan &nbsp;·&nbsp; Principal Broker<br>541.213.6706 &nbsp;·&nbsp; ryan-realty.com</div>
    </div>
  </div></body></html>`;
}

// F7: Price Drop — single logo top-left badge, no second logo at bottom
function F7(a, p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${base(a)}
    .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #faf8f4; }
    .hero-photo {
      position: absolute; top: 0; left: 0; right: 0; height: 660px;
      background: url('${p.HERO}') center 40% / cover no-repeat;
    }
    .hero-photo::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 200px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    /* Logo — cream badge top-left */
    .logo-badge {
      position: absolute; top: 40px; left: 52px; z-index: 10;
      background: rgba(250,248,244,0.93); padding: 10px 18px; border-radius: 3px;
    }
    .logo-badge img { width: 150px; display: block; }
    /* "Price Adjusted" badge top-right */
    .price-badge {
      position: absolute; top: 40px; right: 52px; z-index: 10;
      background: #102742; padding: 12px 22px; border-radius: 3px;
      font-family: 'AzoSans', sans-serif; font-size: 12px; letter-spacing: 0.18em;
      color: rgba(250,248,244,0.8); text-transform: uppercase;
    }
    /* Content block — overlaps the photo/cream transition */
    .content { position: absolute; top: 560px; left: 56px; right: 56px; }
    .eyebrow {
      font-family: 'AzoSans', sans-serif; font-size: 12px; letter-spacing: 0.18em;
      color: rgba(16,39,66,0.44); text-transform: uppercase; margin-bottom: 16px;
    }
    .old-price {
      font-family: 'Amboqia', serif; font-size: 52px; color: rgba(16,39,66,0.28);
      letter-spacing: -0.01em; text-decoration: line-through; display: block; margin-bottom: 2px;
    }
    .new-price {
      font-family: 'Amboqia', serif; font-size: 104px; line-height: 0.90; letter-spacing: -0.02em;
      color: #102742; margin-bottom: 28px; display: block;
    }
    .rule { height: 1px; background: rgba(16,39,66,0.10); margin-bottom: 24px; }
    .address {
      font-family: 'Amboqia', serif; font-size: 40px; color: #102742;
      letter-spacing: -0.01em; margin-bottom: 10px;
    }
    .specs {
      font-family: 'AzoSans', sans-serif; font-size: 13px; letter-spacing: 0.12em;
      color: rgba(16,39,66,0.50); text-transform: uppercase; margin-bottom: 28px;
    }
    .copy {
      font-family: 'Geist', sans-serif; font-size: 18px; line-height: 1.55;
      color: rgba(16,39,66,0.68); margin-bottom: 52px;
    }
    .agent-footer {
      border-top: 1px solid rgba(16,39,66,0.10); padding-top: 20px;
      font-family: 'Geist', sans-serif; font-size: 15px; color: rgba(16,39,66,0.55);
    }
    .agent-footer strong { color: #102742; font-weight: 600; }
  </style></head><body>
  <div class="frame">
    <div class="hero-photo"></div>
    <div class="logo-badge"><img src="${a.logoBlue}" alt="Ryan Realty"></div>
    <div class="price-badge">Price Adjusted</div>
    <div class="content">
      <div class="eyebrow">Tumalo, Oregon &nbsp;·&nbsp; Newly Priced</div>
      <span class="old-price">$1,295,000</span>
      <span class="new-price">$1,225,000</span>
      <div class="rule"></div>
      <div class="address">19496 Tumalo Reservoir Rd</div>
      <div class="specs">3 BD &nbsp;·&nbsp; 3 BA &nbsp;·&nbsp; 2,325 SQFT &nbsp;·&nbsp; 2.28 Acres</div>
      <div class="copy">Creek on the property. Three Sisters views. 12 minutes to downtown Bend. This is the price to move it.</div>
      <div class="agent-footer"><strong>Matt Ryan</strong> &nbsp;·&nbsp; 541.213.6706 &nbsp;·&nbsp; ryan-realty.com</div>
    </div>
  </div></body></html>`;
}

async function renderFlyer(browser, html, filename) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1350 });
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => Promise.all(
    Array.from(document.images).filter(i => !i.complete)
      .map(i => new Promise(r => { i.onload = i.onerror = r; }))
  ));
  await page.waitForTimeout(400);
  const outPath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await page.close();
  const size = fs.statSync(outPath).size;
  console.log(`  ${filename}: ${(size / 1024).toFixed(0)} KB`);
  return outPath;
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const patch = [
    { name: 'F6-farmstead-postcard.png', html: F6(A, P) },
    { name: 'F7-price-drop.png',         html: F7(A, P) },
  ];
  const rendered = [];
  for (const f of patch) {
    console.log(`Rendering ${f.name}...`);
    try { rendered.push(await renderFlyer(browser, f.html, f.name)); }
    catch (e) { console.error(`  ERROR: ${e.message}`); }
  }
  await browser.close();
  for (const src of rendered) {
    fs.copyFileSync(src, path.join(MIRROR_DIR, path.basename(src)));
    console.log(`  Mirrored ${path.basename(src)}`);
  }
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
