import { chromium } from '@playwright/test';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
const ROOT = '/Users/matthewryan/RyanRealty/design_system/ryan-realty';
const OUT = '/Users/matthewryan/RyanRealty/design_system/ryan-realty/ui_kits/out';
const MIME = { '.html':'text/html','.jpg':'image/jpeg','.png':'image/png','.otf':'font/otf' };
const server = createServer(async (req,res)=>{ try{ const p=join(ROOT,decodeURIComponent(req.url.split('?')[0])); const d=await readFile(p); res.writeHead(200,{'content-type':MIME[extname(p)]||'application/octet-stream'}); res.end(d);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(8125,r));
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:8125/ui_kits/homepage-v4/index.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(2600);
// ticker area (just below hero)
await p.evaluate(() => window.scrollTo(0, document.querySelector('.ticker').offsetTop - 180));
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/concept-v4-ticker.png` });
// reading again
await p.evaluate(() => { const r = document.getElementById('reading'); window.scrollTo(0, r.offsetTop + (r.offsetHeight - innerHeight) * 0.6); });
await p.waitForTimeout(1100);
await p.screenshot({ path: `${OUT}/concept-v4-reading.png` });
// film
await p.evaluate(() => document.querySelector('.film').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(1100);
await p.screenshot({ path: `${OUT}/concept-v4-film.png` });
// closer
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1100);
await p.screenshot({ path: `${OUT}/concept-v4-closer.png` });
await p.close();
// mobile hero + reading + ledger
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
await m.goto('http://127.0.0.1:8125/ui_kits/homepage-v4/index.html', { waitUntil: 'networkidle' });
await m.waitForTimeout(3000);
await m.screenshot({ path: `${OUT}/concept-v4-mobile-hero.png` });
await m.evaluate(() => { const r = document.getElementById('reading'); window.scrollTo(0, r.offsetTop + (r.offsetHeight - innerHeight) * 0.6); });
await m.waitForTimeout(1100);
await m.screenshot({ path: `${OUT}/concept-v4-mobile-reading.png` });
await m.evaluate(() => document.getElementById('ledger').scrollIntoView());
await m.waitForTimeout(900);
await m.screenshot({ path: `${OUT}/concept-v4-mobile-ledger.png` });
await m.close();
await b.close(); server.close();
console.log('done');
