import { chromium } from '@playwright/test';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';

const ROOT = '/Users/matthewryan/RyanRealty/design_system/ryan-realty';
const OUT_DIR = '/Users/matthewryan/RyanRealty/design_system/ryan-realty/ui_kits/out';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf', '.webp': 'image/webp', '.JPG': 'image/jpeg' };

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    const data = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(8123, r));

const URL = 'http://127.0.0.1:8123/ui_kits/homepage-v4/index.html';
const b = await chromium.launch({ headless: true });

// Desktop full page (animations settled)
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(2800);
  // freeze animations for clean fullpage capture, force reveals visible
  await p.addStyleTag({ content: `*,*::before,*::after{animation-play-state:paused!important;transition:none!important} .reveal{opacity:1!important;transform:none!important} .hero-live,.hero-count,.hero-sub,.hero-aside{opacity:1!important;transform:none!important}` });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT_DIR}/concept-v4-desktop-full.png`, fullPage: true });
  console.log('✓ desktop full');
  await p.close();
}
// Desktop hero viewport (live, after count-up)
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(3200);
  await p.screenshot({ path: `${OUT_DIR}/concept-v4-hero.png` });
  console.log('✓ hero viewport');
  // reading step 3 (months of supply)
  await p.evaluate(() => {
    const r = document.getElementById('reading');
    window.scrollTo(0, r.offsetTop + (r.offsetHeight - innerHeight) * 0.6);
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT_DIR}/concept-v4-reading.png` });
  console.log('✓ reading stage');
  // ledger with hover on Tetherow
  await p.evaluate(() => document.getElementById('ledger').scrollIntoView());
  await p.waitForTimeout(900);
  await p.hover('.ledger-row[data-img="4"]');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT_DIR}/concept-v4-ledger.png` });
  console.log('✓ ledger hover');
  await p.close();
}
// Mobile 390 full
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(2800);
  await p.addStyleTag({ content: `*,*::before,*::after{animation-play-state:paused!important;transition:none!important} .reveal{opacity:1!important;transform:none!important} .hero-live,.hero-count,.hero-sub,.hero-aside{opacity:1!important;transform:none!important}` });
  await p.waitForTimeout(400);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log('mobile horizontal overflow:', overflow);
  await p.screenshot({ path: `${OUT_DIR}/concept-v4-mobile-full.png`, fullPage: true });
  console.log('✓ mobile full');
  await p.close();
}
await b.close();
server.close();
console.log('done');
