/**
 * Screenshot script: city pages (local dev + production BEFORE)
 * Usage: node scripts/_shot-cities.mjs
 */
import { chromium } from '@playwright/test';

const ANIMATIONS_OFF = '*, *::before, *::after { animation: none !important; transition: none !important; }';
const LOCAL = 'http://localhost:3014';
const PROD = 'https://ryanrealty.vercel.app';

async function shot(page, url, path, { fullPage = true } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.addStyleTag({ content: ANIMATIONS_OFF });
  await page.waitForTimeout(2000);
  await page.screenshot({ path, fullPage });
  console.log(`screenshot: ${path}`);
}

const browser = await chromium.launch();

// Desktop 1440
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await shot(desktop, `${LOCAL}/cities/bend`, 'out/cities-bend-desktop.png');
await shot(desktop, `${LOCAL}/cities/redmond`, 'out/cities-redmond-desktop.png');
await shot(desktop, `${LOCAL}/cities`, 'out/cities-index-desktop.png');

// Mobile 390
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await shot(mobile, `${LOCAL}/cities/bend`, 'out/cities-bend-mobile.png');
await shot(mobile, `${LOCAL}/cities`, 'out/cities-index-mobile.png');

// Production BEFORE shot
try {
  await shot(desktop, `${PROD}/cities/bend`, 'out/cities-bend-BEFORE.png');
} catch (e) {
  console.log(`Prod BEFORE shot failed: ${e.message}`);
}

// Competitors
const competitors = [
  ['https://www.cascadehasson.com/bend-oregon-real-estate/', 'out/competitor-cascadehasson.png'],
  ['https://www.zillow.com/bend-or/', 'out/competitor-zillow.png'],
  ['https://www.windermere.com/listings/search#q=bend+oregon', 'out/competitor-windermere.png'],
];
for (const [url, path] of competitors) {
  try {
    await shot(desktop, url, path);
  } catch (e) {
    console.log(`Competitor shot failed (${url}): ${e.message}`);
  }
}

await browser.close();
console.log('All screenshots done.');
