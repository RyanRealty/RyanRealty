import pkg from '../node_modules/@playwright/test/index.js';
const { chromium } = pkg;

const FREEZE = `
*, *::before, *::after {
  animation: none !important;
  transition: none !important;
}
`;

const url = 'http://localhost:8097/homepage-film/';

// Desktop 1440
{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await p.addStyleTag({ content: FREEZE });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'out/concept-film-desktop.png', fullPage: true });
  await b.close();
  console.log('desktop done');
}

// Mobile 390
{
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await p.addStyleTag({ content: FREEZE });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'out/concept-film-mobile.png', fullPage: true });
  await b.close();
  console.log('mobile done');
}

console.log('screenshots saved to out/concept-film-*.png');
