import { chromium } from '@playwright/test';

const OUT_DIR = '/Users/matthewryan/RyanRealty/design_system/ryan-realty/ui_kits/out';
const URL = 'http://127.0.0.1:8098/homepage-magazine/index.html';

const FREEZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    animation-duration: 0s !important;
    transition-duration: 0s !important;
    animation-delay: 0s !important;
  }
`;

async function shot(page, path, label) {
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.waitForTimeout(2000);
  await page.screenshot({ path, fullPage: true });
  console.log(`✓ ${label}: ${path}`);
}

const b = await chromium.launch({ headless: true });

// Desktop 1440
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p, `${OUT_DIR}/concept-magazine-desktop.png`, 'desktop 1440');
  await p.close();
}

// Mobile 390
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await shot(p, `${OUT_DIR}/concept-magazine-mobile.png`, 'mobile 390');
  await p.close();
}

await b.close();
console.log('All screenshots done.');
