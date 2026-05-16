#!/usr/bin/env node
/**
 * Patch 3 — F6 final fix: shorter photo, illustration gets full breathing room
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/flyers';
const MIRROR_DIR = '/Users/matthewryan/RyanRealty/public/template-picker/list-kits/19496-tumalo-reservoir/flyers';

function b64(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = { png: 'image/png', otf: 'font/otf', ttf: 'font/ttf' }[ext] || 'image/png';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

const A = {
  amboqia:  b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/fonts/Amboqia_Boriango.otf'),
  azosans:  b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/fonts/AzoSans-Medium.ttf'),
  logoWhite:b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/logo-white.png'),
  illus05:  b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/illustration-05.png'),
};

const DUSK2 = 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035353837808000000-o.jpg';

// F6: photo 300px, cream heritage panel 890px, navy footer 160px = 1350 total
// Illustration at 500px wide — finally gets room to breathe
function F6html(a) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    @font-face { font-family: 'Amboqia'; src: url('${a.amboqia}') format('opentype'); }
    @font-face { font-family: 'AzoSans'; src: url('${a.azosans}') format('truetype'); font-weight: 500; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1350px; overflow: hidden; -webkit-font-smoothing: antialiased; }

    .frame { width: 1080px; height: 1350px; display: flex; flex-direction: column; background: #faf8f4; overflow: hidden; }

    /* Full-bleed photo top — 300px */
    .photo {
      height: 300px; flex-shrink: 0; position: relative;
      background: url('${DUSK2}') center 40% / cover no-repeat;
    }
    /* Scrim bottom of photo → blends into cream */
    .photo::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 80px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    /* Logo on photo */
    .photo-logo {
      position: absolute; top: 24px; left: 40px;
      background: rgba(250,248,244,0.88); padding: 8px 16px; border-radius: 3px;
    }
    .photo-logo img { height: 30px; display: block; }
    .photo-tag {
      position: absolute; top: 24px; right: 40px;
      font-family: 'AzoSans', sans-serif; font-size: 11px; letter-spacing: 0.18em;
      color: rgba(250,248,244,0.7); text-transform: uppercase;
    }

    /* Heritage cream — 890px */
    .heritage {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; text-align: center;
      padding: 40px 80px 24px; position: relative;
    }

    /* Thin border frame inside heritage area — classic letterhead feel */
    .heritage::before {
      content: ''; position: absolute;
      top: 20px; left: 40px; right: 40px; bottom: 16px;
      border: 1px solid rgba(16,39,66,0.09); pointer-events: none;
    }

    .lockup { width: 500px; margin-bottom: 32px; position: relative; z-index: 1; }

    .divider { width: 72px; height: 1px; background: rgba(16,39,66,0.16); margin: 0 auto 28px; }

    .place-line {
      font-family: 'AzoSans', sans-serif; font-size: 12px; letter-spacing: 0.22em;
      color: rgba(16,39,66,0.38); text-transform: uppercase; margin-bottom: 16px;
    }

    .property-address {
      font-family: 'Amboqia', serif; font-size: 72px; line-height: 0.93; letter-spacing: -0.01em;
      color: #102742; margin-bottom: 28px;
    }

    .spec-line {
      font-family: 'AzoSans', sans-serif; font-size: 13px; letter-spacing: 0.15em;
      color: rgba(16,39,66,0.50); text-transform: uppercase; margin-bottom: 24px;
    }

    .narrative {
      font-family: 'Geist', sans-serif; font-size: 17px; line-height: 1.65;
      color: rgba(16,39,66,0.65); max-width: 660px;
    }

    /* Navy footer — 160px */
    .footer {
      height: 160px; background: #102742; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 56px;
    }
    .price { font-family: 'Amboqia', serif; font-size: 54px; color: #faf8f4; letter-spacing: -0.01em; }
    .contact-block { text-align: right; }
    .contact-name {
      font-family: 'Geist', sans-serif; font-weight: 600; font-size: 16px; color: #faf8f4;
      margin-bottom: 6px;
    }
    .contact-info {
      font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(250,248,244,0.52);
    }
  </style></head><body>
  <div class="frame">
    <div class="photo">
      <div class="photo-logo"><img src="${a.logoWhite}" alt="Ryan Realty"></div>
      <div class="photo-tag">Tumalo, Oregon &nbsp;·&nbsp; Active</div>
    </div>
    <div class="heritage">
      <img class="lockup" src="${a.illus05}" alt="Ryan Realty Heritage Lockup">
      <div class="divider"></div>
      <div class="place-line">Tumalo &nbsp;·&nbsp; Central Oregon &nbsp;·&nbsp; 2.28 Acres</div>
      <div class="property-address">19496 Tumalo<br>Reservoir Rd</div>
      <div class="spec-line">3 Bedrooms &nbsp;&middot;&nbsp; 3 Baths &nbsp;&middot;&nbsp; 2,325 SQFT</div>
      <div class="narrative">Three Sisters Cascade views from nearly every room. A creek runs through 2.28 acres of mature timber. Heated 3-car garage. Twelve minutes to downtown Bend.</div>
    </div>
    <div class="footer">
      <div class="price">$1,225,000</div>
      <div class="contact-block">
        <div class="contact-name">Matt Ryan &nbsp;&middot;&nbsp; Principal Broker</div>
        <div class="contact-info">541.213.6706 &nbsp;&middot;&nbsp; ryan-realty.com</div>
      </div>
    </div>
  </div></body></html>`;
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1350 });
  await page.setContent(F6html(A), { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => Promise.all(
    Array.from(document.images).filter(i => !i.complete)
      .map(i => new Promise(r => { i.onload = i.onerror = r; }))
  ));
  await page.waitForTimeout(400);

  const outPath = path.join(OUT_DIR, 'F6-farmstead-postcard.png');
  await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await page.close();
  await browser.close();

  const size = fs.statSync(outPath).size;
  console.log(`F6-farmstead-postcard.png: ${(size/1024).toFixed(0)} KB`);
  fs.copyFileSync(outPath, path.join(MIRROR_DIR, 'F6-farmstead-postcard.png'));
  console.log('Mirrored. Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
