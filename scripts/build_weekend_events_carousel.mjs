#!/usr/bin/env node
/**
 * build_weekend_events_carousel.mjs
 *
 * Event carousel (content_type: event) per social_media_skills/instagram-carousel/SKILL.md.
 * Cover + N event slides + CTA. Full-bleed real Central Oregon photo + navy scrim + info block,
 * persistent navy footer (logo-white + slide numeral) identical on every slide.
 *
 * Brand: navy #102742 on cream #faf8f4. Amboqia (display) + AzoSans (kicker) embedded as data
 * URIs so the brand font never falls back. Geist (body) via Google Fonts + system fallback.
 *
 * Usage:  node scripts/build_weekend_events_carousel.mjs
 * Output: out/carousel/weekend-events-2026-07-17/slide-01.png ... slide-09.png
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'out/carousel/weekend-events-2026-07-17');
mkdirSync(OUT, { recursive: true });

const W = 1080, H = 1350, FOOTER = 120;
const NAVY = '#102742';

function du(rel) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) throw new Error(`asset not found: ${rel}`);
  const ext = abs.split('.').pop().toLowerCase();
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', otf: 'font/otf', ttf: 'font/ttf' }[ext] || 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(abs).toString('base64')}`;
}

const AMBOQIA = du('design_system/ryan-realty/fonts/Amboqia_Boriango.otf');
const AZO = du('design_system/ryan-realty/fonts/AzoSans-Medium.ttf');
const LOGO_WHITE = du('design_system/ryan-realty/assets/brand/logo-white.png');
const MASCOT = du('design_system/ryan-realty/assets/brand/white-dog-trans.png');

const SLIDES = [
  {
    type: 'cover',
    photo: 'public/asset-library/photos/curated/4842585b-9ae7-431f-b8e4-7c9dfefa8882.JPG',
    pos: 'center 42%',
    kicker: "WHAT'S ON THIS WEEKEND",
    title: 'This weekend in\nCentral Oregon',
    deck: 'Concerts, farmers markets, and a mountain race. Friday to Sunday.',
    date: 'JULY 17 · 18 · 19',
  },
  {
    type: 'event',
    photo: 'out/carousel/weekend-events-2026-07-17/band-photos/jew_southside.jpg',
    pos: 'center 30%',
    kicker: 'FRIDAY · JULY 17',
    name: 'Jimmy Eat World',
    detail: 'Hayden Homes Amphitheater · 4:30 pm',
    line: 'The alt-rock headliner brings Motion City Soundtrack and Illuminati Hotties.',
  },
  {
    type: 'event',
    photo: 'public/asset-library/photos/unsplash/fc74fcc1-be7a-45d3-8bd4-c080d88e977b.jpg',
    pos: 'center 60%',
    kicker: 'FRIDAY · JULY 17',
    name: 'Friday Night Races',
    detail: 'Mt. Bachelor · 3:30 pm',
    line: 'Downhill mountain bike races run the mountain. One of six nights this summer.',
  },
  {
    type: 'event',
    photo: 'public/asset-library/photos/curated/34a02608-2c6a-4972-8c22-10f4101ca54d.JPG',
    pos: 'center center',
    kicker: 'FRIDAY · JULY 17',
    name: 'Redmond Farmers Market',
    detail: 'Centennial Park · 3 to 7 pm',
    line: 'Local produce and prepared foods in downtown Redmond.',
  },
  {
    type: 'event',
    photo: 'public/asset-library/photos/curated/6ae94ec1-fd80-4a94-8b7c-041093262318.JPG',
    pos: 'center center',
    kicker: 'SATURDAY · JULY 18',
    name: 'NorthWest Crossing\nFarmers Market',
    detail: "Bend's westside · 10 am to 2 pm",
    line: 'Produce, local makers, and food on the westside.',
  },
  {
    type: 'event',
    photo: 'out/carousel/weekend-events-2026-07-17/band-photos/levity_press.jpg',
    pos: 'center 36%',
    kicker: 'SATURDAY · JULY 18',
    name: 'Levity & Tape B',
    detail: 'Hayden Homes Amphitheater · 4:30 pm',
    line: 'Electronic and bass acts co-headline, with Canabliss opening.',
  },
  {
    type: 'event',
    photo: 'public/asset-library/photos/unsplash/0a37e880-6b0c-4274-b765-5412fb539fe6.jpg',
    pos: 'center 45%',
    kicker: 'SATURDAY · JULY 18',
    name: 'Camp Clay Summer Market',
    detail: 'NE Olney Ave · 10 am to 5 pm',
    line: 'Ceramic artists and makers sell their work, with live music.',
  },
  {
    type: 'event',
    photo: 'out/carousel/weekend-events-2026-07-17/band-photos/eric_vertical.jpg',
    pos: 'center 28%',
    kicker: 'SATURDAY · JULY 18',
    name: 'Eric Leadbetter Band',
    detail: 'Worthy Brewing · 7 pm',
    line: 'Original songs live at the Worthy Brewing main pub.',
  },
  {
    type: 'event',
    photo: 'public/asset-library/photos/curated/cc841602-2edc-4aee-8433-a65c114d6908.JPG',
    pos: 'center 60%',
    kicker: 'SUNDAY · JULY 19',
    name: 'Sisters Farmers Market',
    detail: 'Fir Street Park · 10 am to 2 pm',
    line: 'More than forty vendors with produce and local goods in Sisters.',
  },
  { type: 'cta' },
];

const TOTAL = SLIDES.length;

const HEAD = `
@font-face { font-family:'Amboqia'; src:url('${AMBOQIA}') format('opentype'); font-weight:400; font-display:block; }
@font-face { font-family:'AzoSans'; src:url('${AZO}') format('truetype'); font-weight:500; font-display:block; }
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { width:${W}px; height:${H}px; position:relative; overflow:hidden; background:${NAVY}; }
.slide { position:absolute; inset:0; }
.photo { position:absolute; inset:0; background-size:cover; background-repeat:no-repeat; }
/* full-slide subtle grade + strong bottom block for legibility */
.grade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(16,39,66,0.28) 0%, rgba(16,39,66,0.00) 26%, rgba(16,39,66,0.00) 46%, rgba(16,39,66,0.60) 74%, rgba(16,39,66,0.94) 100%); }
.footer { position:absolute; bottom:0; left:0; right:0; height:${FOOTER}px; background:rgba(16,39,66,0.94);
  display:flex; align-items:center; justify-content:space-between; padding:0 40px; }
