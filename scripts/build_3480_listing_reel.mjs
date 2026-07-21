#!/usr/bin/env node
/**
 * build_3480_listing_reel.mjs — vertical 9:16 (1080x1920) Just-Listed tour slides.
 * Cover (full-bleed hero + text) + photo slides (blurred-fill bg so landscape
 * photos don't crop, sharp photo centered) + stats card + Matt-headshot CTA.
 * Figures trace to Supabase listings (ListingKey 20260708114552589824000000).
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
const W=1080, H=1920, NAVY='#102742', CREAM='#faf8f4';
function du(abs){ if(!existsSync(abs)) throw new Error('missing: '+abs); const e=abs.split('.').pop().toLowerCase(); const m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',otf:'font/otf',ttf:'font/ttf'}[e]||'application/octet-stream'; return `data:${m};base64,${readFileSync(abs).toString('base64')}`; }
const AMBOQIA=du(resolve(ROOT,'design_system/ryan-realty/fonts/Amboqia_Boriango.otf'));
const AZO=du(resolve(ROOT,'design_system/ryan-realty/fonts/AzoSans-Medium.ttf'));
const LOGO_WHITE=du(resolve(ROOT,'design_system/ryan-realty/assets/brand/logo-white.png'));
const MATT=du(resolve(ROOT,'design_system/ryan-realty/assets/team/matt-ryan.png'));
const F={addr1:'3480 SW 45th St',addr2:'Redmond, Oregon',price:'$655,000',beds:'3',baths:'2',sqft:'1,631',built:'2018',lot:'0.21 acre',sub:'Forked Horn Butte',ppsf:'$402/sqft'};

const SLIDES=[
  {type:'cover',photo:'02.jpg',pos:'center 60%'},
  {type:'photo',photo:'17.jpg',pos:'center center'},{type:'photo',photo:'24.jpg',pos:'center center'},{type:'photo',photo:'20.jpg',pos:'center center'},
  {type:'photo',photo:'30.jpg',pos:'center 42%'},{type:'photo',photo:'31.jpg',pos:'center center'},{type:'photo',photo:'33.jpg',pos:'center center'},
  {type:'photo',photo:'13.jpg',pos:'center 55%'},{type:'photo',photo:'45.jpg',pos:'center center'},
  {type:'stats'},{type:'cta'},
];
const HEAD=`
@font-face{font-family:'Amboqia';src:url('${AMBOQIA}') format('opentype');font-weight:400;font-display:block;}
@font-face{font-family:'AzoSans';src:url('${AZO}') format('truetype');font-weight:500;font-display:block;}
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${NAVY};}
.slide{position:absolute;inset:0;}
.full{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;}
.bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(36px) brightness(0.5);transform:scale(1.2);}
.fg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}
.fg img{width:100%;max-height:70%;object-fit:contain;}
.grade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,0.34) 0%,rgba(16,39,66,0) 22%,rgba(16,39,66,0) 42%,rgba(16,39,66,0.6) 70%,rgba(16,39,66,0.95) 100%);}
.cblock{position:absolute;left:90px;right:90px;bottom:470px;}
.kick{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${CREAM};font-size:20px;margin-bottom:18px;}
.addr{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:88px;line-height:1.0;letter-spacing:-0.01em;}
.addr2{font-family:'Geist',sans-serif;color:rgba(250,248,244,0.9);font-size:28px;margin-top:10px;}
.stats{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:36px;margin-top:24px;font-variant-numeric:tabular-nums;}
.feat{font-family:'Geist',sans-serif;color:rgba(250,248,244,0.9);font-size:24px;margin-top:12px;}
/* stats card */
.sc{position:absolute;inset:0;background:${NAVY};display:flex;flex-direction:column;justify-content:center;padding:0 100px;}
.sc .k{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:rgba(250,248,244,0.7);font-size:19px;margin-bottom:20px;}
.sc .price{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:128px;line-height:0.98;font-variant-numeric:tabular-nums;}
.sc .row{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:40px;margin-top:16px;font-variant-numeric:tabular-nums;}
.sc .grid{margin-top:52px;display:grid;grid-template-columns:1fr 1fr;gap:34px 40px;}
.sc .lab{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:rgba(250,248,244,0.55);font-size:16px;}
.sc .val{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:32px;margin-top:6px;font-variant-numeric:tabular-nums;}
/* cta */
.cta{position:absolute;inset:0;background:${NAVY};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 100px;}
.cta img.logo{width:220px;margin-bottom:26px;}
.cta img.head{width:240px;margin:6px 0 10px;}
.cta .tag{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:56px;line-height:1.06;margin-top:8px;}
.cta .by{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.16em;color:rgba(250,248,244,0.75);font-size:18px;margin-top:26px;}
.cta .contact{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:30px;margin-top:16px;font-variant-numeric:tabular-nums;}
`;
function cover(s){return `<div class="slide"><div class="full" style="background-image:url('${du(P(s.photo))}');background-position:${s.pos};"></div><div class="grade"></div>
  <div class="cblock"><div class="kick">Just Listed · Redmond</div><div class="addr">${F.addr1}</div><div class="addr2">${F.addr2}</div>
  <div class="stats">${F.price} · ${F.beds} bd · ${F.baths} ba · ${F.sqft} sqft</div><div class="feat">${F.sub} · Cascade Mountain views</div></div></div>`;}
function photo(s){const u=du(P(s.photo));return `<div class="slide"><div class="full" style="background-image:url('${u}');background-position:${s.pos||'center center'};"></div></div>`;}
function statsCard(){return `<div class="sc"><div class="k">3480 SW 45th St · Redmond</div><div class="price">${F.price}</div>
  <div class="row">${F.beds} beds · ${F.baths} baths · ${F.sqft} sqft</div>
  <div class="grid"><div><div class="lab">Year built</div><div class="val">${F.built}</div></div><div><div class="lab">Lot</div><div class="val">${F.lot}</div></div>
  <div><div class="lab">Neighborhood</div><div class="val">${F.sub}</div></div><div><div class="lab">Views</div><div class="val">Cascade Mtns</div></div></div></div>`;}
function cta(){return `<div class="cta"><img class="logo" src="${LOGO_WHITE}"><img class="head" src="${MATT}"><div class="tag">Call today for your<br>private showing.</div>
  <div class="by">Listed by Matt Ryan · Ryan Realty</div><div class="contact">541.213.6706 · ryan-realty.com</div></div>`;}

async function main(){
  const b=await chromium.launch();
  try{
    for(let idx=0;idx<SLIDES.length;idx++){
      const s=SLIDES[idx];
      const body=s.type==='cover'?cover(s):s.type==='photo'?photo(s):s.type==='stats'?statsCard():cta();
      const html=`<!doctype html><html><head><meta charset="utf-8"><style>${HEAD}</style></head><body>${body}</body></html>`;
      const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
      await page.setContent(html,{waitUntil:'networkidle'});
      await page.evaluate(()=> (document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve());
      await page.waitForTimeout(350);
      await page.screenshot({path:resolve(OUT,`reel-${String(idx+1).padStart(2,'0')}.png`)});
      await page.close();
      console.log(`  reel ${idx+1}/${SLIDES.length} (${s.type})`);
    }
  } finally { await b.close(); }
  console.log('Done.');
}
main().catch(e=>{console.error('FAILED:',e.message);process.exit(2);});
