#!/usr/bin/env node
/**
 * build_3480_reel_v2.mjs — vertical listing reel with LAYER-SEPARATED motion.
 * Only the PHOTO layer moves; text/overlays are a fixed layer that never scales.
 * Each photo gets a distinct, eased camera move (varied push/pan/tilt, no two
 * neighbours alike) instead of the generic center Ken Burns. Renders per-slide
 * clips then xfade-concats. Figures trace to Supabase listings.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname,'..');
const OUT = resolve(ROOT,'out/listing/3480-sw-45th-redmond');
const P=(n)=>resolve(OUT,`photos/${n}`);
const FFMPEG=process.env.HOME+'/.local/bin/ffmpeg';
const W=1080,H=1920,NAVY='#102742',CREAM='#faf8f4';
const FPS=30, SECS=4.5, NFR=Math.round(FPS*SECS), XF=0.6;
function du(a){ if(!existsSync(a))throw new Error('missing '+a); const e=a.split('.').pop().toLowerCase(); const m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',otf:'font/otf',ttf:'font/ttf'}[e]||'application/octet-stream'; return `data:${m};base64,${readFileSync(a).toString('base64')}`; }
const AMBOQIA=du(resolve(ROOT,'design_system/ryan-realty/fonts/Amboqia_Boriango.otf'));
const AZO=du(resolve(ROOT,'design_system/ryan-realty/fonts/AzoSans-Medium.ttf'));
const LOGO=du(resolve(ROOT,'design_system/ryan-realty/assets/brand/logo-white.png'));
const MATT=du(resolve(ROOT,'design_system/ryan-realty/assets/team/matt-ryan.png'));
const F={addr1:'3480 SW 45th St',addr2:'Redmond, Oregon',price:'$655,000',beds:'3',baths:'2',sqft:'1,631',built:'2018',lot:'0.21 acre',sub:'Forked Horn Butte'};

// each photo slide gets a distinct camera move (no two neighbours alike)
const SLIDES=[
  {type:'cover',photo:'02.jpg',pos:'center 60%',move:'push_in'},
  {type:'photo',photo:'17.jpg',pos:'center center',move:'pan_right'},
  {type:'photo',photo:'24.jpg',pos:'center center',move:'tilt_up'},
  {type:'photo',photo:'20.jpg',pos:'center center',move:'push_in'},
  {type:'photo',photo:'30.jpg',pos:'center 42%',move:'pan_right'},
  {type:'photo',photo:'31.jpg',pos:'center center',move:'tilt_down'},
  {type:'photo',photo:'33.jpg',pos:'center center',move:'push_out'},
  {type:'photo',photo:'13.jpg',pos:'center 55%',move:'pan_left'},
  {type:'photo',photo:'45.jpg',pos:'center center',move:'push_in'},
  {type:'stats'},{type:'cta'},
];
const CSS=`
@font-face{font-family:'Amboqia';src:url('${AMBOQIA}') format('opentype');font-weight:400;font-display:block;}
@font-face{font-family:'AzoSans';src:url('${AZO}') format('truetype');font-weight:500;font-display:block;}
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${NAVY};}
.photo{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;will-change:transform;transform-origin:center center;}
.grade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,0.34) 0%,rgba(16,39,66,0) 22%,rgba(16,39,66,0) 42%,rgba(16,39,66,0.6) 70%,rgba(16,39,66,0.95) 100%);}
.cblock{position:absolute;left:90px;right:90px;bottom:470px;}
.kick{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:${CREAM};font-size:20px;margin-bottom:18px;}
.addr{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:88px;line-height:1.0;letter-spacing:-0.01em;}
.addr2{font-family:'Geist',sans-serif;color:rgba(250,248,244,0.9);font-size:28px;margin-top:10px;}
.stats{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:36px;margin-top:24px;font-variant-numeric:tabular-nums;}
.feat{font-family:'Geist',sans-serif;color:rgba(250,248,244,0.9);font-size:24px;margin-top:12px;}
.sc{position:absolute;inset:0;background:${NAVY};display:flex;flex-direction:column;justify-content:center;padding:0 100px;}
.sc .k{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:rgba(250,248,244,0.7);font-size:19px;margin-bottom:20px;}
.sc .price{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:128px;line-height:0.98;font-variant-numeric:tabular-nums;}
.sc .row{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:40px;margin-top:16px;font-variant-numeric:tabular-nums;}
.sc .grid{margin-top:52px;display:grid;grid-template-columns:1fr 1fr;gap:34px 40px;}
.sc .lab{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.12em;color:rgba(250,248,244,0.55);font-size:16px;}
.sc .val{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:32px;margin-top:6px;font-variant-numeric:tabular-nums;}
.cta{position:absolute;inset:0;background:${NAVY};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 100px;}
.cta img.logo{width:220px;margin-bottom:26px;} .cta img.head{width:240px;margin:6px 0 10px;}
.cta .tag{font-family:'Amboqia','Playfair Display',serif;color:${CREAM};font-size:56px;line-height:1.06;margin-top:8px;}
.cta .by{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.16em;color:rgba(250,248,244,0.75);font-size:18px;margin-top:26px;}
.cta .contact{font-family:'Geist',sans-serif;font-weight:600;color:${CREAM};font-size:30px;margin-top:16px;font-variant-numeric:tabular-nums;}
`;
function slideHTML(s){
  if(s.type==='cover') return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="photo" id="ph" style="background-image:url('${du(P(s.photo))}');background-position:${s.pos};"></div><div class="grade"></div>
    <div class="cblock"><div class="kick">Just Listed · Redmond</div><div class="addr">${F.addr1}</div><div class="addr2">${F.addr2}</div>
    <div class="stats">${F.price} · ${F.beds} bd · ${F.baths} ba · ${F.sqft} sqft</div><div class="feat">${F.sub} · Cascade Mountain views</div></div></body></html>`;
  if(s.type==='photo') return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="photo" id="ph" style="background-image:url('${du(P(s.photo))}');background-position:${s.pos};"></div></body></html>`;
  if(s.type==='stats') return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="sc"><div class="k">3480 SW 45th St · Redmond</div><div class="price">${F.price}</div><div class="row">${F.beds} beds · ${F.baths} baths · ${F.sqft} sqft</div>
    <div class="grid"><div><div class="lab">Year built</div><div class="val">${F.built}</div></div><div><div class="lab">Lot</div><div class="val">${F.lot}</div></div>
    <div><div class="lab">Neighborhood</div><div class="val">${F.sub}</div></div><div><div class="lab">Views</div><div class="val">Cascade Mtns</div></div></div></div></body></html>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="cta"><img class="logo" src="${LOGO}"><img class="head" src="${MATT}"><div class="tag">Call today for your<br>private showing.</div>
    <div class="by">Listed by Matt Ryan · Ryan Realty</div><div class="contact">541.213.6706 · ryan-realty.com</div></div></body></html>`;
}
// camera move -> {scale, txPx, tyPx} at eased progress e in [0,1]
function move(kind,e){
  let scale=1.10,tx=0,ty=0;
  if(kind==='push_in') scale=1.05+0.12*e;
  else if(kind==='push_out') scale=1.17-0.12*e;
  else if(kind==='pan_right'){scale=1.12;tx=(-3+6*e);}
  else if(kind==='pan_left'){scale=1.12;tx=(3-6*e);}
  else if(kind==='tilt_down'){scale=1.12;ty=(-3+6*e);}
  else if(kind==='tilt_up'){scale=1.12;ty=(3-6*e);}
  return {scale, txPx:(tx/100)*W, tyPx:(ty/100)*H};
}

async function main(){
  const b=await chromium.launch();
  const clips=[];
  try{
    for(let idx=0;idx<SLIDES.length;idx++){
      const s=SLIDES[idx];
      const clip=resolve(OUT,`_clip_${String(idx).padStart(2,'0')}.mp4`);
      const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
      await page.setContent(slideHTML(s),{waitUntil:'networkidle'});
      await page.evaluate(()=>(document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve());
      await page.waitForTimeout(300);
      const moving = s.type==='cover'||s.type==='photo';
      if(!moving){
        // static slide -> one frame, loop to duration
        const png=resolve(OUT,`_static_${idx}.png`); await page.screenshot({path:png});
        execFileSync(FFMPEG,['-y','-loglevel','error','-loop','1','-t',String(SECS),'-i',png,'-r',String(FPS),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20',clip],{stdio:'inherit'});
        rmSync(png,{force:true});
      } else {
        const fr=resolve(OUT,`_fr_${idx}`); mkdirSync(fr,{recursive:true});
        for(let f=0;f<NFR;f++){
          const t=f/(NFR-1); const e=0.5-0.5*Math.cos(Math.PI*t); // ease in-out, completes A->B
          const {scale,txPx,tyPx}=move(s.move,e);
          await page.evaluate(({scale,txPx,tyPx})=>{const ph=document.getElementById('ph'); if(ph) ph.style.transform=`translate(${txPx.toFixed(2)}px,${tyPx.toFixed(2)}px) scale(${scale.toFixed(4)})`;},{scale,txPx,tyPx});
          await page.screenshot({path:resolve(fr,`f${String(f).padStart(3,'0')}.png`)});
        }
        execFileSync(FFMPEG,['-y','-loglevel','error','-framerate',String(FPS),'-i',resolve(fr,'f%03d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20',clip],{stdio:'inherit'});
        rmSync(fr,{recursive:true,force:true});
      }
      await page.close(); clips.push(clip);
      console.log(`  clip ${idx+1}/${SLIDES.length} (${s.type}${s.move?': '+s.move:''})`);
    }
  } finally { await b.close(); }
  // xfade-concat
  const inputs=[]; clips.forEach(c=>inputs.push('-i',c));
  let fc=''; const step=SECS-XF; let prev='[0:v]';
  for(let i=1;i<clips.length;i++){ const off=(step*i).toFixed(3); const out=(i===clips.length-1)?'[vout]':`[x${i}]`; fc+=`${prev}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${off}${out};`; prev=out; }
  fc=fc.replace(/;$/,'');
  const OUTV=resolve(OUT,'3480-listing-reel.mp4');
  execFileSync(FFMPEG,['-y','-loglevel','error',...inputs,'-filter_complex',fc,'-map','[vout]','-c:v','libx264','-pix_fmt','yuv420p','-profile:v','high','-crf','20','-preset','medium','-movflags','+faststart',OUTV],{stdio:'inherit'});
  clips.forEach(c=>rmSync(c,{force:true}));
  console.log('Wrote '+OUTV);
}
main().catch(e=>{console.error('FAILED:',e.message);process.exit(2);});
