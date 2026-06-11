/**
 * Screenshot script for /communities/tetherow review package.
 * Takes 3 local shots (animations-off desktop, mobile, live desktop)
 * and 1 production BEFORE shot.
 */
import { chromium } from '@playwright/test';

const LOCAL = 'http://localhost:3000/communities/tetherow';
const PROD  = 'https://ryan-realty.com/communities/tetherow';

const ANIMS_OFF = '*, *::before, *::after { animation: none !important; transition: none !important; }';

async function shot(page, path, fullPage = true) {
  await page.screenshot({ path, fullPage });
  console.log('  wrote', path);
}

const b = await chromium.launch({ headless: true });

// ── 1. BEFORE — production (no animations-off needed, just a reference) ──
console.log('1/4  production BEFORE shot...');
try {
  const p1 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p1.goto(PROD, { waitUntil: 'networkidle', timeout: 30_000 });
  await p1.waitForTimeout(2000);
  await shot(p1, 'out/experience-exemplar-BEFORE.png');
  await p1.close();
} catch (e) {
  console.warn('  BEFORE shot skipped (prod unreachable):', e.message);
}

// ── 2. Local desktop — animations off ──
console.log('2/4  local desktop 1440 (animations-off)...');
{
  const p2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p2.goto(LOCAL, { waitUntil: 'networkidle', timeout: 30_000 });
  await p2.addStyleTag({ content: ANIMS_OFF });
  await p2.waitForTimeout(2000);
  await shot(p2, 'out/experience-exemplar-desktop.png');
  await p2.close();
}

// ── 3. Local mobile — animations off ──
console.log('3/4  local mobile 390...');
{
  const p3 = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p3.goto(LOCAL, { waitUntil: 'networkidle', timeout: 30_000 });
  await p3.addStyleTag({ content: ANIMS_OFF });
  await p3.waitForTimeout(2000);
  await shot(p3, 'out/experience-exemplar-mobile.png');
  await p3.close();
}

// ── 4. Local desktop — live (animations running, 3s settle) ──
console.log('4/4  local desktop 1440 (live, 3s settle)...');
{
  const p4 = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p4.goto(LOCAL, { waitUntil: 'networkidle', timeout: 30_000 });
  await p4.waitForTimeout(3500);
  await shot(p4, 'out/experience-exemplar-desktop-live.png');
  await p4.close();
}

await b.close();
console.log('\nAll 4 shots done.');
