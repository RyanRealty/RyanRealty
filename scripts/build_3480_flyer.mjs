#!/usr/bin/env node
/** build_3480_flyer.mjs — standalone Just-Listed flyer (1080x1350) with contact bar.
 * For Pinterest / X / GBP / print share. Figures trace to Supabase listings. */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'out/listing/3480-sw-45th-redmond');
const P = (n)=>resolve(OUT,`photos/${n}`);
mkdirSync(OUT,{recursive:true});
const W=1080,H=1350,NAVY='#102742',CREAM='#faf8f4';
function du(a){ if(!existsSync(a))throw new Error('missing '+a); const e=a.split('.').pop().toLowerCase(); const m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',otf:'font/otf',ttf:'font/ttf'}[e]||'application/octet-stream'; return `data:${m};base64,${readFileSync(a).toString('base64')}`; }
const AMBOQIA=du(resolve(ROOT,'design_system/ryan-realty/fonts/Amboqia_Boriango.otf'));
const AZO=du(resolve(ROOT,'design_system/ryan-realty/fonts/AzoSans-Medium.ttf'));
const LOGO_WHITE=du(resolve(ROOT,'design_system/ryan-realty/assets/brand/logo-white.png'));
const MATT=du(resolve(ROOT,'design_system/ryan-realty/assets/team/matt-ryan.jpg'));
const F={addr1:'3480 SW 45th St',addr2:'Redmond, Oregon',price:'$655,000',beds:'3',baths:'2',sqft:'1,631',sub:'Forked Horn Butte'};
const HEAD=`
@font-face{font-family:'Amboqia';src:url('${AMBOQIA}') format('opentype');font-weight:400;font-display:block;}
@font-face{font-family:'AzoSans';src:url('${AZO}') format('truetype');font-weight:500;font-display:block;}
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;position:relative;overflow:hidden;font-family:'Geist',sans-serif;}
.photo{position:absolute;left:0;right:0;top:0;height:${H-210}px;background:url('${du(P('02.jpg'))}') center 58%/cover no-repeat;}
.grade{position:absolute;left:0;right:0;top:0;height:${H-210}px;background:linear-gradient(180deg,rgba(16,39,66,0.34) 0%,rgba(16,39,66,0) 26%,rgba(16,39,66,0) 46%,rgba(16,39,66,0.66) 78%,rgba(16,39,66,0.94) 100%);}
.logo{position:absolute;top:34px;right:40px;height:56px;}
.block{position:absolute;left:54px;right:54px;top:${H-210-260}px;}
.kick{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${CREAM};font-size:17px;margin-bottom:14px;}
.addr{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:76px;line-height:1.0;letter-spacing:-0.01em;}
.addr2{color:rgba(250,248,244,0.9);font-size:24px;margin-top:8px;}
.stats{font-weight:600;color:${CREAM};font-size:32px;margin-top:18px;font-variant-numeric:tabular-nums;}
.bar{position:absolute;left:0;right:0;bottom:0;height:210px;background:${NAVY};display:flex;align-items:center;padding:0 48px;gap:26px;}
.bar img.h{width:130px;height:130px;border-radius:50%;object-fit:cover;object-position:center top;}
.bar .who .n{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:34px;line-height:1.05;}
.bar .who .r{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:rgba(250,248,244,0.7);font-size:14px;margin-top:6px;}
.bar .c{margin-left:auto;text-align:right;color:${CREAM};font-weight:600;font-size:26px;line-height:1.5;font-variant-numeric:tabular-nums;}
`;
const html=`<!doctype html><html><head><meta charset="utf-8"><style>${HEAD}</style></head><body>
<div class="photo"></div><div class="grade"></div><img class="logo" src="${LOGO_WHITE}">
<div class="block"><div class="kick">Just Listed · Redmond</div><div class="addr">${F.addr1}</div>
<div class="addr2">${F.addr2} · ${F.sub}</div><div class="stats">${F.price} · ${F.beds} bd · ${F.baths} ba · ${F.sqft} sqft</div></div>
<div class="bar"><img class="h" src="${MATT}"><div class="who"><div class="n">Matt Ryan</div><div class="r">Ryan Realty · Principal Broker</div></div>
<div class="c">541.213.6706<br>ryan-realty.com</div></div>
</body></html>`;
const b=await chromium.launch();
try{
  const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
  await page.setContent(html,{waitUntil:'networkidle'});
  await page.evaluate(()=>(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve());
  await page.waitForTimeout(350);
  await page.screenshot({path:resolve(OUT,'flyer.png')});
  await page.close();
  console.log('flyer.png done');
} finally { await b.close(); }
