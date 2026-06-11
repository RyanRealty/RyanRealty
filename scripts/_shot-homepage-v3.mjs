import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://127.0.0.1:8094/homepage-v3/index.html', { waitUntil: 'networkidle' });
await p.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'out/homepage-v3-desktop-realmap.png', fullPage: true });
await b.close();
console.log('shot done');
