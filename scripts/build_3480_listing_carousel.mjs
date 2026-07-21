#!/usr/bin/env node
/**
 * build_3480_listing_carousel.mjs
 * Just-Listed carousel for 3480 SW 45th St, Redmond (1080x1350).
 * Designed cover + bare full-bleed photo slides (the photography is the star,
 * per instagram-carousel skill) + a details slide + a Matt-headshot CTA.
 * All figures trace to Supabase listings (ListingKey 20260708114552589824000000).
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'out/listing/3480-sw-45th-redmond');
const P = (n) => resolve(OUT, `photos/${n}`);
mkdirSync(OUT, { recursive: true });

const W = 1080, H = 1350, FOOTER = 120, NAVY = '#102742', CREAM = '#faf8f4';
function du(abs) {
  if (!existsSync(abs)) throw new Error(`missing: ${abs}`);
  const ext = abs.split('.').pop().toLowerCase();
  const mime = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', otf:'font/otf', ttf:'font/ttf' }[ext] || 'application/octet-stream';
  return `data:${mime};base64,${readFileSync(abs).toString('base64')}`;
}
const AMBOQIA = du(resolve(ROOT,'design_system/ryan-realty/fonts/Amboqia_Boriango.otf'));
const AZO = du(resolve(ROOT,'design_system/ryan-realty/fonts/AzoSans-Medium.ttf'));
const LOGO_WHITE = du(resolve(ROOT,'design_system/ryan-realty/assets/brand/logo-white.png'));
const LOGO_BLUE = du(resolve(ROOT,'design_system/ryan-realty/assets/brand/logo-blue.png'));
const MATT = du(resolve(ROOT,'design_system/ryan-realty/assets/team/matt-ryan.png'));

// verified facts
const F = {
  addr1: '3480 SW 45th St', addr2: 'Redmond, Oregon',
  price: '$655,000', beds: '3', baths: '2', sqft: '1,631',
  built: '2018', lot: '0.21 acre', sub: 'Forked Horn Butte', ppsf: '$402/sqft',
};

const SLIDES = [
  { type:'cover', photo:'02.jpg', pos:'center 60%' },
  { type:'photo', photo:'17.jpg', pos:'center center' },
  { type:'photo', photo:'24.jpg', pos:'center center' },
  { type:'photo', photo:'20.jpg', pos:'center center' },
  { type:'photo', photo:'30.jpg', pos:'center 45%' },
  { type:'photo', photo:'31.jpg', pos:'center center' },
  { type:'photo', photo:'33.jpg', pos:'center center' },
  { type:'photo', photo:'13.jpg', pos:'center 55%' },
  { type:'details' },
  { type:'cta' },
];
const TOTAL = SLIDES.length;

const HEAD = `
@font-face{font-family:'Amboqia';src:url('${AMBOQIA}') format('opentype');font-weight:400;font-display:block;}
@font-face{font-family:'AzoSans';src:url('${AZO}') format('truetype');font-weight:500;font-display:block;}
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${NAVY};}
.slide{position:absolute;inset:0;}
.photo{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;}
.cover-grade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,0.30) 0%,rgba(16,39,66,0) 24%,rgba(16,39,66,0) 44%,rgba(16,39,66,0.62) 72%,rgba(16,39,66,0.95) 100%);}
.footer{position:absolute;bottom:0;left:0;right:0;height:${FOOTER}px;background:rgba(16,39,66,0.94);display:flex;align-items:center;justify-content:space-between;padding:0 40px;}
.footer img{height:42px;}
.num{font-family:'Geist',sans-serif;font-size:18px;font-weight:500;color:${CREAM};letter-spacing:0.04em;font-variant-numeric:tabular-nums;}
.cblock{position:absolute;left:54px;right:54px;bottom:${FOOTER+44}px;}
.kick{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${CREAM};font-size:17px;margin-bottom:16px;}
.addr{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:72px;line-height:1.0;letter-spacing:-0.01em;}
.addr2{font-family:'Geist',sans-serif;font-weight:400;color:rgba(250,248,244,0.9);font-size:24px;margin-top:8px;}
.stats{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:30px;margin-top:20px;font-variant-numeric:tabular-nums;}
.feat{font-family:'Geist',sans-serif;font-weight:400;color:rgba(250,248,244,0.9);font-size:21px;margin-top:10px;}
/* details */
.det{position:absolute;inset:0;background:${CREAM};padding:96px 72px ${FOOTER+64}px;display:flex;flex-direction:column;}
.det .k{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${NAVY};font-size:16px;margin-bottom:18px;}
.det .price{font-family:'Amboqia','Playfair Display',serif;color:${NAVY};font-size:104px;line-height:0.98;font-variant-numeric:tabular-nums;}
.det .row{font-family:'Geist',sans-serif;font-weight:600;color:${NAVY};font-size:34px;margin-top:14px;font-variant-numeric:tabular-nums;}
.det .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px 40px;margin-top:44px;}
.det .cell .lab{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:rgba(16,39,66,0.55);font-size:14px;}
.det .cell .val{font-family:'Geist',sans-serif;font-weight:600;color:${NAVY};font-size:26px;margin-top:4px;font-variant-numeric:tabular-nums;}
.det .blurb{font-family:'Geist',sans-serif;font-weight:400;color:rgba(16,39,66,0.82);font-size:23px;line-height:1.5;margin-top:auto;}
/* cta */
.cta{position:absolute;inset:0;background:${NAVY};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;}
.cta img.logo{width:200px;margin-bottom:20px;}
.cta img.head{width:200px;height:auto;margin:6px 0 8px;}
.cta .tag{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:42px;line-height:1.08;margin-top:6px;}
.cta .by{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.16em;color:rgba(250,248,244,0.75);font-size:15px;margin-top:22px;}
.cta .contact{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:24px;margin-top:14px;font-variant-numeric:tabular-nums;}
.swipe{position:absolute;right:30px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:5;}
.swipe .chevs{display:flex;align-items:center;}
.swipe .chevs span{font-family:'Geist',sans-serif;font-weight:700;font-size:40px;line-height:1;color:${CREAM};margin-left:-10px;text-shadow:0 2px 12px rgba(0,0,0,0.65);}
.swipe .lab{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;color:${CREAM};text-shadow:0 2px 10px rgba(0,0,0,0.7);}
`;
// swipe cue: three chevrons whose brightness sweeps left->right; `hi` is the
// highlighted index (0..2) so the same markup drives the static PNG (hi=2) and
// the animated cover frames (hi cycles).
function swipeCue(hi=2){
  const op=(k)=>{ const d=(k-hi); return d===0?1 : d===-1?0.62 : d===-2?0.34 : 0.34; };
  const s=[0,1,2].map(k=>`<span style="opacity:${op(k).toFixed(2)}">›</span>`).join('');
  return `<div class="swipe"><div class="chevs">${s}</div><div class="lab">Swipe</div></div>`;
}
const footer = (i,dark=true)=>`<div class="footer"><img src="${dark?LOGO_WHITE:LOGO_WHITE}" alt=""><span class="num">${i} / ${TOTAL}</span></div>`;

function cover(s,i){
  return `<div class="slide"><div class="photo" style="background-image:url('${du(P(s.photo))}');background-position:${s.pos};"></div><div class="cover-grade"></div>
  <div class="cblock"><div class="kick">Just Listed · Redmond</div>
    <div class="addr">${F.addr1}</div><div class="addr2">${F.addr2}</div>
    <div class="stats">${F.price} · ${F.beds} bd · ${F.baths} ba · ${F.sqft} sqft</div>
    <div class="feat">${F.sub} · Cascade Mountain views</div></div>${swipeCue()}${footer(i)}</div>`;
}
function photo(s,i){
  return `<div class="slide"><div class="photo" style="background-image:url('${du(P(s.photo))}');background-position:${s.pos};"></div>${swipeCue()}</div>`;
}
function details(i){
  return `<div class="det"><div class="k">The details</div>
    <div class="price">${F.price}</div>
    <div class="row">${F.beds} beds · ${F.baths} baths · ${F.sqft} sqft</div>
    <div class="grid">
      <div class="cell"><div class="lab">Year built</div><div class="val">${F.built}</div></div>
      <div class="cell"><div class="lab">Lot size</div><div class="val">${F.lot}</div></div>
      <div class="cell"><div class="lab">Neighborhood</div><div class="val">${F.sub}</div></div>
      <div class="cell"><div class="lab">Price per sqft</div><div class="val">${F.ppsf}</div></div>
    </div>
    <div class="blurb">A contemporary home in Redmond with an open great room, vaulted ceilings, a stone gas fireplace, and Cascade Mountain views from the primary suite and back deck.</div>
    </div>${footer(i)}`;
}
function cta(i){
  return `<div class="cta"><img class="logo" src="${LOGO_WHITE}" alt="">
    <img class="head" src="${MATT}" alt="">
    <div class="tag">Call today for your<br>private showing.</div>
    <div class="by">Listed by Matt Ryan · Ryan Realty</div>
    <div class="contact">541.213.6706 · ryan-realty.com</div></div>${footer(i)}`;
}

async function main(){
  const b=await chromium.launch();
  try{
    for(let idx=0;idx<SLIDES.length;idx++){
      const s=SLIDES[idx], i=idx+1;
      const body = s.type==='cover'?cover(s,i):s.type==='photo'?photo(s,i):s.type==='details'?details(i):cta(i);
      const html=`<!doctype html><html><head><meta charset="utf-8"><style>${HEAD}</style></head><body>${body}</body></html>`;
      const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
      await page.setContent(html,{waitUntil:'networkidle'});
      await page.evaluate(()=> (document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve());
      await page.waitForTimeout(350);
      await page.screenshot({path:resolve(OUT,`carousel-${String(i).padStart(2,'0')}.png`)});
      await page.close();
      console.log(`  carousel ${i}/${TOTAL} (${s.type})`);
    }
  } finally { await b.close(); }
  console.log('Done.');
}
main().catch(e=>{console.error('FAILED:',e.message);process.exit(2);});
