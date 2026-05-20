#!/usr/bin/env node
/**
 * Tumalo Reservoir Flyer Renderer — v2 (research-backed redesign)
 * Renders all 10 flyers at 1080x1350 (IG portrait 4:5)
 * Uses Playwright with deviceScaleFactor 2 for crisp output
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/flyers';
const MIRROR_DIR = '/Users/matthewryan/RyanRealty/public/template-picker/list-kits/19496-tumalo-reservoir/flyers';

// ─── ASSET BASE64 ENCODING ───────────────────────────────────────────────────
function b64(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', otf: 'font/otf', ttf: 'font/ttf' }[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${data}`;
}

const ASSETS = {
  amboqia: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/fonts/Amboqia_Boriango.otf'),
  azosans: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/fonts/AzoSans-Medium.ttf'),
  logoBlue: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/logo-blue.png'),
  logoWhite: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/logo-white.png'),
  matt: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/team/matt-ryan.png'),
  illus05: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/illustration-05.png'),
  qr: b64('/Users/matthewryan/RyanRealty/design_system/ryan-realty/assets/brand/qr-code.png'),
};

// Property photos (remote URLs — Playwright fetches them)
const PHOTOS = {
  HERO:        'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175825195222000000-o.jpg',
  AERIAL_1:    'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175719779563000000-o.jpg',
  AERIAL_2:    'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175720531554000000-o.jpg',
  AERIAL_3:    'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175723357841000000-o.jpg',
  DUSK_1:      'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035352655634000000-o.jpg',
  DUSK_2:      'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035353837808000000-o.jpg',
  DUSK_3:      'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035354882604000000-o.jpg',
  LIVING:      'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175725529629000000-o.jpg',
  KITCHEN:     'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175728975287000000-o.jpg',
  PRIMARY_BR:  'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175741090616000000-o.jpg',
  PRIMARY_BATH:'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175741900992000000-o.jpg',
  GROUNDS_1:   'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175744600559000000-o.jpg',
  GROUNDS_2:   'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175746136817000000-o.jpg',
};

// ─── SHARED CSS / FONT INJECTION ──────────────────────────────────────────────
function baseCss(assets) {
  return `
    @font-face {
      font-family: 'Amboqia';
      src: url('${assets.amboqia}') format('opentype');
      font-weight: normal;
      font-style: normal;
    }
    @font-face {
      font-family: 'AzoSans';
      src: url('${assets.azosans}') format('truetype');
      font-weight: 500;
      font-style: normal;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px;
      height: 1350px;
      overflow: hidden;
      background: #faf8f4;
      font-family: 'Geist', 'Inter', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  `;
}

// ─── FLYER DEFINITIONS ────────────────────────────────────────────────────────

function F1_MuseumWall(assets, photos) {
  // Full-bleed hero. Address quiet at bottom on cream strip. Maximum negative space.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame {
      position: relative; width: 1080px; height: 1350px; overflow: hidden;
      background: #102742;
    }
    .hero-photo {
      position: absolute; top: 0; left: 0; right: 0; bottom: 210px;
      background: url('${photos.HERO}') center center / cover no-repeat;
    }
    .bottom-strip {
      position: absolute; bottom: 0; left: 0; right: 0; height: 210px;
      background: #faf8f4;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 56px;
    }
    .address-block {}
    .eyebrow {
      font-family: 'AzoSans', sans-serif;
      font-size: 14px; letter-spacing: 0.16em;
      color: #102742; opacity: 0.55;
      text-transform: uppercase; margin-bottom: 10px;
    }
    .address {
      font-family: 'Amboqia', serif;
      font-size: 46px; line-height: 1.05;
      color: #102742; letter-spacing: -0.01em;
    }
    .divider-v {
      width: 1px; height: 80px; background: rgba(16,39,66,0.15);
    }
    .price-block { text-align: right; }
    .price {
      font-family: 'Amboqia', serif;
      font-size: 42px; color: #102742; letter-spacing: -0.01em;
    }
    .specs {
      font-family: 'AzoSans', sans-serif;
      font-size: 13px; letter-spacing: 0.10em;
      color: #102742; opacity: 0.65;
      text-transform: uppercase; margin-top: 10px;
    }
    .logo-badge {
      position: absolute; top: 40px; right: 48px;
      background: rgba(250,248,244,0.92);
      padding: 12px 20px; border-radius: 4px;
    }
    .logo-badge img { width: 180px; display: block; }
    /* Top-left brand attribution — logo-blue on semi-transparent cream pill */
    .logo-top-left {
      position: absolute; top: 60px; left: 60px;
      background: rgba(250,248,244,0.92);
      padding: 12px 20px; border-radius: 4px;
      z-index: 10;
    }
    .logo-top-left img { width: 200px; display: block; }
    .coord {
      position: absolute; bottom: 220px; left: 56px;
      font-family: 'AzoSans', sans-serif;
      font-size: 11px; letter-spacing: 0.14em;
      color: rgba(250,248,244,0.5); text-transform: uppercase;
    }
  </style></head>
  <body>
  <div class="frame">
    <div class="hero-photo"></div>
    <div class="logo-top-left"><img src="${assets.logoBlue}" alt="Ryan Realty"></div>
    <div class="logo-badge"><img src="${assets.logoBlue}" alt="Ryan Realty"></div>
    <div class="coord">44.0891° N · 121.3421° W</div>
    <div class="bottom-strip">
      <div class="address-block">
        <div class="eyebrow">Tumalo, Oregon</div>
        <div class="address">19496 Tumalo<br>Reservoir Rd</div>
      </div>
      <div class="divider-v"></div>
      <div class="price-block">
        <div class="price">$1,225,000</div>
        <div class="specs">3 BD &nbsp;·&nbsp; 3 BA &nbsp;·&nbsp; 2,325 SQFT</div>
      </div>
    </div>
  </div>
  </body></html>`;
}

function F2_BroadsheetStrip(assets, photos) {
  // Editorial / newspaper. Full-bleed photo top 58%, strong headline below on cream.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame { position: relative; width: 1080px; height: 1350px; background: #faf8f4; overflow: hidden; display: flex; flex-direction: column; }
    .photo-zone {
      height: 680px; flex-shrink: 0; position: relative;
      background: url('${photos.AERIAL_1}') center 35% / cover no-repeat;
    }
    /* Masthead overlay on top of photo */
    .masthead {
      position: absolute; top: 0; left: 0; right: 0;
      height: 80px; background: rgba(16,39,66,0.88);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 52px; z-index: 2;
    }
    .masthead img { height: 40px; }
    .masthead-right {
      font-family: 'AzoSans', sans-serif;
      font-size: 11px; letter-spacing: 0.16em;
      color: rgba(250,248,244,0.55); text-transform: uppercase; text-align: right;
    }
    /* Bottom fade */
    .photo-zone::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 160px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    /* Content panel */
    .content-area { flex: 1; padding: 32px 56px 44px; display: flex; flex-direction: column; }
    .issue-line {
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.18em;
      color: rgba(16,39,66,0.42); text-transform: uppercase;
      margin-bottom: 18px;
    }
    .headline {
      font-family: 'Amboqia', serif;
      font-size: 88px; line-height: 0.93; letter-spacing: -0.02em;
      color: #102742; margin-bottom: 24px;
    }
    .rule { height: 1px; background: rgba(16,39,66,0.12); margin-bottom: 20px; }
    .spec-row {
      display: flex; gap: 0; align-items: center; margin-bottom: 20px;
    }
    .spec-item {
      font-family: 'AzoSans', sans-serif;
      font-size: 13px; letter-spacing: 0.12em;
      color: rgba(16,39,66,0.65); text-transform: uppercase;
      padding-right: 20px; margin-right: 20px;
      border-right: 1px solid rgba(16,39,66,0.15);
    }
    .spec-item:last-child { border-right: none; }
    .narrative {
      font-family: 'Geist', sans-serif;
      font-size: 17px; line-height: 1.6; color: rgba(16,39,66,0.7);
      margin-bottom: auto;
    }
    .contact-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 20px; border-top: 1px solid rgba(16,39,66,0.12); margin-top: 24px;
    }
    .agent-name {
      font-family: 'Geist', sans-serif;
      font-weight: 600; font-size: 15px; color: #102742;
    }
    .agent-contact {
      font-family: 'Geist', sans-serif;
      font-size: 14px; color: rgba(16,39,66,0.5); margin-top: 4px;
    }
    .logo-small img { width: 140px; }
  </style></head>
  <body>
  <div class="frame">
    <div class="photo-zone">
      <div class="masthead">
        <img src="${assets.logoWhite}" alt="Ryan Realty">
        <div class="masthead-right">Active Listing &nbsp;·&nbsp; ryan-realty.com</div>
      </div>
    </div>
    <div class="content-area">
      <div class="issue-line">Tumalo, Oregon &nbsp;97703 &nbsp;·&nbsp; 2.28 Acres &nbsp;·&nbsp; Active</div>
      <div class="headline">19496 Tumalo<br>Reservoir Rd</div>
      <div class="rule"></div>
      <div class="spec-row">
        <div class="spec-item">$1,225,000</div>
        <div class="spec-item">3 BD &nbsp;·&nbsp; 3 BA</div>
        <div class="spec-item">2,325 SQFT</div>
        <div class="spec-item">2.28 Acres</div>
      </div>
      <div class="narrative">Cascade views from nearly every room. A creek runs through 2.28 acres of mature timber. Heated 3-car garage. Twelve minutes to downtown Bend.</div>
      <div class="contact-bar">
        <div>
          <div class="agent-name">Matt Ryan &nbsp;·&nbsp; Principal Broker</div>
          <div class="agent-contact">541.213.6706 &nbsp;·&nbsp; ryan-realty.com</div>
        </div>
        <div class="logo-small"><img src="${assets.logoBlue}" alt="Ryan Realty"></div>
      </div>
    </div>
  </div>
  </body></html>`;
}