.footer img { height:44px; }
.num { font-family:'Geist',system-ui,sans-serif; font-size:18px; font-weight:500; color:#faf8f4;
  letter-spacing:0.04em; font-variant-numeric:tabular-nums; }
.block { position:absolute; left:54px; right:54px; bottom:${FOOTER + 44}px; }
.kicker { font-family:'AzoSans','Geist',sans-serif; font-weight:500; text-transform:uppercase;
  letter-spacing:0.16em; color:#faf8f4; font-size:15px; margin-bottom:16px; opacity:0.95; }
.name { font-family:'Amboqia','Playfair Display',Georgia,serif; color:#faf8f4; line-height:1.02;
  letter-spacing:-0.005em; }
.detail { font-family:'Geist',system-ui,sans-serif; font-weight:600; color:#faf8f4; font-size:26px;
  font-variant-numeric:tabular-nums; margin-top:18px; }
.line { font-family:'Geist',system-ui,sans-serif; font-weight:400; color:rgba(250,248,244,0.90);
  font-size:22px; line-height:1.42; margin-top:12px; max-width:900px; }
/* cover */
.cov-title { font-family:'Amboqia','Playfair Display',Georgia,serif; color:#faf8f4; font-size:84px;
  line-height:1.02; letter-spacing:-0.01em; }
.cov-deck { font-family:'Geist',system-ui,sans-serif; font-weight:400; color:rgba(250,248,244,0.92);
  font-size:24px; line-height:1.45; margin-top:20px; max-width:880px; }
.cov-date { font-family:'AzoSans','Geist',sans-serif; font-weight:500; text-transform:uppercase;
  letter-spacing:0.18em; color:#faf8f4; font-size:17px; margin-top:26px; font-variant-numeric:tabular-nums; }
/* cta */
.cta { position:absolute; inset:0; background:${NAVY}; display:flex; flex-direction:column;
  align-items:center; justify-content:center; text-align:center; padding:0 90px; }
.cta img.mascot { width:210px; height:auto; margin-bottom:34px; }
.cta .big { font-family:'Amboqia','Playfair Display',Georgia,serif; color:#faf8f4; font-size:56px;
  line-height:1.06; letter-spacing:-0.005em; }
.cta .sub { font-family:'Geist',system-ui,sans-serif; font-weight:400; color:rgba(250,248,244,0.86);
  font-size:24px; line-height:1.5; margin-top:22px; max-width:760px; }
.cta .contact { font-family:'Geist',system-ui,sans-serif; font-weight:600; color:#faf8f4; font-size:26px;
  margin-top:30px; font-variant-numeric:tabular-nums; letter-spacing:0.01em; }
.cta .tag { font-family:'AzoSans','Geist',sans-serif; font-weight:500; text-transform:uppercase;
  letter-spacing:0.2em; color:rgba(250,248,244,0.7); font-size:14px; margin-top:26px; }
`;

function footer(i) {
  return `<div class="footer"><img src="${LOGO_WHITE}" alt=""><span class="num">${i} / ${TOTAL}</span></div>`;
}
const nl = (s) => (s || '').replace(/\n/g, '<br>');

function coverHTML(s, i) {
  return `<div class="slide">
    <div class="photo" style="background-image:url('${du(s.photo)}');background-position:${s.pos};"></div>
    <div class="grade"></div>
    <div class="block">
      <div class="kicker">${s.kicker}</div>
      <div class="cov-title">${nl(s.title)}</div>
      <div class="cov-deck">${s.deck}</div>
      <div class="cov-date">${s.date}</div>
    </div>
    ${footer(i)}
  </div>`;
}

function eventHTML(s, i) {
  // size the name by length so long two-line names fit the safe zone
  const plain = s.name.replace(/\n/g, ' ');
  const size = plain.length > 22 ? 58 : plain.length > 16 ? 66 : 74;
  return `<div class="slide">
    <div class="photo" style="background-image:url('${du(s.photo)}');background-position:${s.pos};"></div>
    <div class="grade"></div>
    <div class="block">
      <div class="kicker">${s.kicker}</div>
      <div class="name" style="font-size:${size}px">${nl(s.name)}</div>
      <div class="detail">${s.detail}</div>
      <div class="line">${s.line}</div>
    </div>
    ${footer(i)}
  </div>`;
}

function ctaHTML(i) {
  return `<div class="cta">
    <img class="mascot" src="${MASCOT}" alt="">
    <div class="big">Every weekend<br>looks like this.</div>
    <div class="sub">Thinking about a move to Central Oregon? We're local, and we answer.</div>
    <div class="contact">541.213.6706 · ryan-realty.com</div>
    <div class="tag">Ryan Realty · Bend, Oregon</div>
  </div>
  ${footer(i)}`;
}

async function main() {
  const browser = await chromium.launch();
  try {
    for (let idx = 0; idx < SLIDES.length; idx++) {
      const s = SLIDES[idx];
      const i = idx + 1;
      const body = s.type === 'cover' ? coverHTML(s, i) : s.type === 'cta' ? ctaHTML(i) : eventHTML(s, i);
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${HEAD}</style></head><body>${body}</body></html>`;
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.evaluate(() => (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve());
      await page.waitForTimeout(400);
      const out = resolve(OUT, `slide-${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: out, fullPage: false });
      await page.close();
      console.log(`  slide ${i}/${TOTAL} (${s.type})  ->  ${out.replace(ROOT + '/', '')}`);
    }
  } finally {
    await browser.close();
  }
  console.log('Done.');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(2); });
