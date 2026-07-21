#!/usr/bin/env node
/**
 * build_3480_animated_carousel.mjs — ALL 10 carousel slides as seamless-loop
 * MP4s (2s each, 1080x1350). Each photo/cover slide has a subtle Ken Burns
 * "breathing" zoom + animated swipe chevrons; details has animated navy
 * chevrons; CTA is a clean hold. Post as an all-video carousel.
 * Figures trace to Supabase listings (ListingKey 20260708114552589824000000).
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname,'..');
const OUT = resolve(ROOT,'out/listing/3480-sw-45th-redmond');
const P = (n)=>resolve(OUT,`photos/${n}`);
const FFMPEG = process.env.HOME+'/.local/bin/ffmpeg';
const W=1080,H=1350,FOOTER=120,NAVY='#102742',CREAM='#faf8f4';
const FPS=30, NFR=60; // 2s seamless loop
function du(a){ if(!existsSync(a))throw new Error('missing '+a); const e=a.split('.').pop().toLowerCase(); const m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',otf:'font/otf',ttf:'font/ttf'}[e]||'application/octet-stream'; return `data:${m};base64,${readFileSync(a).toString('base64')}`; }
const AMBOQIA=du(resolve(ROOT,'design_system/ryan-realty/fonts/Amboqia_Boriango.otf'));
const AZO=du(resolve(ROOT,'design_system/ryan-realty/fonts/AzoSans-Medium.ttf'));
const LOGO=du(resolve(ROOT,'design_system/ryan-realty/assets/brand/logo-white.png'));
const MATT=du(resolve(ROOT,'design_system/ryan-realty/assets/team/matt-ryan.png'));
const F={addr1:'3480 SW 45th St',addr2:'Redmond, Oregon',price:'$655,000',beds:'3',baths:'2',sqft:'1,631',built:'2018',lot:'0.21 acre',sub:'Forked Horn Butte',ppsf:'$402/sqft'};
const SLIDES=[
  {type:'cover',photo:'02.jpg',pos:'center 60%'},
  {type:'photo',photo:'17.jpg',pos:'center center'},
  {type:'photo',photo:'24.jpg',pos:'center center'},
  {type:'photo',photo:'20.jpg',pos:'center center'},
  {type:'photo',photo:'30.jpg',pos:'center 45%'},
  {type:'photo',photo:'31.jpg',pos:'center center'},
  {type:'photo',photo:'33.jpg',pos:'center center'},
  {type:'photo',photo:'13.jpg',pos:'center 55%'},
  {type:'details'},
  {type:'cta'},
];
const TOTAL=SLIDES.length;
const CSS=`
@font-face{font-family:'Amboqia';src:url('${AMBOQIA}') format('opentype');font-weight:400;font-display:block;}
@font-face{font-family:'AzoSans';src:url('${AZO}') format('truetype');font-weight:500;font-display:block;}
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${NAVY};}
.photo{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;will-change:transform;transform-origin:center center;}
.cover-grade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,0.30) 0%,rgba(16,39,66,0) 24%,rgba(16,39,66,0) 44%,rgba(16,39,66,0.62) 72%,rgba(16,39,66,0.95) 100%);}
.footer{position:absolute;bottom:0;left:0;right:0;height:${FOOTER}px;background:rgba(16,39,66,0.94);display:flex;align-items:center;justify-content:space-between;padding:0 40px;z-index:6;}
.footer img{height:42px;} .num{font-family:'Geist',sans-serif;font-size:18px;font-weight:500;color:${CREAM};font-variant-numeric:tabular-nums;}
.cblock{position:absolute;left:54px;right:54px;bottom:${FOOTER+44}px;z-index:4;}
.kick{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${CREAM};font-size:17px;margin-bottom:16px;}
.addr{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:72px;line-height:1.0;letter-spacing:-0.01em;}
.addr2{font-family:'Geist',sans-serif;color:rgba(250,248,244,0.9);font-size:24px;margin-top:8px;}
.stats{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:30px;margin-top:20px;font-variant-numeric:tabular-nums;}
.feat{font-family:'Geist',sans-serif;color:rgba(250,248,244,0.9);font-size:21px;margin-top:10px;}
.det{position:absolute;inset:0;background:${CREAM};padding:96px 72px ${FOOTER+64}px;display:flex;flex-direction:column;}
.det .k{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${NAVY};font-size:16px;margin-bottom:18px;}
.det .price{font-family:'Amboqia','Playfair Display',serif;color:${NAVY};font-size:104px;line-height:0.98;font-variant-numeric:tabular-nums;}
.det .row{font-family:'Geist',sans-serif;font-weight:600;color:${NAVY};font-size:34px;margin-top:14px;font-variant-numeric:tabular-nums;}
.det .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px 40px;margin-top:44px;}
.det .lab{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:rgba(16,39,66,0.55);font-size:14px;}
.det .val{font-family:'Geist',sans-serif;font-weight:600;color:${NAVY};font-size:26px;margin-top:4px;font-variant-numeric:tabular-nums;}
.det .blurb{font-family:'Geist',sans-serif;color:rgba(16,39,66,0.82);font-size:23px;line-height:1.5;margin-top:auto;}
.cta{position:absolute;inset:0;background:${NAVY};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 80px;}
.cta img.logo{width:200px;margin-bottom:20px;} .cta img.head{width:200px;margin:6px 0 8px;}
.cta .tag{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:42px;line-height:1.08;margin-top:6px;}
.cta .by{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.16em;color:rgba(250,248,244,0.75);font-size:15px;margin-top:22px;}
.cta .contact{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:24px;margin-top:14px;font-variant-numeric:tabular-nums;}
.swipe{position:absolute;right:30px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:5;}
.swipe.dark .chevs span, .swipe.dark .lab{color:${NAVY};text-shadow:none;}
.swipe .chevs{display:flex;align-items:center;}
.swipe .chevs span{font-family:'Geist',sans-serif;font-weight:700;font-size:40px;line-height:1;color:${CREAM};margin-left:-10px;text-shadow:0 2px 12px rgba(0,0,0,0.65);}
.swipe .lab{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.18em;font-size:13px;color:${CREAM};text-shadow:0 2px 10px rgba(0,0,0,0.7);}
`;
const swipe=(dark=false)=>`<div class="swipe${dark?' dark':''}" id="sw"><div class="chevs"><span id="c0">›</span><span id="c1">›</span><span id="c2">›</span></div><div class="lab">Swipe</div></div>`;
const footer=(i)=>`<div class="footer"><img src="${LOGO}"><span class="num">${i} / ${TOTAL}</span></div>`;

function slideHTML(s,i){
  let body;
  if(s.type==='cover') body=`<div class="photo" id="ph" style="background-image:url('${du(P(s.photo))}');background-position:${s.pos};"></div><div class="cover-grade"></div>
    <div class="cblock"><div class="kick">Just Listed · Redmond</div><div class="addr">${F.addr1}</div><div class="addr2">${F.addr2}</div>
    <div class="stats">${F.price} · ${F.beds} bd · ${F.baths} ba · ${F.sqft} sqft</div><div class="feat">${F.sub} · Cascade Mountain views</div></div>${swipe()}${footer(i)}`;
  else if(s.type==='photo') body=`<div class="photo" id="ph" style="background-image:url('${du(P(s.photo))}');background-position:${s.pos};"></div>${swipe()}${footer(i)}`;
  else if(s.type==='details') body=`<div class="det"><div class="k">The details</div><div class="price">${F.price}</div>
    <div class="row">${F.beds} beds · ${F.baths} baths · ${F.sqft} sqft</div>
    <div class="grid"><div><div class="lab">Year built</div><div class="val">${F.built}</div></div><div><div class="lab">Lot size</div><div class="val">${F.lot}</div></div>
    <div><div class="lab">Neighborhood</div><div class="val">${F.sub}</div></div><div><div class="lab">Price per sqft</div><div class="val">${F.ppsf}</div></div></div>
    <div class="blurb">A contemporary home in Redmond with an open great room, vaulted ceilings, a stone gas fireplace, and Cascade Mountain views from the primary suite and back deck.</div></div>${swipe(true)}${footer(i)}`;
  else body=`<div class="cta"><img class="logo" src="${LOGO}"><img class="head" src="${MATT}"><div class="tag">Call today for your<br>private showing.</div>
    <div class="by">Listed by Matt Ryan · Ryan Realty</div><div class="contact">541.213.6706 · ryan-realty.com</div></div>${footer(i)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
}

async function main(){
  const b=await chromium.launch();
  const tmp=resolve(OUT,'_ac_frames');
  try{
    for(let idx=0;idx<SLIDES.length;idx++){
      const s=SLIDES[idx], i=idx+1;
      mkdirSync(tmp,{recursive:true});
      const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
      await page.setContent(slideHTML(s,i),{waitUntil:'networkidle'});
      await page.evaluate(()=>(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve());
      await page.waitForTimeout(300);
      const hasPhoto = s.type==='cover'||s.type==='photo';
      const hasSwipe = s.type!=='cta';
      for(let f=0;f<NFR;f++){
        const p=f/NFR;
        await page.evaluate(({p,hasPhoto,hasSwipe})=>{
          if(hasPhoto){ const z=1+0.03*(0.5-0.5*Math.cos(2*Math.PI*p)); const ph=document.getElementById('ph'); if(ph) ph.style.transform='scale('+z.toFixed(4)+')'; }
          if(hasSwipe){ const op=(k)=>(0.34+0.66*(0.5+0.5*Math.sin(2*Math.PI*(p-k/3)))); const bob=(6*Math.sin(2*Math.PI*p)); for(let k=0;k<3;k++){const el=document.getElementById('c'+k); if(el) el.style.opacity=op(k).toFixed(3);} const sw=document.getElementById('sw'); if(sw) sw.style.transform='translateY(-50%) translateX('+bob.toFixed(2)+'px)'; }
        },{p,hasPhoto,hasSwipe});
        await page.screenshot({path:resolve(tmp,`f${String(f).padStart(3,'0')}.png`)});
      }
      await page.close();
      const out=resolve(OUT,`carousel-${String(i).padStart(2,'0')}-animated.mp4`);
      execFileSync(FFMPEG,['-y','-loglevel','error','-framerate',String(FPS),'-i',resolve(tmp,'f%03d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-profile:v','high','-crf','20','-movflags','+faststart',out],{stdio:'inherit'});
      rmSync(tmp,{recursive:true,force:true});
      console.log(`  slide ${i}/${TOTAL} (${s.type}) -> ${out.split('/').pop()}`);
    }
  } finally { await b.close(); rmSync(tmp,{recursive:true,force:true}); }
  console.log('Done.');
}
main().catch(e=>{console.error('FAILED:',e.message);process.exit(2);});
