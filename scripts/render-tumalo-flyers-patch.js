#!/usr/bin/env node
/**
 * Patch renderer — only re-renders the 5 flyers that needed fixes
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Load the main renderer module's flyer functions by requiring it
// Actually, just inline the specific flyers here:

const OUT_DIR = '/Users/matthewryan/RyanRealty/out/list-kits/19496-tumalo-reservoir/flyers';
const MIRROR_DIR = '/Users/matthewryan/RyanRealty/public/template-picker/list-kits/19496-tumalo-reservoir/flyers';

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

const PHOTOS = {
  HERO:     'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175825195222000000-o.jpg',
  AERIAL_1: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175719779563000000-o.jpg',
  AERIAL_2: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175720531554000000-o.jpg',
  AERIAL_3: 'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175723357841000000-o.jpg',
  DUSK_1:   'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035352655634000000-o.jpg',
  DUSK_2:   'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035353837808000000-o.jpg',
  DUSK_3:   'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260307035354882604000000-o.jpg',
  LIVING:   'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175725529629000000-o.jpg',
  GROUNDS_1:'https://cdn.resize.sparkplatform.com/ore/1024x768/true/20260304175744600559000000-o.jpg',
};

function baseCss(assets) {
  return `
    @font-face {
      font-family: 'Amboqia';
      src: url('${assets.amboqia}') format('opentype');
    }
    @font-face {
      font-family: 'AzoSans';
      src: url('${assets.azosans}') format('truetype');
      font-weight: 500;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px; height: 1350px; overflow: hidden;
      background: #faf8f4;
      font-family: 'Geist', 'Inter', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  `;
}

// ─── F2 BROADSHEET ─────────────────────────────────────────────────────────────
function F2(a, p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(a)}
    .frame { position: relative; width: 1080px; height: 1350px; background: #faf8f4; overflow: hidden; display: flex; flex-direction: column; }
    .photo-zone {
      height: 700px; flex-shrink: 0; position: relative;
      background: url('${p.AERIAL_1}') center 35% / cover no-repeat;
    }
    .masthead {
      position: absolute; top: 0; left: 0; right: 0; height: 80px;
      background: rgba(16,39,66,0.90);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 52px; z-index: 2;
    }
    .masthead img { height: 40px; }
    .masthead-right {
      font-family: 'AzoSans', sans-serif; font-size: 11px; letter-spacing: 0.16em;
      color: rgba(250,248,244,0.55); text-transform: uppercase; text-align: right;
    }
    .photo-zone::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 180px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    .content-area { flex: 1; padding: 28px 56px 40px; display: flex; flex-direction: column; }
    .issue-line {
      font-family: 'AzoSans', sans-serif; font-size: 12px; letter-spacing: 0.18em;
      color: rgba(16,39,66,0.40); text-transform: uppercase; margin-bottom: 16px;
    }
    .headline {
      font-family: 'Amboqia', serif; font-size: 92px; line-height: 0.92; letter-spacing: -0.02em;
      color: #102742; margin-bottom: 22px;
    }
    .rule { height: 1px; background: rgba(16,39,66,0.12); margin-bottom: 18px; }
    .spec-row { display: flex; align-items: center; margin-bottom: 18px; }
    .spec-item {
      font-family: 'AzoSans', sans-serif; font-size: 13px; letter-spacing: 0.12em;
      color: rgba(16,39,66,0.62); text-transform: uppercase;
      padding-right: 18px; margin-right: 18px; border-right: 1px solid rgba(16,39,66,0.15);
    }
    .spec-item:last-child { border-right: none; }
    .narrative {
      font-family: 'Geist', sans-serif; font-size: 17px; line-height: 1.6;
      color: rgba(16,39,66,0.68); margin-bottom: auto;
    }
    .contact-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 18px; border-top: 1px solid rgba(16,39,66,0.12); margin-top: 20px;
    }
    .agent-name { font-family: 'Geist', sans-serif; font-weight: 600; font-size: 15px; color: #102742; }
    .agent-contact { font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(16,39,66,0.5); margin-top: 4px; }
    .logo-small img { width: 130px; }
  </style></head><body>
  <div class="frame">
    <div class="photo-zone">
      <div class="masthead">
        <img src="${a.logoWhite}" alt="Ryan Realty">
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
        <div class="logo-small"><img src="${a.logoBlue}" alt="Ryan Realty"></div>
      </div>
    </div>
  </div></body></html>`;
}

// ─── F3 STAT SPIKE ─────────────────────────────────────────────────────────────
function F3(a, p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(a)}
    .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #faf8f4; }
    .photo-panel {
      position: absolute; right: 0; top: 0; bottom: 0; width: 460px;
      background: url('${p.AERIAL_3}') center 40% / cover no-repeat;
    }
    .photo-panel::before {
      content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 140px;
      background: linear-gradient(to right, #faf8f4, transparent);
    }
    .content {
      position: relative; z-index: 2; width: 660px; height: 100%;
      display: flex; flex-direction: column; padding: 72px 64px 64px;
    }
    .top-logo img { width: 180px; }
    .middle { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 48px 0; }
    .overline {
      font-family: 'AzoSans', sans-serif; font-size: 12px; letter-spacing: 0.20em;
      color: rgba(16,39,66,0.42); text-transform: uppercase; margin-bottom: 10px;
    }
    .big-stat {
      font-family: 'Amboqia', serif; font-size: 196px; line-height: 0.84; letter-spacing: -0.04em;
      color: #102742;
    }
    .stat-unit {
      font-family: 'AzoSans', sans-serif; font-size: 15px; letter-spacing: 0.16em;
      color: rgba(16,39,66,0.52); text-transform: uppercase;
      margin-top: 14px; margin-bottom: 40px;
    }
    .rule { width: 48px; height: 1px; background: rgba(16,39,66,0.18); margin-bottom: 28px; }
    .desc {
      font-family: 'Geist', sans-serif; font-size: 18px; line-height: 1.6;
      color: rgba(16,39,66,0.70); max-width: 450px;
    }
    .bottom-bar { border-top: 1px solid rgba(16,39,66,0.10); padding-top: 26px; margin-top: 36px; }
    .address {
      font-family: 'Amboqia', serif; font-size: 30px; color: #102742;
      letter-spacing: -0.01em; margin-bottom: 8px;
    }
    .price-contact { font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(16,39,66,0.52); }
    .price-contact strong { color: #102742; font-weight: 600; }
  </style></head><body>
  <div class="frame">
    <div class="photo-panel"></div>
    <div class="content">
      <div class="top-logo"><img src="${a.logoBlue}" alt="Ryan Realty"></div>
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
  </div></body></html>`;
}

// ─── F6 FARMSTEAD POSTCARD ────────────────────────────────────────────────────
function F6(a, p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(a)}
    .frame {
      position: relative; width: 1080px; height: 1350px;
      background: #faf8f4; display: flex; flex-direction: column; overflow: hidden;
    }
    .header {
      height: 80px; background: #102742;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 52px; flex-shrink: 0;
    }
    .header img { height: 38px; }
    .header-tag {
      font-family: 'AzoSans', sans-serif; font-size: 11px; letter-spacing: 0.18em;
      color: rgba(250,248,244,0.5); text-transform: uppercase;
    }
    .photo-band {
      height: 490px; flex-shrink: 0;
      background: url('${p.DUSK_2}') center 45% / cover no-repeat; position: relative;
    }
    .photo-band::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 140px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    .heritage-center {
      flex: 1; padding: 12px 80px 0;
      display: flex; flex-direction: column; align-items: center; text-align: center;
    }
    .lockup-img { width: 400px; margin-bottom: 20px; }
    .thin-rule { width: 64px; height: 1px; background: rgba(16,39,66,0.18); margin: 0 auto 20px; }
    .location-tag {
      font-family: 'AzoSans', sans-serif; font-size: 12px; letter-spacing: 0.20em;
      color: rgba(16,39,66,0.38); text-transform: uppercase; margin-bottom: 12px;
    }
    .property-name {
      font-family: 'Amboqia', serif; font-size: 64px; line-height: 0.95; letter-spacing: -0.01em;
      color: #102742; margin-bottom: 16px;
    }
    .specs-center {
      font-family: 'AzoSans', sans-serif; font-size: 13px; letter-spacing: 0.14em;
      color: rgba(16,39,66,0.52); text-transform: uppercase;
    }
    .bottom-bar {
      background: #102742; padding: 30px 52px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .price-white { font-family: 'Amboqia', serif; font-size: 46px; color: #faf8f4; letter-spacing: -0.01em; }
    .contact-white { font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(250,248,244,0.55); text-align: right; }
  </style></head><body>
  <div class="frame">
    <div class="header">
      <img src="${a.logoWhite}" alt="Ryan Realty">
      <div class="header-tag">Tumalo, Oregon &nbsp;·&nbsp; Active Listing</div>
    </div>
    <div class="photo-band"></div>
    <div class="heritage-center">
      <img class="lockup-img" src="${a.illus05}" alt="Ryan Realty Heritage Lockup">
      <div class="thin-rule"></div>
      <div class="location-tag">Tumalo &nbsp;·&nbsp; Central Oregon</div>
      <div class="property-name">19496 Tumalo<br>Reservoir Rd</div>
      <div class="specs-center">3 Bedrooms &nbsp;·&nbsp; 3 Baths &nbsp;·&nbsp; 2,325 SQFT &nbsp;·&nbsp; 2.28 Acres</div>
    </div>
    <div class="bottom-bar">
      <div class="price-white">$1,225,000</div>
      <div class="contact-white">Matt Ryan &nbsp;·&nbsp; Principal Broker<br>541.213.6706 &nbsp;·&nbsp; ryan-realty.com</div>
    </div>
  </div></body></html>`;
}

// ─── F7 PRICE DROP ────────────────────────────────────────────────────────────
function F7(a, p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(a)}
    .frame { position: relative; width: 1080px; height: 1350px; overflow: hidden; background: #faf8f4; }
    .bg-photo {
      position: absolute; top: 0; left: 0; right: 0; height: 660px;
      background: url('${p.HERO}') center 40% / cover no-repeat;
    }
    .bg-photo::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 220px;
      background: linear-gradient(to top, #faf8f4, transparent);
    }
    .logo-top {
      position: absolute; top: 40px; left: 52px;
      background: rgba(250,248,244,0.92); padding: 10px 18px; border-radius: 4px;
    }
    .logo-top img { width: 150px; display: block; }
    .badge {
      position: absolute; top: 40px; right: 52px;
      background: #102742; padding: 12px 24px; border-radius: 4px;
      font-family: 'AzoSans', sans-serif; font-size: 12px; letter-spacing: 0.18em;
      color: rgba(250,248,244,0.8); text-transform: uppercase;
    }
    .content { position: absolute; top: 570px; left: 0; right: 0; padding: 0 56px; }
    .label {
      font-family: 'AzoSans', sans-serif; font-size: 13px; letter-spacing: 0.18em;
      color: rgba(16,39,66,0.48); text-transform: uppercase; margin-bottom: 18px;
    }
    .old-price {
      font-family: 'Amboqia', serif; font-size: 52px; color: rgba(16,39,66,0.28);
      letter-spacing: -0.01em; text-decoration: line-through; margin-bottom: 4px;
    }
    .new-price {
      font-family: 'Amboqia', serif; font-size: 100px; line-height: 0.92;
      letter-spacing: -0.02em; color: #102742; margin-bottom: 32px;
    }
    .rule { height: 1px; background: rgba(16,39,66,0.10); margin-bottom: 28px; }
    .address-block {
      font-family: 'Amboqia', serif; font-size: 40px; color: #102742;
      letter-spacing: -0.01em; margin-bottom: 10px;
    }
    .spec-bar {
      font-family: 'AzoSans', sans-serif; font-size: 13px; letter-spacing: 0.12em;
      color: rgba(16,39,66,0.52); text-transform: uppercase; margin-bottom: 28px;
    }
    .reason {
      font-family: 'Geist', sans-serif; font-size: 18px; line-height: 1.55;
      color: rgba(16,39,66,0.68); margin-bottom: 48px;
    }
    .contact-row {
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid rgba(16,39,66,0.10); padding-top: 22px;
    }
    .agent-info { font-family: 'Geist', sans-serif; font-size: 14px; color: rgba(16,39,66,0.58); }
    .agent-info strong { color: #102742; font-weight: 600; }
    .logo-contact img { width: 140px; }
  </style></head><body>
  <div class="frame">
    <div class="bg-photo"></div>
    <div class="logo-top"><img src="${a.logoBlue}" alt="Ryan Realty"></div>
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
        <div class="logo-contact"><img src="${a.logoBlue}" alt="Ryan Realty"></div>
      </div>
    </div>
  </div></body></html>`;
}

// ─── F8 TRACK RECORD ─────────────────────────────────────────────────────────
function F8(a, p) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    ${baseCss(a)}
    .frame { width: 1080px; height: 1350px; background: #102742; display: flex; flex-direction: column; overflow: hidden; }
    .hero-zone {
      height: 660px; flex-shrink: 0; position: relative;
      background: url('${p.AERIAL_1}') center 40% / cover no-repeat;
    }
    .hero-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(16,39,66,0.08) 0%, rgba(16,39,66,0.62) 100%);
    }
    .hero-logo { position: absolute; top: 40px; left: 48px; }
    .hero-logo img { width: 200px; }
    /* Portrait: use img tag directly — transparent PNG floats over bg */
    .portrait-container {
      position: absolute; right: 0; bottom: 0;
      width: 360px; height: 640px; overflow: hidden;
    }
    .portrait-container img {
      width: 100%; height: auto; display: block;
      /* object-fit not needed — img is taller than container, anchored top */
    }
    .name-block { position: absolute; left: 48px; bottom: 40px; z-index: 3; }
    .broker-name {
      font-family: 'Amboqia', serif; font-size: 58px; line-height: 1.0;
      letter-spacing: -0.01em; color: #faf8f4;
    }
    .broker-title {
      font-family: 'AzoSans', sans-serif; font-size: 13px; letter-spacing: 0.16em;
      color: rgba(250,248,244,0.58); text-transform: uppercase; margin-top: 10px;
    }
    .stats-zone {
      flex: 1; background: #faf8f4; padding: 40px 48px 36px;
      display: flex; flex-direction: column;
    }
    .eyebrow {
      font-family: 'AzoSans', sans-serif; font-size: 12px; letter-spacing: 0.18em;
      color: rgba(16,39,66,0.38); text-transform: uppercase; margin-bottom: 28px;
    }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-bottom: 36px; }
    .stat-block { padding: 0 28px 0 0; border-right: 1px solid rgba(16,39,66,0.10); }
    .stat-block:last-child { border-right: none; padding-left: 28px; padding-right: 0; }
    .stat-block:nth-child(2) { padding: 0 28px; }
    .stat-num {
      font-family: 'Amboqia', serif; font-size: 72px; line-height: 0.88;
      letter-spacing: -0.02em; color: #102742;
    }
    .stat-unit {
      font-family: 'AzoSans', sans-serif; font-size: 11px; letter-spacing: 0.14em;
      color: rgba(16,39,66,0.48); text-transform: uppercase; margin-top: 8px;
    }
    .rule { height: 1px; background: rgba(16,39,66,0.10); margin-bottom: 24px; }
    .listing-teaser { display: flex; align-items: center; gap: 20px; flex: 1; }
    .teaser-photo {
      width: 110px; height: 82px; border-radius: 4px;
      background: url('${p.HERO}') center / cover no-repeat; flex-shrink: 0;
    }
    .teaser-address { font-family: 'Amboqia', serif; font-size: 22px; color: #102742; }
    .teaser-price { font-family: 'Geist', sans-serif; font-weight: 500; font-size: 15px; color: rgba(16,39,66,0.58); margin-top: 4px; }
    .contact-footer {
      border-top: 1px solid rgba(16,39,66,0.10); padding-top: 18px; margin-top: auto;
      font-family: 'Geist', sans-serif; font-size: 13px; color: rgba(16,39,66,0.48);
    }
  </style></head><body>
  <div class="frame">
    <div class="hero-zone">
      <div class="hero-overlay"></div>
      <div class="hero-logo"><img src="${a.logoWhite}" alt="Ryan Realty"></div>
      <div class="portrait-container">
        <img src="${a.matt}" alt="Matt Ryan">
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
        <div>
          <div class="teaser-address">19496 Tumalo Reservoir Rd</div>
          <div class="teaser-price">$1,225,000 &nbsp;·&nbsp; 3 BD &nbsp;·&nbsp; 3 BA &nbsp;·&nbsp; 2,325 SQFT</div>
        </div>
      </div>
      <div class="contact-footer">541.213.6706 &nbsp;·&nbsp; matt@ryan-realty.com &nbsp;·&nbsp; ryan-realty.com</div>
    </div>
  </div></body></html>`;
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
async function renderFlyer(browser, html, filename) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1350 });
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => Promise.all(
    Array.from(document.images).filter(i => !i.complete)
      .map(i => new Promise(r => { i.onload = i.onerror = r; }))
  ));
  await page.waitForTimeout(500);

  const outPath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await page.close();

  const size = fs.statSync(outPath).size;
  console.log(`  ${filename}: ${(size / 1024).toFixed(0)} KB`);
  return outPath;
}

async function main() {
  console.log('Launching Playwright (patch render)...');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  const patch = [
    { name: 'F2-broadsheet-strip.png', html: F2(ASSETS, PHOTOS) },
    { name: 'F3-stat-spike.png',       html: F3(ASSETS, PHOTOS) },
    { name: 'F6-farmstead-postcard.png', html: F6(ASSETS, PHOTOS) },
    { name: 'F7-price-drop.png',       html: F7(ASSETS, PHOTOS) },
    { name: 'F8-track-record.png',     html: F8(ASSETS, PHOTOS) },
  ];

  const rendered = [];
  for (const f of patch) {
    console.log(`Rendering ${f.name}...`);
    try {
      const p = await renderFlyer(browser, f.html, f.name);
      rendered.push(p);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  await browser.close();

  console.log('\nMirroring...');
  for (const src of rendered) {
    const dest = path.join(MIRROR_DIR, path.basename(src));
    fs.copyFileSync(src, dest);
    console.log(`  Copied ${path.basename(src)}`);
  }

  console.log(`\nDone. ${rendered.length}/5 patch flyers rendered.`);
}

main().catch(e => { console.error(e); process.exit(1); });