function F3_StatSpike(assets, photos) {
  // ONE massive number dominates. Cream background, navy type — high contrast and editorial.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #faf8f4; }
    /* Photo takes the right half vertically */
    .photo-panel {
      position: absolute; right: 0; top: 0; bottom: 0; width: 480px;
      background: url('${photos.AERIAL_3}') center 40% / cover no-repeat;
    }
    .photo-panel::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 120px;
      background: linear-gradient(to right, #faf8f4, transparent);
    }
    /* Content on left */
    .content {
      position: relative; z-index: 2;
      width: 640px; height: 100%;
      display: flex; flex-direction: column;
      padding: 72px 64px 64px;
    }
    .top-logo img { width: 180px; margin-bottom: auto; }
    .middle { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
    .overline {
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.20em;
      color: rgba(16,39,66,0.45); text-transform: uppercase;
      margin-bottom: 12px;
    }
    .big-stat {
      font-family: 'Amboqia', serif;
      font-size: 192px; line-height: 0.85; letter-spacing: -0.04em;
      color: #102742;
    }
    .stat-unit {
      font-family: 'AzoSans', sans-serif;
      font-size: 16px; letter-spacing: 0.14em;
      color: rgba(16,39,66,0.55); text-transform: uppercase;
      margin-top: 16px; margin-bottom: 44px;
    }
    .rule { width: 48px; height: 1px; background: rgba(16,39,66,0.2); margin-bottom: 32px; }
    .desc {
      font-family: 'Geist', sans-serif;
      font-size: 18px; line-height: 1.6;
      color: rgba(16,39,66,0.72); max-width: 460px;
    }
    .bottom-bar {
      border-top: 1px solid rgba(16,39,66,0.1);
      padding-top: 28px; margin-top: 40px;
    }
    .address {
      font-family: 'Amboqia', serif;
      font-size: 30px; color: #102742; letter-spacing: -0.01em; margin-bottom: 8px;
    }
    .price-contact {
      font-family: 'Geist', sans-serif;
      font-size: 14px; color: rgba(16,39,66,0.55);
    }
    .price-contact strong { color: #102742; font-weight: 600; }
  </style></head>
  <body>
  <div class="frame">
    <div class="photo-panel"></div>
    <div class="content">
      <div class="top-logo"><img src="${assets.logoBlue}" alt="Ryan Realty"></div>
      <div class="middle">
        <div class="overline">Tumalo, Oregon</div>
        <div class="big-stat">2.28</div>
        <div class="stat-unit">Acres with creek &amp; timber</div>
        <div class="rule"></div>
        <div class="desc">Three Sisters views from nearly every room. Heated 3-car garage. RV parking. Twelve minutes to downtown Bend.</div>
      </div>
      <div class="bottom-bar">
        <div class="address">19496 Tumalo<br>Reservoir Rd</div>
        <div class="price-contact">
          <strong>$1,225,000</strong> &nbsp;·&nbsp; 3 BD &nbsp;·&nbsp; 3 BA &nbsp;·&nbsp; 2,325 SQFT<br>
          Matt Ryan &nbsp;·&nbsp; 541.213.6706 &nbsp;·&nbsp; ryan-realty.com
        </div>
      </div>
    </div>
  </div>
  </body></html>`;
}

function F4_ContactSheet(assets, photos) {
  // 6-photo grid. Visual tour. Address + specs anchoring bottom.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame { width: 1080px; height: 1350px; background: #faf8f4; display: flex; flex-direction: column; overflow: hidden; }
    .top-bar {
      height: 88px; background: #102742;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 48px; flex-shrink: 0;
    }
    .top-bar img { height: 38px; }
    .top-bar-right {
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.15em; color: rgba(250,248,244,0.55);
      text-transform: uppercase; text-align: right;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 4px;
      flex: 1;
      background: #102742;
    }
    .photo-grid .cell { background-size: cover; background-position: center; }
    .cell-1 { background-image: url('${photos.HERO}'); }
    .cell-2 { background-image: url('${photos.DUSK_1}'); }
    .cell-3 { background-image: url('${photos.LIVING}'); }
    .cell-4 { background-image: url('${photos.KITCHEN}'); }
    .cell-5 { background-image: url('${photos.GROUNDS_1}'); }
    .cell-6 { background-image: url('${photos.AERIAL_2}'); }
    .bottom-content { padding: 36px 48px 40px; flex-shrink: 0; }
    .address-line {
      font-family: 'Amboqia', serif;
      font-size: 52px; line-height: 1.0; letter-spacing: -0.01em;
      color: #102742; margin-bottom: 16px;
    }
    .spec-row {
      display: flex; align-items: center; gap: 0;
      margin-bottom: 20px;
    }
    .spec {
      font-family: 'AzoSans', sans-serif;
      font-size: 13px; letter-spacing: 0.12em;
      color: rgba(16,39,66,0.6); text-transform: uppercase;
      padding-right: 20px; margin-right: 20px;
      border-right: 1px solid rgba(16,39,66,0.15);
    }
    .spec:last-child { border-right: none; }
    .contact-row {
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid rgba(16,39,66,0.1); padding-top: 18px;
    }
    .agent-info {
      font-family: 'Geist', sans-serif;
      font-size: 14px; color: rgba(16,39,66,0.6);
    }
    .agent-info strong { color: #102742; font-weight: 600; }
    .price-display {
      font-family: 'Amboqia', serif;
      font-size: 32px; color: #102742; letter-spacing: -0.01em;
    }
  </style></head>
  <body>
  <div class="frame">
    <div class="top-bar">
      <img src="${assets.logoWhite}" alt="Ryan Realty">
      <div class="top-bar-right">Tumalo, Oregon<br>97703</div>
    </div>
    <div class="photo-grid">
      <div class="cell cell-1"></div>
      <div class="cell cell-2"></div>
      <div class="cell cell-3"></div>
      <div class="cell cell-4"></div>
      <div class="cell cell-5"></div>
      <div class="cell cell-6"></div>
    </div>
    <div class="bottom-content">
      <div class="address-line">19496 Tumalo Reservoir Rd</div>
      <div class="spec-row">
        <div class="spec">3 BD</div>
        <div class="spec">3 BA</div>
        <div class="spec">2,325 SQFT</div>
        <div class="spec">2.28 Acres</div>
        <div class="spec">Built 1995</div>
      </div>
      <div class="contact-row">
        <div class="agent-info"><strong>Matt Ryan</strong> &nbsp;·&nbsp; Principal Broker<br>541.213.6706 &nbsp;·&nbsp; ryan-realty.com</div>
        <div class="price-display">$1,225,000</div>
      </div>
    </div>
  </div>
  </body></html>`;
}

function F5_StoryPostcard(assets, photos) {
  // Lifestyle narrative. Right-side photo, left-side cream panel with the story.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame {
      position: relative; width: 1080px; height: 1350px;
      display: flex; flex-direction: column; background: #faf8f4; overflow: hidden;
    }
    /* Top: hero photo, 2/3 height */
    .hero {
      height: 760px; flex-shrink: 0;
      background: url('${photos.LIVING}') center 50% / cover no-repeat;
      position: relative;
    }
    /* dark scrim — bottom third of photo only */
    .hero::after {
      content: '';
      position: absolute; bottom: 0; left: 0; right: 0; height: 220px;
      background: linear-gradient(to top, rgba(16,39,66,0.55), transparent);
    }
    .hero-text {
      position: absolute; bottom: 0; left: 0; right: 0; z-index: 2;
      padding: 0 56px 44px;
    }
    .place-tag {
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.18em;
      color: rgba(250,248,244,0.65); text-transform: uppercase;
      margin-bottom: 12px;
    }
    .hero-headline {
      font-family: 'Amboqia', serif;
      font-size: 60px; line-height: 0.95; letter-spacing: -0.01em;
      color: #faf8f4;
    }
    /* Bottom: cream content panel */
    .content-panel { flex: 1; padding: 44px 56px 44px; display: flex; flex-direction: column; }
    .rule { height: 1px; background: rgba(16,39,66,0.12); margin-bottom: 32px; }
    .narrative {
      font-family: 'Geist', sans-serif;
      font-size: 19px; line-height: 1.65; color: rgba(16,39,66,0.8);
      margin-bottom: 32px; flex: 1;
    }
    .bottom-row {
      display: flex; align-items: flex-end; justify-content: space-between;
    }
    .price-address {}
    .price {
      font-family: 'Amboqia', serif;
      font-size: 38px; color: #102742; letter-spacing: -0.01em;
    }
    .address-small {
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.12em;
      color: rgba(16,39,66,0.5); text-transform: uppercase; margin-top: 8px;
    }
    .logo-contact { text-align: right; }
    .logo-contact img { width: 180px; margin-bottom: 10px; }
    .contact-line {
      font-family: 'Geist', sans-serif;
      font-size: 14px; color: rgba(16,39,66,0.55);
    }
  </style></head>
  <body>
  <div class="frame">
    <div class="hero">
      <div class="hero-text">
        <div class="place-tag">Tumalo, Oregon &nbsp;·&nbsp; Central Oregon</div>
        <div class="hero-headline">Where the Cascades<br>come into the room</div>
      </div>
    </div>
    <div class="content-panel">
      <div class="rule"></div>
      <div class="narrative">Three Sisters frame the view from nearly every room. A creek moves through 2.28 acres of mature timber. The heated 3-car garage handles everything — the gear, the truck, the weekend projects. Bend is twelve minutes down the road.</div>
      <div class="bottom-row">
        <div class="price-address">
          <div class="price">$1,225,000</div>
          <div class="address-small">19496 Tumalo Reservoir Rd &nbsp;·&nbsp; 3 BD &nbsp;·&nbsp; 3 BA &nbsp;·&nbsp; 2,325 SQFT</div>
        </div>
        <div class="logo-contact">
          <img src="${assets.logoBlue}" alt="Ryan Realty">
          <div class="contact-line">541.213.6706 &nbsp;·&nbsp; ryan-realty.com</div>
        </div>
      </div>
    </div>
  </div>
  </body></html>`;
}

function F6_FarmsteadPostcard(assets, photos) {
  // Heritage register. Cream background, brand illustration large and proud, photo inset.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame {
      position: relative; width: 1080px; height: 1350px;
      background: #faf8f4; display: flex; flex-direction: column;
      overflow: hidden;
    }
    /* Top: navy header */
    .header {
      height: 80px; background: #102742;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 52px; flex-shrink: 0;
    }
    .header img { height: 38px; }
    .header-tag {
      font-family: 'AzoSans', sans-serif;
      font-size: 11px; letter-spacing: 0.18em;
      color: rgba(250,248,244,0.5); text-transform: uppercase;
    }
    /* Full-width photo, generous */
    .photo-band {
      height: 480px; flex-shrink: 0;
      background: url('${photos.DUSK_2}') center 45% / cover no-repeat;
      position: relative;
    }
    .photo-band::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 140px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    /* Heritage center — cream, illustration prominent */
    .heritage-center {
      flex: 1; padding: 20px 80px 0;
      display: flex; flex-direction: column; align-items: center;
      text-align: center;
    }
    .lockup-img { width: 420px; margin-bottom: 28px; }
    .thin-rule { width: 64px; height: 1px; background: rgba(16,39,66,0.18); margin: 0 auto 24px; }
    .location-tag {
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.20em;
      color: rgba(16,39,66,0.4); text-transform: uppercase;
      margin-bottom: 16px;
    }
    .property-name {
      font-family: 'Amboqia', serif;
      font-size: 62px; line-height: 0.96; letter-spacing: -0.01em;
      color: #102742; margin-bottom: 20px;
    }
    .specs-center {
      font-family: 'AzoSans', sans-serif;
      font-size: 13px; letter-spacing: 0.14em;
      color: rgba(16,39,66,0.55); text-transform: uppercase;
    }
    /* Bottom bar */
    .bottom-bar {
      background: #102742; padding: 28px 52px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .price-white {
      font-family: 'Amboqia', serif;
      font-size: 44px; color: #faf8f4; letter-spacing: -0.01em;
    }
    .contact-white {
      font-family: 'Geist', sans-serif;
      font-size: 14px; color: rgba(250,248,244,0.55); text-align: right;
    }
  </style></head>
  <body>
  <div class="frame">
    <div class="header">
      <img src="${assets.logoWhite}" alt="Ryan Realty">
      <div class="header-tag">Tumalo, Oregon &nbsp;·&nbsp; Active Listing</div>
    </div>
    <div class="photo-band"></div>
    <div class="heritage-center">
      <img class="lockup-img" src="${assets.illus05}" alt="Ryan Realty Heritage Lockup">
      <div class="thin-rule"></div>
      <div class="location-tag">Tumalo &nbsp;·&nbsp; Central Oregon</div>
      <div class="property-name">19496 Tumalo<br>Reservoir Rd</div>
      <div class="specs-center">3 Bedrooms &nbsp;·&nbsp; 3 Baths &nbsp;·&nbsp; 2,325 SQFT &nbsp;·&nbsp; 2.28 Acres</div>
    </div>
    <div class="bottom-bar">
      <div class="price-white">$1,225,000</div>
      <div class="contact-white">Matt Ryan &nbsp;·&nbsp; Principal Broker<br>541.213.6706 &nbsp;·&nbsp; ryan-realty.com</div>
    </div>
  </div>
  </body></html>`;
}

function F7_PriceDrop(assets, photos) {
  // Price adjustment. Photo backdrop, dramatic strikethrough, reason-to-care.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #faf8f4; }
    .bg-photo {
      position: absolute; top: 0; left: 0; right: 0; height: 680px;
      background: url('${photos.HERO}') center 40% / cover no-repeat;
    }
    .bg-photo::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 200px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    .logo-top {
      position: absolute; top: 40px; left: 52px;
      background: rgba(250,248,244,0.90); padding: 10px 18px; border-radius: 4px;
    }
    .logo-top img { width: 160px; display: block; }
    .badge {
      position: absolute; top: 40px; right: 52px;
      background: #102742; padding: 12px 24px; border-radius: 4px;
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.18em;
      color: rgba(250,248,244,0.8); text-transform: uppercase;
    }
    .content {
      position: absolute; top: 580px; left: 0; right: 0;
      padding: 0 56px;
    }
    .label {
      font-family: 'AzoSans', sans-serif;
      font-size: 13px; letter-spacing: 0.18em;
      color: rgba(16,39,66,0.5); text-transform: uppercase;
      margin-bottom: 20px;
    }
    .old-price {
      font-family: 'Amboqia', serif;
      font-size: 56px; color: rgba(16,39,66,0.3); letter-spacing: -0.01em;
      text-decoration: line-through; text-decoration-thickness: 2px;
      margin-bottom: 8px;
    }
    .new-price {
      font-family: 'Amboqia', serif;
      font-size: 96px; line-height: 0.95; letter-spacing: -0.02em;
      color: #102742; margin-bottom: 36px;
    }
    .rule { height: 1px; background: rgba(16,39,66,0.1); margin-bottom: 32px; }
    .address-block {
      font-family: 'Amboqia', serif;
      font-size: 38px; color: #102742; letter-spacing: -0.01em; margin-bottom: 12px;
    }
    .spec-bar {
      font-family: 'AzoSans', sans-serif;
      font-size: 13px; letter-spacing: 0.12em;
      color: rgba(16,39,66,0.55); text-transform: uppercase;
      margin-bottom: 40px;
    }
    .reason {
      font-family: 'Geist', sans-serif;
      font-size: 18px; line-height: 1.55; color: rgba(16,39,66,0.7);
      margin-bottom: 48px;
    }
    .contact-row {
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid rgba(16,39,66,0.1); padding-top: 24px;
    }
    .agent-info { font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(16,39,66,0.6); }
    .agent-info strong { color: #102742; font-weight: 600; }
    .logo-bottom img { width: 160px; }
  </style></head>
  <body>
  <div class="frame">
    <div class="bg-photo"></div>
    <div class="logo-top"><img src="${assets.logoBlue}" alt="Ryan Realty"></div>
    <div class="badge">Price Adjusted</div>
    <div class="content">
      <div class="label">Tumalo, Oregon &nbsp;·&nbsp; Newly Priced</div>
      <div class="old-price">$1,295,000</div>
      <div class="new-price">$1,225,000</div>
      <div class="rule"></div>
      <div class="address-block">19496 Tumalo Reservoir Rd</div>
      <div class="spec-bar">3 BD &nbsp;·&nbsp; 3 BA &nbsp;·&nbsp; 2,325 SQFT &nbsp;·&nbsp; 2.28 Acres</div>
      <div class="reason">Creek on the property. Three Sisters views. 12 minutes to downtown Bend. This is the price to move it.</div>
      <div class="contact-row">
        <div class="agent-info"><strong>Matt Ryan</strong> &nbsp;·&nbsp; 541.213.6706<br>ryan-realty.com</div>
      </div>
    </div>
  </div>
  </body></html>`;
}

function F8_TrackRecord(assets, photos) {
  // Broker brag. Matt's portrait prominent. Stats as hero content.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame { width: 1080px; height: 1350px; background: #102742; display: flex; flex-direction: column; overflow: hidden; }
    /* Top half: photo strip with Matt portrait */
    .hero-zone {
      height: 640px; flex-shrink: 0; position: relative;
      background: url('${photos.AERIAL_1}') center 40% / cover no-repeat;
    }
    .hero-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(16,39,66,0.10) 0%, rgba(16,39,66,0.65) 100%);
    }
    .hero-logo {
      position: absolute; top: 40px; left: 48px;
    }
    .hero-logo img { width: 200px; }
    .portrait-container {
      position: absolute; right: 0; bottom: 0;
      width: 380px; height: 640px;
      overflow: hidden;
    }
    .portrait-container img {
      width: 100%; height: auto; display: block;
      object-fit: cover; object-position: top center;
    }
    .name-block {
      position: absolute; left: 48px; bottom: 44px; z-index: 3;
    }
    .broker-name {
      font-family: 'Amboqia', serif;
      font-size: 54px; line-height: 1.0; letter-spacing: -0.01em;
      color: #faf8f4;
    }
    .broker-title {
      font-family: 'AzoSans', sans-serif;
      font-size: 13px; letter-spacing: 0.16em;
      color: rgba(250,248,244,0.6); text-transform: uppercase; margin-top: 10px;
    }
    /* Bottom half: stats + content */
    .stats-zone {
      flex: 1; background: #faf8f4; padding: 44px 48px 40px;
      display: flex; flex-direction: column;
    }
    .eyebrow {
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.18em;
      color: rgba(16,39,66,0.4); text-transform: uppercase;
      margin-bottom: 32px;
    }
    .stats-grid {
      display: grid; grid-template-columns: 1fr 1fr 1fr;
      gap: 0; margin-bottom: 40px;
    }
    .stat-block {
      padding: 0 32px 0 0; border-right: 1px solid rgba(16,39,66,0.1);
    }
    .stat-block:last-child { border-right: none; padding-left: 32px; padding-right: 0; }
    .stat-block:nth-child(2) { padding: 0 32px; }
    .stat-num {
      font-family: 'Amboqia', serif;
      font-size: 68px; line-height: 0.9; letter-spacing: -0.02em;
      color: #102742;
    }
    .stat-unit {
      font-family: 'AzoSans', sans-serif;
      font-size: 11px; letter-spacing: 0.14em;
      color: rgba(16,39,66,0.5); text-transform: uppercase;
      margin-top: 8px;
    }
    .rule { height: 1px; background: rgba(16,39,66,0.1); margin-bottom: 28px; }
    .listing-teaser {
      display: flex; align-items: center; gap: 24px; flex: 1;
    }
    .teaser-photo {
      width: 120px; height: 90px; border-radius: 4px;
      background: url('${photos.HERO}') center / cover no-repeat;
      flex-shrink: 0;
    }
    .teaser-info {}
    .teaser-address {
      font-family: 'Amboqia', serif;
      font-size: 22px; color: #102742; letter-spacing: -0.01em;
    }
    .teaser-price {
      font-family: 'Geist', sans-serif;
      font-weight: 600; font-size: 15px; color: rgba(16,39,66,0.6); margin-top: 4px;
    }
    .contact-footer {
      border-top: 1px solid rgba(16,39,66,0.1); padding-top: 20px; margin-top: auto;
      font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(16,39,66,0.5);
    }
  </style></head>
  <body>
  <div class="frame">
    <div class="hero-zone">
      <div class="hero-overlay"></div>
      <div class="hero-logo"><img src="${assets.logoWhite}" alt="Ryan Realty"></div>
      <div class="portrait-container">
        <img src="${assets.matt}" alt="Matt Ryan">
      </div>
      <div class="name-block">
        <div class="broker-name">Matt Ryan</div>
        <div class="broker-title">Principal Broker &nbsp;·&nbsp; Ryan Realty</div>
      </div>
    </div>
    <div class="stats-zone">
      <div class="eyebrow">Central Oregon Track Record</div>
      <div class="stats-grid">
        <div class="stat-block">
          <div class="stat-num">98%</div>
          <div class="stat-unit">Sale-to-List Ratio</div>
        </div>
        <div class="stat-block">
          <div class="stat-num">22</div>
          <div class="stat-unit">Avg Days on Market</div>
        </div>
        <div class="stat-block">
          <div class="stat-num">$14M</div>
          <div class="stat-unit">Volume Closed YTD</div>
        </div>
      </div>
      <div class="rule"></div>
      <div class="listing-teaser">
        <div class="teaser-photo"></div>
        <div class="teaser-info">
          <div class="teaser-address">19496 Tumalo Reservoir Rd</div>
          <div class="teaser-price">$1,225,000 &nbsp;·&nbsp; 3 BD &nbsp;·&nbsp; 3 BA &nbsp;·&nbsp; 2,325 SQFT</div>
        </div>
      </div>
      <div class="contact-footer">541.213.6706 &nbsp;·&nbsp; matt@ryan-realty.com &nbsp;·&nbsp; ryan-realty.com</div>
    </div>
  </div>
  </body></html>`;
}

function F9_OpenHouse(assets, photos) {
  // Event poster. Bold "OPEN HOUSE", date/time dominant, photo as backdrop.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #102742; }
    .bg {
      position: absolute; inset: 0;
      background: url('${photos.DUSK_3}') center 40% / cover no-repeat;
      opacity: 0.35;
    }
    .content {
      position: relative; z-index: 2;
      height: 100%; display: flex; flex-direction: column;
      padding: 64px 64px 56px;
    }
    .top-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: auto;
    }
    .top-row img { width: 200px; }
    .event-label {
      font-family: 'AzoSans', sans-serif;
      font-size: 13px; letter-spacing: 0.20em;
      color: rgba(250,248,244,0.55); text-transform: uppercase; text-align: right;
    }
    .center-content { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .open-house-text {
      font-family: 'Amboqia', serif;
      font-size: 110px; line-height: 0.88; letter-spacing: -0.02em;
      color: #faf8f4; margin-bottom: 48px;
    }
    .rule { width: 80px; height: 2px; background: rgba(250,248,244,0.3); margin-bottom: 40px; }
    .date-line {
      font-family: 'Amboqia', serif;
      font-size: 52px; line-height: 1.1; color: #faf8f4; letter-spacing: -0.01em;
      margin-bottom: 12px;
    }
    .time-line {
      font-family: 'AzoSans', sans-serif;
      font-size: 20px; letter-spacing: 0.10em;
      color: rgba(250,248,244,0.65); text-transform: uppercase;
      margin-bottom: 64px;
    }
    .address-block {
      border-top: 1px solid rgba(250,248,244,0.2);
      padding-top: 40px;
    }
    .address-label {
      font-family: 'AzoSans', sans-serif;
      font-size: 11px; letter-spacing: 0.18em;
      color: rgba(250,248,244,0.4); text-transform: uppercase; margin-bottom: 10px;
    }
    .address-text {
      font-family: 'Amboqia', serif;
      font-size: 36px; color: #faf8f4; letter-spacing: -0.01em;
    }
    .address-specs {
      font-family: 'Geist', sans-serif; font-size: 15px;
      color: rgba(250,248,244,0.55); margin-top: 8px;
    }
    .bottom-contact {
      display: flex; align-items: flex-end; justify-content: space-between;
      border-top: 1px solid rgba(250,248,244,0.15); padding-top: 28px; margin-top: 40px;
    }
    .contact-white {
      font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(250,248,244,0.5);
    }
    .price-white {
      font-family: 'Amboqia', serif;
      font-size: 36px; color: #faf8f4; letter-spacing: -0.01em;
    }
  </style></head>
  <body>
  <div class="frame">
    <div class="bg"></div>
    <div class="content">
      <div class="top-row">
        <img src="${assets.logoWhite}" alt="Ryan Realty">
        <div class="event-label">You're Invited<br>Tumalo, Oregon</div>
      </div>
      <div class="center-content">
        <div class="open-house-text">Open<br>House</div>
        <div class="rule"></div>
        <div class="date-line">Sunday, June 8</div>
        <div class="time-line">1:00 PM &nbsp;—&nbsp; 4:00 PM</div>
        <div class="address-block">
          <div class="address-label">Property</div>
          <div class="address-text">19496 Tumalo Reservoir Rd</div>
          <div class="address-specs">Tumalo, Oregon 97703 &nbsp;·&nbsp; 3 BD &nbsp;·&nbsp; 3 BA &nbsp;·&nbsp; 2,325 SQFT</div>
        </div>
      </div>
      <div class="bottom-contact">
        <div class="contact-white">Matt Ryan &nbsp;·&nbsp; 541.213.6706<br>ryan-realty.com</div>
        <div class="price-white">$1,225,000</div>
      </div>
    </div>
  </div>
  </body></html>`;
}

function F10_BuyerEducation(assets, photos) {
  // Market-fact educational. 4 facts about Tumalo / Central Oregon, photo backdrop.
  return `
  <!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(assets)}
    .frame { width: 1080px; height: 1350px; background: #faf8f4; display: flex; flex-direction: column; overflow: hidden; }
    /* Top nav bar */
    .nav { height: 88px; background: #102742; display: flex; align-items: center; justify-content: space-between; padding: 0 48px; flex-shrink: 0; }
    .nav img { height: 36px; }
    .nav-tag { font-family: 'AzoSans', sans-serif; font-size: 11px; letter-spacing: 0.18em; color: rgba(250,248,244,0.5); text-transform: uppercase; }
    /* Hero photo */
    .hero { height: 360px; flex-shrink: 0; background: url('${photos.AERIAL_2}') center 50% / cover no-repeat; position: relative; }
    .hero::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 120px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    /* Content area */
    .body { flex: 1; padding: 20px 52px 40px; display: flex; flex-direction: column; }
    .section-title {
      font-family: 'Amboqia', serif;
      font-size: 44px; line-height: 1.0; letter-spacing: -0.01em;
      color: #102742; margin-bottom: 8px;
    }
    .section-sub {
      font-family: 'AzoSans', sans-serif;
      font-size: 12px; letter-spacing: 0.16em;
      color: rgba(16,39,66,0.4); text-transform: uppercase;
      margin-bottom: 36px;
    }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; flex: 1; }
    .fact-card {
      background: #102742; border-radius: 8px;
      padding: 28px 28px 24px;
      display: flex; flex-direction: column;
    }
    .fact-num {
      font-family: 'Amboqia', serif;
      font-size: 58px; line-height: 0.9; letter-spacing: -0.02em;
      color: #faf8f4; margin-bottom: 8px;
    }
    .fact-unit {
      font-family: 'AzoSans', sans-serif;
      font-size: 11px; letter-spacing: 0.14em;
      color: rgba(250,248,244,0.4); text-transform: uppercase;
      margin-bottom: 16px;
    }
    .fact-rule { width: 32px; height: 1px; background: rgba(250,248,244,0.2); margin-bottom: 16px; }
    .fact-desc {
      font-family: 'Geist', sans-serif;
      font-size: 14px; line-height: 1.55;
      color: rgba(250,248,244,0.7); flex: 1;
    }
    .footer-row {
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid rgba(16,39,66,0.1); padding-top: 20px; margin-top: 20px;
    }
    .footer-contact { font-family: 'Geist', sans-serif; font-size: 13px; color: rgba(16,39,66,0.5); }
    .footer-contact strong { color: #102742; }
    .qr-wrap { display: flex; align-items: center; gap: 14px; }
    .qr-wrap img { width: 56px; height: 56px; }
    .qr-label { font-family: 'Geist', sans-serif; font-size: 12px; color: rgba(16,39,66,0.45); }
  </style></head>
  <body>
  <div class="frame">
    <div class="nav">
      <img src="${assets.logoWhite}" alt="Ryan Realty">
      <div class="nav-tag">Market Education &nbsp;·&nbsp; Tumalo, OR</div>
    </div>
    <div class="hero"></div>
    <div class="body">
      <div class="section-title">Four Things to Know<br>About Tumalo</div>
      <div class="section-sub">Central Oregon &nbsp;·&nbsp; Deschutes County</div>
      <div class="facts">
        <div class="fact-card">
          <div class="fact-num">12</div>
          <div class="fact-unit">Minutes to Bend</div>
          <div class="fact-rule"></div>
          <div class="fact-desc">Tumalo sits just northwest of Bend on Hwy 20 — close enough for daily errands, far enough for space and quiet.</div>
        </div>
        <div class="fact-card">
          <div class="fact-num">4.1</div>
          <div class="fact-unit">Months Supply</div>
          <div class="fact-rule"></div>
          <div class="fact-desc">Central Oregon remains a seller's market. Inventory is tight and well-priced properties move fast.</div>
        </div>
        <div class="fact-card">
          <div class="fact-num">2.28</div>
          <div class="fact-unit">Acres on Offer</div>
          <div class="fact-rule"></div>
          <div class="fact-desc">This parcel includes creek frontage and mature timber — acreage this size near Bend is genuinely rare.</div>
        </div>
        <div class="fact-card">
          <div class="fact-num">$526</div>
          <div class="fact-unit">Price per SQFT</div>
          <div class="fact-rule"></div>
          <div class="fact-desc">Median price/sqft in Deschutes County. This listing at $527/sqft reflects the land and location premium.</div>
        </div>
      </div>
      <div class="footer-row">
        <div class="footer-contact"><strong>Matt Ryan</strong> &nbsp;·&nbsp; 541.213.6706 &nbsp;·&nbsp; ryan-realty.com</div>
        <div class="qr-wrap">
          <img src="${assets.qr}" alt="QR">
          <div class="qr-label">View listing<br>details</div>
        </div>
      </div>
    </div>
  </div>
  </body></html>`;
}

// ─── RENDER ENGINE ────────────────────────────────────────────────────────────

async function renderFlyer(browser, html, filename) {
  const page = await browser.newPage();
  // Load Google Fonts (Geist) + property photos
  await page.setExtraHTTPHeaders({ 'Accept': 'image/webp,image/*,*/*' });

  // Set viewport to exactly 1080x1350
  await page.setViewportSize({ width: 1080, height: 1350 });

  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for fonts + images to fully load
  await page.waitForTimeout(2000);

  // Ensure all images are loaded
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter(img => !img.complete)
        .map(img => new Promise(resolve => { img.onload = img.onerror = resolve; }))
    );
  });

  await page.waitForTimeout(500);

  const outPath = path.join(OUT_DIR, filename);
  await page.screenshot({
    path: outPath,
    type: 'png',
    clip: { x: 0, y: 0, width: 1080, height: 1350 }
  });

  await page.close();

  const size = fs.statSync(outPath).size;
  console.log(`  ${filename}: ${(size / 1024).toFixed(0)} KB`);
  return outPath;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Launching Playwright...');
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // F7 (price-drop) + F8 (track-record) removed 2026-05-20 per Matt review.
  // Function definitions retained as dead code in case we want to bring them
  // back; they're just not rendered or shipped. The other 8 flyers stay.
  const flyers = [
    { name: 'F1-museum-wall.png',      html: F1_MuseumWall(ASSETS, PHOTOS) },
    { name: 'F2-broadsheet-strip.png', html: F2_BroadsheetStrip(ASSETS, PHOTOS) },
    { name: 'F3-stat-spike.png',       html: F3_StatSpike(ASSETS, PHOTOS) },
    { name: 'F4-contact-sheet.png',    html: F4_ContactSheet(ASSETS, PHOTOS) },
    { name: 'F5-story-postcard.png',   html: F5_StoryPostcard(ASSETS, PHOTOS) },
    { name: 'F6-farmstead-postcard.png', html: F6_FarmsteadPostcard(ASSETS, PHOTOS) },
    { name: 'F9-open-house.png',       html: F9_OpenHouse(ASSETS, PHOTOS) },
    { name: 'F10-buyer-education.png', html: F10_BuyerEducation(ASSETS, PHOTOS) },
  ];

  const rendered = [];
  for (const flyer of flyers) {
    console.log(`Rendering ${flyer.name}...`);
    try {
      const p = await renderFlyer(browser, flyer.html, flyer.name);
      rendered.push(p);
    } catch (err) {
      console.error(`  ERROR on ${flyer.name}:`, err.message);
    }
  }

  await browser.close();

  // Mirror to public template-picker directory
  console.log('\nMirroring to template-picker...');
  for (const src of rendered) {
    const filename = path.basename(src);
    const dest = path.join(MIRROR_DIR, filename);
    fs.copyFileSync(src, dest);
    console.log(`  Copied ${filename}`);
  }

  console.log(`\nDone. ${rendered.length}/10 flyers rendered.`);
}

main().catch(err => { console.error(err); process.exit(1); });
