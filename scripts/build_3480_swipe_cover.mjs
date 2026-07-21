#!/usr/bin/env node
/**
 * build_3480_swipe_cover.mjs — animated cover (carousel slide 1 as a seamless
 * ~2.4s loop MP4) where the swipe chevrons pulse left->right and gently bob.
 * Post this as the FIRST carousel item (video) with slides 2-10 as stills, so
 * the swipe arrows actually move. Renders frames -> ffmpeg loop.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname,'..');
const OUT = resolve(ROOT,'out/listing/3480-sw-45th-redmond');
const FR = resolve(OUT,'_swipe_frames');
mkdirSync(FR,{recursive:true});
const W=1080,H=1350,NAVY='#102742',CREAM='#faf8f4';
function du(a){ const e=a.split('.').pop().toLowerCase(); const m={jpg:'image/jpeg',png:'image/png',otf:'font/otf',ttf:'font/ttf'}[e]||'application/octet-stream'; return `data:${m};base64,${readFileSync(a).toString('base64')}`; }
const AMBOQIA=du(resolve(ROOT,'design_system/ryan-realty/fonts/Amboqia_Boriango.otf'));
const AZO=du(resolve(ROOT,'design_system/ryan-realty/fonts/AzoSans-Medium.ttf'));
const LOGO=du(resolve(ROOT,'design_system/ryan-realty/assets/brand/logo-white.png'));
const PHOTO=du(resolve(OUT,'photos/02.jpg'));
const F={addr1:'3480 SW 45th St',addr2:'Redmond, Oregon',price:'$655,000',beds:'3',baths:'2',sqft:'1,631',sub:'Forked Horn Butte'};
const FOOTER=120, FPS=30, NFR=72; // 2.4s seamless loop
const CSS=`
@font-face{font-family:'Amboqia';src:url('${AMBOQIA}') format('opentype');font-weight:400;font-display:block;}
@font-face{font-family:'AzoSans';src:url('${AZO}') format('truetype');font-weight:500;font-display:block;}
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${NAVY};}
.photo{position:absolute;inset:0;background:url('${PHOTO}') center 60%/cover no-repeat;}
.grade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,0.30) 0%,rgba(16,39,66,0) 24%,rgba(16,39,66,0) 44%,rgba(16,39,66,0.62) 72%,rgba(16,39,66,0.95) 100%);}
.footer{position:absolute;bottom:0;left:0;right:0;height:${FOOTER}px;background:rgba(16,39,66,0.94);display:flex;align-items:center;justify-content:space-between;padding:0 40px;}
.footer img{height:42px;} .num{font-family:'Geist',sans-serif;font-size:18px;font-weight:500;color:${CREAM};font-variant-numeric:tabular-nums;}
.cblock{position:absolute;left:54px;right:54px;bottom:${FOOTER+44}px;}
.kick{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${CREAM};font-size:17px;margin-bottom:16px;}
.addr{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:72px;line-height:1.0;letter-spacing:-0.01em;}
.addr2{font-family:'Geist',sans-serif;color:rgba(250,248,244,0.9);font-size:24px;margin-top:8px;}
.stats{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:30px;margin-top:20px;font-variant-numeric:tabular-nums;}
.feat{font-family:'Geist',sans-serif;color:rgba(250,248,244,0.9);font-size:21px;margin-top:10px;}
.swipe{position:absolute;right:30px;top:50%;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:5;}
.swipe .chevs{display:flex;align-items:center;}
.swipe .chevs span{font-family:'Geist',sans-serif;font-weight:700;font-size:40px;line-height:1;color:${CREAM};margin-left:-10px;text-shadow:0 2px 12px rgba(0,0,0,0.65);}
.swipe .lab{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;color:${CREAM};text-shadow:0 2px 10px rgba(0,0,0,0.7);}
`;
function frameHTML(p){ // p in [0,1)
  // brightness wave sweeping right; gentle horizontal bob
  const op=(k)=> (0.34 + 0.66*(0.5+0.5*Math.sin(2*Math.PI*(p - k/3)))).toFixed(3);
  const bob=(6*Math.sin(2*Math.PI*p)).toFixed(2);
  const chev=[0,1,2].map(k=>`<span style="opacity:${op(k)}">›</span>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
  <div class="photo"></div><div class="grade"></div>
  <div class="cblock"><div class="kick">Just Listed · Redmond</div><div class="addr">${F.addr1}</div><div class="addr2">${F.addr2}</div>
  <div class="stats">${F.price} · ${F.beds} bd · ${F.baths} ba · ${F.sqft} sqft</div><div class="feat">${F.sub} · Cascade Mountain views</div></div>
  <div class="swipe" style="transform:translateY(-50%) translateX(${bob}px)"><div class="chevs">${chev}</div><div class="lab">Swipe</div></div>
  <div class="footer"><img src="${LOGO}"><span class="num">1 / 10</span></div></body></html>`;
}
const b=await chromium.launch();
try{
  const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
  for(let f=0;f<NFR;f++){
    await page.setContent(frameHTML(f/NFR),{waitUntil:'networkidle'});
    await page.evaluate(()=>(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve());
    if(f===0) await page.waitForTimeout(300);
    await page.screenshot({path:resolve(FR,`f${String(f).padStart(3,'0')}.png`)});
  }
  await page.close();
} finally { await b.close(); }
execFileSync(process.env.HOME+'/.local/bin/ffmpeg',['-y','-loglevel','error','-framerate',String(FPS),'-i',resolve(FR,'f%03d.png'),
  '-c:v','libx264','-pix_fmt','yuv420p','-profile:v','high','-crf','20','-movflags','+faststart',resolve(OUT,'carousel-01-animated.mp4')],{stdio:'inherit'});
rmSync(FR,{recursive:true,force:true});
console.log('Wrote carousel-01-animated.mp4');
