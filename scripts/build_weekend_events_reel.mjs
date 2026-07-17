#!/usr/bin/env node
/**
 * build_weekend_events_reel.mjs
 *
 * Vertical 9:16 (1080x1920) Reel version of the weekend-events carousel.
 * Same verified events + same photos, re-laid-out for Reels: all text inside the
 * working safe zone (x 90-990, y 280-1480), no chrome in the platform avoid zones
 * (top 0-280 profile pill, bottom 1480-1920 caption/engagement UI). Brand is
 * reserved for the end card ("the logo is a closer, not an opener").
 *
 * Output: out/carousel/weekend-events-2026-07-17/reel-slide-01.png ... reel-slide-10.png
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'out/carousel/weekend-events-2026-07-17');
mkdirSync(OUT, { recursive: true });

const W = 1080, H = 1920, NAVY = '#102742';

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

// same photos + copy as the approved carousel (band photos on concert slides)
const SLIDES = [
  { type:'cover', photo:'public/asset-library/photos/curated/4842585b-9ae7-431f-b8e4-7c9dfefa8882.JPG', pos:'center 45%',
    kicker:"WHAT'S ON THIS WEEKEND", title:'This weekend in\nCentral Oregon',
    deck:'Concerts, farmers markets, and a mountain race. Friday to Sunday.', date:'JULY 17 · 18 · 19' },
  { type:'event', photo:'out/carousel/weekend-events-2026-07-17/band-photos/jew_southside.jpg', pos:'center 28%',
    kicker:'FRIDAY · JULY 17', name:'Jimmy Eat World', detail:'Hayden Homes Amphitheater · 4:30 pm',
    line:'The alt-rock headliner brings Motion City Soundtrack and Illuminati Hotties.' },
  { type:'event', photo:'public/asset-library/photos/unsplash/fc74fcc1-be7a-45d3-8bd4-c080d88e977b.jpg', pos:'center 55%',
    kicker:'FRIDAY · JULY 17', name:'Friday Night Races', detail:'Mt. Bachelor · 3:30 pm',
    line:'Downhill mountain bike races run the mountain. One of six nights this summer.' },
  { type:'event', photo:'public/asset-library/photos/curated/34a02608-2c6a-4972-8c22-10f4101ca54d.JPG', pos:'center center',
    kicker:'FRIDAY · JULY 17', name:'Redmond Farmers Market', detail:'Centennial Park · 3 to 7 pm',
    line:'Local produce and prepared foods in downtown Redmond.' },
  { type:'event', photo:'public/asset-library/photos/curated/6ae94ec1-fd80-4a94-8b7c-041093262318.JPG', pos:'center center',
    kicker:'SATURDAY · JULY 18', name:'NorthWest Crossing\nFarmers Market', detail:"Bend's westside · 10 am to 2 pm",
    line:'Produce, local makers, and food on the westside.' },
  { type:'event', photo:'out/carousel/weekend-events-2026-07-17/band-photos/levity_press.jpg', pos:'center 34%',
    kicker:'SATURDAY · JULY 18', name:'Levity & Tape B', detail:'Hayden Homes Amphitheater · 4:30 pm',
    line:'Electronic and bass acts co-headline, with Canabliss opening.' },
  { type:'event', photo:'public/asset-library/photos/unsplash/0a37e880-6b0c-4274-b765-5412fb539fe6.jpg', pos:'center 42%',
    kicker:'SATURDAY · JULY 18', name:'Camp Clay Summer Market', detail:'NE Olney Ave · 10 am to 5 pm',
    line:'Ceramic artists and makers sell their work, with live music.' },
  { type:'event', photo:'out/carousel/weekend-events-2026-07-17/band-photos/eric_vertical.jpg', pos:'center 26%',
    kicker:'SATURDAY · JULY 18', name:'Eric Leadbetter Band', detail:'Worthy Brewing · 7 pm',
    line:'Original songs live at the Worthy Brewing main pub.' },
  { type:'event', photo:'public/asset-library/photos/curated/cc841602-2edc-4aee-8433-a65c114d6908.JPG', pos:'center 58%',
    kicker:'SUNDAY · JULY 19', name:'Sisters Farmers Market', detail:'Fir Street Park · 10 am to 2 pm',
    line:'More than forty vendors with produce and local goods in Sisters.' },
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
.grade{position:absolute;inset:0;background:linear-gradient(180deg, rgba(16,39,66,0.30) 0%, rgba(16,39,66,0.00) 22%, rgba(16,39,66,0.00) 40%, rgba(16,39,66,0.55) 66%, rgba(16,39,66,0.92) 88%, rgba(16,39,66,0.96) 100%);}
/* event info block: sits in the lower safe zone, terminates above y=1480 avoid line */
.block{position:absolute;left:90px;right:90px;bottom:470px;}
.kicker{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.17em;color:#faf8f4;font-size:19px;margin-bottom:18px;opacity:0.95;}
.name{font-family:'Amboqia','Playfair Display',Georgia,serif;color:#faf8f4;line-height:1.02;letter-spacing:-0.005em;}
.detail{font-family:'Geist',system-ui,sans-serif;font-weight:600;color:#faf8f4;font-size:32px;font-variant-numeric:tabular-nums;margin-top:22px;}
.line{font-family:'Geist',system-ui,sans-serif;font-weight:400;color:rgba(250,248,244,0.92);font-size:27px;line-height:1.42;margin-top:14px;max-width:860px;}
/* cover: centered in safe zone */
.cov{position:absolute;left:90px;right:90px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;}
.cov-k{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.18em;color:#faf8f4;font-size:20px;margin-bottom:22px;}
.cov-title{font-family:'Amboqia','Playfair Display',Georgia,serif;color:#faf8f4;font-size:104px;line-height:1.0;letter-spacing:-0.01em;}
.cov-deck{font-family:'Geist',system-ui,sans-serif;font-weight:400;color:rgba(250,248,244,0.92);font-size:30px;line-height:1.45;margin-top:26px;max-width:840px;}
.cov-date{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.2em;color:#faf8f4;font-size:22px;margin-top:32px;font-variant-numeric:tabular-nums;}
/* cta */
.cta{position:absolute;inset:0;background:${NAVY};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 100px;}
.cta img.mascot{width:250px;height:auto;margin-bottom:40px;}
.cta .big{font-family:'Amboqia','Playfair Display',Georgia,serif;color:#faf8f4;font-size:70px;line-height:1.06;letter-spacing:-0.005em;}
.cta .sub{font-family:'Geist',system-ui,sans-serif;font-weight:400;color:rgba(250,248,244,0.88);font-size:30px;line-height:1.5;margin-top:28px;max-width:780px;}
.cta .contact{font-family:'Geist',system-ui,sans-serif;font-weight:600;color:#faf8f4;font-size:32px;margin-top:36px;font-variant-numeric:tabular-nums;}
.cta .tag{font-family:'AzoSans','Geist',sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:0.22em;color:rgba(250,248,244,0.7);font-size:17px;margin-top:30px;}
`;
const nl = (s)=> (s||'').replace(/\n/g,'<br>');

function coverHTML(s){
  return `<div class="slide"><div class="photo" style="background-image:url('${du(s.photo)}');background-position:${s.pos};"></div><div class="grade"></div>
    <div class="cov"><div class="cov-k">${s.kicker}</div><div class="cov-title">${nl(s.title)}</div><div class="cov-deck">${s.deck}</div><div class="cov-date">${s.date}</div></div></div>`;
}
function eventHTML(s){
  const plain=s.name.replace(/\n/g,' ');
  const size = plain.length>22?74:plain.length>16?84:92;
  return `<div class="slide"><div class="photo" style="background-image:url('${du(s.photo)}');background-position:${s.pos};"></div><div class="grade"></div>
    <div class="block"><div class="kicker">${s.kicker}</div><div class="name" style="font-size:${size}px">${nl(s.name)}</div><div class="detail">${s.detail}</div><div class="line">${s.line}</div></div></div>`;
}
function ctaHTML(){
  return `<div class="cta"><img class="mascot" src="${MASCOT}" alt="">
    <div class="big">Every weekend<br>looks like this.</div>
    <div class="sub">Thinking about a move to Central Oregon? We're local, and we answer.</div>
    <div class="contact">541.213.6706 · ryan-realty.com</div>
    <div class="tag">Ryan Realty · Bend, Oregon</div></div>`;
}

async function main(){
  const browser=await chromium.launch();
  try{
    for(let idx=0;idx<SLIDES.length;idx++){
      const s=SLIDES[idx];
      const body = s.type==='cover'?coverHTML(s):s.type==='cta'?ctaHTML():eventHTML(s);
      const html=`<!doctype html><html><head><meta charset="utf-8"><style>${HEAD}</style></head><body>${body}</body></html>`;
      const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
      await page.setContent(html,{waitUntil:'networkidle'});
      await page.evaluate(()=> (document.fonts&&document.fonts.ready)?document.fonts.ready:Promise.resolve());
      await page.waitForTimeout(400);
      const out=resolve(OUT,`reel-slide-${String(idx+1).padStart(2,'0')}.png`);
      await page.screenshot({path:out,fullPage:false});
      await page.close();
      console.log(`  reel slide ${idx+1}/${TOTAL} (${s.type})`);
    }
  } finally { await browser.close(); }
  console.log('Done.');
}
main().catch(e=>{console.error('FAILED:',e.message);process.exit(2);});
